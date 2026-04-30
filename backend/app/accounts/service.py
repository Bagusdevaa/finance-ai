"""Account business logic.

Service layer murni — input AsyncSession + DTO, output ORM object.
Semua query difilter `user_id` + `deleted_at IS NULL` (security boundary).
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.accounts.models import Account
from app.accounts.schemas import AccountCreate, AccountUpdate
from app.core.errors import NotFoundError
from app.users.models import User


async def list_accounts(session: AsyncSession, user: User) -> list[Account]:
	stmt = (
		select(Account)
		.where(Account.user_id == user.id, Account.deleted_at.is_(None))
		.order_by(Account.created_at.desc())
	)
	result = await session.scalars(stmt)
	return list(result.all())


async def get_account(
	session: AsyncSession, user: User, account_id: UUID
) -> Account:
	stmt = select(Account).where(
		Account.id == account_id,
		Account.user_id == user.id,
		Account.deleted_at.is_(None),
	)
	account = await session.scalar(stmt)
	if account is None:
		raise NotFoundError(code="ACCOUNT_NOT_FOUND", message="Account not found")
	return account


async def create_account(
	session: AsyncSession, user: User, data: AccountCreate
) -> Account:
	account = Account(
		user_id=user.id,
		name=data.name.strip(),
		type=data.type,
		last4=data.last4,
		currency=data.currency.upper(),
	)
	session.add(account)
	await session.commit()
	await session.refresh(account)
	return account


async def update_account(
	session: AsyncSession, user: User, account_id: UUID, data: AccountUpdate
) -> Account:
	account = await get_account(session, user, account_id)
	update_data = data.model_dump(exclude_unset=True)
	for field, value in update_data.items():
		setattr(account, field, value)
	await session.commit()
	await session.refresh(account)
	return account


async def delete_account(
	session: AsyncSession, user: User, account_id: UUID
) -> None:
	account = await get_account(session, user, account_id)
	account.deleted_at = datetime.now(timezone.utc)
	await session.commit()
