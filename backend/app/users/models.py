"""User ORM model.

Email selalu disimpan lowercase — normalisasi dilakukan di service layer.
hashed_password nullable supaya nanti user OAuth-only (Google) bisa exist tanpa password.
"""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import (
	SoftDeleteMixin,
	TimestampMixin,
	UUIDPrimaryKeyMixin,
)
from app.database import Base


if TYPE_CHECKING:
	from app.auth.models import RefreshToken


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "users"

	email: Mapped[str] = mapped_column(
		String(320),
		unique=True,
		index=True,
		nullable=False,
	)
	hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
	name: Mapped[str] = mapped_column(String(255), nullable=False)

	# Placeholder untuk Google OAuth flow — diisi nanti.
	google_sub: Mapped[str | None] = mapped_column(
		String(255),
		unique=True,
		index=True,
		nullable=True,
	)

	is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
	last_login_at: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True),
		nullable=True,
	)

	refresh_tokens: Mapped[list["RefreshToken"]] = relationship(
		"RefreshToken",
		back_populates="user",
		cascade="all, delete-orphan",
		lazy="selectin",
	)
