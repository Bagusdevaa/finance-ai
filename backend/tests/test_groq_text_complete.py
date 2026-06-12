"""Unit test untuk text_complete (mocked Groq sync client)."""


def test_text_complete_returns_message_content(monkeypatch):
	from app.ai import groq_client

	captured = {}

	class _Msg:
		content = '{"ok": true}'

	class _Choice:
		message = _Msg()

	class _Resp:
		choices = [_Choice()]

	class _Completions:
		def create(self, **kwargs):
			captured.update(kwargs)
			return _Resp()

	class _Chat:
		completions = _Completions()

	class _FakeClient:
		chat = _Chat()

	monkeypatch.setattr(groq_client, "_get_sync_client", lambda: _FakeClient())

	out = groq_client.text_complete("sys", "user")
	assert out == '{"ok": true}'
	# JSON mode + low temperature for deterministic structured output.
	assert captured["response_format"] == {"type": "json_object"}
	assert captured["temperature"] == 0.1
	assert captured["messages"][0]["role"] == "system"
	assert captured["messages"][1]["content"] == "user"


def test_text_complete_empty_content_returns_empty_string(monkeypatch):
	from app.ai import groq_client

	class _Msg:
		content = None

	class _Choice:
		message = _Msg()

	class _Resp:
		choices = [_Choice()]

	class _FakeClient:
		class chat:
			class completions:
				@staticmethod
				def create(**kwargs):
					return _Resp()

	monkeypatch.setattr(groq_client, "_get_sync_client", lambda: _FakeClient())
	assert groq_client.text_complete("s", "u") == ""
