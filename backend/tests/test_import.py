"""Integration tests untuk /v1/import."""

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
