"""Chat session + message ORM.

Sources di-simpan sebagai list of transaction_id strings supaya frontend
bisa link langsung ke transaksi yang di-cite asisten.
"""

import uuid
from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.base_model import (
	SoftDeleteMixin,
	TimestampMixin,
	UUIDPrimaryKeyMixin,
)
from app.database import Base


class ChatRole(str, Enum):
	user = "user"
	assistant = "assistant"
	system = "system"


class ChatSession(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "chat_sessions"

	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	title: Mapped[str] = mapped_column(
		String(200),
		nullable=False,
		default="Percakapan baru",
	)
	# Dipakai untuk sort di list view (last_message_at desc nulls last).
	last_message_at: Mapped[datetime | None] = mapped_column(
		DateTime(timezone=True),
		nullable=True,
	)

	messages: Mapped[list["ChatMessage"]] = relationship(
		"ChatMessage",
		back_populates="session",
		cascade="all, delete-orphan",
		lazy="raise",
	)


class ChatMessage(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
	__tablename__ = "chat_messages"

	session_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("chat_sessions.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	# Denormalized — semua scope check filter user_id langsung tanpa JOIN ke session.
	user_id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True),
		ForeignKey("users.id", ondelete="CASCADE"),
		index=True,
		nullable=False,
	)
	role: Mapped[ChatRole] = mapped_column(
		SAEnum(ChatRole, name="chat_role"),
		nullable=False,
	)
	content: Mapped[str] = mapped_column(Text, nullable=False)
	# List transaction_id (string UUID) yang di-cite oleh assistant message.
	# Null untuk user/system messages.
	sources: Mapped[list[str] | None] = mapped_column(
		JSONB,
		nullable=True,
	)

	session: Mapped["ChatSession"] = relationship(
		"ChatSession",
		back_populates="messages",
	)
