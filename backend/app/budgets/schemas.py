"""Pydantic schemas untuk Budget endpoints."""

from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BudgetCreate(BaseModel):
	category: str = Field(min_length=1, max_length=64)
	monthly_amount: Decimal = Field(gt=0)
	month: date
	icon: str | None = Field(default=None, max_length=32)

	@field_validator("month")
	@classmethod
	def must_be_first_of_month(cls, v: date) -> date:
		if v.day != 1:
			raise ValueError("month must be the first day of the month (YYYY-MM-01)")
		return v


class BudgetUpdate(BaseModel):
	monthly_amount: Decimal | None = Field(default=None, gt=0)
	icon: str | None = Field(default=None, max_length=32)


class BudgetResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	category: str
	monthly_amount: Decimal
	month: date
	icon: str | None
	# Calculated fields — diisi di service layer.
	spent: Decimal = Decimal("0")
	remaining: Decimal = Decimal("0")
	percent_used: float = 0.0


class BudgetSummaryResponse(BaseModel):
	month: date
	total_budget: Decimal
	total_spent: Decimal
	remaining: Decimal
	items: list[BudgetResponse]
