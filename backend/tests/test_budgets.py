"""Integration tests untuk /v1/budgets."""

from decimal import Decimal

from httpx import ASGITransport, AsyncClient
import pytest

from tests.helpers import register_and_login


pytestmark = pytest.mark.asyncio


async def test_budget_crud(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	r = await client.post(
		"/v1/budgets/",
		json={
			"category": "food",
			"monthly_amount": "1500000",
			"month": "2026-04-01",
			"icon": "food",
		},
		headers=headers,
	)
	assert r.status_code == 201, r.text
	budget = r.json()
	assert budget["category"] == "food"
	assert budget["monthly_amount"] == "1500000.00"

	# Duplicate → 409
	r = await client.post(
		"/v1/budgets/",
		json={
			"category": "food",
			"monthly_amount": "2000000",
			"month": "2026-04-01",
		},
		headers=headers,
	)
	assert r.status_code == 409
	assert r.json()["error"]["code"] == "BUDGET_EXISTS"

	# List
	r = await client.get("/v1/budgets/?month=2026-04", headers=headers)
	assert r.status_code == 200
	assert len(r.json()) == 1

	# Update
	r = await client.patch(
		f"/v1/budgets/{budget['id']}",
		json={"monthly_amount": "2000000"},
		headers=headers,
	)
	assert r.status_code == 200
	assert r.json()["monthly_amount"] == "2000000.00"

	# Delete
	r = await client.delete(f"/v1/budgets/{budget['id']}", headers=headers)
	assert r.status_code == 204


async def test_budget_invalid_month(client):
	auth = await register_and_login(client)
	# Bukan first-of-month → 422
	r = await client.post(
		"/v1/budgets/",
		json={
			"category": "food",
			"monthly_amount": "1000000",
			"month": "2026-04-15",
		},
		headers=auth["headers"],
	)
	assert r.status_code == 422


async def test_budget_summary_aggregates_expenses(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	# Buat 2 budgets.
	await client.post(
		"/v1/budgets/",
		json={
			"category": "food",
			"monthly_amount": "1500000",
			"month": "2026-04-01",
		},
		headers=headers,
	)
	await client.post(
		"/v1/budgets/",
		json={
			"category": "transport",
			"monthly_amount": "500000",
			"month": "2026-04-01",
		},
		headers=headers,
	)

	# Buat transaksi: expenses dalam April + 1 income (harus dilewatkan)
	tx_specs = [
		# food: 200k + 300k = 500k spent
		{"amount": "-200000", "category": "food", "transaction_date": "2026-04-05"},
		{"amount": "-300000", "category": "food", "transaction_date": "2026-04-12"},
		# transport: 100k spent
		{"amount": "-100000", "category": "transport", "transaction_date": "2026-04-08"},
		# Income: must be ignored.
		{"amount": "5000000", "category": "salary", "transaction_date": "2026-04-25"},
		# Bulan lain: ignored.
		{"amount": "-999999", "category": "food", "transaction_date": "2026-03-15"},
		{"amount": "-999999", "category": "food", "transaction_date": "2026-05-01"},
	]
	for spec in tx_specs:
		r = await client.post(
			"/v1/transactions/", json={**spec, "merchant_name": "x"}, headers=headers
		)
		assert r.status_code == 201

	r = await client.get("/v1/budgets/summary?month=2026-04", headers=headers)
	assert r.status_code == 200, r.text
	body = r.json()

	assert Decimal(body["total_budget"]) == Decimal("2000000")
	assert Decimal(body["total_spent"]) == Decimal("600000")
	assert Decimal(body["remaining"]) == Decimal("1400000")

	by_cat = {item["category"]: item for item in body["items"]}
	assert Decimal(by_cat["food"]["spent"]) == Decimal("500000")
	assert Decimal(by_cat["food"]["remaining"]) == Decimal("1000000")
	assert by_cat["food"]["percent_used"] == pytest.approx(33.33, rel=0.01)
	assert Decimal(by_cat["transport"]["spent"]) == Decimal("100000")


async def test_budgets_require_auth(client):
	r = await client.get("/v1/budgets/?month=2026-04")
	assert r.status_code == 401


async def test_budgets_user_isolation(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	r = await client.post(
		"/v1/budgets/",
		json={
			"category": "food",
			"monthly_amount": "1000000",
			"month": "2026-04-01",
		},
		headers=auth_a["headers"],
	)
	a_budget_id = r.json()["id"]

	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")
		r = await client_b.get(
			"/v1/budgets/?month=2026-04", headers=auth_b["headers"]
		)
		assert r.json() == []

		r = await client_b.get(
			f"/v1/budgets/{a_budget_id}", headers=auth_b["headers"]
		)
		assert r.status_code == 404
