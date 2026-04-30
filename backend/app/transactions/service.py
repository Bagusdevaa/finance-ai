"""Transaction business logic.

Filter list-nya cukup banyak — semua optional, hanya `user_id` mandatory.
Cursor pagination: kunci stabil = (transaction_date DESC, id DESC).
"""

from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.accounts.models import Account
from app.core.errors import ForbiddenError, NotFoundError, ValidationError
from app.core.pagination import decode_cursor, encode_cursor
from app.transactions.models import Transaction
from app.transactions.schemas import TransactionCreate, TransactionUpdate
from app.users.models import User


@dataclass
class TransactionFilters:
	account_id: UUID | None = None
	category: str | None = None
	type: str | None = None  # 'in' | 'out' | 'all' | None
	date_from: date | None = None
	date_to: date | None = None
	search: str | None = None


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
		# 403, bukan 404, supaya tidak bocor existence akun user lain.
		raise ForbiddenError(
			code="ACCOUNT_NOT_OWNED",
			message="Account does not exist or not owned by user",
		)


async def list_transactions(
	session: AsyncSession,
	user: User,
	filters: TransactionFilters,
	cursor: str | None = None,
	limit: int = 50,
) -> tuple[list[Transaction], str | None, bool]:
	if limit < 1 or limit > 200:
		raise ValidationError(
			code="INVALID_LIMIT", message="limit harus di antara 1 dan 200"
		)

	conditions = [
		Transaction.user_id == user.id,
		Transaction.deleted_at.is_(None),
	]

	if filters.account_id is not None:
		conditions.append(Transaction.account_id == filters.account_id)
	if filters.category is not None:
		conditions.append(Transaction.category == filters.category)
	if filters.type == "in":
		conditions.append(Transaction.amount > 0)
	elif filters.type == "out":
		conditions.append(Transaction.amount < 0)
	if filters.date_from is not None:
		conditions.append(Transaction.transaction_date >= filters.date_from)
	if filters.date_to is not None:
		conditions.append(Transaction.transaction_date <= filters.date_to)
	if filters.search:
		needle = f"%{filters.search.strip()}%"
		conditions.append(
			or_(
				Transaction.merchant_name.ilike(needle),
				Transaction.description.ilike(needle),
			)
		)

	if cursor is not None:
		cursor_date, cursor_id = decode_cursor(cursor)
		# (date DESC, id DESC) → ambil row yg < cursor.
		conditions.append(
			or_(
				Transaction.transaction_date < cursor_date,
				and_(
					Transaction.transaction_date == cursor_date,
					Transaction.id < cursor_id,
				),
			)
		)

	# +1 supaya tahu has_more tanpa COUNT extra.
	stmt = (
		select(Transaction)
		.where(*conditions)
		.options(selectinload(Transaction.account))
		.order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
		.limit(limit + 1)
	)
	result = await session.scalars(stmt)
	rows = list(result.all())

	has_more = len(rows) > limit
	if has_more:
		rows = rows[:limit]

	next_cursor = (
		encode_cursor(rows[-1].transaction_date, rows[-1].id)
		if has_more and rows
		else None
	)
	return rows, next_cursor, has_more


async def get_transaction(
	session: AsyncSession, user: User, tx_id: UUID
) -> Transaction:
	stmt = (
		select(Transaction)
		.where(
			Transaction.id == tx_id,
			Transaction.user_id == user.id,
			Transaction.deleted_at.is_(None),
		)
		.options(selectinload(Transaction.account))
	)
	tx = await session.scalar(stmt)
	if tx is None:
		raise NotFoundError(
			code="TRANSACTION_NOT_FOUND", message="Transaction not found"
		)
	return tx


async def create_transaction(
	session: AsyncSession, user: User, data: TransactionCreate
) -> Transaction:
	if data.account_id is not None:
		await _verify_account_owned(session, user, data.account_id)

	tx = Transaction(
		user_id=user.id,
		account_id=data.account_id,
		amount=Decimal(data.amount),
		currency=data.currency.upper(),
		merchant_name=data.merchant_name,
		description=data.description,
		category=data.category,
		transaction_date=data.transaction_date,
		note=data.note,
	)
	session.add(tx)
	await session.commit()
	# Refresh + load relationship (account) supaya response complete.
	await session.refresh(tx, attribute_names=["created_at", "updated_at", "account"])
	return tx


async def update_transaction(
	session: AsyncSession,
	user: User,
	tx_id: UUID,
	data: TransactionUpdate,
) -> Transaction:
	tx = await get_transaction(session, user, tx_id)
	update_data = data.model_dump(exclude_unset=True)

	if "account_id" in update_data and update_data["account_id"] is not None:
		await _verify_account_owned(session, user, update_data["account_id"])

	if "currency" in update_data and update_data["currency"]:
		update_data["currency"] = update_data["currency"].upper()

	for field, value in update_data.items():
		setattr(tx, field, value)

	await session.commit()
	await session.refresh(tx, attribute_names=["created_at", "updated_at", "account"])
	return tx


async def delete_transaction(
	session: AsyncSession, user: User, tx_id: UUID
) -> None:
	tx = await get_transaction(session, user, tx_id)
	tx.deleted_at = datetime.now(timezone.utc)
	await session.commit()
