# FinanceAI — Backend Prompts (Production Grade)
# FastAPI · PostgreSQL · Qdrant · Groq

Arsitektur: Full FastAPI. Next.js adalah pure frontend — zero backend logic.
Standard: Production-grade, industry standard. Bukan tutorial, bukan MVP asal jalan.

---

## PROMPT 01 — Project Setup & Structure

```
Buat project FastAPI untuk FinanceAI dengan standar production.

=== TECH STACK ===
- FastAPI (latest)
- PostgreSQL via SQLAlchemy 2.0 (async) + Alembic (migrations)
- Pydantic v2 (request/response validation)
- python-jose (JWT)
- passlib[bcrypt] (password hashing)
- authlib (Google OAuth)
- httpx (async HTTP client untuk Groq)
- pdfplumber (PDF parsing)
- qdrant-client (vector DB)
- slowapi (rate limiting)
- structlog (structured logging)
- python-dotenv
- uvicorn[standard]

=== FOLDER STRUCTURE ===

backend/
├── app/
│   ├── main.py                  # FastAPI app, middleware, routers
│   ├── config.py                # Settings via pydantic-settings
│   ├── database.py              # Async SQLAlchemy engine + session
│   ├── dependencies.py          # Shared FastAPI dependencies
│   │
│   ├── auth/
│   │   ├── router.py            # /auth/* endpoints
│   │   ├── service.py           # Auth business logic
│   │   ├── schemas.py           # Pydantic request/response models
│   │   └── utils.py             # JWT, password, cookie helpers
│   │
│   ├── users/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── models.py            # SQLAlchemy ORM model
│   │
│   ├── accounts/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── models.py
│   │
│   ├── transactions/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── models.py
│   │
│   ├── assets/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── models.py
│   │
│   ├── budget/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── models.py
│   │
│   ├── import_data/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   ├── models.py
│   │   └── parsers/
│   │       ├── base.py          # Abstract base parser
│   │       ├── pdf_bca.py
│   │       ├── pdf_mandiri.py
│   │       ├── pdf_bri.py
│   │       ├── csv_bibit.py
│   │       ├── csv_ipot.py
│   │       └── image_vision.py  # Groq vision parser
│   │
│   ├── chat/
│   │   ├── router.py
│   │   ├── service.py
│   │   ├── schemas.py
│   │   └── models.py
│   │
│   ├── ai/
│   │   ├── groq_client.py       # Groq API wrapper
│   │   ├── rag_pipeline.py      # Qdrant indexing + querying
│   │   ├── categorizer.py       # Transaction auto-categorization
│   │   └── insights.py          # Dashboard AI insights generator
│   │
│   └── core/
│       ├── errors.py            # Global exception handlers
│       ├── logging.py           # Structlog setup
│       ├── middleware.py        # Request ID, logging middleware
│       └── health.py            # Health check endpoint
│
├── alembic/
│   ├── env.py
│   └── versions/                # Migration files
│
├── tests/
│   ├── conftest.py              # Pytest fixtures
│   ├── test_auth.py
│   ├── test_transactions.py
│   └── test_import.py
│
├── .env.example
├── alembic.ini
├── requirements.txt
└── Dockerfile

=== app/config.py ===

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
	DATABASE_URL: str
	REDIS_URL: str = ""  # opsional, untuk future caching

	# JWT
	JWT_SECRET_KEY: str
	JWT_ALGORITHM: str = "HS256"
	ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
	REFRESH_TOKEN_EXPIRE_DAYS: int = 30

	# Google OAuth
	GOOGLE_CLIENT_ID: str = ""
	GOOGLE_CLIENT_SECRET: str = ""
	GOOGLE_REDIRECT_URI: str = "https://api.yourdomain.com/auth/google/callback"

	# Groq
	GROQ_API_KEY: str
	GROQ_MODEL: str = "llama-3.3-70b-versatile"
	GROQ_VISION_MODEL: str = "llama-3.2-11b-vision-preview"

	# Qdrant
	QDRANT_URL: str = "http://qdrant:6333"
	QDRANT_COLLECTION: str = "financeai_transactions"

	# App
	FRONTEND_URL: str = "https://yourdomain.com"
	ENVIRONMENT: str = "production"
	LOG_LEVEL: str = "INFO"

	class Config:
		env_file = ".env"

settings = Settings()

=== app/main.py ===

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.core.errors import register_exception_handlers
from app.core.middleware import RequestIDMiddleware, LoggingMiddleware
from app.core.logging import setup_logging

# Import semua routers
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.accounts.router import router as accounts_router
from app.transactions.router import router as transactions_router
from app.assets.router import router as assets_router
from app.budget.router import router as budget_router
from app.import_data.router import router as import_router
from app.chat.router import router as chat_router
from app.core.health import router as health_router

setup_logging()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
	title="FinanceAI API",
	version="1.0.0",
	docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
	redoc_url=None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — hanya izinkan frontend domain
app.add_middleware(
	CORSMiddleware,
	allow_origins=[settings.FRONTEND_URL],
	allow_credentials=True,  # penting untuk cookies
	allow_methods=["*"],
	allow_headers=["*"],
)

app.add_middleware(RequestIDMiddleware)
app.add_middleware(LoggingMiddleware)

# Register semua routers dengan prefix /v1
app.include_router(health_router)
app.include_router(auth_router, prefix="/v1/auth", tags=["auth"])
app.include_router(users_router, prefix="/v1/users", tags=["users"])
app.include_router(accounts_router, prefix="/v1/accounts", tags=["accounts"])
app.include_router(transactions_router, prefix="/v1/transactions", tags=["transactions"])
app.include_router(assets_router, prefix="/v1/assets", tags=["assets"])
app.include_router(budget_router, prefix="/v1/budget", tags=["budget"])
app.include_router(import_router, prefix="/v1/import", tags=["import"])
app.include_router(chat_router, prefix="/v1/chat", tags=["chat"])

register_exception_handlers(app)
```

---

## PROMPT 02 — Database Schema (SQLAlchemy Models)

```
Buat semua SQLAlchemy 2.0 async models untuk FinanceAI.
Gunakan UUID sebagai primary key, soft delete pattern, dan audit timestamps.

=== BASE MODEL ===
Semua model inherit dari Base ini:

# app/core/base_model.py
import uuid
from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID

class Base(DeclarativeBase):
	pass

class TimestampMixin:
	created_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now()
	)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
	)

class UUIDMixin:
	id: Mapped[uuid.UUID] = mapped_column(
		UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
	)

=== MODELS ===

--- users/models.py ---
class User(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "users"

	email: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
	name: Mapped[str] = mapped_column(nullable=False)
	hashed_password: Mapped[str | None]  # None jika OAuth-only
	google_id: Mapped[str | None] = mapped_column(unique=True, index=True)
	avatar_url: Mapped[str | None]
	is_active: Mapped[bool] = mapped_column(default=True)
	is_verified: Mapped[bool] = mapped_column(default=False)
	onboarding_completed: Mapped[bool] = mapped_column(default=False)

	# Relationships
	accounts: Mapped[list["Account"]] = relationship(back_populates="user")
	refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")

--- auth/models.py ---
class RefreshToken(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "refresh_tokens"

	user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
	token_hash: Mapped[str] = mapped_column(unique=True)  # simpan hash, bukan raw token
	expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
	revoked: Mapped[bool] = mapped_column(default=False)
	user_agent: Mapped[str | None]  # untuk device tracking
	ip_address: Mapped[str | None]

	user: Mapped["User"] = relationship(back_populates="refresh_tokens")

--- accounts/models.py ---
class AccountType(str, Enum):
	BANK = "BANK"
	EWALLET = "EWALLET"
	INVESTMENT = "INVESTMENT"
	CRYPTO = "CRYPTO"
	CASH = "CASH"

class Account(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "accounts"

	user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
	name: Mapped[str]            # "BCA Tahapan"
	platform: Mapped[str]        # "BCA", "Mandiri", "Bibit", "IPOT"
	type: Mapped[AccountType]
	masked_number: Mapped[str | None]  # "****1234"
	currency: Mapped[str] = mapped_column(default="IDR")
	is_active: Mapped[bool] = mapped_column(default=True)
	color: Mapped[str | None]    # untuk UI differentiation

	user: Mapped["User"] = relationship(back_populates="accounts")
	transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")
	snapshots: Mapped[list["NetWorthSnapshot"]] = relationship(back_populates="account")

--- transactions/models.py ---
class TransactionType(str, Enum):
	INCOME = "INCOME"
	EXPENSE = "EXPENSE"
	TRANSFER = "TRANSFER"

class TransactionCategory(str, Enum):
	FOOD = "FOOD"
	TRANSPORT = "TRANSPORT"
	SHOPPING = "SHOPPING"
	ENTERTAINMENT = "ENTERTAINMENT"
	HEALTH = "HEALTH"
	EDUCATION = "EDUCATION"
	INVESTMENT = "INVESTMENT"
	SALARY = "SALARY"
	TRANSFER = "TRANSFER"
	UTILITIES = "UTILITIES"
	HOUSING = "HOUSING"
	OTHER = "OTHER"

class Transaction(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "transactions"
	__table_args__ = (
		Index("ix_transactions_user_date", "account_id", "date"),
	)

	account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"), index=True)
	date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
	description: Mapped[str]          # nama merchant asli dari bank
	merchant_name: Mapped[str | None] # nama bersih setelah normalisasi
	amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
	# amount: positif = income, negatif = expense
	type: Mapped[TransactionType]
	category: Mapped[TransactionCategory]
	notes: Mapped[str | None]

	# Import tracking
	import_session_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("import_sessions.id"))
	confidence_score: Mapped[float | None]  # 0.0-1.0, dari AI extraction
	is_reviewed: Mapped[bool] = mapped_column(default=False)  # user sudah konfirmasi

	# Soft delete
	deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

	account: Mapped["Account"] = relationship(back_populates="transactions")

--- assets/models.py ---
class AssetType(str, Enum):
	STOCK = "STOCK"
	MUTUAL_FUND = "MUTUAL_FUND"
	CRYPTO = "CRYPTO"
	GOLD = "GOLD"
	PROPERTY = "PROPERTY"
	VEHICLE = "VEHICLE"
	OTHER = "OTHER"

class StockHolding(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "stock_holdings"
	__table_args__ = (
		# Satu ticker per account (bukan global)
		UniqueConstraint("account_id", "ticker"),
	)

	account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
	ticker: Mapped[str] = mapped_column(index=True)   # "BBCA"
	name: Mapped[str]                                  # "Bank Central Asia"
	lot: Mapped[int]
	avg_price: Mapped[Decimal] = mapped_column(Numeric(15, 2))
	# current_price TIDAK disimpan di DB — selalu fetch live atau dari snapshot

class MutualFundHolding(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "mutual_fund_holdings"
	__table_args__ = (
		UniqueConstraint("account_id", "fund_code"),
	)

	account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
	fund_code: Mapped[str]
	fund_name: Mapped[str]
	units: Mapped[Decimal] = mapped_column(Numeric(18, 6))
	avg_nav: Mapped[Decimal] = mapped_column(Numeric(15, 2))

class ManualAsset(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "manual_assets"

	account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
	type: Mapped[AssetType]
	name: Mapped[str]                # "Rumah di Depok"
	current_value: Mapped[Decimal] = mapped_column(Numeric(15, 2))
	notes: Mapped[str | None]

class NetWorthSnapshot(Base, UUIDMixin):
	# Snapshot net worth per bulan untuk chart history
	__tablename__ = "net_worth_snapshots"
	__table_args__ = (
		UniqueConstraint("account_id", "snapshot_date"),
	)

	account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
	snapshot_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
	value: Mapped[Decimal] = mapped_column(Numeric(15, 2))

--- budget/models.py ---
class Budget(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "budgets"
	__table_args__ = (
		UniqueConstraint("user_id", "category", "month"),
	)

	user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
	category: Mapped[TransactionCategory]
	amount: Mapped[Decimal] = mapped_column(Numeric(15, 2))
	month: Mapped[str]  # "2025-02" format YYYY-MM

--- import_data/models.py ---
class ImportStatus(str, Enum):
	UPLOADING = "UPLOADING"
	PROCESSING = "PROCESSING"
	REVIEW = "REVIEW"          # menunggu konfirmasi user
	COMPLETED = "COMPLETED"
	FAILED = "FAILED"

class ImportSession(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "import_sessions"

	user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
	account_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("accounts.id"))
	status: Mapped[ImportStatus] = mapped_column(default=ImportStatus.UPLOADING)
	source_type: Mapped[str]      # "PDF", "CSV", "IMAGE"
	source_platform: Mapped[str]  # "BCA", "Stockbit"
	file_path: Mapped[str | None]
	error_message: Mapped[str | None]
	extracted_count: Mapped[int] = mapped_column(default=0)
	confirmed_count: Mapped[int] = mapped_column(default=0)

--- chat/models.py ---
class ChatSession(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "chat_sessions"

	user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
	title: Mapped[str | None]       # auto-generated dari pesan pertama
	messages: Mapped[list["ChatMessage"]] = relationship(back_populates="session")

class ChatMessage(Base, UUIDMixin, TimestampMixin):
	__tablename__ = "chat_messages"

	session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chat_sessions.id"), index=True)
	role: Mapped[str]    # "user" atau "assistant"
	content: Mapped[str]

=== MIGRATION ===
Setelah semua model dibuat, buat initial migration:
  alembic init alembic
  alembic revision --autogenerate -m "initial_schema"
  alembic upgrade head
```

---

## PROMPT 03 — Auth System (Production Pattern)

```
Implementasikan sistem autentikasi production-grade untuk FinanceAI.
Pattern: Access Token (15 menit, di memory) + Refresh Token (30 hari, HttpOnly Cookie).

=== app/auth/utils.py ===

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Response, Request
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
	return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
	return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
	expire = datetime.now(timezone.utc) + timedelta(
		minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
	)
	return jwt.encode(
		{"sub": user_id, "exp": expire, "type": "access"},
		settings.JWT_SECRET_KEY,
		algorithm=settings.JWT_ALGORITHM,
	)

def create_refresh_token() -> tuple[str, str]:
	# Return (raw_token, hashed_token)
	# Simpan yang hash ke DB, kirim yang raw ke cookie
	raw = secrets.token_urlsafe(64)
	hashed = hashlib.sha256(raw.encode()).hexdigest()
	return raw, hashed

def decode_access_token(token: str) -> str:
	# Return user_id atau raise JWTError
	payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
	if payload.get("type") != "access":
		raise JWTError("Invalid token type")
	return payload["sub"]

def set_refresh_cookie(response: Response, token: str) -> None:
	response.set_cookie(
		key="refresh_token",
		value=token,
		httponly=True,
		secure=True,        # HTTPS only
		samesite="lax",     # CSRF protection
		max_age=60 * 60 * 24 * settings.REFRESH_TOKEN_EXPIRE_DAYS,
		path="/v1/auth",    # cookie HANYA dikirim ke /v1/auth/* — bukan semua endpoint
	)

def clear_refresh_cookie(response: Response) -> None:
	response.delete_cookie(key="refresh_token", path="/v1/auth")

=== app/dependencies.py ===

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.auth.utils import decode_access_token
from app.users.service import UserService

bearer_scheme = HTTPBearer()

async def get_current_user(
	credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
	db: AsyncSession = Depends(get_session),
):
	try:
		user_id = decode_access_token(credentials.credentials)
	except JWTError:
		raise HTTPException(
			status_code=status.HTTP_401_UNAUTHORIZED,
			detail="Invalid or expired token",
		)
	user = await UserService(db).get_by_id(user_id)
	if not user or not user.is_active:
		raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
	return user

=== app/auth/schemas.py ===

class RegisterRequest(BaseModel):
	email: EmailStr
	name: str = Field(min_length=2, max_length=100)
	password: str = Field(min_length=8, max_length=100)

class LoginRequest(BaseModel):
	email: EmailStr
	password: str

class TokenResponse(BaseModel):
	access_token: str
	token_type: str = "bearer"
	expires_in: int  # detik

class AuthResponse(BaseModel):
	user: UserPublic
	access_token: str
	token_type: str = "bearer"
	expires_in: int

=== app/auth/router.py — Semua Endpoints ===

router = APIRouter()

# POST /v1/auth/register
# Rate limit: 5 request per menit per IP
@router.post("/register", response_model=AuthResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
	request: Request,
	body: RegisterRequest,
	response: Response,
	db: AsyncSession = Depends(get_session),
):
	user = await AuthService(db).register(body)
	access_token = create_access_token(str(user.id))
	raw_refresh, hashed_refresh = create_refresh_token()
	await AuthService(db).save_refresh_token(
		user_id=user.id,
		token_hash=hashed_refresh,
		user_agent=request.headers.get("user-agent"),
		ip_address=request.client.host,
	)
	set_refresh_cookie(response, raw_refresh)
	return AuthResponse(
		user=UserPublic.model_validate(user),
		access_token=access_token,
		expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
	)

# POST /v1/auth/login
@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
async def login(
	request: Request,
	body: LoginRequest,
	response: Response,
	db: AsyncSession = Depends(get_session),
):
	user = await AuthService(db).authenticate(body.email, body.password)
	# ... sama seperti register

# POST /v1/auth/refresh
# Baca refresh token dari cookie, return access token baru
@router.post("/refresh", response_model=TokenResponse)
async def refresh(
	request: Request,
	response: Response,
	db: AsyncSession = Depends(get_session),
):
	raw_token = request.cookies.get("refresh_token")
	if not raw_token:
		raise HTTPException(status_code=401, detail="No refresh token")
	hashed = hashlib.sha256(raw_token.encode()).hexdigest()
	token_record = await AuthService(db).get_valid_refresh_token(hashed)
	if not token_record:
		raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
	# Rotate refresh token (best practice — satu token hanya boleh dipakai sekali)
	await AuthService(db).revoke_refresh_token(token_record.id)
	raw_new, hashed_new = create_refresh_token()
	await AuthService(db).save_refresh_token(user_id=token_record.user_id, ...)
	set_refresh_cookie(response, raw_new)
	return TokenResponse(
		access_token=create_access_token(str(token_record.user_id)),
		expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
	)

# POST /v1/auth/logout
@router.post("/logout", status_code=204)
async def logout(
	request: Request,
	response: Response,
	current_user = Depends(get_current_user),
	db: AsyncSession = Depends(get_session),
):
	raw_token = request.cookies.get("refresh_token")
	if raw_token:
		hashed = hashlib.sha256(raw_token.encode()).hexdigest()
		await AuthService(db).revoke_refresh_token_by_hash(hashed)
	clear_refresh_cookie(response)

# GET /v1/auth/google
# Redirect user ke Google consent screen
@router.get("/google")
async def google_oauth_start():
	# authlib redirect ke Google
	...

# GET /v1/auth/google/callback
# Google redirect ke sini setelah user approve
@router.get("/google/callback")
async def google_oauth_callback(
	request: Request,
	response: Response,
	db: AsyncSession = Depends(get_session),
):
	# authlib ambil token, fetch user info dari Google
	# Cek apakah user sudah ada di DB (by google_id atau email)
	# Jika belum: buat user baru (tanpa password)
	# Issue tokens, redirect ke frontend dengan access_token di query param
	# Frontend simpan di memory, buang dari URL
	frontend_url = f"{settings.FRONTEND_URL}/auth/callback?token={access_token}"
	return RedirectResponse(frontend_url)
```

---

## PROMPT 04 — API Contracts Lengkap

```
Implementasikan semua endpoints berikut dengan Pydantic schemas yang tepat.
Setiap endpoint harus punya: request validation, response model, error handling, dan auth guard.

=== STANDARD ERROR RESPONSE ===
Semua error menggunakan format ini (register di core/errors.py):

{
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "Email sudah terdaftar",
		"details": {}  # opsional, untuk field-level errors
	}
}

HTTP Status codes yang digunakan:
200 OK           — sukses GET/PUT
201 Created      — sukses POST yang buat resource baru
204 No Content   — sukses DELETE/logout
400 Bad Request  — validation error, business logic error
401 Unauthorized — token tidak ada atau invalid
403 Forbidden    — user tidak punya akses ke resource
404 Not Found    — resource tidak ditemukan
422 Unprocessable — Pydantic validation error (FastAPI default)
429 Too Many Requests — rate limit

=== PAGINATION ===
Semua endpoint list menggunakan cursor-based pagination:

Request query params:
	limit: int = 20 (max 100)
	cursor: str | None = None  # base64-encoded timestamp + id dari item terakhir

Response wrapper untuk semua list:
class PaginatedResponse(BaseModel, Generic[T]):
	data: list[T]
	next_cursor: str | None  # None jika tidak ada halaman berikutnya
	total: int               # total count tanpa pagination

=== USERS ===

GET /v1/users/me
Auth: Required
Response 200:
{
	"id": "uuid",
	"email": "string",
	"name": "string",
	"avatar_url": "string | null",
	"onboarding_completed": "bool",
	"created_at": "datetime"
}

PUT /v1/users/me
Auth: Required
Request:
{
	"name": "string (optional)",
	"avatar_url": "string (optional)"
}
Response 200: UserPublic (sama seperti GET /me)

PUT /v1/users/me/password
Auth: Required
Request:
{
	"current_password": "string",
	"new_password": "string (min 8)"
}
Response 204

=== ACCOUNTS ===

GET /v1/accounts
Auth: Required
Response 200:
{
	"data": [
		{
			"id": "uuid",
			"name": "string",
			"platform": "string",
			"type": "BANK | EWALLET | INVESTMENT | CRYPTO | CASH",
			"masked_number": "string | null",
			"currency": "string",
			"is_active": "bool",
			"current_balance": "number",  // dihitung dari transaksi terbaru
			"created_at": "datetime"
		}
	]
}

POST /v1/accounts
Auth: Required
Request:
{
	"name": "string",
	"platform": "string",
	"type": "AccountType",
	"masked_number": "string (optional)",
	"initial_balance": "number (optional, default 0)"
}
Response 201: Account object

PUT /v1/accounts/:id
Auth: Required, harus milik user
Request: field yang ingin diupdate (partial update)
Response 200: Account object

DELETE /v1/accounts/:id
Auth: Required, harus milik user
Behavior: soft delete — set is_active=false, TIDAK hapus transaksi
Response 204

=== TRANSACTIONS ===

GET /v1/transactions
Auth: Required
Query params:
	limit: int = 20
	cursor: string
	account_id: uuid (optional)
	category: TransactionCategory (optional)
	type: "INCOME | EXPENSE | TRANSFER" (optional)
	date_from: date (optional) format YYYY-MM-DD
	date_to: date (optional)
	search: string (optional, search di description + merchant_name)
Response 200: PaginatedResponse[TransactionPublic]

TransactionPublic:
{
	"id": "uuid",
	"account_id": "uuid",
	"account_name": "string",     // join dari account
	"date": "datetime",
	"description": "string",
	"merchant_name": "string | null",
	"amount": "number",           // positif = income, negatif = expense
	"type": "TransactionType",
	"category": "TransactionCategory",
	"notes": "string | null",
	"confidence_score": "number | null",
	"is_reviewed": "bool",
	"created_at": "datetime"
}

POST /v1/transactions
Auth: Required
Request:
{
	"account_id": "uuid",
	"date": "datetime",
	"description": "string",
	"amount": "number",          // positif = income, negatif = expense
	"category": "TransactionCategory",
	"notes": "string (optional)"
}
Response 201: TransactionPublic

PATCH /v1/transactions/:id
Auth: Required, harus transaksi milik user
Request (semua optional):
{
	"merchant_name": "string",
	"category": "TransactionCategory",
	"notes": "string",
	"date": "datetime",
	"amount": "number"
}
Response 200: TransactionPublic

DELETE /v1/transactions/:id
Auth: Required, harus milik user
Behavior: set deleted_at = now() (soft delete)
Response 204

GET /v1/transactions/summary
Auth: Required
Query: month (YYYY-MM, default bulan ini)
Response 200:
{
	"month": "2025-02",
	"total_income": "number",
	"total_expense": "number",
	"net": "number",
	"savings_rate": "number",   // (income - expense) / income * 100
	"by_category": [
		{
			"category": "TransactionCategory",
			"total": "number",
			"count": "int",
			"percentage": "number"
		}
	]
}

=== DASHBOARD ===

GET /v1/dashboard/summary
Auth: Required
Response 200:
{
	"net_worth": "number",
	"net_worth_change": "number",        // vs bulan lalu
	"net_worth_change_pct": "number",
	"monthly_income": "number",
	"monthly_expense": "number",
	"savings_rate": "number",
	"total_accounts": "int",
	"updated_at": "datetime"
}

GET /v1/dashboard/trend
Auth: Required
Query: months=6 (default 6, max 24)
Response 200:
{
	"data": [
		{
			"month": "2024-09",
			"income": "number",
			"expense": "number",
			"net_worth": "number"
		}
	]
}

GET /v1/dashboard/insights
Auth: Required
Behavior: Call FastAPI AI service → Groq, return cached jika < 6 jam
Response 200:
{
	"insights": [
		{
			"type": "WARNING | TIP | ACHIEVEMENT",
			"title": "string",
			"description": "string",
			"generated_at": "datetime"
		}
	]
}

=== ASSETS ===

GET /v1/assets/summary
Auth: Required
Response 200:
{
	"total_net_worth": "number",
	"breakdown": [
		{
			"type": "AssetType",
			"label": "string",
			"value": "number",
			"percentage": "number"
		}
	],
	"accounts_count": "int",
	"last_updated": "datetime"
}

GET /v1/assets/stocks
Auth: Required
Query: view = "aggregate | per_account" (default aggregate)
Response 200 (aggregate):
{
	"total_value": "number",
	"holdings": [
		{
			"ticker": "string",
			"name": "string",
			"total_lot": "int",
			"weighted_avg_price": "number",   // dihitung di service
			"current_price": "number | null", // null jika tidak ada data live
			"total_value": "number | null",
			"pnl": "number | null",
			"pnl_percent": "number | null",
			"is_multi_account": "bool",       // true jika dari >1 akun
			"accounts": [                      // selalu ada, untuk detail
				{
					"account_id": "uuid",
					"account_name": "string",
					"platform": "string",
					"lot": "int",
					"avg_price": "number"
				}
			]
		}
	]
}

Response 200 (per_account):
{
	"accounts": [
		{
			"account_id": "uuid",
			"account_name": "string",
			"platform": "string",
			"total_value": "number",
			"holdings": [StockHolding]
		}
	]
}

Catatan: weighted_avg_price dihitung di service layer:
def calc_weighted_avg(holdings: list) -> Decimal:
	total_lot = sum(h.lot for h in holdings)
	if total_lot == 0:
		return Decimal(0)
	return sum(h.lot * h.avg_price for h in holdings) / total_lot

POST /v1/assets/snapshot
Auth: Required
Request:
{
	"snapshots": [
		{
			"account_id": "uuid",
			"value": "number",
			"snapshot_date": "date (optional, default today)"
		}
	]
}
Response 201:
{
	"saved_count": "int"
}

GET /v1/assets/mutual-funds
Auth: Required
Response 200:
{
	"total_value": "number",
	"holdings": [MutualFundHolding]
}

POST /v1/assets/manual
Auth: Required
Request:
{
	"account_id": "uuid",
	"type": "AssetType",
	"name": "string",
	"current_value": "number",
	"notes": "string (optional)"
}
Response 201: ManualAsset

PATCH /v1/assets/manual/:id
Auth: Required
Request: { "current_value": number, "notes": string }
Response 200: ManualAsset

=== BUDGET ===

GET /v1/budget
Auth: Required
Query: month=YYYY-MM (default bulan ini)
Response 200:
{
	"month": "2025-02",
	"total_budget": "number",
	"total_spent": "number",
	"remaining": "number",
	"categories": [
		{
			"id": "uuid",
			"category": "TransactionCategory",
			"budget_amount": "number",
			"spent_amount": "number",    // dihitung dari transactions
			"remaining": "number",
			"percentage_used": "number",
			"is_over_budget": "bool",
			"transaction_count": "int"
		}
	]
}

POST /v1/budget
Auth: Required
Request:
{
	"category": "TransactionCategory",
	"amount": "number",
	"month": "string YYYY-MM"
}
Response 201: Budget object
Validation: UniqueConstraint — satu kategori per bulan per user

PUT /v1/budget/:id
Auth: Required
Request: { "amount": number }
Response 200: Budget object

DELETE /v1/budget/:id
Auth: Required
Response 204

=== IMPORT ===

POST /v1/import/upload
Auth: Required
Request: multipart/form-data
	file: File (PDF, PNG, JPG, CSV — max 10MB)
	account_id: uuid
	source_platform: string ("BCA", "Mandiri", "Stockbit", dll)
	source_type: string ("PDF", "CSV", "IMAGE")

Validation:
- File type check (magic bytes, bukan hanya extension)
- Max file size 10MB
- Account harus milik user

Behavior:
- Simpan file ke /tmp/uploads/{session_id}/
- Buat ImportSession record dengan status UPLOADING
- Jalankan parsing sebagai BackgroundTask
- Return session_id SEGERA (tidak tunggu parsing selesai)

Response 202 Accepted:
{
	"session_id": "uuid",
	"status": "UPLOADING",
	"message": "File diterima, sedang diproses"
}

GET /v1/import/status/:session_id
Auth: Required, session harus milik user
Response 200:
{
	"session_id": "uuid",
	"status": "UPLOADING | PROCESSING | REVIEW | COMPLETED | FAILED",
	"source_platform": "string",
	"source_type": "string",
	"stages": [        // untuk progress UI
		{
			"name": "Membaca dokumen",
			"status": "done | processing | pending",
			"progress": 100
		},
		{
			"name": "Mengekstrak transaksi",
			"status": "processing",
			"progress": 67
		},
		{
			"name": "Kategorisasi AI",
			"status": "pending",
			"progress": 0
		}
	],
	"extracted_count": 127,
	"error_message": "string | null"
}

GET /v1/import/preview/:session_id
Auth: Required
Hanya available jika status = REVIEW
Response 200:
{
	"session_id": "uuid",
	"source_platform": "string",
	"summary": {
		"total_count": 127,
		"income_count": 3,
		"expense_count": 124,
		"total_income": "number",
		"total_expense": "number",
		"high_confidence": 115,   // confidence >= 0.8
		"medium_confidence": 10,  // 0.5-0.8
		"low_confidence": 2       // < 0.5
	},
	"transactions": [
		{
			"temp_id": "string",   // ID sementara, bukan DB ID
			"date": "datetime",
			"description": "string",
			"merchant_name": "string | null",
			"amount": "number",
			"type": "TransactionType",
			"category": "TransactionCategory",
			"confidence_score": "number",
			"confidence_fields": {   // confidence per field
				"date": 0.99,
				"amount": 0.95,
				"merchant": 0.72,
				"category": 0.61
			}
		}
	]
}

POST /v1/import/confirm
Auth: Required
Request:
{
	"session_id": "uuid",
	"transactions": [
		{
			"temp_id": "string",
			"date": "datetime",
			"description": "string",
			"merchant_name": "string | null",
			"amount": "number",
			"category": "TransactionCategory",
			"notes": "string (optional)"
		}
	]
}
Behavior:
- Bulk insert ke transactions table
- Update import_session status = COMPLETED
- Trigger RAG indexing (background task)
- Trigger net worth snapshot update (background task)
Response 201:
{
	"saved_count": 127,
	"session_id": "uuid"
}

GET /v1/import/history
Auth: Required
Query: limit=20, cursor
Response 200: PaginatedResponse[ImportSessionSummary]

=== CHAT ===

GET /v1/chat/sessions
Auth: Required
Response 200: PaginatedResponse[ChatSessionSummary]

ChatSessionSummary:
{
	"id": "uuid",
	"title": "string | null",
	"last_message": "string",
	"created_at": "datetime"
}

POST /v1/chat/sessions
Auth: Required
Request: {} (body kosong — buat session baru)
Response 201:
{
	"session_id": "uuid"
}

GET /v1/chat/sessions/:session_id/messages
Auth: Required
Response 200: PaginatedResponse[ChatMessage]

POST /v1/chat/sessions/:session_id/messages
Auth: Required
Request:
{
	"content": "string",
	"data_sources": ["uuid"]  // account_id yang dijadikan konteks, optional
}

Response: text/event-stream (Server-Sent Events — streaming)
Format SSE:
	data: {"type": "token", "content": "Berdasarkan"}
	data: {"type": "token", "content": " transaksi"}
	data: {"type": "done", "message_id": "uuid"}
	data: {"type": "error", "message": "string"}

Behavior di service:
1. Simpan user message ke DB
2. Fetch financial context dari DB (summary, recent transactions)
3. Call RAG pipeline — query Qdrant untuk konteks relevan
4. Build system prompt dengan context
5. Call Groq API dengan streaming=True
6. Stream tokens ke client via SSE
7. Setelah selesai, simpan full response ke DB
8. Auto-generate session title jika belum ada (dari pesan pertama)

=== HEALTH ===

GET /health
Auth: Not required
Response 200:
{
	"status": "ok",
	"version": "1.0.0",
	"database": "ok | error",
	"qdrant": "ok | error"
}
```

---

## PROMPT 05 — AI Services (Groq + RAG)

```
Implementasikan semua AI services untuk FinanceAI.

=== app/ai/groq_client.py ===
Wrapper tipis di atas httpx untuk call Groq API.
Jangan pakai library groq resmi — terlalu banyak abstraksi yang tidak perlu.

import httpx
from app.config import settings

class GroqClient:
	BASE_URL = "https://api.groq.com/openai/v1"

	def __init__(self):
		self.client = httpx.AsyncClient(
			headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
			timeout=60.0,
		)

	async def chat(self, messages: list[dict], model: str = None, stream: bool = False) -> dict | AsyncIterator:
		model = model or settings.GROQ_MODEL
		response = await self.client.post(
			f"{self.BASE_URL}/chat/completions",
			json={"model": model, "messages": messages, "stream": stream},
			stream=stream,
		)
		response.raise_for_status()
		if stream:
			return response.aiter_lines()
		return response.json()

	async def vision(self, image_base64: str, prompt: str) -> str:
		# Kirim image ke Groq vision model
		messages = [{
			"role": "user",
			"content": [
				{"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
				{"type": "text", "text": prompt},
			]
		}]
		result = await self.chat(messages, model=settings.GROQ_VISION_MODEL)
		return result["choices"][0]["message"]["content"]

groq = GroqClient()

=== app/ai/rag_pipeline.py ===

from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
from app.config import settings

# Embedding model: pakai Groq text embedding atau simple TF-IDF
# Untuk simplicity production-ready: gunakan sentence-transformers
# Tapi karena kita hindari berat RAM, gunakan Groq embedding API jika tersedia
# Fallback: represent transaksi sebagai text + simple hash untuk lookup

VECTOR_DIM = 1536  # OpenAI/Groq embedding dimension

class RAGPipeline:
	def __init__(self):
		self.client = AsyncQdrantClient(url=settings.QDRANT_URL)

	async def ensure_collection(self):
		collections = await self.client.get_collections()
		names = [c.name for c in collections.collections]
		if settings.QDRANT_COLLECTION not in names:
			await self.client.create_collection(
				collection_name=settings.QDRANT_COLLECTION,
				vectors_config=VectorParams(size=VECTOR_DIM, distance=Distance.COSINE),
			)

	def transaction_to_text(self, tx: dict) -> str:
		# Convert transaksi ke text untuk embedding
		return (
			f"{tx['date']} {tx['merchant_name'] or tx['description']} "
			f"kategori {tx['category']} jumlah {tx['amount']} "
			f"akun {tx['account_name']}"
		)

	async def get_embedding(self, text: str) -> list[float]:
		# Call Groq/OpenAI embedding endpoint
		# Atau gunakan fastembed library yang ringan (50MB model)
		...

	async def index_transactions(self, user_id: str, transactions: list[dict]):
		# Panggil ini setelah import confirm
		points = []
		for tx in transactions:
			text = self.transaction_to_text(tx)
			vector = await self.get_embedding(text)
			points.append(PointStruct(
				id=tx["id"],         # UUID transaksi sebagai Qdrant point ID
				vector=vector,
				payload={
					"user_id": user_id,
					"date": tx["date"],
					"category": tx["category"],
					"amount": float(tx["amount"]),
					"merchant": tx.get("merchant_name"),
					"account_id": tx["account_id"],
				}
			))
		await self.client.upsert(collection_name=settings.QDRANT_COLLECTION, points=points)

	async def query(self, user_id: str, query_text: str, limit: int = 10) -> list[dict]:
		# Cari transaksi relevan dengan query user
		query_vector = await self.get_embedding(query_text)
		results = await self.client.search(
			collection_name=settings.QDRANT_COLLECTION,
			query_vector=query_vector,
			query_filter=Filter(
				must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
			),
			limit=limit,
			with_payload=True,
		)
		return [r.payload for r in results]

rag = RAGPipeline()

=== app/ai/categorizer.py ===

SYSTEM_PROMPT = """
Kamu adalah sistem kategorisasi transaksi keuangan Indonesia.
Tugasmu: tentukan kategori untuk setiap deskripsi merchant/transaksi.

Kategori yang tersedia:
FOOD, TRANSPORT, SHOPPING, ENTERTAINMENT, HEALTH, EDUCATION,
INVESTMENT, SALARY, TRANSFER, UTILITIES, HOUSING, OTHER

Rules:
- GoPay, OVO, Dana, LinkAja → TRANSFER (kecuali jelas dari contextnya)
- Gaji, THR, Bonus → SALARY
- Grab, Gojek, KRL, Transjakarta → TRANSPORT
- Kopi Kenangan, Starbucks, McDonald → FOOD
- Netflix, Spotify, Steam → ENTERTAINMENT
- PLN, PDAM, Telkom → UTILITIES
- Return JSON array dengan urutan sama seperti input
- Sertakan confidence 0.0-1.0 per item
"""

async def categorize_batch(descriptions: list[str]) -> list[dict]:
	# Batch untuk efisiensi — satu call untuk banyak transaksi
	numbered = "\n".join(f"{i+1}. {d}" for i, d in enumerate(descriptions))
	messages = [
		{"role": "system", "content": SYSTEM_PROMPT},
		{"role": "user", "content": f"Kategorikan transaksi berikut:\n{numbered}\n\nReturn JSON: [{{'category': '...', 'confidence': 0.0}}]"}
	]
	result = await groq.chat(messages)
	content = result["choices"][0]["message"]["content"]
	# Parse JSON dari response
	return json.loads(content)

=== app/ai/insights.py ===

async def generate_insights(financial_summary: dict) -> list[dict]:
	SYSTEM = """
	Kamu adalah financial advisor AI untuk pengguna Indonesia.
	Berikan 3 insight singkat dan actionable tentang kondisi keuangan user.
	Setiap insight harus: spesifik (ada angka), jelas, dan dalam Bahasa Indonesia.
	Type insight: WARNING (ada masalah), TIP (saran improvement), ACHIEVEMENT (pencapaian bagus).
	Return JSON array of 3 objects: [{type, title, description}]
	"""
	messages = [
		{"role": "system", "content": SYSTEM},
		{"role": "user", "content": f"Data keuangan bulan ini:\n{json.dumps(financial_summary, ensure_ascii=False)}"}
	]
	result = await groq.chat(messages)
	return json.loads(result["choices"][0]["message"]["content"])

=== app/chat/service.py — Chat dengan RAG ===

SYSTEM_PROMPT_TEMPLATE = """
Kamu adalah financial advisor AI untuk pengguna {user_name} di aplikasi FinanceAI.
Jawab dalam Bahasa Indonesia, conversational tapi professional.
Gunakan angka spesifik dari data yang diberikan. Format angka sebagai Rp X.XXX.XXX.
Jangan buat asumsi tentang data yang tidak ada — katakan "data tidak tersedia".
Disclaimer: bukan rekomendasi investasi profesional.

DATA KEUANGAN USER:
{financial_context}

TRANSAKSI RELEVAN (dari pencarian):
{rag_context}
"""

async def get_chat_response_stream(session_id, user_message, user):
	# 1. Ambil financial summary dari DB
	summary = await get_user_financial_summary(user.id)

	# 2. Query RAG untuk konteks relevan
	relevant_txs = await rag.query(str(user.id), user_message)

	# 3. Build system prompt
	system = SYSTEM_PROMPT_TEMPLATE.format(
		user_name=user.name,
		financial_context=json.dumps(summary, ensure_ascii=False),
		rag_context=json.dumps(relevant_txs, ensure_ascii=False),
	)

	# 4. Ambil history conversation (max 10 pesan terakhir)
	history = await get_session_messages(session_id, limit=10)
	messages = [{"role": "system", "content": system}]
	messages += [{"role": m.role, "content": m.content} for m in history]
	messages.append({"role": "user", "content": user_message})

	# 5. Stream dari Groq
	stream = await groq.chat(messages, stream=True)
	return stream  # SSE handler di router yang consume ini
```

---

## PROMPT 06 — Import Parsers

```
Implementasikan PDF dan image parsers untuk import data.

=== app/import_data/parsers/base.py ===

from abc import ABC, abstractmethod
from dataclasses import dataclass
from decimal import Decimal
from datetime import datetime

@dataclass
class ParsedTransaction:
	date: datetime
	description: str
	amount: Decimal          # positif = masuk, negatif = keluar
	confidence_score: float  # 0.0-1.0 overall
	confidence_fields: dict  # per-field confidence

class BaseParser(ABC):
	@abstractmethod
	async def parse(self, file_path: str) -> list[ParsedTransaction]:
		pass

	def _determine_type(self, amount: Decimal) -> str:
		return "INCOME" if amount > 0 else "EXPENSE"

=== app/import_data/parsers/pdf_bca.py ===

import pdfplumber
from decimal import Decimal

class BCAPDFParser(BaseParser):
	"""
	Parser untuk mutasi rekening BCA.
	Format: tabel dengan kolom Tanggal | Keterangan | Cabang | Jumlah | Saldo
	"""

	async def parse(self, file_path: str) -> list[ParsedTransaction]:
		transactions = []
		with pdfplumber.open(file_path) as pdf:
			for page in pdf.pages:
				tables = page.extract_tables()
				for table in tables:
					for row in table:
						tx = self._parse_row(row)
						if tx:
							transactions.append(tx)
		return transactions

	def _parse_row(self, row: list) -> ParsedTransaction | None:
		# BCA format: [tanggal, keterangan, cabang, jumlah, saldo]
		# Bersihkan dan validasi setiap field
		# Return None jika row tidak valid (header, kosong, dll)
		try:
			date_str = row[0].strip() if row[0] else None
			desc = row[1].strip() if row[1] else None
			amount_str = row[3].strip() if row[3] else None

			if not all([date_str, desc, amount_str]):
				return None

			# Parse tanggal — format BCA: DD/MM/YY
			date = datetime.strptime(date_str, "%d/%m/%y")

			# Parse jumlah — hilangkan titik pemisah ribuan, koma desimal
			# BCA pakai CR untuk kredit, DB untuk debit di kolom terpisah
			amount = self._parse_amount(amount_str, row)

			return ParsedTransaction(
				date=date,
				description=desc,
				amount=amount,
				confidence_score=0.95,
				confidence_fields={"date": 0.99, "amount": 0.95, "description": 0.90},
			)
		except (ValueError, IndexError):
			return None

	def _parse_amount(self, amount_str: str, row: list) -> Decimal:
		# Bersihkan format angka Indonesia: "1.234.567,89"
		cleaned = amount_str.replace(".", "").replace(",", ".")
		amount = Decimal(cleaned)
		# Cek apakah debit atau kredit dari kolom ke-4 atau keyword
		# BCA: ada kolom CR/DB terpisah, atau + / - prefix
		return amount  # Implementasi lengkap sesuai format aktual BCA

=== app/import_data/parsers/image_vision.py ===

import base64
from app.ai.groq_client import groq

VISION_PROMPT = """
Ekstrak semua data keuangan dari gambar ini secara akurat.
Perhatikan setiap angka dan teks dengan teliti.

Return JSON dengan format tepat ini:
{
	"platform": "nama platform/bank",
	"document_type": "bank_statement | stock_portfolio | mutual_fund | ewallet",
	"transactions": [
		{
			"date": "YYYY-MM-DD atau null jika tidak terbaca",
			"description": "deskripsi transaksi",
			"amount": 1234567.89,
			"is_income": true/false,
			"confidence": 0.0-1.0
		}
	],
	"stock_holdings": [
		{
			"ticker": "BBCA",
			"name": "Bank Central Asia",
			"lot": 150,
			"avg_price": 9150.0,
			"current_price": 9850.0,
			"confidence": 0.0-1.0
		}
	],
	"overall_confidence": 0.0-1.0
}

Aturan confidence:
- 0.9+: terbaca jelas, angka pasti
- 0.7-0.9: terbaca tapi ada ketidakpastian kecil
- 0.5-0.7: sebagian terpotong atau blur
- < 0.5: tidak yakin, butuh konfirmasi user
Jika field tidak ada di gambar, return array kosong atau null.
"""

class ImageVisionParser(BaseParser):
	async def parse(self, file_path: str) -> list[ParsedTransaction]:
		with open(file_path, "rb") as f:
			image_b64 = base64.b64encode(f.read()).decode()

		raw_result = await groq.vision(image_b64, VISION_PROMPT)

		# Parse JSON dari response
		data = json.loads(raw_result)
		transactions = []

		for tx in data.get("transactions", []):
			amount = Decimal(str(tx["amount"]))
			if not tx.get("is_income"):
				amount = -amount
			transactions.append(ParsedTransaction(
				date=datetime.strptime(tx["date"], "%Y-%m-%d") if tx.get("date") else datetime.now(),
				description=tx["description"],
				amount=amount,
				confidence_score=tx.get("confidence", 0.5),
				confidence_fields={"overall": tx.get("confidence", 0.5)},
			))

		return transactions

=== app/import_data/service.py — Background Processing ===

async def process_import_session(session_id: str, file_path: str, source_type: str, source_platform: str):
	"""
	Dijalankan sebagai BackgroundTask setelah upload.
	Tidak blocking — user sudah dapat response 202.
	"""
	async with get_async_session() as db:
		try:
			# Update status ke PROCESSING
			await update_session_status(db, session_id, ImportStatus.PROCESSING)

			# Pilih parser yang tepat
			parser = get_parser(source_type, source_platform)
			raw_transactions = await parser.parse(file_path)

			# Batch categorize dengan AI
			descriptions = [tx.description for tx in raw_transactions]
			categories = await categorize_batch(descriptions)

			# Merge hasil
			extracted = []
			for tx, cat in zip(raw_transactions, categories):
				extracted.append({
					"temp_id": str(uuid.uuid4()),
					"date": tx.date.isoformat(),
					"description": tx.description,
					"amount": float(tx.amount),
					"category": cat["category"],
					"confidence_score": min(tx.confidence_score, cat["confidence"]),
					"confidence_fields": tx.confidence_fields,
				})

			# Simpan extracted data sementara (ke Redis jika ada, atau temp table)
			await cache_extracted_data(session_id, extracted)

			# Update status ke REVIEW
			await update_session_status(db, session_id, ImportStatus.REVIEW, extracted_count=len(extracted))

		except Exception as e:
			await update_session_status(db, session_id, ImportStatus.FAILED, error=str(e))
			logger.error("Import processing failed", session_id=session_id, error=str(e))

def get_parser(source_type: str, platform: str) -> BaseParser:
	if source_type == "IMAGE":
		return ImageVisionParser()
	if source_type == "PDF":
		parsers = {"BCA": BCAPDFParser, "MANDIRI": MandiriPDFParser, "BRI": BRIPDFParser}
		return parsers.get(platform.upper(), GenericPDFParser)()
	if source_type == "CSV":
		parsers = {"BIBIT": BibitCSVParser, "IPOT": IPOTCSVParser}
		return parsers.get(platform.upper(), GenericCSVParser)()
	raise ValueError(f"Unsupported source: {source_type}/{platform}")
```

---

## PROMPT 07 — Error Handling & Middleware

```
Implementasikan global error handling dan middleware untuk FinanceAI.

=== app/core/errors.py ===

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from jose import JWTError

def make_error(code: str, message: str, details: dict = None) -> dict:
	return {"error": {"code": code, "message": message, "details": details or {}}}

def register_exception_handlers(app: FastAPI):

	@app.exception_handler(IntegrityError)
	async def integrity_error_handler(request: Request, exc: IntegrityError):
		# Database constraint violations
		if "unique" in str(exc).lower():
			return JSONResponse(
				status_code=409,
				content=make_error("CONFLICT", "Resource sudah ada"),
			)
		return JSONResponse(status_code=400, content=make_error("DB_ERROR", "Database error"))

	@app.exception_handler(404)
	async def not_found_handler(request: Request, exc):
		return JSONResponse(status_code=404, content=make_error("NOT_FOUND", "Resource tidak ditemukan"))

	@app.exception_handler(Exception)
	async def generic_handler(request: Request, exc: Exception):
		logger.error("Unhandled exception", error=str(exc), path=request.url.path)
		return JSONResponse(
			status_code=500,
			content=make_error("INTERNAL_ERROR", "Terjadi kesalahan internal"),
		)

=== app/core/middleware.py ===

import uuid
import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

class RequestIDMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request, call_next):
		request_id = str(uuid.uuid4())
		request.state.request_id = request_id
		response = await call_next(request)
		response.headers["X-Request-ID"] = request_id
		return response

class LoggingMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request, call_next):
		start = time.time()
		response = await call_next(request)
		duration_ms = (time.time() - start) * 1000
		logger.info(
			"request",
			method=request.method,
			path=request.url.path,
			status=response.status_code,
			duration_ms=round(duration_ms, 2),
			request_id=getattr(request.state, "request_id", None),
		)
		return response

=== app/core/health.py ===

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_session)):
	db_ok = True
	qdrant_ok = True
	try:
		await db.execute(text("SELECT 1"))
	except:
		db_ok = False
	try:
		await rag.client.get_collections()
	except:
		qdrant_ok = False

	status = "ok" if (db_ok and qdrant_ok) else "degraded"
	return {
		"status": status,
		"version": "1.0.0",
		"database": "ok" if db_ok else "error",
		"qdrant": "ok" if qdrant_ok else "error",
	}
```

---

## CATATAN CODE STYLE

Semua kode yang dihasilkan harus mengikuti preferensi ini:
- Indentasi: TAB (bukan spasi)
- Komentar: singkat, purposeful — jelaskan KENAPA bukan APA
- Logic: sesederhana mungkin — hindari abstraksi berlebihan
- Fungsi: satu tanggung jawab, pendek
- Nama variabel: descriptive, bukan singkatan aneh
- Jangan buat helper function yang hanya dipanggil sekali
