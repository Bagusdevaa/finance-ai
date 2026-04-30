"""Helper umum untuk integration tests."""

from httpx import AsyncClient


async def register_and_login(
	client: AsyncClient,
	email: str = "user@example.com",
	password: str = "supersecret123",
	name: str = "User",
) -> dict:
	"""Register + login, return {token, headers, user}."""
	await client.post(
		"/v1/auth/register",
		json={"email": email, "password": password, "name": name},
	)
	r = await client.post(
		"/v1/auth/login",
		json={"email": email, "password": password},
	)
	body = r.json()
	token = body["access_token"]
	return {
		"token": token,
		"headers": {"Authorization": f"Bearer {token}"},
		"user": body["user"],
	}
