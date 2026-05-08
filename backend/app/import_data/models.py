"""Import pipeline ORM models.

Dua table: ImportJob (header) + ImportRow (line items hasil parse).
Row dipisah supaya user bisa edit/exclude per-baris sebelum konfirmasi.
"""

import uuid
from datetime import date as date_t, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import (
	Boolean,
	Date,
	DateTime,
	ForeignKey,
	Index,
	Integer,
	Numeric,
	String,
	Text,
)
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
	pass


class ImportSourceType(str, Enum):
	pdf_bca = "pdf_bca"
	pdf_mandiri = "pdf_mandiri"
	pdf_bri = "pdf_bri"
	csv_bibit = "csv_bibit"
	csv_ipot = "csv_ipot"
	image_vision = "image_vision"
	manual_csv = "manual_csv"


class ImportJobStatus(str, Enum):
	pending = "pending"
	processing = "processing"
	review = "review"
	confirmed = "confirmed"
	failed = "failed"
	cancelled = "cancelled"


class ImportJob(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "import_jobs"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	# Account opsional — import bisa belum di-attach ke akun saat upload.
	account_id: Mapped[uuid.UUID | None] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("accounts.id", ondelete="SET NULL"),
		nullable=True,
	)
	source_type: Mapped[ImportSourceType] = mapped_column(
		SAEnum(ImportSourceType, name="import_source_type"),
		nullable=False,
	)
	status: Mapped[ImportJobStatus] = mapped_column(
		SAEnum(ImportJobStatus, name="import_job_status"),
		nullable=False,
		default=ImportJobStatus.pending,
	)

	file_name: Mapped[str] = mapped_column(String(255), nullable=False)
	# Path relatif ke backend/uploads/ — biar portable antar env.
	file_path: Mapped[str] = mapped_column(String(500), nullable=False)
	file_size: Mapped[int] = mapped_column(Integer, nullable=False)
	mime_type: Mapped[str | None] = mapped_column(String(255), nullable=True)

	rows_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	rows_ok: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	rows_warn: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	rows_err: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

	error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
	confirmed_at: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True),
		nullable=True,
	)

	rows: Mapped[list["ImportRow"]] = relationship(
		"ImportRow",
		back_populates="job",
		cascade="all, delete-orphan",
		lazy="raise",
	)


class ImportRow(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "import_rows"

	job_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("import_jobs.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	# Denormalized — hindari JOIN setiap kali query user-scoped.
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)

	line_no: Mapped[int] = mapped_column(Integer, nullable=False)

	transaction_date: Mapped[date_t] = mapped_column(Date, nullable=False)
	amount: Mapped[Decimal] = mapped_column(Numeric(15, 2), nullable=False)
	currency: Mapped[str] = mapped_column(String(3), nullable=False, default="IDR")

	merchant_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
	description: Mapped[str | None] = mapped_column(String(500), nullable=True)
	category: Mapped[str | None] = mapped_column(String(64), nullable=True)

	# 0.00–1.00; threshold display: <0.5 err, 0.5–0.8 warn, >=0.8 ok.
	confidence_score: Mapped[Decimal] = mapped_column(
		Numeric(3, 2),
		nullable=False,
		default=Decimal("1.00"),
	)
	raw_text: Mapped[str] = mapped_column(Text, nullable=False, default="")

	is_duplicate: Mapped[bool] = mapped_column(
		Boolean,
		nullable=False,
		default=False,
	)
	is_excluded: Mapped[bool] = mapped_column(
		Boolean,
		nullable=False,
		default=False,
	)

	job: Mapped["ImportJob"] = relationship("ImportJob", back_populates="rows")

	__table_args__ = (
		Index("ix_import_rows_job_line", "job_id", "line_no"),
	)
