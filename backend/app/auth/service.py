"""Auth business logic.

Service layer murni — tidak tahu soal HTTP, hanya AsyncSession + DTO.
Router yang ngurus cookie & status code.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import RefreshToken
from app.auth.schemas import LoginRequest, RegisterRequest
from app.auth.utils import (
	create_access_token,
	generate_refresh_token,
	hash_password,
	hash_refresh_token,
	verify_password,
)
from app.config import get_settings
from app.core.errors import ConflictError, UnauthorizedError
from app.users.models import User


settings = get_settings()


async def register(session: AsyncSession, data: RegisterRequest) -> User:
	email = data.email.lower().strip()

	existing = await session.scalar(select(User).where(User.email == email))
	if existing is not None:
		raise ConflictError(code="EMAIL_TAKEN", message="Email already registered")

	user = User(
		email=email,
		hashed_password=hash_password(data.password),
		name=data.name.strip(),
	)
	session.add(user)
	await session.commit()
	await session.refresh(user)
	return user


async def login(
	session: AsyncSession, data: LoginRequest
) -> tuple[User, str, str, datetime]:
	email = data.email.lower().strip()

	user = await session.scalar(select(User).where(User.email == email))
	# Sengaja generic message — jangan kasih tahu apakah email ada / password salah.
	if user is None or user.hashed_password is None:
		raise UnauthorizedError(
			code="INVALID_CREDENTIALS", message="Invalid email or password"
		)
	if not verify_password(data.password, user.hashed_password):
		raise UnauthorizedError(
			code="INVALID_CREDENTIALS", message="Invalid email or password"
		)
	if not user.is_active:
		raise UnauthorizedError(code="ACCOUNT_DISABLED", message="Account disabled")

	access_token = create_access_token(user.id)
	refresh_plain, refresh_hash = generate_refresh_token()
	expires_at = datetime.now(timezone.utc) + timedelta(
		days=settings.REFRESH_TOKEN_EXPIRE_DAYS
	)

	session.add(
		RefreshToken(
			user_id=user.id,
			token_hash=refresh_hash,
			expires_at=expires_at,
		)
	)
	user.last_login_at = datetime.now(timezone.utc)

	await session.commit()
	await session.refresh(user)

	return user, access_token, refresh_plain, expires_at


async def refresh(
	session: AsyncSession, refresh_plaintext: str
) -> tuple[User, str, str, datetime]:
	token_hash = hash_refresh_token(refresh_plaintext)

	old = await session.scalar(
		select(RefreshToken).where(RefreshToken.token_hash == token_hash)
	)
	if old is None:
		raise UnauthorizedError(
			code="INVALID_REFRESH_TOKEN", message="Refresh token not recognized"
		)

	now = datetime.now(timezone.utc)
	# expires_at dari DB bisa naive/aware tergantung driver — normalkan ke aware.
	expires_at = old.expires_at
	if expires_at.tzinfo is None:
		expires_at = expires_at.replace(tzinfo=timezone.utc)

	if old.revoked_at is not None or expires_at < now:
		raise UnauthorizedError(
			code="INVALID_REFRESH_TOKEN", message="Refresh token expired or revoked"
		)

	user = await session.get(User, old.user_id)
	if user is None or not user.is_active:
		raise UnauthorizedError(
			code="INVALID_REFRESH_TOKEN", message="User not available"
		)

	# Rotation: bikin token baru dulu sebelum revoke yang lama, supaya bisa link replaced_by_id.
	new_plain, new_hash = generate_refresh_token()
	new_expires = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
	new_token = RefreshToken(
		user_id=user.id,
		token_hash=new_hash,
		expires_at=new_expires,
	)
	session.add(new_token)
	await session.flush()  # populate new_token.id

	old.revoked_at = now
	old.replaced_by_id = new_token.id

	access_token = create_access_token(user.id)

	await session.commit()
	await session.refresh(user)

	return user, access_token, new_plain, new_expires


async def logout(session: AsyncSession, refresh_plaintext: str) -> None:
	"""Idempotent — kalau token tidak ada / sudah revoked, anggap success."""
	token_hash = hash_refresh_token(refresh_plaintext)
	token = await session.scalar(
		select(RefreshToken).where(RefreshToken.token_hash == token_hash)
	)
	if token is None or token.revoked_at is not None:
		return
	token.revoked_at = datetime.now(timezone.utc)
	await session.commit()
