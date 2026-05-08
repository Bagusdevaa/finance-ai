"""Stock holding business logic.

Dua mode list: per_account (raw rows) & aggregate (group by ticker).
Weighted avg dihitung di Python pakai Decimal — jangan float, presisi penting.
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.models import Account, AccountType
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.holdings.models import StockHolding
from app.holdings.schemas import (
	AggregateBreakdown,
	AggregateHolding,
	HoldingCreate,
	HoldingResponse,
	HoldingUpdate,
)
from app.users.models import User


async def _verify_broker_account(
	session: AsyncSession, user: User, account_id: UUID
) -> Account:
	stmt = select(Account).where(
		Account.id == account_id,
		Account.user_id == user.id,
		Account.deleted_at.is_(None),
	)
	account = await session.scalar(stmt)
	if account is None:
		raise ForbiddenError(
			code="ACCOUNT_NOT_OWNED",
			message="Account does not exist or not owned by user",
		)
	if account.type != AccountType.broker:
		raise ForbiddenError(
			code="ACCOUNT_NOT_BROKER",
			message="Holdings can only be attached to broker accounts",
		)
	return account


async def _holdings_with_accounts(
	session: AsyncSession, user: User
) -> list[tuple[StockHolding, Account]]:
	# Single join supaya bisa render account_name tanpa N+1.
	stmt = (
		select(StockHolding, Account)
		.join(Account, Account.id == StockHolding.account_id)
		.where(
			StockHolding.user_id == user.id,
			StockHolding.deleted_at.is_(None),
			Account.deleted_at.is_(None),
		)
		.order_by(StockHolding.ticker.asc(), Account.name.asc())
	)
	result = await session.execute(stmt)
	return [(row[0], row[1]) for row in result.all()]


async def list_holdings(
	session: AsyncSession,
	user: User,
	view: Literal["aggregate", "per_account"] = "aggregate",
) -> list[HoldingResponse] | list[AggregateHolding]:
	rows = await _holdings_with_accounts(session, user)

	if view == "per_account":
		return [
			HoldingResponse(
				id=h.id,
				account_id=h.account_id,
				account_name=acc.name,
				ticker=h.ticker,
				lot=h.lot,
				avg_price=h.avg_price,
			)
			for h, acc in rows
		]

	# Aggregate: group by ticker, weighted avg = Σ(lot * price) / Σ(lot).
	grouped: dict[str, list[tuple[StockHolding, Account]]] = {}
	for h, acc in rows:
		grouped.setdefault(h.ticker, []).append((h, acc))

	out: list[AggregateHolding] = []
	for ticker, items in grouped.items():
		total_lot = sum(h.lot for h, _ in items)
		weighted_sum = sum(Decimal(h.lot) * h.avg_price for h, _ in items)
		weighted_avg = (
			(weighted_sum / Decimal(total_lot)).quantize(Decimal("0.01"))
			if total_lot > 0
			else Decimal("0")
		)
		out.append(
			AggregateHolding(
				ticker=ticker,
				total_lot=total_lot,
				weighted_avg_price=weighted_avg,
				breakdown=[
					AggregateBreakdown(
						account_id=acc.id,
						account_name=acc.name,
						lot=h.lot,
						avg_price=h.avg_price,
					)
					for h, acc in items
				],
			)
		)
	return out


async def get_holding(
	session: AsyncSession, user: User, holding_id: UUID
) -> tuple[StockHolding, Account]:
	stmt = (
		select(StockHolding, Account)
		.join(Account, Account.id == StockHolding.account_id)
		.where(
			StockHolding.id == holding_id,
			StockHolding.user_id == user.id,
			StockHolding.deleted_at.is_(None),
		)
	)
	row = (await session.execute(stmt)).first()
	if row is None:
		raise NotFoundError(
			code="HOLDING_NOT_FOUND", message="Holding not found"
		)
	return row[0], row[1]


async def create_holding(
	session: AsyncSession, user: User, data: HoldingCreate
) -> tuple[StockHolding, Account]:
	account = await _verify_broker_account(session, user, data.account_id)
	ticker = data.ticker.upper().strip()

	existing = await session.scalar(
		select(StockHolding).where(
			StockHolding.account_id == data.account_id,
			StockHolding.ticker == ticker,
			StockHolding.deleted_at.is_(None),
		)
	)
	if existing is not None:
		raise ConflictError(
			code="HOLDING_EXISTS",
			message="Holding for this account & ticker already exists",
		)

	holding = StockHolding(
		user_id=user.id,
		account_id=data.account_id,
		ticker=ticker,
		lot=data.lot,
		avg_price=Decimal(data.avg_price),
	)
	session.add(holding)
	try:
		await session.commit()
	except IntegrityError as e:
		await session.rollback()
		raise ConflictError(
			code="HOLDING_EXISTS",
			message="Holding for this account & ticker already exists",
		) from e
	await session.refresh(holding)
	return holding, account


async def update_holding(
	session: AsyncSession, user: User, holding_id: UUID, data: HoldingUpdate
) -> tuple[StockHolding, Account]:
	holding, account = await get_holding(session, user, holding_id)
	update_data = data.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(holding, field, value)
	await session.commit()
	await session.refresh(holding)
	return holding, account


async def delete_holding(
	session: AsyncSession, user: User, holding_id: UUID
) -> None:
	holding, _ = await get_holding(session, user, holding_id)
	holding.deleted_at = datetime.now(timezone.utc)
	await session.commit()
