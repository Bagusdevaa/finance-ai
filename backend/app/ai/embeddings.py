"""Sentence embeddings via fastembed (ONNX, no PyTorch).

Lazy-load supaya boot cepat — model download ~220MB pas first call.
fastembed itu sync; caller dari async code WAJIB pakai asyncio.to_thread.

Model: sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
  - Multilingual (50+ bahasa termasuk Indonesia)
  - 384 dim, cosine similarity
  - Tidak butuh prefix khusus seperti E5 family
"""

from collections.abc import Iterable

from app.config import get_settings


_settings = get_settings()
_model = None  # type: ignore[var-annotated]

# Dimensi vector untuk paraphrase-multilingual-MiniLM-L12-v2. Hardcoded
# supaya Qdrant bisa create collection sebelum model di-download.
EMBED_DIM = 384


def _get_model():
	"""Singleton — fastembed thread-safe untuk inference, tapi kita tetap satu instance."""
	global _model
	if _model is None:
		# Import di sini supaya import-time aplikasi tidak nge-load fastembed
		# (yang sendiri me-load ONNX runtime). Best-effort lazy.
		from fastembed import TextEmbedding

		_model = TextEmbedding(model_name=_settings.EMBEDDING_MODEL)
	return _model


def embed_texts(texts: Iterable[str]) -> list[list[float]]:
	"""Sync embedding. Caller dari async harus pakai asyncio.to_thread."""
	model = _get_model()
	# fastembed.embed() return generator of numpy arrays — ubah ke list[float].
	return [list(map(float, v)) for v in model.embed(list(texts))]


def embed_passages(texts: Iterable[str]) -> list[list[float]]:
	"""Embed dokumen yang akan disimpan ke vector store."""
	return embed_texts(list(texts))


def embed_query(text: str) -> list[float]:
	"""Embed query string untuk semantic search."""
	return embed_texts([text])[0]
