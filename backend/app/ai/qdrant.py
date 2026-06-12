"""Async Qdrant client wrapper.

Singleton client + ensure_collection idempotent. Kalau Qdrant down,
ensure_collection log warning aja — non-AI features harus tetap jalan.
"""

import structlog
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, VectorParams

from app.ai.embeddings import EMBED_DIM
from app.config import get_settings


logger = structlog.get_logger(__name__)
_settings = get_settings()
_client: AsyncQdrantClient | None = None


def get_client() -> AsyncQdrantClient:
	"""Singleton client — koneksi HTTP ke Qdrant."""
	global _client
	if _client is None:
		_client = AsyncQdrantClient(url=_settings.QDRANT_URL)
	return _client


async def ensure_collection() -> None:
	"""Idempotent: bikin collection kalau belum ada.

	Index payload field user_id sebagai keyword supaya filter cepat
	(dipakai di setiap RAG query — security-critical).
	"""
	client = get_client()
	collections = await client.get_collections()
	names = {c.name for c in collections.collections}
	if _settings.QDRANT_COLLECTION in names:
		return

	await client.create_collection(
		collection_name=_settings.QDRANT_COLLECTION,
		vectors_config=VectorParams(size=EMBED_DIM, distance=Distance.COSINE),
	)
	# Wajib index user_id — dipakai di every query filter.
	await client.create_payload_index(
		collection_name=_settings.QDRANT_COLLECTION,
		field_name="user_id",
		field_schema="keyword",
	)


async def health_check() -> bool:
	try:
		client = get_client()
		await client.get_collections()
		return True
	except Exception:
		return False
