"""Pydantic schemas untuk Transaction endpoints."""

from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.accounts.models import AccountType
from app.transactions.models import TransactionSource


class AccountSummary(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	name: str
	type: AccountType


class TransactionCreate(BaseModel):
	account_id: UUID | None = None
	amount: Decimal
	currency: str = Field(default="IDR", min_length=3, max_length=3)
	merchant_name: str | None = Field(default=None, max_length=255)
	description: str | None = Field(default=None, max_length=500)
	category: str | None = Field(default=None, max_length=64)
	transaction_date: date
	note: str | None = None


class TransactionUpdate(BaseModel):
	account_id: UUID | None = None
	amount: Decimal | None = None
	currency: str | None = Field(default=None, min_length=3, max_length=3)
	merchant_name: str | None = Field(default=None, max_length=255)
	description: str | None = Field(default=None, max_length=500)
	category: str | None = Field(default=None, max_length=64)
	transaction_date: date | None = None
	note: str | None = None


class TransactionResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	user_id: UUID
	account_id: UUID | None
	account: AccountSummary | None = None
	amount: Decimal
	currency: str
	merchant_name: str | None
	description: str | None
	category: str | None
	transaction_date: date
	source: TransactionSource
	confidence_score: Decimal | None
	note: str | None
	created_at: datetime
	updated_at: datetime


class TransactionListResponse(BaseModel):
	items: list[TransactionResponse]
	next_cursor: str | None
	has_more: bool
