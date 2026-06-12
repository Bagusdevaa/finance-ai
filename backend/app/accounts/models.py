"""Account ORM model.

Account = sumber dana / portfolio milik user (BCA, GoPay, Stockbit, dll).
Type dibatasi enum supaya konsisten antar fitur (import, holdings).
"""

import uuid
from enum import Enum

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import (
	SoftDeleteMixin,
	TimestampMixin,
	UUIDPrimaryKeyMixin,
)
from app.database import Base


class AccountType(str, Enum):
	bank = "bank"
	ewallet = "ewallet"
	broker = "broker"
	cash = "cash"


class Account(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "accounts"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	name: Mapped[str] = mapped_column(String(255), nullable=False)
	type: Mapped[AccountType] = mapped_column(
		SAEnum(AccountType, name="account_type"),
		nullable=False,
	)
	last4: Mapped[str | None] = mapped_column(String(8), nullable=True)
	currency: Mapped[str] = mapped_column(String(3), nullable=False, default="IDR")
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
