"""Transaction HTTP endpoints."""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_session
from app.transactions import service
from app.transactions.schemas import (
	TransactionCreate,
	TransactionListResponse,
	TransactionResponse,
	TransactionUpdate,
)
from app.transactions.service import TransactionFilters
from app.users.models import User


router = APIRouter()


@router.get("/", response_model=TransactionListResponse)
async def list_transactions(
	cursor: str | None = Query(default=None),
	limit: int = Query(default=50, ge=1, le=200),
	account_id: UUID | None = Query(default=None),
	category: str | None = Query(default=None),
	type: str | None = Query(default=None, pattern="^(in|out|all)$"),
	date_from: date | None = Query(default=None),
	date_to: date | None = Query(default=None),
	search: str | None = Query(default=None),
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> TransactionListResponse:
	filters = TransactionFilters(
		account_id=account_id,
		category=category,
		type=type,
		date_from=date_from,
		date_to=date_to,
		search=search,
	)
	items, next_cursor, has_more = await service.list_transactions(
		session, user, filters, cursor=cursor, limit=limit
	)
	return TransactionListResponse(
		items=[TransactionResponse.model_validate(tx) for tx in items],
		next_cursor=next_cursor,
		has_more=has_more,
	)


@router.post(
	"/",
	response_model=TransactionResponse,
	status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
	data: TransactionCreate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.create_transaction(session, user, data)


@router.get("/{tx_id}", response_model=TransactionResponse)
async def get_transaction(
	tx_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.get_transaction(session, user, tx_id)


@router.patch("/{tx_id}", response_model=TransactionResponse)
async def update_transaction(
	tx_id: UUID,
	data: TransactionUpdate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.update_transaction(session, user, tx_id, data)


@router.delete("/{tx_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
	tx_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> None:
	await service.delete_transaction(session, user, tx_id)
