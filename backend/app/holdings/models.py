"""Stock holding ORM model.

Satu row per (account, ticker). Aggregate antar broker dihitung di service,
tidak disimpan — current_price juga tidak disimpan (selalu fetched).
"""

import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, Numeric, String, text
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


class StockHolding(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "stock_holdings"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	account_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("accounts.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	# Ticker IDX biasanya 4 huruf (BBCA, TLKM); cap 10 untuk safety.
	ticker: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
	lot: Mapped[int] = mapped_column(Integer, nullable=False)
	avg_price: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)

	account: Mapped["Account"] = relationship("Account", lazy="raise")

	__table_args__ = (
		Index(
			"uq_holdings_account_ticker_active",
			"account_id",
			"ticker",
			unique=True,
			postgresql_where=text("deleted_at IS NULL"),
		),
	)
