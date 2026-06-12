"""Pydantic schemas untuk StockHolding endpoints."""

from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class HoldingCreate(BaseModel):
	account_id: UUID
	ticker: str = Field(min_length=1, max_length=10)
	lot: int = Field(gt=0)
	avg_price: Decimal = Field(gt=0)


class HoldingUpdate(BaseModel):
	lot: int | None = Field(default=None, gt=0)
	avg_price: Decimal | None = Field(default=None, gt=0)


class HoldingResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	account_id: UUID
	account_name: str
	ticker: str
	lot: int
	avg_price: Decimal


class AggregateBreakdown(BaseModel):
	account_id: UUID
	account_name: str
	lot: int
	avg_price: Decimal


class AggregateHolding(BaseModel):
	ticker: str
	total_lot: int
	weighted_avg_price: Decimal
	breakdown: list[AggregateBreakdown]


class HoldingsListResponse(BaseModel):
	# items polymorphic: per_account → HoldingResponse, aggregate → AggregateHolding.
	items: list[HoldingResponse] | list[AggregateHolding]
