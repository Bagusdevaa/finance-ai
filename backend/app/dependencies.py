"""FastAPI dependencies yang dipakai lintas-fitur."""

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.utils import decode_access_token
from app.core.errors import UnauthorizedError
from app.database import get_session
from app.users.models import User


# tokenUrl untuk OpenAPI docs — endpoint sebenarnya pakai JSON body, bukan form,
# tapi Swagger UI tetap bisa pakai ini buat "Authorize" button.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/v1/auth/login", auto_error=False)


async def get_current_user(
	token: str | None = Depends(oauth2_scheme),
	session: AsyncSession = Depends(get_session),
) -> User:
	if not token:
		raise UnauthorizedError(
			code="MISSING_TOKEN", message="Authentication required"
		)

	user_id = decode_access_token(token)
	user = await session.get(User, user_id)
	if user is None or not user.is_active or user.deleted_at is not None:
		raise UnauthorizedError(
			code="INVALID_TOKEN", message="User not found or inactive"
		)
	return user


__all__ = ["get_session", "get_current_user", "oauth2_scheme"]
