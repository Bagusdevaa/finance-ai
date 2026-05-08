"""Integration tests untuk /v1/accounts."""

from httpx import ASGITransport, AsyncClient
import pytest

from tests.helpers import register_and_login


pytestmark = pytest.mark.asyncio


async def test_create_list_get_update_delete_account(client):
	auth = await register_and_login(client, email="a@example.com")
	headers = auth["headers"]

	# Create
	r = await client.post(
		"/v1/accounts/",
		json={"name": "BCA Tahapan", "type": "bank", "last4": "7823"},
		headers=headers,
	)
	assert r.status_code == 201, r.text
	acc = r.json()
	assert acc["name"] == "BCA Tahapan"
	assert acc["type"] == "bank"
	assert acc["currency"] == "IDR"
	assert acc["is_active"] is True

	# List
	r = await client.get("/v1/accounts/", headers=headers)
	assert r.status_code == 200
	assert len(r.json()) == 1

	# Get
	r = await client.get(f"/v1/accounts/{acc['id']}", headers=headers)
	assert r.status_code == 200
	assert r.json()["id"] == acc["id"]

	# Update
	r = await client.patch(
		f"/v1/accounts/{acc['id']}",
		json={"name": "BCA Updated", "is_active": False},
		headers=headers,
	)
	assert r.status_code == 200
	assert r.json()["name"] == "BCA Updated"
	assert r.json()["is_active"] is False

	# Delete (soft)
	r = await client.delete(f"/v1/accounts/{acc['id']}", headers=headers)
	assert r.status_code == 204

	# Get after delete → 404
	r = await client.get(f"/v1/accounts/{acc['id']}", headers=headers)
	assert r.status_code == 404
	assert r.json()["error"]["code"] == "ACCOUNT_NOT_FOUND"

	# List harusnya kosong
	r = await client.get("/v1/accounts/", headers=headers)
	assert r.json() == []


async def test_accounts_require_auth(client):
	r = await client.get("/v1/accounts/")
	assert r.status_code == 401


async def test_accounts_user_isolation(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	# Create account untuk user A.
	r = await client.post(
		"/v1/accounts/",
		json={"name": "A's BCA", "type": "bank"},
		headers=auth_a["headers"],
	)
	a_account_id = r.json()["id"]

	# User B di client baru (cookie jar bersih).
	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")
		# B tidak boleh lihat akun A.
		r = await client_b.get("/v1/accounts/", headers=auth_b["headers"])
		assert r.status_code == 200
		assert r.json() == []

		# B akses akun A → 404 (bukan 403, biar tidak bocor existence).
		r = await client_b.get(
			f"/v1/accounts/{a_account_id}", headers=auth_b["headers"]
		)
		assert r.status_code == 404
