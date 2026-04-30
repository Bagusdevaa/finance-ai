"""Budget HTTP endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.budgets import service
from app.budgets.schemas import (
	BudgetCreate,
	BudgetResponse,
	BudgetSummaryResponse,
	BudgetUpdate,
)
from app.core.errors import ValidationError
from app.dependencies import get_current_user, get_session
from app.users.models import User


router = APIRouter()


def _parse_month(month_str: str) -> date:
	"""Terima 'YYYY-MM' atau 'YYYY-MM-DD' (DD harus 01)."""
	try:
		# coba YYYY-MM dulu
		if len(month_str) == 7:
			year, month = month_str.split("-")
			return date(int(year), int(month), 1)
		parsed = date.fromisoformat(month_str)
		if parsed.day != 1:
			raise ValueError
		return parsed
	except (ValueError, TypeError) as e:
		raise ValidationError(
			code="INVALID_MONTH",
			message="month must be in YYYY-MM or YYYY-MM-01 format",
		) from e


@router.get("/", response_model=list[BudgetResponse])
async def list_budgets(
	month: str = Query(..., description="Format YYYY-MM"),
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> list[BudgetResponse]:
	month_date = _parse_month(month)
	budgets = await service.list_budgets(session, user, month_date)
	# Tanpa kalkulasi spent — raw list endpoint.
	return [BudgetResponse.model_validate(b) for b in budgets]


@router.get("/summary", response_model=BudgetSummaryResponse)
async def get_summary(
	month: str = Query(..., description="Format YYYY-MM"),
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> BudgetSummaryResponse:
	return await service.get_summary(session, user, _parse_month(month))


@router.post(
	"/",
	response_model=BudgetResponse,
	status_code=status.HTTP_201_CREATED,
)
async def create_budget(
	data: BudgetCreate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.create_budget(session, user, data)


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
	budget_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.get_budget(session, user, budget_id)


@router.patch("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
	budget_id: UUID,
	data: BudgetUpdate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.update_budget(session, user, budget_id, data)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
	budget_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> None:
	await service.delete_budget(session, user, budget_id)
