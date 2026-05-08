"""Pytest fixtures untuk smoke tests.

PENTING: tests pakai database TERPISAH (financeai_test) supaya nggak menghapus
data dev. Set env `TEST_DATABASE_URL` manual kalau mau pakai DB lain.

Setup pertama kali:
  createdb -U postgres -h localhost financeai_test
  TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/financeai_test \\
	venv/bin/alembic upgrade head

Atau: pytest akan auto-create schema dari Base.metadata pada session pertama —
nggak perlu alembic kalau cuma untuk testing.
"""

import asyncio
import os
from collections.abc import AsyncIterator

# WAJIB SEBELUM import app — supaya engine pakai test DB.
os.environ["DATABASE_URL"] = os.getenv(
	"TEST_DATABASE_URL",
	"postgresql+asyncpg://postgres:postgres@localhost:5432/financeai_test",
)

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

# Import models supaya Base.metadata terisi sebelum create_all.
from app.users.models import User  # noqa: F401
from app.accounts.models import Account  # noqa: F401
from app.transactions.models import Transaction  # noqa: F401
from app.budgets.models import Budget  # noqa: F401
from app.holdings.models import StockHolding  # noqa: F401
from app.import_data.models import ImportJob, ImportRow  # noqa: F401
from app.chat.models import ChatSession, ChatMessage  # noqa: F401
from app.auth.models import RefreshToken  # noqa: F401

from app.database import AsyncSessionLocal, Base, engine
from app.main import app


# Bootstrap schema sekali di module load — dispose engine setelahnya supaya
# connection pool fresh pas tests jalan (mencegah "Future attached to different
# loop" error karena engine pool sticky ke event loop tempat dia dibuat).
async def _bootstrap_schema():
	async with engine.begin() as conn:
		await conn.run_sync(Base.metadata.create_all)
	await engine.dispose()


asyncio.run(_bootstrap_schema())


@pytest.fixture(scope="session")
def event_loop():
	loop = asyncio.new_event_loop()
	yield loop
	loop.close()


@pytest.fixture(autouse=True)
def stub_external_ai(monkeypatch):
	"""Stub Qdrant indexing untuk semua test — tidak butuh Qdrant aktif."""

	async def fake_index(transaction_ids):
		return None

	monkeypatch.setattr(
		"app.import_data.service.index_transactions", fake_index, raising=False
	)


@pytest_asyncio.fixture
async def clean_db() -> AsyncIterator[None]:
	# TRUNCATE CASCADE — aman karena ini DB test terpisah.
	async with AsyncSessionLocal() as session:
		await session.execute(
			text(
				"TRUNCATE TABLE chat_messages, chat_sessions, import_rows, "
				"import_jobs, stock_holdings, budgets, transactions, accounts, "
				"refresh_tokens, users CASCADE"
			)
		)
		await session.commit()
	yield


@pytest_asyncio.fixture
async def client(clean_db) -> AsyncIterator[AsyncClient]:
	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as ac:
		yield ac
