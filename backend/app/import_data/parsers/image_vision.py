"""Image vision parser via Groq multimodal LLM.

Model dipilih via GROQ_VISION_MODEL env (lihat .env.example). Per 2026-05-12,
Llama 3.2 vision models (90B/11B) di-deprecate dari Groq inventory; pakai
meta-llama/llama-4-scout-17b-16e-instruct sebagai pengganti multimodal.

Input: image bytes (PNG/JPEG/WebP).
Output: list[ParsedRow] via Groq vision LLM + strict JSON output + Python-side
validation. Sync (parser must stay sync per existing Parser Protocol — service
layer calls parse() from async context, so we use sync Groq client to avoid
event-loop reentry).

Hybrid kategorisasi: vision LLM extract `bank_category` (app's own label),
pass-through ke ParsedRow.category. Service layer akan jalankan
categorize_rule_based() di atasnya kalau hasilnya None.
"""

import base64
import json
import time
from datetime import date
from decimal import Decimal, InvalidOperation

from app.ai.groq_client import vision_complete
from app.ai.vision_prompts import SYSTEM_PROMPT, USER_PROMPT
from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


# ---------- Constants ----------

_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB
_GENERIC_ONE_WORD_DESCRIPTIONS = {
	"transfer", "bayar", "top up", "topup",
}
_VALID_CURRENCIES = {"IDR", "USD"}


# ---------- Helpers ----------

def _detect_image_mime(file_bytes: bytes) -> str | None:
	"""Detect image MIME via magic bytes. Returns None kalau bukan image yang dikenal."""
	if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
		return "image/png"
	if file_bytes.startswith(b"\xff\xd8\xff"):
		return "image/jpeg"
	if file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
		return "image/webp"
	return None


def _parse_vision_response(raw: str) -> list[dict]:
	"""Parse JSON dari vision LLM. Return list of tx dicts.

	Graceful: malformed JSON, missing 'transactions' key, atau non-list value
	→ return [] (caller akan treat sebagai 'no rows extracted').
	"""
	if not raw:
		return []
	try:
		obj = json.loads(raw)
	except json.JSONDecodeError:
		return []
	if not isinstance(obj, dict):
		return []
	items = obj.get("transactions")
	if not isinstance(items, list):
		return []
	return items


def _compute_confidence(item: dict) -> Decimal:
	"""Per-row confidence based on field completeness.

	1.00: description + merchant + bank_category ada (semua field utama lengkap)
	0.90: description + merchant ada, bank_category null
	0.80: description ada, merchant null
	0.65: description = 1 kata generic (Transfer/Bayar/Top Up)
	"""
	desc = (item.get("description") or "").strip()
	merchant = (item.get("merchant") or "").strip() if item.get("merchant") is not None else ""
	bank_cat = item.get("bank_category")

	if desc.lower() in _GENERIC_ONE_WORD_DESCRIPTIONS:
		return Decimal("0.65")
	if merchant and bank_cat:
		return Decimal("1.00")
	if merchant and not bank_cat:
		return Decimal("0.90")
	# No merchant.
	return Decimal("0.80")


def _to_parsed_row(item: dict, line_no: int) -> ParsedRow | None:
	"""Convert one vision JSON item to ParsedRow. Return None kalau invalid (caller skip)."""
	# date validation
	date_str = (item.get("date") or "").strip() if item.get("date") is not None else ""
	if not date_str:
		return None
	try:
		tx_date = date.fromisoformat(date_str)
	except ValueError:
		return None

	# amount validation
	amount_raw = item.get("amount")
	if amount_raw is None:
		return None
	try:
		amount = Decimal(str(amount_raw))
	except (InvalidOperation, ValueError):
		return None
	if amount == 0:
		return None

	# description validation
	description = (item.get("description") or "").strip() if item.get("description") is not None else ""
	if not description:
		return None

	# currency: default IDR if missing or not in valid set
	currency_raw = item.get("currency") or "IDR"
	currency = currency_raw if currency_raw in _VALID_CURRENCIES else "IDR"

	# merchant: strip; empty/None → None
	merchant_raw = item.get("merchant")
	merchant_name = merchant_raw.strip() if isinstance(merchant_raw, str) and merchant_raw.strip() else None

	# bank_category: pass-through (service layer runs categorize_rule_based() if None)
	bank_cat_raw = item.get("bank_category")
	category = bank_cat_raw.strip() if isinstance(bank_cat_raw, str) and bank_cat_raw.strip() else None

	return ParsedRow(
		line_no=line_no,
		transaction_date=tx_date,
		amount=amount,
		currency=currency,
		merchant_name=merchant_name,
		description=description,
		category=category,
		confidence_score=_compute_confidence(item),
		raw_text=json.dumps(item, ensure_ascii=False),
	)


# ---------- Parser class (parse() implemented in Task 5) ----------

@register(ImportSourceType.image_vision.value)
class ImageVisionParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		# Input validation: short-circuit before calling LLM.
		if not file_bytes:
			return []
		if len(file_bytes) > _MAX_SIZE_BYTES:
			return []
		mime = _detect_image_mime(file_bytes)
		if mime is None:
			return []

		image_b64 = base64.b64encode(file_bytes).decode("ascii")

		# First attempt with default prompt.
		try:
			raw = vision_complete(
				image_b64=image_b64,
				image_mime=mime,
				system_prompt=SYSTEM_PROMPT,
				user_prompt=USER_PROMPT,
			)
		except Exception:
			# Retry once on any Groq API exception (timeout, 5xx, rate limit).
			time.sleep(2)
			raw = vision_complete(
				image_b64=image_b64,
				image_mime=mime,
				system_prompt=SYSTEM_PROMPT,
				user_prompt=USER_PROMPT,
			)

		items = _parse_vision_response(raw)

		# If JSON parsing failed (empty items but raw was non-empty non-empty-array),
		# retry once with corrective prompt prefix.
		if not items and raw and raw.strip() not in ('{"transactions":[]}', '{"transactions": []}'):
			retry_prompt = (
				"Your previous response could not be parsed as JSON. "
				"Output STRICT JSON only, matching the schema. "
				"No prose, no markdown fences.\n\n" + USER_PROMPT
			)
			try:
				raw = vision_complete(
					image_b64=image_b64,
					image_mime=mime,
					system_prompt=SYSTEM_PROMPT,
					user_prompt=retry_prompt,
				)
				items = _parse_vision_response(raw)
			except Exception:
				return []

		# Map items → ParsedRow, skip invalid rows, reassign line_no by valid index.
		rows: list[ParsedRow] = []
		next_line_no = 1
		for item in items:
			if not isinstance(item, dict):
				continue
			row = _to_parsed_row(item, line_no=next_line_no)
			if row is not None:
				rows.append(row)
				next_line_no += 1
		return rows
