"""Auth HTTP endpoints.

Refresh token disimpan di HttpOnly cookie dengan path=/v1/auth supaya
hanya dikirim ke endpoint auth — mengurangi exposure di endpoint lain.
"""

from fastapi import APIRouter, Cookie, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import service
from app.auth.schemas import (
	LoginRequest,
	RefreshResponse,
	RegisterRequest,
	TokenResponse,
	UserPublic,
)
from app.config import get_settings
from app.core.errors import UnauthorizedError
from app.dependencies import get_current_user, get_session
from app.users.models import User


router = APIRouter()
settings = get_settings()


REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/v1/auth"


def _set_refresh_cookie(response: Response, token: str) -> None:
	response.set_cookie(
		key=REFRESH_COOKIE_NAME,
		value=token,
		max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
		path=REFRESH_COOKIE_PATH,
		httponly=True,
		secure=settings.is_production,
		samesite="lax",
	)


def _clear_refresh_cookie(response: Response) -> None:
	response.delete_cookie(
		key=REFRESH_COOKIE_NAME,
		path=REFRESH_COOKIE_PATH,
	)


@router.post(
	"/register",
	response_model=UserPublic,
	status_code=status.HTTP_201_CREATED,
)
async def register(
	data: RegisterRequest,
	session: AsyncSession = Depends(get_session),
) -> User:
	return await service.register(session, data)


@router.post("/login", response_model=TokenResponse)
async def login(
	data: LoginRequest,
	response: Response,
	session: AsyncSession = Depends(get_session),
) -> TokenResponse:
	user, access_token, refresh_plain, _ = await service.login(session, data)
	_set_refresh_cookie(response, refresh_plain)
	return TokenResponse(
		access_token=access_token,
		expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
		user=UserPublic.model_validate(user),
	)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
	response: Response,
	refresh_token: str | None = Cookie(default=None),
	session: AsyncSession = Depends(get_session),
) -> RefreshResponse:
	if not refresh_token:
		raise UnauthorizedError(
			code="MISSING_REFRESH_TOKEN", message="Refresh token cookie not found"
		)

	user, access_token, new_refresh, _ = await service.refresh(session, refresh_token)
	_set_refresh_cookie(response, new_refresh)
	return RefreshResponse(
		access_token=access_token,
		expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
		user=UserPublic.model_validate(user),
	)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
	response: Response,
	refresh_token: str | None = Cookie(default=None),
	session: AsyncSession = Depends(get_session),
) -> None:
	if refresh_token:
		await service.logout(session, refresh_token)
	# Cookie di-clear dengan path yang sama supaya browser benar-benar hapus.
	_clear_refresh_cookie(response)


@router.get("/me", response_model=UserPublic)
async def me(current_user: User = Depends(get_current_user)) -> User:
	return current_user
