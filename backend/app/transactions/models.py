"""Transaction ORM model.

Convention amount: positif = income/inflow, negatif = expense/outflow.
Konvensi ini dipakai di semua tempat (budget, RAG, dll), jangan dibalik.
"""

import uuid
from datetime import date as date_t
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Date, ForeignKey, Index, Numeric, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import (
	SoftDeleteMixin,
	TimestampMixin,
	UUIDPrimaryKeyMixin,
)
from app.database import Base


if TYPE_CHECKING:
	from app.accounts.models import Account


class TransactionSource(str, Enum):
	manual = "manual"
	import_pdf = "import_pdf"
	import_csv = "import_csv"
	import_image = "import_image"


class Transaction(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "transactions"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	# account nullable: transaksi manual bisa tidak terikat akun (mis. cash misc).
	account_id: Mapped[uuid.UUID | None] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("accounts.id", ondelete="SET NULL"),
		index=True,
		nullable=True,
	)
	amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
	currency: Mapped[str] = mapped_column(String(3), nullable=False, default="IDR")
	merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
	description: Mapped[str | None] = mapped_column(String(500), nullable=True)
	# Free-form sampai Step categorisasi diformalkan.
	category: Mapped[str | None] = mapped_column(String(64), nullable=True)
	transaction_date: Mapped[date_t] = mapped_column(
		Date,
		nullable=False,
		index=True,
	)
	source: Mapped[TransactionSource] = mapped_column(
		SAEnum(TransactionSource, name="transaction_source"),
		nullable=False,
		default=TransactionSource.manual,
	)
	confidence_score: Mapped[Decimal | None] = mapped_column(
		Numeric(3, 2),
		nullable=True,
	)
	note: Mapped[str | None] = mapped_column(Text, nullable=True)

	account: Mapped["Account | None"] = relationship(
		"Account",
		lazy="raise",
	)

	__table_args__ = (
		# List utama: user → date desc.
		Index(
			"ix_transactions_user_date",
			"user_id",
			"transaction_date",
		),
		# Filter by-account: dipakai detail per-akun & holdings reconciliation.
		Index("ix_transactions_user_account", "user_id", "account_id"),
	)
