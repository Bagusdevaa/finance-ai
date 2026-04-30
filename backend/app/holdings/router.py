"""Stock holding HTTP endpoints."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_session
from app.holdings import service
from app.holdings.schemas import (
	HoldingCreate,
	HoldingResponse,
	HoldingsListResponse,
	HoldingUpdate,
)
from app.users.models import User


router = APIRouter()


def _to_response(holding, account) -> HoldingResponse:
	return HoldingResponse(
		id=holding.id,
		account_id=holding.account_id,
		account_name=account.name,
		ticker=holding.ticker,
		lot=holding.lot,
		avg_price=holding.avg_price,
	)


@router.get("/", response_model=HoldingsListResponse)
async def list_holdings(
	view: Literal["aggregate", "per_account"] = Query(default="aggregate"),
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> HoldingsListResponse:
	items = await service.list_holdings(session, user, view)
	return HoldingsListResponse(items=items)


@router.post(
	"/",
	response_model=HoldingResponse,
	status_code=status.HTTP_201_CREATED,
)
async def create_holding(
	data: HoldingCreate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	holding, account = await service.create_holding(session, user, data)
	return _to_response(holding, account)


@router.get("/{holding_id}", response_model=HoldingResponse)
async def get_holding(
	holding_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	holding, account = await service.get_holding(session, user, holding_id)
	return _to_response(holding, account)


@router.patch("/{holding_id}", response_model=HoldingResponse)
async def update_holding(
	holding_id: UUID,
	data: HoldingUpdate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	holding, account = await service.update_holding(session, user, holding_id, data)
	return _to_response(holding, account)


@router.delete("/{holding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_holding(
	holding_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> None:
	await service.delete_holding(session, user, holding_id)
