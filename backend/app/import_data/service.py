"""Import pipeline business logic.

Lifecycle: upload → process_job (background) → review → confirm/cancel.
process_job buka session sendiri karena di-trigger via BackgroundTasks
(tidak punya request-scoped session).
"""

from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from uuid import UUID

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.accounts.models import Account
from app.ai.categorizer import categorize_rule_based
from app.ai.rag_pipeline import index_transactions
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.database import AsyncSessionLocal
from app.import_data.models import (
	ImportJob,
	ImportJobStatus,
	ImportRow,
	ImportSourceType,
)
from app.import_data.dispatcher import dispatch
from app.import_data.parsers.base import ParseResult
from app.import_data.schemas import ImportConfirmResponse, ImportRowUpdate
from app.import_data.validation import apply_balance_warning, run_balance_check
from app.transactions.models import Transaction, TransactionSource
from app.users.models import User


# Resolve ke backend/uploads/ — file ini ada di backend/app/import_data/service.py.
UPLOADS_ROOT = Path(__file__).resolve().parent.parent.parent / "uploads"


# ---------- helpers ----------

async def _verify_account_owned(
	session: AsyncSession, user: User, account_id: UUID
) -> None:
	stmt = select(Account.id).where(
		Account.id == account_id,
		Account.user_id == user.id,
		Account.deleted_at.is_(None),
	)
	exists = await session.scalar(stmt)
	if exists is None:
		raise ForbiddenError(
			code="ACCOUNT_NOT_OWNED",
			message="Account does not exist or not owned by user",
		)


def _balance_check_to_dict(bc) -> dict | None:
	"""Serialize BalanceCheck dataclass to JSON-safe dict for JSONB storage."""
	if bc is None:
		return None
	return {
		"saldo_awal": str(bc.saldo_awal),
		"saldo_akhir": str(bc.saldo_akhir),
		"sum_transactions": str(bc.sum_transactions),
		"expected_delta": str(bc.expected_delta),
		"actual_delta": str(bc.actual_delta),
		"matches": bool(bc.matches),
		"diff_pct": str(bc.diff_pct),
	}


def _holding_to_dict(h) -> dict:
	"""Serialize ParsedHolding dataclass to JSON-safe dict."""
	return {
		"line_no": h.line_no,
		"ticker": h.ticker,
		"qty": str(h.qty) if h.qty is not None else None,
		"avg_price": str(h.avg_price) if h.avg_price is not None else None,
		"market_value": str(h.market_value) if h.market_value is not None else None,
		"currency": h.currency,
		"asset_type": h.asset_type,
		"confidence_score": str(h.confidence_score),
	}


def _source_to_transaction_source(src: ImportSourceType) -> TransactionSource:
	# pdf_* → import_pdf, csv_* + manual_csv → import_csv, image → import_image.
	if src.value.startswith("pdf_"):
		return TransactionSource.import_pdf
	if src == ImportSourceType.image_vision:
		return TransactionSource.import_image
	return TransactionSource.import_csv


# ---------- create / list / get ----------

async def create_job(
	session: AsyncSession,
	user: User,
	*,
	source_type: ImportSourceType,
	account_id: UUID | None,
	file_name: str,
	file_size: int,
	mime_type: str | None,
	file_bytes: bytes,
) -> ImportJob:
	if account_id is not None:
		await _verify_account_owned(session, user, account_id)

	job = ImportJob(
		user_id=user.id,
		account_id=account_id,
		source_type=source_type,
		status=ImportJobStatus.pending,
		file_name=file_name,
		file_path="",  # diisi setelah save ke disk
		file_size=file_size,
		mime_type=mime_type,
	)
	session.add(job)
	await session.flush()  # supaya job.id terisi

	# Sanitize filename — buang path separator supaya tidak bisa break out dari upload dir.
	safe_name = Path(file_name).name or "file"
	rel_path = f"{user.id}/{job.id}/{safe_name}"
	dest = UPLOADS_ROOT / rel_path
	dest.parent.mkdir(parents=True, exist_ok=True)
	dest.write_bytes(file_bytes)

	job.file_path = rel_path
	await session.commit()
	await session.refresh(job)
	return job


async def list_jobs(
	session: AsyncSession, user: User, limit: int = 50
) -> list[ImportJob]:
	stmt = (
		select(ImportJob)
		.where(
			ImportJob.user_id == user.id,
			ImportJob.deleted_at.is_(None),
		)
		.order_by(ImportJob.created_at.desc())
		.limit(limit)
	)
	result = await session.scalars(stmt)
	return list(result.all())


async def get_job(
	session: AsyncSession, user: User, job_id: UUID
) -> ImportJob:
	stmt = (
		select(ImportJob)
		.where(
			ImportJob.id == job_id,
			ImportJob.user_id == user.id,
			ImportJob.deleted_at.is_(None),
		)
		.options(selectinload(ImportJob.rows))
	)
	job = await session.scalar(stmt)
	if job is None:
		raise NotFoundError(code="IMPORT_JOB_NOT_FOUND", message="Import job not found")
	return job


def visible_rows(job: ImportJob) -> list[ImportRow]:
	"""Filter soft-deleted rows + sort by line_no.

	Tidak reassign ke job.rows supaya tidak trigger cascade delete-orphan.
	"""
	return sorted(
		[r for r in job.rows if r.deleted_at is None],
		key=lambda r: r.line_no,
	)


# ---------- background processing ----------

async def process_job(job_id: UUID) -> None:
	"""Background task: parse file, isi ImportRow, update counters & status.

	Tidak filter user_id di sini — caller (BackgroundTasks dari endpoint upload)
	sudah memastikan job milik user yang sah.
	"""
	async with AsyncSessionLocal() as session:
		job = await session.get(ImportJob, job_id)
		if job is None or job.deleted_at is not None:
			return
		# Idempotent: skip kalau sudah pernah di-process (mis. BackgroundTasks
		# + explicit call dari test, atau retry signal yang nyasar).
		if job.status != ImportJobStatus.pending:
			return

		job.status = ImportJobStatus.processing
		await session.commit()

		try:
			file_bytes = (UPLOADS_ROOT / job.file_path).read_bytes()
			parser = dispatch(file_bytes)
			result: ParseResult = parser.parse(file_bytes)
		except Exception as exc:
			job.status = ImportJobStatus.failed
			job.error_message = str(exc)[:500]
			await session.commit()
			return

		# Phase 4: extract balance_summary attached by parser (if any), run math-check
		balance_summary_raw = getattr(result, "_balance_summary_raw", None)
		saldo_awal = saldo_akhir = None
		if isinstance(balance_summary_raw, dict):
			try:
				if balance_summary_raw.get("saldo_awal") is not None:
					saldo_awal = Decimal(str(balance_summary_raw["saldo_awal"]))
				if balance_summary_raw.get("saldo_akhir") is not None:
					saldo_akhir = Decimal(str(balance_summary_raw["saldo_akhir"]))
			except (InvalidOperation, ValueError):
				saldo_awal = saldo_akhir = None

		balance_check = run_balance_check(result.rows, saldo_awal, saldo_akhir)
		if balance_check is not None and not balance_check.matches:
			apply_balance_warning(result.rows)

		# Persist Phase 4 metadata
		job.content_type = result.content_type
		job.balance_check = _balance_check_to_dict(balance_check)
		job.detected_holdings = (
			[_holding_to_dict(h) for h in result.holdings] if result.holdings else None
		)

		parsed = result.rows

		rows_ok = rows_warn = rows_err = 0
		for p in parsed:
			# Duplicate check: same user + date + amount + merchant.
			dup_stmt = select(Transaction.id).where(
				Transaction.user_id == job.user_id,
				Transaction.transaction_date == p.transaction_date,
				Transaction.amount == p.amount,
				Transaction.merchant_name == p.merchant_name,
				Transaction.deleted_at.is_(None),
			)
			dup = await session.scalar(dup_stmt)
			is_dup = dup is not None

			# Auto-categorize via rule-based kalau parser nggak isi.
			# Hanya rule-based — deterministic & gratis. LLM fallback skip dulu.
			category = p.category or categorize_rule_based(
				p.merchant_name, p.description
			)

			row = ImportRow(
				job_id=job.id,
				user_id=job.user_id,
				line_no=p.line_no,
				transaction_date=p.transaction_date,
				amount=p.amount,
				currency=p.currency,
				merchant_name=p.merchant_name,
				description=p.description,
				category=category,
				confidence_score=p.confidence_score,
				raw_text=p.raw_text,
				is_duplicate=is_dup,
				is_excluded=False,
			)
			session.add(row)

			conf = p.confidence_score
			if conf >= Decimal("0.8"):
				rows_ok += 1
			elif conf >= Decimal("0.5"):
				rows_warn += 1
			else:
				rows_err += 1

		job.rows_total = len(parsed)
		job.rows_ok = rows_ok
		job.rows_warn = rows_warn
		job.rows_err = rows_err
		job.status = ImportJobStatus.review
		await session.commit()


# ---------- row mutations ----------

async def _get_owned_row(
	session: AsyncSession, user: User, job_id: UUID, row_id: UUID
) -> ImportRow:
	stmt = select(ImportRow).where(
		ImportRow.id == row_id,
		ImportRow.job_id == job_id,
		ImportRow.user_id == user.id,
		ImportRow.deleted_at.is_(None),
	)
	row = await session.scalar(stmt)
	if row is None:
		raise NotFoundError(
			code="IMPORT_ROW_NOT_FOUND", message="Import row not found"
		)
	return row


async def update_row(
	session: AsyncSession,
	user: User,
	job_id: UUID,
	row_id: UUID,
	data: ImportRowUpdate,
) -> ImportRow:
	row = await _get_owned_row(session, user, job_id, row_id)
	update_data = data.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(row, field, value)
	await session.commit()
	await session.refresh(row)
	return row


async def exclude_row(
	session: AsyncSession, user: User, job_id: UUID, row_id: UUID
) -> None:
	row = await _get_owned_row(session, user, job_id, row_id)
	row.is_excluded = True
	await session.commit()


# ---------- confirm / cancel ----------

async def confirm_job(
	session: AsyncSession,
	user: User,
	job_id: UUID,
	background_tasks: BackgroundTasks | None = None,
) -> ImportConfirmResponse:
	job = await get_job(session, user, job_id)

	if job.status != ImportJobStatus.review:
		raise ConflictError(
			code="INVALID_JOB_STATE",
			message=f"Job status {job.status.value} tidak bisa di-confirm",
		)

	tx_source = _source_to_transaction_source(job.source_type)

	# Kumpulkan tx baru supaya bisa di-index ke RAG setelah commit.
	new_txs: list[Transaction] = []
	already_existed = 0
	for row in visible_rows(job):
		if row.is_excluded:
			continue
		if row.is_duplicate:
			already_existed += 1
			continue

		tx = Transaction(
			user_id=user.id,
			account_id=job.account_id,
			amount=row.amount,
			currency=row.currency,
			merchant_name=row.merchant_name,
			description=row.description,
			category=row.category,
			transaction_date=row.transaction_date,
			source=tx_source,
			confidence_score=row.confidence_score,
		)
		session.add(tx)
		new_txs.append(tx)

	job.status = ImportJobStatus.confirmed
	job.confirmed_at = datetime.now(timezone.utc)
	await session.commit()

	# Index ke Qdrant via background task supaya endpoint cepat.
	# Best-effort: kalau background_tasks tidak di-pass (mis. dipanggil dari
	# script/test), skip indexing — bisa di-trigger manual nanti.
	new_ids = [tx.id for tx in new_txs]
	if new_ids and background_tasks is not None:
		background_tasks.add_task(index_transactions, new_ids)

	return ImportConfirmResponse(
		job_id=job.id,
		transactions_created=len(new_ids),
		already_existed=already_existed,
	)


async def cancel_job(
	session: AsyncSession, user: User, job_id: UUID
) -> None:
	# Re-fetch tanpa selectinload supaya cheaper.
	stmt = select(ImportJob).where(
		ImportJob.id == job_id,
		ImportJob.user_id == user.id,
		ImportJob.deleted_at.is_(None),
	)
	job = await session.scalar(stmt)
	if job is None:
		raise NotFoundError(code="IMPORT_JOB_NOT_FOUND", message="Import job not found")

	cancellable = {
		ImportJobStatus.pending,
		ImportJobStatus.processing,
		ImportJobStatus.review,
	}
	if job.status not in cancellable:
		raise ConflictError(
			code="INVALID_JOB_STATE",
			message=f"Job status {job.status.value} tidak bisa di-cancel",
		)

	job.status = ImportJobStatus.cancelled
	await session.commit()
