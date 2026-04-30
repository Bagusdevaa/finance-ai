"""Helper kripto untuk auth flow.

Password: bcrypt via passlib (slow hash, salt otomatis).
Access token: JWT (HS256), short-lived (15 menit default).
Refresh token: random urlsafe string, simpan sha256 hash di DB.
	→ sha256 cukup karena token sendiri sudah high-entropy (48 bytes random),
	  bcrypt overkill di sini dan bikin lookup jadi mahal.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings
from app.core.errors import UnauthorizedError


settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
	return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
	return _pwd_context.verify(plain, hashed)


def create_access_token(user_id: uuid.UUID) -> str:
	now = datetime.now(timezone.utc)
	expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
	payload = {
		"sub": str(user_id),
		"iat": int(now.timestamp()),
		"exp": int(expire.timestamp()),
		"type": "access",
		"jti": uuid.uuid4().hex,
	}
	return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
	try:
		payload = jwt.decode(
			token,
			settings.JWT_SECRET_KEY,
			algorithms=[settings.JWT_ALGORITHM],
		)
	except JWTError as exc:
		raise UnauthorizedError(code="INVALID_TOKEN", message="Invalid or expired token") from exc

	if payload.get("type") != "access":
		raise UnauthorizedError(code="INVALID_TOKEN", message="Wrong token type")

	sub = payload.get("sub")
	if not sub:
		raise UnauthorizedError(code="INVALID_TOKEN", message="Token missing subject")

	try:
		return uuid.UUID(sub)
	except ValueError as exc:
		raise UnauthorizedError(code="INVALID_TOKEN", message="Invalid token subject") from exc


def hash_refresh_token(plaintext: str) -> str:
	return hashlib.sha256(plaintext.encode("utf-8")).hexdigest()


def generate_refresh_token() -> tuple[str, str]:
	"""Return (plaintext, hash). Plaintext dikirim ke client via cookie, hash disimpan di DB."""
	plaintext = secrets.token_urlsafe(48)
	return plaintext, hash_refresh_token(plaintext)
