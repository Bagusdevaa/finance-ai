"""Cursor pagination helper.

Cursor encodes (transaction_date, id) of last seen item dalam list descending.
Pakai base64 supaya safe di URL & opaque buat client.
"""

import base64
from datetime import date
from uuid import UUID

from app.core.errors import ValidationError


def encode_cursor(transaction_date: date, id_: UUID) -> str:
	raw = f"{transaction_date.isoformat()}|{id_}"
	return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> tuple[date, UUID]:
	# Restore padding yang dihilangkan saat encode.
	padded = cursor + "=" * (-len(cursor) % 4)
	try:
		raw = base64.urlsafe_b64decode(padded.encode()).decode()
		date_str, id_str = raw.split("|", 1)
		return date.fromisoformat(date_str), UUID(id_str)
	except (ValueError, UnicodeDecodeError) as e:
		raise ValidationError(
			code="INVALID_CURSOR", message="Cursor format invalid"
		) from e
