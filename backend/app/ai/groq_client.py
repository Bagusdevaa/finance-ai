"""Groq API client wrapper.

Streaming chat completion via async iterator.
Singleton client di-init lazy biar app bisa boot tanpa GROQ_API_KEY
(non-AI features tetap fungsi).
"""

from collections.abc import AsyncIterator

from app.config import get_settings


_settings = get_settings()
_client = None  # type: ignore[var-annotated]


def _get_client():
	global _client
	if _client is None:
		if not _settings.GROQ_API_KEY:
			raise RuntimeError("GROQ_API_KEY not configured")
		# Import lazily — package optional saat AI disabled.
		from groq import AsyncGroq

		_client = AsyncGroq(api_key=_settings.GROQ_API_KEY)
	return _client


async def chat_stream(
	messages: list[dict],
	model: str | None = None,
) -> AsyncIterator[str]:
	"""Stream chat completion. Yield content tokens as they arrive.

	Temperature 0.4 — masih natural tapi tidak terlalu mengarang
	(critical karena kita feed data finansial real).
	"""
	client = _get_client()
	stream = await client.chat.completions.create(
		model=model or _settings.GROQ_MODEL,
		messages=messages,
		stream=True,
		temperature=0.4,
		max_tokens=1024,
	)
	async for chunk in stream:
		delta = chunk.choices[0].delta.content
		if delta:
			yield delta


# ---------- Sync vision client ----------

_sync_client = None  # type: ignore[var-annotated]


def _get_sync_client():
	"""Lazy sync Groq client. Separate from async client because vision parser
	is called from sync parse() context (existing Parser Protocol)."""
	global _sync_client
	if _sync_client is None:
		if not _settings.GROQ_API_KEY:
			raise RuntimeError("GROQ_API_KEY not configured")
		from groq import Groq

		_sync_client = Groq(api_key=_settings.GROQ_API_KEY)
	return _sync_client


def vision_complete(
	image_b64: str,
	image_mime: str,
	system_prompt: str,
	user_prompt: str,
	*,
	model: str | None = None,
	max_tokens: int = 4096,
) -> str:
	"""Single-shot vision completion. Sync (parser must stay sync per Protocol).

	Args:
	    image_b64: base64-encoded image bytes (no data: prefix)
	    image_mime: "image/png" | "image/jpeg" | "image/webp"
	    system_prompt: system message content
	    user_prompt: user message text content (image attached separately)
	    model: optional override; default GROQ_VISION_MODEL
	    max_tokens: max completion tokens; default 4096 (vision JSON output can be large)

	Returns:
	    Raw assistant content string. Empty string if model returned None.
	"""
	client = _get_sync_client()
	response = client.chat.completions.create(
		model=model or _settings.GROQ_VISION_MODEL,
		messages=[
			{"role": "system", "content": system_prompt},
			{
				"role": "user",
				"content": [
					{"type": "text", "text": user_prompt},
					{
						"type": "image_url",
						"image_url": {
							"url": f"data:{image_mime};base64,{image_b64}"
						},
					},
				],
			},
		],
		temperature=0.1,
		max_tokens=max_tokens,
		response_format={"type": "json_object"},
	)
	return response.choices[0].message.content or ""


def text_complete(
	system_prompt: str,
	user_prompt: str,
	*,
	model: str | None = None,
	max_tokens: int = 2048,
) -> str:
	"""Single-shot text completion with JSON output. Sync (orchestrator runs
	sync inference inside the background task, like vision_complete).

	Temperature 0.1 — structured mapping output, deterministic. Used for recipe
	inference: the model maps columns/rules, it never transcribes row numbers.

	Returns raw assistant content string. Empty string if model returned None.
	"""
	client = _get_sync_client()
	response = client.chat.completions.create(
		model=model or _settings.GROQ_MODEL,
		messages=[
			{"role": "system", "content": system_prompt},
			{"role": "user", "content": user_prompt},
		],
		temperature=0.1,
		max_tokens=max_tokens,
		response_format={"type": "json_object"},
	)
	return response.choices[0].message.content or ""
