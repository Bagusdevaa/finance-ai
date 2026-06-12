"""Integration tests untuk /v1/import."""

from decimal import Decimal
from uuid import UUID

from httpx import ASGITransport, AsyncClient
import pytest

from app.import_data import service as import_service
from tests.helpers import register_and_login


pytestmark = pytest.mark.asyncio


CSV_BYTES = (
	b"date,amount,merchant,description,category\n"
	b"2026-04-15,-58000,Gojek,GoFood Sudirman,Makan\n"
	b"2026-04-16,5000000,PT Konstruksi Jaya,Gaji April,Pemasukan\n"
)


async def _upload_manual_csv(client, headers, csv_bytes=CSV_BYTES) -> dict:
	files = {"file": ("test.csv", csv_bytes, "text/csv")}
	data = {"source_type": "manual_csv"}
	r = await client.post(
		"/v1/import/upload", files=files, data=data, headers=headers
	)
	assert r.status_code == 202, r.text
	return r.json()


async def test_manual_csv_full_flow(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	job = await _upload_manual_csv(client, headers)
	job_id = job["id"]
	assert job["status"] == "pending"
	assert job["source_type"] == "manual_csv"

	# Trigger processing langsung supaya deterministic.
	await import_service.process_job(UUID(job_id))

	r = await client.get(f"/v1/import/jobs/{job_id}", headers=headers)
	assert r.status_code == 200
	detail = r.json()
	assert detail["status"] == "review"
	assert detail["rows_total"] == 2
	assert detail["rows_ok"] == 2
	assert len(detail["items"]) == 2
	# line_no mulai dari 2 (header = line 1).
	assert detail["items"][0]["line_no"] == 2
	assert detail["items"][0]["merchant_name"] == "Gojek"

	# Confirm.
	r = await client.post(f"/v1/import/jobs/{job_id}/confirm", headers=headers)
	assert r.status_code == 200, r.text
	body = r.json()
	assert body["transactions_created"] == 2
	assert body["already_existed"] == 0

	# Verify transaksi tertulis dengan source=import_csv.
	r = await client.get("/v1/transactions/", headers=headers)
	assert r.status_code == 200
	items = r.json()["items"]
	assert len(items) == 2
	for tx in items:
		assert tx["source"] == "import_csv"


async def test_edit_row_before_confirm(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	job = await _upload_manual_csv(client, headers)
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	r = await client.get(f"/v1/import/jobs/{job_id}", headers=headers)
	row = r.json()["items"][0]
	row_id = row["id"]

	# PATCH category.
	r = await client.patch(
		f"/v1/import/jobs/{job_id}/rows/{row_id}",
		json={"category": "Edited"},
		headers=headers,
	)
	assert r.status_code == 200, r.text
	assert r.json()["category"] == "Edited"

	# Confirm + verify category sampai ke transaction.
	r = await client.post(f"/v1/import/jobs/{job_id}/confirm", headers=headers)
	assert r.status_code == 200

	r = await client.get("/v1/transactions/", headers=headers)
	items = r.json()["items"]
	categories = {tx["category"] for tx in items}
	assert "Edited" in categories


async def test_exclude_row(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	job = await _upload_manual_csv(client, headers)
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	r = await client.get(f"/v1/import/jobs/{job_id}", headers=headers)
	row_id = r.json()["items"][0]["id"]

	# DELETE → set is_excluded=True.
	r = await client.delete(
		f"/v1/import/jobs/{job_id}/rows/{row_id}", headers=headers
	)
	assert r.status_code == 204

	r = await client.post(f"/v1/import/jobs/{job_id}/confirm", headers=headers)
	assert r.status_code == 200
	assert r.json()["transactions_created"] == 1

	r = await client.get("/v1/transactions/", headers=headers)
	assert len(r.json()["items"]) == 1


async def test_duplicate_detection(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	# Pre-create transaksi yang match salah satu CSV row.
	r = await client.post(
		"/v1/transactions/",
		json={
			"amount": "-58000",
			"merchant_name": "Gojek",
			"transaction_date": "2026-04-15",
		},
		headers=headers,
	)
	assert r.status_code == 201

	job = await _upload_manual_csv(client, headers)
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	r = await client.get(f"/v1/import/jobs/{job_id}", headers=headers)
	rows = r.json()["items"]
	dups = [row for row in rows if row["is_duplicate"]]
	assert len(dups) == 1
	assert dups[0]["merchant_name"] == "Gojek"

	r = await client.post(f"/v1/import/jobs/{job_id}/confirm", headers=headers)
	body = r.json()
	assert body["already_existed"] >= 1
	assert body["transactions_created"] == 1

	# Total transaksi = 1 manual + 1 dari import non-dup.
	r = await client.get("/v1/transactions/", headers=headers)
	assert len(r.json()["items"]) == 2


async def test_user_isolation(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	job = await _upload_manual_csv(client, auth_a["headers"])
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")

		# B tidak boleh lihat job milik A.
		r = await client_b.get(
			f"/v1/import/jobs/{job_id}", headers=auth_b["headers"]
		)
		assert r.status_code == 404

		# B tidak boleh confirm job A.
		r = await client_b.post(
			f"/v1/import/jobs/{job_id}/confirm", headers=auth_b["headers"]
		)
		assert r.status_code == 404

		# Listing B kosong.
		r = await client_b.get("/v1/import/jobs", headers=auth_b["headers"])
		assert r.json() == []


async def test_confirm_twice_fails(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	job = await _upload_manual_csv(client, headers)
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	r = await client.post(f"/v1/import/jobs/{job_id}/confirm", headers=headers)
	assert r.status_code == 200

	r = await client.post(f"/v1/import/jobs/{job_id}/confirm", headers=headers)
	assert r.status_code == 409
	assert r.json()["error"]["code"] == "INVALID_JOB_STATE"


# ---------- Phase 4: content_type, balance_check, holdings persistence ----------

@pytest.fixture
def mock_dispatch_holding(monkeypatch):
	"""Patch dispatcher to return a parser yielding holding-shaped ParseResult."""
	from app.import_data.parsers.base import ParsedHolding, ParseResult
	from app.import_data import service as svc

	class _MockHoldingParser:
		def parse(self, _file_bytes):
			return ParseResult(
				rows=[],
				holdings=[
					ParsedHolding(line_no=1, ticker="QQQ", qty=Decimal("0.225"), avg_price=Decimal("268.44"), currency="USD", asset_type="stock"),
					ParsedHolding(line_no=2, ticker="BTC", qty=Decimal("0.001"), avg_price=Decimal("1473939"), currency="IDR", asset_type="crypto"),
				],
				content_type="holding",
			)

	monkeypatch.setattr(svc, "dispatch", lambda _bytes: _MockHoldingParser())


@pytest.fixture
def mock_dispatch_statement_with_balance(monkeypatch):
	"""Patch dispatcher to return ParseResult with statement content_type and balance_summary raw."""
	from datetime import date
	from app.import_data.parsers.base import ParsedRow, ParseResult
	from app.import_data import service as svc

	class _MockStatementParser:
		def parse(self, _file_bytes):
			result = ParseResult(
				rows=[
					ParsedRow(line_no=1, transaction_date=date(2026, 6, 1), amount=Decimal("19600"), description="BI-FAST CR"),
					ParsedRow(line_no=2, transaction_date=date(2026, 6, 1), amount=Decimal("-19600"), description="TRANSAKSI DEBIT"),
				],
				content_type="statement",
			)
			# Balance check would match: 19600 + -19600 = 0; saldo unchanged
			result._balance_summary_raw = {"saldo_awal": 50000, "saldo_akhir": 50000, "currency": "IDR"}
			return result

	monkeypatch.setattr(svc, "dispatch", lambda _bytes: _MockStatementParser())


@pytest.fixture
def mock_dispatch_statement_with_mismatch(monkeypatch):
	"""Statement where sum_txs doesn't match delta — should trigger warning."""
	from datetime import date
	from app.import_data.parsers.base import ParsedRow, ParseResult
	from app.import_data import service as svc

	class _MockMismatchParser:
		def parse(self, _file_bytes):
			result = ParseResult(
				rows=[
					ParsedRow(line_no=1, transaction_date=date(2026, 6, 1), amount=Decimal("100"), description="only one tx", confidence_score=Decimal("1.00")),
				],
				content_type="statement",
			)
			# Expected delta: 1000 - 0 = 1000. Actual: 100. Diff = 90% (way over 1%)
			result._balance_summary_raw = {"saldo_awal": 0, "saldo_akhir": 1000, "currency": "IDR"}
			return result

	monkeypatch.setattr(svc, "dispatch", lambda _bytes: _MockMismatchParser())


async def test_process_job_persists_content_type(client, mock_dispatch_holding):
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)  # file type doesn't matter; dispatch is mocked
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	r = await client.get(f"/v1/import/jobs/{job_id}", headers=headers)
	body = r.json()
	assert body["content_type"] == "holding"
	assert body["detected_holdings"] is not None
	assert len(body["detected_holdings"]) == 2
	assert body["detected_holdings"][0]["ticker"] == "QQQ"


async def test_process_job_persists_balance_check_match(client, mock_dispatch_statement_with_balance):
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)
	await import_service.process_job(UUID(job["id"]))

	r = await client.get(f"/v1/import/jobs/{job['id']}", headers=headers)
	body = r.json()
	assert body["content_type"] == "statement"
	assert body["balance_check"] is not None
	assert body["balance_check"]["matches"] is True
	assert Decimal(body["balance_check"]["sum_transactions"]) == Decimal("0")
	assert Decimal(body["balance_check"]["expected_delta"]) == Decimal("0")


async def test_process_job_applies_warning_on_mismatch(client, mock_dispatch_statement_with_mismatch):
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)
	await import_service.process_job(UUID(job["id"]))

	r = await client.get(f"/v1/import/jobs/{job['id']}", headers=headers)
	body = r.json()
	assert body["content_type"] == "statement"
	assert body["balance_check"]["matches"] is False
	# All rows should have confidence capped to 0.70
	for item in body["items"]:
		assert Decimal(item["confidence_score"]) <= Decimal("0.70")


async def test_process_job_legacy_no_content_type_writes_unknown(client):
	"""Backward compat: if parser returns ParseResult(content_type='unknown'), job has 'unknown'."""
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)
	await import_service.process_job(UUID(job["id"]))

	r = await client.get(f"/v1/import/jobs/{job['id']}", headers=headers)
	body = r.json()
	# manual_csv parser returns ParseResult(rows=..., content_type="unknown" by default)
	assert body["content_type"] == "unknown"
	assert body["balance_check"] is None
	assert body["detected_holdings"] is None or body["detected_holdings"] == []
