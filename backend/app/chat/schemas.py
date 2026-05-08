"""Pydantic schemas untuk chat endpoints."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.chat.models import ChatRole


class ChatSessionCreate(BaseModel):
	title: str | None = Field(default=None, max_length=200)


class ChatSessionResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	title: str
	last_message_at: datetime | None
	created_at: datetime
	updated_at: datetime


class ChatMessageResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	session_id: UUID
	role: ChatRole
	content: str
	sources: list[str] | None
	created_at: datetime


class ChatSessionDetailResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	id: UUID
	title: str
	last_message_at: datetime | None
	created_at: datetime
	updated_at: datetime
	messages: list[ChatMessageResponse]


class PostMessageRequest(BaseModel):
	content: str = Field(..., min_length=1, max_length=4000)
