"""Budget business logic.

`get_summary` melakukan satu query agregasi (bukan N+1):
group by category dari transactions yang masuk bulan tersebut & amount < 0.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.budgets.models import Budget
from app.budgets.schemas import (
	BudgetCreate,
	BudgetResponse,
	BudgetSummaryResponse,
	BudgetUpdate,
)
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.transactions.models import Transaction
from app.users.models import User


def _next_month(month: date) -> date:
	if month.month == 12:
		return date(month.year + 1, 1, 1)
	return date(month.year, month.month + 1, 1)


def _ensure_first_of_month(month: date) -> None:
	if month.day != 1:
		raise ValidationError(
			code="INVALID_MONTH",
			message="month must be the first day of the month",
		)


async def list_budgets(
	session: AsyncSession, user: User, month: date
) -> list[Budget]:
	_ensure_first_of_month(month)
	stmt = (
		select(Budget)
		.where(
			Budget.user_id == user.id,
			Budget.month == month,
			Budget.deleted_at.is_(None),
		)
		.order_by(Budget.category.asc())
	)
	result = await session.scalars(stmt)
	return list(result.all())


async def get_budget(
	session: AsyncSession, user: User, budget_id: UUID
) -> Budget:
	stmt = select(Budget).where(
		Budget.id == budget_id,
		Budget.user_id == user.id,
		Budget.deleted_at.is_(None),
	)
	budget = await session.scalar(stmt)
	if budget is None:
		raise NotFoundError(code="BUDGET_NOT_FOUND", message="Budget not found")
	return budget


async def create_budget(
	session: AsyncSession, user: User, data: BudgetCreate
) -> Budget:
	_ensure_first_of_month(data.month)

	# Pre-check supaya error message konsisten (ConflictError, bukan IntegrityError mentah).
	existing = await session.scalar(
		select(Budget).where(
			Budget.user_id == user.id,
			Budget.category == data.category,
			Budget.month == data.month,
			Budget.deleted_at.is_(None),
		)
	)
	if existing is not None:
		raise ConflictError(
			code="BUDGET_EXISTS",
			message="Budget for this category & month already exists",
		)

	budget = Budget(
		user_id=user.id,
		category=data.category,
		monthly_amount=Decimal(data.monthly_amount),
		month=data.month,
		icon=data.icon,
	)
	session.add(budget)
	try:
		await session.commit()
	except IntegrityError as e:
		await session.rollback()
		# Race condition fallback (concurrent insert).
		raise ConflictError(
			code="BUDGET_EXISTS",
			message="Budget for this category & month already exists",
		) from e
	await session.refresh(budget)
	return budget


async def update_budget(
	session: AsyncSession, user: User, budget_id: UUID, data: BudgetUpdate
) -> Budget:
	budget = await get_budget(session, user, budget_id)
	update_data = data.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(budget, field, value)
	await session.commit()
	await session.refresh(budget)
	return budget


async def delete_budget(
	session: AsyncSession, user: User, budget_id: UUID
) -> None:
	budget = await get_budget(session, user, budget_id)
	budget.deleted_at = datetime.now(timezone.utc)
	await session.commit()


async def get_summary(
	session: AsyncSession, user: User, month: date
) -> BudgetSummaryResponse:
	_ensure_first_of_month(month)
	month_end_exclusive = _next_month(month)

	budgets = await list_budgets(session, user, month)

	# Single aggregate query: total expenses (amount < 0) per category in [month, next).
	expense_stmt = (
		select(
			Transaction.category,
			func.coalesce(func.sum(-Transaction.amount), 0).label("spent"),
		)
		.where(
			Transaction.user_id == user.id,
			Transaction.deleted_at.is_(None),
			Transaction.amount < 0,
			Transaction.transaction_date >= month,
			Transaction.transaction_date < month_end_exclusive,
		)
		.group_by(Transaction.category)
	)
	rows = await session.execute(expense_stmt)
	spent_by_cat: dict[str | None, Decimal] = {
		row.category: Decimal(row.spent) for row in rows
	}

	items: list[BudgetResponse] = []
	total_budget = Decimal("0")
	total_spent = Decimal("0")
	for b in budgets:
		spent = spent_by_cat.get(b.category, Decimal("0"))
		remaining = b.monthly_amount - spent
		percent = (
			float(spent / b.monthly_amount * 100)
			if b.monthly_amount > 0
			else 0.0
		)
		items.append(
			BudgetResponse(
				id=b.id,
				category=b.category,
				monthly_amount=b.monthly_amount,
				month=b.month,
				icon=b.icon,
				spent=spent,
				remaining=remaining,
				percent_used=round(percent, 2),
			)
		)
		total_budget += b.monthly_amount
		total_spent += spent

	return BudgetSummaryResponse(
		month=month,
		total_budget=total_budget,
		total_spent=total_spent,
		remaining=total_budget - total_spent,
		items=items,
	)
