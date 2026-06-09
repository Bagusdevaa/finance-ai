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
from app.import_data.parsers.base import (
	ParsedHolding,
	ParsedRow,
	ParseResult,
	register,
)


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


def _parse_vision_response_obj(raw: str) -> dict | None:
	"""Parse JSON dari vision LLM. Return dict (full response) or None on bad JSON."""
	if not raw:
		return None
	try:
		obj = json.loads(raw)
	except json.JSONDecodeError:
		return None
	if not isinstance(obj, dict):
		return None
	return obj


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


def _to_parsed_holding(item: dict, line_no: int) -> ParsedHolding | None:
	"""Convert one vision JSON holding item to ParsedHolding. Return None if invalid."""
	ticker = (item.get("ticker") or "").strip() if item.get("ticker") is not None else ""
	if not ticker:
		return None

	# qty: optional sekarang — summary view (Pluang Portfolio tab) cuma punya market_value.
	qty = None
	if item.get("qty") is not None:
		try:
			qty = Decimal(str(item["qty"]))
			if qty == 0:
				qty = None
		except (InvalidOperation, ValueError):
			qty = None

	# avg_price: optional
	avg_price = None
	if item.get("avg_price") is not None:
		try:
			avg_price = Decimal(str(item["avg_price"]))
		except (InvalidOperation, ValueError):
			pass

	# market_value: optional
	market_value = None
	if item.get("market_value") is not None:
		try:
			market_value = Decimal(str(item["market_value"]))
		except (InvalidOperation, ValueError):
			pass

	# Skip kalau qty DAN market_value dua-duanya tidak ada (tidak ada data berguna).
	if qty is None and market_value is None:
		return None

	currency_raw = item.get("currency") or "IDR"
	currency = currency_raw if currency_raw in _VALID_CURRENCIES else "IDR"

	asset_type_raw = (item.get("asset_type") or "unknown").strip()
	valid_asset_types = {"stock", "crypto", "gold", "cash", "unknown"}
	asset_type = asset_type_raw if asset_type_raw in valid_asset_types else "unknown"

	return ParsedHolding(
		line_no=line_no,
		ticker=ticker,
		qty=qty,
		avg_price=avg_price,
		market_value=market_value,
		currency=currency,
		asset_type=asset_type,
		confidence_score=Decimal("1.00"),
		raw_text=json.dumps(item, ensure_ascii=False),
	)


# ---------- Parser class ----------

@register(ImportSourceType.image_vision.value)
class ImageVisionParser:
	def parse(self, file_bytes: bytes) -> ParseResult:
		# Input validation: short-circuit before calling LLM.
		if not file_bytes:
			return ParseResult()
		if len(file_bytes) > _MAX_SIZE_BYTES:
			return ParseResult()
		mime = _detect_image_mime(file_bytes)
		if mime is None:
			return ParseResult()

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

		obj = _parse_vision_response_obj(raw)

		# Retry once on bad JSON with corrective prompt.
		if obj is None:
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
				obj = _parse_vision_response_obj(raw)
			except Exception:
				return ParseResult()
			if obj is None:
				return ParseResult()

		# Parse content_type with fallback to "unknown"
		content_type_raw = obj.get("content_type", "unknown")
		valid_content_types = {"statement", "receipt", "holding", "unknown"}
		content_type = content_type_raw if content_type_raw in valid_content_types else "unknown"

		# Map transactions → ParsedRow list
		tx_items = obj.get("transactions") or []
		if not isinstance(tx_items, list):
			tx_items = []
		rows: list[ParsedRow] = []
		next_line_no = 1
		for item in tx_items:
			if not isinstance(item, dict):
				continue
			row = _to_parsed_row(item, line_no=next_line_no)
			if row is not None:
				rows.append(row)
				next_line_no += 1

		# Map holdings → ParsedHolding list
		holding_items = obj.get("holdings") or []
		if not isinstance(holding_items, list):
			holding_items = []
		holdings: list[ParsedHolding] = []
		next_h_line_no = 1
		for item in holding_items:
			if not isinstance(item, dict):
				continue
			h = _to_parsed_holding(item, line_no=next_h_line_no)
			if h is not None:
				holdings.append(h)
				next_h_line_no += 1

		# Attach balance_summary raw dict as attribute for service layer (no BalanceCheck yet)
		result = ParseResult(
			rows=rows,
			holdings=holdings,
			content_type=content_type,
		)
		balance_summary = obj.get("balance_summary")
		if isinstance(balance_summary, dict):
			# Stash raw for service layer to convert to BalanceCheck via validation.run_balance_check
			result._balance_summary_raw = balance_summary  # type: ignore[attr-defined]
		return result
