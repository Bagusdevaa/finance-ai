"""Chat business logic + streaming RAG generator.

SECURITY: setiap query untuk session/message WAJIB filter user_id.
Caller pun harus pakai get_current_user. Kalau ragu, over-filter.
"""

from collections.abc import AsyncIterator
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai import groq_client, rag_pipeline
from app.chat.models import ChatMessage, ChatRole, ChatSession
from app.core.errors import NotFoundError
from app.transactions.models import Transaction
from app.users.models import User


logger = structlog.get_logger(__name__)

# Berapa pesan history dikirim ke LLM. Jangan terlalu banyak — cost+latency.
HISTORY_WINDOW = 10
# Top-K transaksi yang di-fetch via RAG.
RAG_TOP_K = 8


# ---------- session CRUD ----------

async def create_session(
	session: AsyncSession, user: User, title: str | None = None
) -> ChatSession:
	chat = ChatSession(
		user_id=user.id,
		title=title or "Percakapan baru",
	)
	session.add(chat)
	await session.commit()
	await session.refresh(chat)
	return chat


async def list_sessions(
	session: AsyncSession, user: User, limit: int = 50
) -> list[ChatSession]:
	# last_message_at desc nulls last → fresh sessions tanpa pesan tetap di atas
	# kalau dibuat baru-baru ini (fallback ke created_at).
	stmt = (
		select(ChatSession)
		.where(
			ChatSession.user_id == user.id,
			ChatSession.deleted_at.is_(None),
		)
		.order_by(
			ChatSession.last_message_at.desc().nullslast(),
			ChatSession.created_at.desc(),
		)
		.limit(limit)
	)
	result = await session.scalars(stmt)
	return list(result.all())


async def _get_owned_session(
	session: AsyncSession, user: User, session_id: UUID, *, with_messages: bool = False
) -> ChatSession:
	stmt = select(ChatSession).where(
		ChatSession.id == session_id,
		ChatSession.user_id == user.id,
		ChatSession.deleted_at.is_(None),
	)
	if with_messages:
		stmt = stmt.options(selectinload(ChatSession.messages))
	chat = await session.scalar(stmt)
	if chat is None:
		# 404 (bukan 403) supaya tidak bocor existence session user lain.
		raise NotFoundError(
			code="CHAT_SESSION_NOT_FOUND",
			message="Chat session not found",
		)
	return chat


async def get_session_detail(
	db: AsyncSession, user: User, session_id: UUID
) -> ChatSession:
	chat = await _get_owned_session(db, user, session_id, with_messages=True)
	# Sort messages by created_at asc supaya rendering urut.
	# Filter soft-deleted di Python — biar relationship tetap intact.
	chat.messages = sorted(
		[m for m in chat.messages if m.deleted_at is None],
		key=lambda m: m.created_at,
	)
	return chat


async def delete_session(
	db: AsyncSession, user: User, session_id: UUID
) -> None:
	chat = await _get_owned_session(db, user, session_id)
	chat.deleted_at = datetime.now(timezone.utc)
	await db.commit()


# ---------- context builders ----------

async def _expense_summary(
	db: AsyncSession, user: User, days: int = 30
) -> list[dict]:
	"""SQL aggregate: pengeluaran per kategori N hari terakhir.

	SECURITY: filter user_id mandatory.
	"""
	since = date.today() - timedelta(days=days)
	stmt = (
		select(
			Transaction.category,
			func.sum(Transaction.amount).label("total"),
			func.count().label("count"),
		)
		.where(
			Transaction.user_id == user.id,
			Transaction.deleted_at.is_(None),
			Transaction.transaction_date >= since,
			Transaction.amount < 0,
		)
		.group_by(Transaction.category)
		.order_by(func.sum(Transaction.amount).asc())  # most-negative dulu
		.limit(10)
	)
	result = await db.execute(stmt)
	return [
		{
			"category": row.category or "Tanpa kategori",
			"total": float(row.total or 0),
			"count": row.count,
		}
		for row in result.all()
	]


def _format_context_block(rag_hits: list[dict], expense_summary: list[dict]) -> str:
	"""Susun plain-text context untuk system prompt."""
	parts: list[str] = []

	if expense_summary:
		parts.append("Ringkasan pengeluaran 30 hari terakhir per kategori:")
		for row in expense_summary:
			amount = abs(Decimal(str(row["total"])))
			parts.append(
				f"- {row['category']}: Rp{amount:,.0f} ({row['count']} transaksi)"
			)
		parts.append("")

	if rag_hits:
		parts.append("Transaksi relevan (top hasil pencarian semantik):")
		for h in rag_hits:
			amount = h.get("amount") or 0
			sign = "+" if amount > 0 else "-"
			parts.append(
				f"- [{h.get('transaction_id')}] {h.get('transaction_date')} "
				f"{sign}Rp{abs(amount):,.0f} {h.get('merchant_name') or ''} "
				f"({h.get('category') or 'tanpa kategori'})"
			)
	else:
		parts.append("Tidak ada transaksi relevan ditemukan untuk pertanyaan ini.")

	return "\n".join(parts)


def _build_system_prompt(context_block: str) -> str:
	return (
		"Kamu adalah asisten keuangan personal untuk pengguna FinanceAI di Indonesia. "
		"Jawab dalam Bahasa Indonesia. Gunakan format Rupiah (Rp X.XXX.XXX) untuk uang.\n\n"
		f"Data transaksi yang relevan:\n{context_block}\n\n"
		"Aturan:\n"
		"- Jangan mengarang angka. Kalau data tidak cukup, katakan jujur.\n"
		"- Sebut sumber dengan ID transaksi kalau spesifik.\n"
		"- Singkat dan to-the-point."
	)


async def _recent_history(
	db: AsyncSession, user: User, session_id: UUID, limit: int = HISTORY_WINDOW
) -> list[ChatMessage]:
	"""Ambil N pesan terakhir di session ini, ascending (lama → baru).

	SECURITY: filter user_id + session_id + deleted_at IS NULL.
	"""
	stmt = (
		select(ChatMessage)
		.where(
			ChatMessage.session_id == session_id,
			ChatMessage.user_id == user.id,
			ChatMessage.deleted_at.is_(None),
		)
		.order_by(ChatMessage.created_at.desc())
		.limit(limit)
	)
	result = await db.scalars(stmt)
	rows = list(result.all())
	rows.reverse()
	return rows


# ---------- streaming chat ----------

async def post_message_streaming(
	db: AsyncSession, user: User, session_id: UUID, content: str
) -> AsyncIterator[dict]:
	"""Streaming generator. Caller wraps each event sebagai SSE.

	Events:
	  {"type": "user_saved", "id": "..."}
	  {"type": "context", "sources": [tx_id, ...]}
	  {"type": "token", "content": "..."}
	  {"type": "done", "id": "..."}
	  {"type": "error", "message": "..."}
	"""
	# 1. Verify ownership — raises NotFoundError kalau bukan milik user.
	chat = await _get_owned_session(db, user, session_id)

	# 2. Save user message.
	now = datetime.now(timezone.utc)
	user_msg = ChatMessage(
		session_id=chat.id,
		user_id=user.id,
		role=ChatRole.user,
		content=content,
		sources=None,
	)
	db.add(user_msg)
	chat.last_message_at = now
	await db.commit()
	await db.refresh(user_msg)
	yield {"type": "user_saved", "id": str(user_msg.id)}

	# 3. Build context — RAG + SQL aggregate. Both user-scoped.
	try:
		rag_hits = await rag_pipeline.query(user.id, content, top_k=RAG_TOP_K)
	except Exception as exc:
		logger.warning("rag_query_failed_in_chat", error=str(exc))
		rag_hits = []

	try:
		expense_summary = await _expense_summary(db, user, days=30)
	except Exception as exc:
		logger.warning("expense_summary_failed", error=str(exc))
		expense_summary = []

	source_ids = [
		h["transaction_id"] for h in rag_hits if h.get("transaction_id")
	]
	yield {"type": "context", "sources": source_ids}

	# 4. Build messages untuk Groq.
	context_block = _format_context_block(rag_hits, expense_summary)
	messages: list[dict] = [
		{"role": "system", "content": _build_system_prompt(context_block)}
	]
	history = await _recent_history(db, user, chat.id)
	# History sudah include user_msg yang barusan disimpan; aman karena
	# system prompt + history + (current user msg sebagai last entry).
	for m in history:
		messages.append({"role": m.role.value, "content": m.content})

	# 5. Stream dari Groq.
	buffer = ""
	try:
		async for token in groq_client.chat_stream(messages):
			buffer += token
			yield {"type": "token", "content": token}
	except Exception as exc:
		logger.exception("groq_stream_failed")
		# Persist whatever we got + error placeholder.
		assistant_msg = ChatMessage(
			session_id=chat.id,
			user_id=user.id,
			role=ChatRole.assistant,
			content=buffer or "[error: gagal dapat response dari LLM]",
			sources=source_ids or None,
		)
		db.add(assistant_msg)
		chat.last_message_at = datetime.now(timezone.utc)
		await db.commit()
		yield {"type": "error", "message": str(exc)[:200]}
		return

	# 6. Save assistant message.
	assistant_msg = ChatMessage(
		session_id=chat.id,
		user_id=user.id,
		role=ChatRole.assistant,
		content=buffer,
		sources=source_ids or None,
	)
	db.add(assistant_msg)
	chat.last_message_at = datetime.now(timezone.utc)
	await db.commit()
	await db.refresh(assistant_msg)

	yield {"type": "done", "id": str(assistant_msg.id)}
