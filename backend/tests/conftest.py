"""Pytest fixtures untuk smoke tests.

Tests butuh Postgres aktif dengan DB sesuai DATABASE_URL.
Sebelum jalan: alembic upgrade head.
Tiap test: bersihkan tabel users + refresh_tokens supaya isolated.
"""

import asyncio
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.database import AsyncSessionLocal
from app.main import app


@pytest.fixture(scope="session")
def event_loop():
	loop = asyncio.new_event_loop()
	yield loop
	loop.close()


@pytest.fixture(autouse=True)
def stub_external_ai(monkeypatch):
	"""Stub Qdrant indexing untuk semua test — tidak butuh Qdrant aktif.

	Test khusus chat masih boleh override stub ini (mis. mock chat_stream).
	"""

	async def fake_index(transaction_ids):
		return None

	# Patch where it's looked up — di import_data.service.
	monkeypatch.setattr(
		"app.import_data.service.index_transactions", fake_index, raising=False
	)


@pytest_asyncio.fixture
async def clean_db() -> AsyncIterator[None]:
	# TRUNCATE CASCADE — semua FK ke users akan ikut bersih.
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
