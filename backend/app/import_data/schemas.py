"""Pydantic schemas untuk Import endpoints."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.import_data.models import ImportJobStatus, ImportSourceType


class ImportJobResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	source_type: ImportSourceType
	status: ImportJobStatus
	file_name: str
	account_id: UUID | None
	rows_total: int
	rows_ok: int
	rows_warn: int
	rows_err: int
	created_at: datetime
	confirmed_at: datetime | None
	error_message: str | None


class ImportRowResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	line_no: int
	transaction_date: date
	amount: Decimal
	currency: str
	merchant_name: str | None
	description: str | None
	category: str | None
	confidence_score: Decimal
	raw_text: str
	is_duplicate: bool
	is_excluded: bool


class BalanceCheckResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	saldo_awal: Decimal
	saldo_akhir: Decimal
	sum_transactions: Decimal
	expected_delta: Decimal
	actual_delta: Decimal
	matches: bool
	diff_pct: Decimal


class DetectedHoldingResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	line_no: int
	ticker: str
	qty: Decimal | None = None
	avg_price: Decimal | None = None
	market_value: Decimal | None = None
	currency: str
	asset_type: str
	confidence_score: Decimal


class ImportJobDetailResponse(ImportJobResponse):
	items: list[ImportRowResponse]
	content_type: str | None = None
	balance_check: BalanceCheckResponse | None = None
	detected_holdings: list[DetectedHoldingResponse] | None = None


class ImportRowUpdate(BaseModel):
	merchant_name: str | None = Field(default=None, max_length=255)
	description: str | None = Field(default=None, max_length=500)
	category: str | None = Field(default=None, max_length=64)
	amount: Decimal | None = None
	transaction_date: date | None = None
	is_excluded: bool | None = None


class ImportConfirmResponse(BaseModel):
	job_id: UUID
	transactions_created: int
	already_existed: int
