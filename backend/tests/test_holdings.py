"""Integration tests untuk /v1/holdings."""

from decimal import Decimal

from httpx import ASGITransport, AsyncClient
import pytest

from tests.helpers import register_and_login


pytestmark = pytest.mark.asyncio


async def _create_account(client, headers, name: str, type_: str = "broker") -> str:
	r = await client.post(
		"/v1/accounts/",
		json={"name": name, "type": type_},
		headers=headers,
	)
	assert r.status_code == 201, r.text
	return r.json()["id"]


async def test_holding_crud(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	account_id = await _create_account(client, headers, "Stockbit")

	# Create
	r = await client.post(
		"/v1/holdings/",
		json={
			"account_id": account_id,
			"ticker": "bbca",  # auto-uppercased
			"lot": 10,
			"avg_price": "9500",
		},
		headers=headers,
	)
	assert r.status_code == 201, r.text
	holding = r.json()
	assert holding["ticker"] == "BBCA"
	assert holding["lot"] == 10
	assert holding["account_name"] == "Stockbit"

	# Duplicate → 409
	r = await client.post(
		"/v1/holdings/",
		json={
			"account_id": account_id,
			"ticker": "BBCA",
			"lot": 5,
			"avg_price": "9000",
		},
		headers=headers,
	)
	assert r.status_code == 409
	assert r.json()["error"]["code"] == "HOLDING_EXISTS"

	# Update
	r = await client.patch(
		f"/v1/holdings/{holding['id']}",
		json={"lot": 20},
		headers=headers,
	)
	assert r.status_code == 200
	assert r.json()["lot"] == 20

	# Delete
	r = await client.delete(f"/v1/holdings/{holding['id']}", headers=headers)
	assert r.status_code == 204


async def test_holding_must_be_broker_account(client):
	auth = await register_and_login(client)
	headers = auth["headers"]
	bank_id = await _create_account(client, headers, "BCA", type_="bank")

	r = await client.post(
		"/v1/holdings/",
		json={
			"account_id": bank_id,
			"ticker": "BBCA",
			"lot": 10,
			"avg_price": "9500",
		},
		headers=headers,
	)
	assert r.status_code == 403
	assert r.json()["error"]["code"] == "ACCOUNT_NOT_BROKER"


async def test_holdings_aggregate_weighted_avg(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	stockbit = await _create_account(client, headers, "Stockbit")
	ipot = await _create_account(client, headers, "IPOT")

	# BBCA di Stockbit: 10 lot @ 9000
	# BBCA di IPOT: 5 lot @ 10000
	# weighted avg = (10*9000 + 5*10000) / 15 = 140000/15 = 9333.33
	await client.post(
		"/v1/holdings/",
		json={"account_id": stockbit, "ticker": "BBCA", "lot": 10, "avg_price": "9000"},
		headers=headers,
	)
	await client.post(
		"/v1/holdings/",
		json={"account_id": ipot, "ticker": "BBCA", "lot": 5, "avg_price": "10000"},
		headers=headers,
	)
	# TLKM hanya di Stockbit, sebagai control.
	await client.post(
		"/v1/holdings/",
		json={"account_id": stockbit, "ticker": "TLKM", "lot": 4, "avg_price": "3500"},
		headers=headers,
	)

	# Aggregate view
	r = await client.get("/v1/holdings/?view=aggregate", headers=headers)
	assert r.status_code == 200
	items = {item["ticker"]: item for item in r.json()["items"]}

	bbca = items["BBCA"]
	assert bbca["total_lot"] == 15
	assert Decimal(bbca["weighted_avg_price"]) == Decimal("9333.33")
	assert len(bbca["breakdown"]) == 2

	tlkm = items["TLKM"]
	assert tlkm["total_lot"] == 4
	assert Decimal(tlkm["weighted_avg_price"]) == Decimal("3500.00")

	# per_account view
	r = await client.get("/v1/holdings/?view=per_account", headers=headers)
	assert r.status_code == 200
	assert len(r.json()["items"]) == 3


async def test_holdings_require_auth(client):
	r = await client.get("/v1/holdings/")
	assert r.status_code == 401


async def test_holdings_user_isolation(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	a_account = await _create_account(client, auth_a["headers"], "A's Stockbit")
	r = await client.post(
		"/v1/holdings/",
		json={
			"account_id": a_account,
			"ticker": "BBCA",
			"lot": 10,
			"avg_price": "9500",
		},
		headers=auth_a["headers"],
	)
	a_holding_id = r.json()["id"]

	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")
		r = await client_b.get(
			"/v1/holdings/?view=per_account", headers=auth_b["headers"]
		)
		assert r.json()["items"] == []

		r = await client_b.get(
			f"/v1/holdings/{a_holding_id}", headers=auth_b["headers"]
		)
		assert r.status_code == 404
