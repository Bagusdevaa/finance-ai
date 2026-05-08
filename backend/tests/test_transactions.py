"""Integration tests untuk /v1/transactions."""

from httpx import ASGITransport, AsyncClient
import pytest

from tests.helpers import register_and_login


pytestmark = pytest.mark.asyncio


async def _create_account(client, headers, name="BCA") -> str:
	r = await client.post(
		"/v1/accounts/",
		json={"name": name, "type": "bank"},
		headers=headers,
	)
	return r.json()["id"]


async def test_transaction_crud_with_account(client):
	auth = await register_and_login(client)
	headers = auth["headers"]
	account_id = await _create_account(client, headers)

	# Create (expense → negative)
	r = await client.post(
		"/v1/transactions/",
		json={
			"account_id": account_id,
			"amount": "-75000.00",
			"merchant_name": "Indomaret",
			"category": "groceries",
			"transaction_date": "2026-04-15",
		},
		headers=headers,
	)
	assert r.status_code == 201, r.text
	tx = r.json()
	assert tx["amount"] == "-75000.00"
	assert tx["account"]["id"] == account_id
	assert tx["account"]["name"] == "BCA"
	assert tx["source"] == "manual"

	# Get
	r = await client.get(f"/v1/transactions/{tx['id']}", headers=headers)
	assert r.status_code == 200

	# Update
	r = await client.patch(
		f"/v1/transactions/{tx['id']}",
		json={"merchant_name": "Alfamart", "amount": "-50000.00"},
		headers=headers,
	)
	assert r.status_code == 200
	assert r.json()["merchant_name"] == "Alfamart"
	assert r.json()["amount"] == "-50000.00"

	# Delete
	r = await client.delete(f"/v1/transactions/{tx['id']}", headers=headers)
	assert r.status_code == 204

	r = await client.get(f"/v1/transactions/{tx['id']}", headers=headers)
	assert r.status_code == 404


async def test_transactions_require_auth(client):
	r = await client.get("/v1/transactions/")
	assert r.status_code == 401


async def test_transactions_user_isolation(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	await client.post(
		"/v1/transactions/",
		json={
			"amount": "-1000.00",
			"transaction_date": "2026-04-15",
			"merchant_name": "A's tx",
		},
		headers=auth_a["headers"],
	)

	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")
		r = await client_b.get("/v1/transactions/", headers=auth_b["headers"])
		assert r.status_code == 200
		assert r.json()["items"] == []


async def test_transactions_filters(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	# 3 expenses + 1 income, beda kategori & tanggal.
	tx_specs = [
		{"amount": "-50000", "category": "food", "transaction_date": "2026-04-05"},
		{"amount": "-25000", "category": "transport", "transaction_date": "2026-04-10"},
		{"amount": "-75000", "category": "food", "transaction_date": "2026-04-20"},
		{"amount": "5000000", "category": "salary", "transaction_date": "2026-04-25"},
	]
	for spec in tx_specs:
		r = await client.post(
			"/v1/transactions/",
			json={**spec, "merchant_name": f"merchant-{spec['category']}"},
			headers=headers,
		)
		assert r.status_code == 201

	# Filter by type=in
	r = await client.get("/v1/transactions/?type=in", headers=headers)
	assert r.status_code == 200
	assert len(r.json()["items"]) == 1
	assert r.json()["items"][0]["category"] == "salary"

	# Filter by type=out
	r = await client.get("/v1/transactions/?type=out", headers=headers)
	assert len(r.json()["items"]) == 3

	# Filter by category
	r = await client.get("/v1/transactions/?category=food", headers=headers)
	assert len(r.json()["items"]) == 2

	# Filter by date range
	r = await client.get(
		"/v1/transactions/?date_from=2026-04-15&date_to=2026-04-30",
		headers=headers,
	)
	assert len(r.json()["items"]) == 2

	# Search
	r = await client.get(
		"/v1/transactions/?search=transport", headers=headers
	)
	assert len(r.json()["items"]) == 1


async def test_transactions_cursor_pagination(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	# 5 transaksi.
	for i in range(5):
		r = await client.post(
			"/v1/transactions/",
			json={
				"amount": f"-{(i + 1) * 1000}",
				"transaction_date": f"2026-04-{i + 1:02d}",
				"merchant_name": f"m{i}",
			},
			headers=headers,
		)
		assert r.status_code == 201

	# Page 1: limit=2
	r = await client.get("/v1/transactions/?limit=2", headers=headers)
	body = r.json()
	assert len(body["items"]) == 2
	assert body["has_more"] is True
	assert body["next_cursor"] is not None
	# Order DESC by transaction_date — paling baru (04-05) dulu.
	assert body["items"][0]["transaction_date"] == "2026-04-05"

	# Page 2: pakai cursor
	cursor = body["next_cursor"]
	r = await client.get(
		f"/v1/transactions/?limit=2&cursor={cursor}", headers=headers
	)
	body2 = r.json()
	assert len(body2["items"]) == 2
	assert body2["items"][0]["transaction_date"] == "2026-04-03"

	# Page 3: cursor terakhir
	r = await client.get(
		f"/v1/transactions/?limit=2&cursor={body2['next_cursor']}",
		headers=headers,
	)
	body3 = r.json()
	assert len(body3["items"]) == 1
	assert body3["has_more"] is False
	assert body3["next_cursor"] is None

	# Cursor invalid → 422
	r = await client.get(
		"/v1/transactions/?cursor=not-a-real-cursor!!!", headers=headers
	)
	assert r.status_code == 422
	assert r.json()["error"]["code"] == "INVALID_CURSOR"


async def test_transaction_with_other_users_account_rejected(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	a_account_id = await _create_account(client, auth_a["headers"], name="A bank")

	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")
		# B coba create transaksi pakai akun A → 403.
		r = await client_b.post(
			"/v1/transactions/",
			json={
				"account_id": a_account_id,
				"amount": "-1000",
				"transaction_date": "2026-04-15",
			},
			headers=auth_b["headers"],
		)
		assert r.status_code == 403
		assert r.json()["error"]["code"] == "ACCOUNT_NOT_OWNED"
