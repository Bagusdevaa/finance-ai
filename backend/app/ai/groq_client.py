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
