"""Async SQLAlchemy 2.0 engine + session.

Pakai expire_on_commit=False supaya object yang sudah di-commit tetap usable
tanpa lazy-load tambahan (lazy-load di async session itu mahal & error-prone).
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
	AsyncSession,
	async_sessionmaker,
	create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


settings = get_settings()

engine = create_async_engine(
	settings.DATABASE_URL,
	echo=False,
	future=True,
	pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
	engine,
	class_=AsyncSession,
	expire_on_commit=False,
	autoflush=False,
)


class Base(DeclarativeBase):
	"""Declarative base untuk semua ORM models."""

	pass


async def get_session() -> AsyncIterator[AsyncSession]:
	"""FastAPI dependency: yield session, commit kalau bersih, rollback kalau error."""
	async with AsyncSessionLocal() as session:
		try:
			yield session
		except Exception:
			await session.rollback()
			raise
