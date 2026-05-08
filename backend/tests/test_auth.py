"""Smoke test untuk auth flow.

Cara jalan:
	1. Pastikan Postgres jalan & DATABASE_URL di .env benar.
	2. cd backend && venv/bin/alembic upgrade head
	3. cd backend && venv/bin/pytest tests/test_auth.py -v
"""

import pytest


pytestmark = pytest.mark.asyncio


REGISTER_PAYLOAD = {
	"email": "alice@example.com",
	"password": "supersecret123",
	"name": "Alice",
}


async def test_full_auth_flow(client):
	# Register
	r = await client.post("/v1/auth/register", json=REGISTER_PAYLOAD)
	assert r.status_code == 201, r.text
	user = r.json()
	assert user["email"] == REGISTER_PAYLOAD["email"]
	assert "id" in user

	# Register lagi dengan email sama → 409
	r = await client.post("/v1/auth/register", json=REGISTER_PAYLOAD)
	assert r.status_code == 409
	assert r.json()["error"]["code"] == "EMAIL_TAKEN"

	# Login
	r = await client.post(
		"/v1/auth/login",
		json={
			"email": REGISTER_PAYLOAD["email"],
			"password": REGISTER_PAYLOAD["password"],
		},
	)
	assert r.status_code == 200
	body = r.json()
	access_token = body["access_token"]
	assert body["token_type"] == "bearer"
	assert body["expires_in"] > 0
	# Cookie refresh_token harus ter-set
	assert "refresh_token" in r.cookies

	# /me dengan access token
	r = await client.get(
		"/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
	)
	assert r.status_code == 200
	assert r.json()["email"] == REGISTER_PAYLOAD["email"]

	# /me tanpa token → 401
	r = await client.get("/v1/auth/me")
	assert r.status_code == 401

	# Refresh — pakai cookie yang sudah di-set di client
	r = await client.post("/v1/auth/refresh")
	assert r.status_code == 200, r.text
	new_access = r.json()["access_token"]
	assert new_access != access_token

	# Old refresh token sudah revoked → coba refresh lagi pakai cookie lama harus gagal.
	# Trick: simpan cookie pertama dulu, lalu kirim manual.
	# Karena AsyncClient otomatis update cookie ke yang baru, kita test dengan client baru.
	# Kita test reuse: panggil refresh lagi (cookie sekarang sudah baru), itu seharusnya tetap sukses.
	r2 = await client.post("/v1/auth/refresh")
	assert r2.status_code == 200

	# Logout
	r = await client.post("/v1/auth/logout")
	assert r.status_code == 204


async def test_login_wrong_password(client):
	await client.post("/v1/auth/register", json=REGISTER_PAYLOAD)
	r = await client.post(
		"/v1/auth/login",
		json={"email": REGISTER_PAYLOAD["email"], "password": "wrongpassword"},
	)
	assert r.status_code == 401
	assert r.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_refresh_without_cookie(client):
	r = await client.post("/v1/auth/refresh")
	assert r.status_code == 401
	assert r.json()["error"]["code"] == "MISSING_REFRESH_TOKEN"


async def test_refresh_token_single_use(client):
	from httpx import ASGITransport, AsyncClient

	from app.main import app

	# Register + login
	await client.post("/v1/auth/register", json=REGISTER_PAYLOAD)
	r = await client.post(
		"/v1/auth/login",
		json={
			"email": REGISTER_PAYLOAD["email"],
			"password": REGISTER_PAYLOAD["password"],
		},
	)
	original_refresh = r.cookies.get("refresh_token")
	assert original_refresh

	# Refresh sekali → token lama harus rotated.
	r = await client.post("/v1/auth/refresh")
	assert r.status_code == 200

	# Pakai token lama lewat client baru (cookie jar kosong) supaya tidak ketimpa cookie baru.
	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as fresh:
		r = await fresh.post(
			"/v1/auth/refresh",
			cookies={"refresh_token": original_refresh},
		)
	assert r.status_code == 401
	assert r.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"
