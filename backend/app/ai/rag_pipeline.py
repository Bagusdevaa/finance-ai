"""RAG pipeline untuk chat context.

SECURITY:
- Setiap query() WAJIB filter by user_id. Tanpa filter, satu user
  bisa lihat data user lain via LLM hallucination.
- index_transactions menyimpan user_id di payload setiap point —
  filter di sisi query baru bisa kerja kalau payload bener.
"""

import asyncio
from uuid import UUID

import structlog
from qdrant_client.models import (
	FieldCondition,
	Filter,
	MatchValue,
	PointIdsList,
	PointStruct,
)
from sqlalchemy import select

from app.ai.embeddings import embed_passages, embed_query
from app.ai.qdrant import get_client
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.transactions.models import Transaction


logger = structlog.get_logger(__name__)
_settings = get_settings()


def _build_text(tx: Transaction) -> str:
	"""Compact natural-language description untuk di-embed.

	Format Bahasa Indonesia supaya match dengan multilingual-e5
	dan typical user query ("berapa pengeluaran gofood bulan lalu").
	"""
	sign = "Pemasukan" if tx.amount > 0 else "Pengeluaran"
	parts = [
		f"{sign} Rp{abs(tx.amount):,.0f}",
		f"di {tx.merchant_name}" if tx.merchant_name else "",
		f"({tx.category})" if tx.category else "",
		f"pada {tx.transaction_date.isoformat()}",
		f"— {tx.description}" if tx.description else "",
	]
	return " ".join(p for p in parts if p)


async def index_transactions(transaction_ids: list[UUID]) -> None:
	"""Background task: fetch transaksi, embed, upsert ke Qdrant.

	Caller bertanggung jawab pass IDs yang valid; tapi payload selalu
	include user_id supaya query bisa filter dengan benar.
	Best-effort: Qdrant down tidak gagalkan import flow.
	"""
	if not transaction_ids:
		return

	try:
		async with AsyncSessionLocal() as session:
			stmt = select(Transaction).where(
				Transaction.id.in_(transaction_ids),
				Transaction.deleted_at.is_(None),
			)
			result = await session.scalars(stmt)
			txs = list(result.all())
		if not txs:
			return

		texts = [_build_text(t) for t in txs]
		# fastembed sync → punt ke threadpool.
		vectors = await asyncio.to_thread(embed_passages, texts)

		points = [
			PointStruct(
				id=str(tx.id),
				vector=vec,
				payload={
					# user_id WAJIB ada — dipakai untuk filter di query().
					"user_id": str(tx.user_id),
					"transaction_id": str(tx.id),
					"transaction_date": tx.transaction_date.isoformat(),
					"amount": float(tx.amount),
					"currency": tx.currency,
					"merchant_name": tx.merchant_name,
					"category": tx.category,
					"description": tx.description,
				},
			)
			for tx, vec in zip(txs, vectors)
		]
		client = get_client()
		await client.upsert(
			collection_name=_settings.QDRANT_COLLECTION,
			points=points,
		)
	except Exception as exc:
		# Indexing failure tidak boleh cascade ke user — log dan move on.
		logger.warning(
			"rag_index_failed",
			count=len(transaction_ids),
			error=str(exc),
		)


async def delete_indexed(transaction_ids: list[UUID]) -> None:
	"""Hapus dari vector store (mis. saat soft-delete transaksi)."""
	if not transaction_ids:
		return
	try:
		client = get_client()
		await client.delete(
			collection_name=_settings.QDRANT_COLLECTION,
			points_selector=PointIdsList(points=[str(i) for i in transaction_ids]),
		)
	except Exception as exc:
		logger.warning(
			"rag_delete_failed",
			count=len(transaction_ids),
			error=str(exc),
		)


async def query(user_id: UUID, query_text: str, top_k: int = 8) -> list[dict]:
	"""Semantic search untuk transaksi user. SECURITY: filter by user_id mandatory.

	Returns: list of {transaction_id, score, transaction_date, amount, ...}
	Empty list kalau Qdrant down atau no hits.
	"""
	if not query_text.strip():
		return []

	try:
		client = get_client()
		vector = await asyncio.to_thread(embed_query, query_text)

		# Filter ini NON-NEGOTIABLE. Jangan pernah hilangkan.
		user_filter = Filter(
			must=[
				FieldCondition(
					key="user_id",
					match=MatchValue(value=str(user_id)),
				)
			]
		)

		# query_points() menggantikan search() yg deprecated di qdrant-client >= 1.10.
		response = await client.query_points(
			collection_name=_settings.QDRANT_COLLECTION,
			query=vector,
			query_filter=user_filter,
			limit=top_k,
			with_payload=True,
		)
		hits = response.points
	except Exception as exc:
		logger.warning(
			"rag_query_failed",
			user_id=str(user_id),
			error=str(exc),
		)
		return []

	return [
		{
			"transaction_id": h.payload.get("transaction_id"),
			"score": h.score,
			"transaction_date": h.payload.get("transaction_date"),
			"amount": h.payload.get("amount"),
			"merchant_name": h.payload.get("merchant_name"),
			"category": h.payload.get("category"),
			"description": h.payload.get("description"),
		}
		for h in hits
		# Defense-in-depth: walaupun filter sudah server-side, double-check
		# payload user_id match. Kalau ada mismatch (bug/misconfig), drop.
		if h.payload.get("user_id") == str(user_id)
	]
