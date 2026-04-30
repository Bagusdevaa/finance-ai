"""RefreshToken ORM model.

Token disimpan sebagai sha256 hash, BUKAN plaintext.
Kalau DB bocor, attacker tidak langsung bisa pakai token.

replaced_by_id: audit trail rotation chain — kalau token A dipakai refresh
dan menghasilkan token B, A.replaced_by_id = B.id, A.revoked_at = now.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import UUIDPrimaryKeyMixin
from app.database import Base


if TYPE_CHECKING:
	from app.users.models import User


class RefreshToken(UUIDPrimaryKeyMixin, Base):
	__tablename__ = "refresh_tokens"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	token_hash: Mapped[str] = mapped_column(
		String(128),
		index=True,
		unique=True,
		nullable=False,
	)
	expires_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		nullable=False,
	)
	revoked_at: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True),
		nullable=True,
	)
	replaced_by_id: Mapped[uuid.UUID | None] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("refresh_tokens.id", ondelete="SET NULL"),
		nullable=True,
	)
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		server_default=func.now(),
		nullable=False,
	)

	user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")
