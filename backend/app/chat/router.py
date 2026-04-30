"""Chat HTTP endpoints.

POST /sessions/{id}/messages return SSE stream — bukan JSON biasa.
Frontend parse `data: {...}` lines incrementally.
"""

import json
from uuid import UUID

from fastapi import APIRouter, Depends, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat import service
from app.chat.schemas import (
	ChatMessageResponse,
	ChatSessionCreate,
	ChatSessionDetailResponse,
	ChatSessionResponse,
	PostMessageRequest,
)
from app.dependencies import get_current_user, get_session
from app.users.models import User


router = APIRouter()


@router.post(
	"/sessions",
	response_model=ChatSessionResponse,
	status_code=status.HTTP_201_CREATED,
)
async def create_session(
	data: ChatSessionCreate | None = None,
	user: User = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
):
	title = data.title if data else None
	return await service.create_session(db, user, title=title)


@router.get("/sessions", response_model=list[ChatSessionResponse])
async def list_sessions(
	user: User = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
):
	return await service.list_sessions(db, user)


@router.get(
	"/sessions/{session_id}",
	response_model=ChatSessionDetailResponse,
)
async def get_session_detail(
	session_id: UUID,
	user: User = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
):
	chat = await service.get_session_detail(db, user, session_id)
	return ChatSessionDetailResponse(
		id=chat.id,
		title=chat.title,
		last_message_at=chat.last_message_at,
		created_at=chat.created_at,
		updated_at=chat.updated_at,
		messages=[ChatMessageResponse.model_validate(m) for m in chat.messages],
	)


@router.delete(
	"/sessions/{session_id}",
	status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_session(
	session_id: UUID,
	user: User = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
) -> None:
	await service.delete_session(db, user, session_id)


@router.post("/sessions/{session_id}/messages")
async def post_message(
	session_id: UUID,
	body: PostMessageRequest,
	user: User = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
):
	"""SSE stream. Each event:
	  data: {"type": "...", ...}\\n\\n
	Final sentinel:
	  data: [DONE]\\n\\n
	"""

	async def event_gen():
		try:
			async for event in service.post_message_streaming(
				db, user, session_id, body.content
			):
				yield f"data: {json.dumps(event)}\n\n"
		except Exception as exc:
			# Misal NotFoundError dari ownership check — surface ke client
			# sebagai error event lalu close stream.
			err = {"type": "error", "message": str(exc)[:200]}
			yield f"data: {json.dumps(err)}\n\n"
		yield "data: [DONE]\n\n"

	return StreamingResponse(event_gen(), media_type="text/event-stream")
