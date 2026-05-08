"""Account HTTP endpoints.

Semua endpoint butuh auth — get_current_user dependency.
Router tipis: parse → service call → serialize.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts import service
from app.accounts.schemas import AccountCreate, AccountResponse, AccountUpdate
from app.dependencies import get_current_user, get_session
from app.users.models import User


router = APIRouter()


@router.get("/", response_model=list[AccountResponse])
async def list_accounts(
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> list:
	return await service.list_accounts(session, user)


@router.post(
	"/",
	response_model=AccountResponse,
	status_code=status.HTTP_201_CREATED,
)
async def create_account(
	data: AccountCreate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.create_account(session, user, data)


@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
	account_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.get_account(session, user, account_id)


@router.patch("/{account_id}", response_model=AccountResponse)
async def update_account(
	account_id: UUID,
	data: AccountUpdate,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
):
	return await service.update_account(session, user, account_id, data)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
	account_id: UUID,
	user: User = Depends(get_current_user),
	session: AsyncSession = Depends(get_session),
) -> None:
	await service.delete_account(session, user, account_id)
