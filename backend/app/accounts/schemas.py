"""Pydantic schemas untuk Account endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.accounts.models import AccountType


class AccountCreate(BaseModel):
	name: str = Field(min_length=1, max_length=255)
	type: AccountType
	last4: str | None = Field(default=None, max_length=8)
	currency: str = Field(default="IDR", min_length=3, max_length=3)


class AccountUpdate(BaseModel):
	name: str | None = Field(default=None, min_length=1, max_length=255)
	type: AccountType | None = None
	last4: str | None = Field(default=None, max_length=8)
	is_active: bool | None = None


class AccountResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	user_id: UUID
	name: str
	type: AccountType
	last4: str | None
	currency: str
	is_active: bool
	created_at: datetime
	updated_at: datetime
