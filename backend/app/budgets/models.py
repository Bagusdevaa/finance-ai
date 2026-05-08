"""Budget ORM model.

Per-category monthly budget. `month` selalu first-of-month (01).
"Spent" tidak disimpan — selalu dihitung dari transactions saat query summary.

Unique-nya pakai partial index (deleted_at IS NULL) supaya soft-delete tidak
block insert ulang category yang pernah dihapus.
"""

import uuid
from datetime import date as date_t
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Index, Numeric, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base_model import (
	SoftDeleteMixin,
	TimestampMixin,
	UUIDPrimaryKeyMixin,
)
from app.database import Base


class Budget(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "budgets"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	category: Mapped[str] = mapped_column(String(64), nullable=False)
	monthly_amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
	month: Mapped[date_t] = mapped_column(Date, nullable=False)
	icon: Mapped[str | None] = mapped_column(String(32), nullable=True)

	__table_args__ = (
		Index(
			"uq_budgets_user_category_month_active",
			"user_id",
			"category",
			"month",
			unique=True,
			postgresql_where=text("deleted_at IS NULL"),
		),
	)
