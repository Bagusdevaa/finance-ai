"""Integration tests untuk /v1/chat.

External services (Groq, Qdrant) di-mock — test harus deterministic
dan tidak butuh internet/Qdrant aktif.
"""

import json

import pytest
from httpx import ASGITransport, AsyncClient

from tests.helpers import register_and_login


pytestmark = pytest.mark.asyncio


@pytest.fixture(autouse=True)
def mock_ai_services(monkeypatch):
	"""Stub Groq + Qdrant calls supaya test deterministic."""

	async def fake_chat_stream(messages, model=None):
		for tok in [
			"Halo",
			"! ",
			"Berdasarkan ",
			"data, ",
			"kamu ",
			"habis ",
			"banyak.",
		]:
			yield tok

	async def fake_query(user_id, query_text, top_k=8):
		# Empty context — pastikan flow tetap jalan tanpa Qdrant.
		return []

	async def fake_index(transaction_ids):
		return None

	# Patch the symbols where the chat service imported them via the module path.
	monkeypatch.setattr("app.chat.service.groq_client.chat_stream", fake_chat_stream)
	monkeypatch.setattr("app.chat.service.rag_pipeline.query", fake_query)
	monkeypatch.setattr(
		"app.import_data.service.index_transactions", fake_index
	)


async def _consume_sse(response) -> list[dict]:
	"""Parse `data: {...}` lines from SSE response. Skip [DONE]."""
	events: list[dict] = []
	async for line in response.aiter_lines():
		if not line.startswith("data: "):
			continue
		payload = line[len("data: "):].strip()
		if payload == "[DONE]":
			continue
		events.append(json.loads(payload))
	return events


async def test_create_and_list_sessions(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	# Initially empty.
	r = await client.get("/v1/chat/sessions", headers=headers)
	assert r.status_code == 200
	assert r.json() == []

	# Create.
	r = await client.post(
		"/v1/chat/sessions",
		json={"title": "Pertanyaan budget"},
		headers=headers,
	)
	assert r.status_code == 201, r.text
	body = r.json()
	assert body["title"] == "Pertanyaan budget"
	session_id = body["id"]

	# Default title kalau tidak dikasih.
	r = await client.post("/v1/chat/sessions", json={}, headers=headers)
	assert r.status_code == 201
	assert r.json()["title"] == "Percakapan baru"

	# List.
	r = await client.get("/v1/chat/sessions", headers=headers)
	assert r.status_code == 200
	items = r.json()
	assert len(items) == 2
	ids = {it["id"] for it in items}
	assert session_id in ids


async def test_get_session_with_messages(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	r = await client.post("/v1/chat/sessions", json={}, headers=headers)
	session_id = r.json()["id"]

	# Post a message via SSE.
	async with client.stream(
		"POST",
		f"/v1/chat/sessions/{session_id}/messages",
		json={"content": "Berapa pengeluaran saya bulan ini?"},
		headers=headers,
	) as resp:
		assert resp.status_code == 200
		events = await _consume_sse(resp)

	# Verify event types.
	types = [e["type"] for e in events]
	assert "user_saved" in types
	assert "context" in types
	assert "token" in types
	assert "done" in types

	# GET session detail returns both messages.
	r = await client.get(f"/v1/chat/sessions/{session_id}", headers=headers)
	assert r.status_code == 200
	body = r.json()
	assert len(body["messages"]) == 2
	roles = [m["role"] for m in body["messages"]]
	assert roles == ["user", "assistant"]

	# Assistant content adalah concat semua tokens.
	assistant_msg = body["messages"][1]
	assert "Halo" in assistant_msg["content"]
	assert "banyak" in assistant_msg["content"]


async def test_post_message_streams_and_saves(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	r = await client.post("/v1/chat/sessions", json={}, headers=headers)
	session_id = r.json()["id"]

	async with client.stream(
		"POST",
		f"/v1/chat/sessions/{session_id}/messages",
		json={"content": "Test"},
		headers=headers,
	) as resp:
		events = await _consume_sse(resp)

	tokens = [e["content"] for e in events if e["type"] == "token"]
	assert len(tokens) > 0
	full = "".join(tokens)
	assert full == "Halo! Berdasarkan data, kamu habis banyak."

	done_events = [e for e in events if e["type"] == "done"]
	assert len(done_events) == 1
	assert "id" in done_events[0]


async def test_user_isolation(client):
	from app.main import app

	auth_a = await register_and_login(client, email="a@example.com")
	r = await client.post(
		"/v1/chat/sessions", json={}, headers=auth_a["headers"]
	)
	session_id = r.json()["id"]

	transport = ASGITransport(app=app)
	async with AsyncClient(transport=transport, base_url="http://test") as client_b:
		auth_b = await register_and_login(client_b, email="b@example.com")

		# B can't read A's session.
		r = await client_b.get(
			f"/v1/chat/sessions/{session_id}", headers=auth_b["headers"]
		)
		assert r.status_code == 404

		# B can't delete A's session.
		r = await client_b.delete(
			f"/v1/chat/sessions/{session_id}", headers=auth_b["headers"]
		)
		assert r.status_code == 404

		# B can't post into A's session — SSE returns 200 but body has error event,
		# karena exception handler tidak fire di dalam StreamingResponse generator.
		async with client_b.stream(
			"POST",
			f"/v1/chat/sessions/{session_id}/messages",
			json={"content": "leak?"},
			headers=auth_b["headers"],
		) as resp:
			events = await _consume_sse(resp)
		# Harus ada error event, dan tidak boleh ada token.
		err_events = [e for e in events if e["type"] == "error"]
		assert len(err_events) >= 1
		token_events = [e for e in events if e["type"] == "token"]
		assert token_events == []

		# B's listing kosong.
		r = await client_b.get("/v1/chat/sessions", headers=auth_b["headers"])
		assert r.json() == []


async def test_session_404_for_unknown(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	r = await client.get(
		"/v1/chat/sessions/00000000-0000-0000-0000-000000000000",
		headers=headers,
	)
	assert r.status_code == 404


async def test_delete_session(client):
	auth = await register_and_login(client)
	headers = auth["headers"]

	r = await client.post("/v1/chat/sessions", json={}, headers=headers)
	session_id = r.json()["id"]

	r = await client.delete(f"/v1/chat/sessions/{session_id}", headers=headers)
	assert r.status_code == 204

	# After delete: 404.
	r = await client.get(f"/v1/chat/sessions/{session_id}", headers=headers)
	assert r.status_code == 404

	# Listing kosong (soft-deleted excluded).
	r = await client.get("/v1/chat/sessions", headers=headers)
	assert r.json() == []
