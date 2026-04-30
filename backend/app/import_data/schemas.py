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


class ImportJobDetailResponse(ImportJobResponse):
	items: list[ImportRowResponse]


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
