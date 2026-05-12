"""Tests untuk ImageVisionParser.

Unit tests pakai mocked Groq (selalu jalan).
Integration live tests dipisah ke test_image_vision_live.py (gated env flag).
"""

import pytest


# ---------- Prompt constants ----------

def test_prompts_module_imports():
	from app.ai.vision_prompts import SYSTEM_PROMPT, USER_PROMPT
	assert isinstance(SYSTEM_PROMPT, str)
	assert isinstance(USER_PROMPT, str)


def test_system_prompt_non_empty_and_mentions_indonesian():
	from app.ai.vision_prompts import SYSTEM_PROMPT
	assert len(SYSTEM_PROMPT) > 100
	assert "Indonesian" in SYSTEM_PROMPT


def test_user_prompt_contains_schema_keys():
	from app.ai.vision_prompts import USER_PROMPT
	# All ParsedRow-relevant fields must be mentioned in the prompt schema.
	for key in ("date", "amount", "currency", "merchant", "description", "bank_category"):
		assert f'"{key}"' in USER_PROMPT, f"Schema key {key} missing from USER_PROMPT"


def test_user_prompt_contains_sign_rules():
	from app.ai.vision_prompts import USER_PROMPT
	# Sign convention rules must be present.
	assert "SIGN" in USER_PROMPT or "sign" in USER_PROMPT
	assert "DB" in USER_PROMPT  # Debit indicator
	assert "CR" in USER_PROMPT  # Credit indicator


def test_user_prompt_contains_status_filter():
	from app.ai.vision_prompts import USER_PROMPT
	# Must instruct LLM to skip failed/cancelled.
	assert "Failed" in USER_PROMPT
	assert "Cancelled" in USER_PROMPT


def test_user_prompt_contains_few_shot_examples():
	from app.ai.vision_prompts import USER_PROMPT
	# Few-shot examples anchor LLM output format.
	assert "EXAMPLES" in USER_PROMPT
	# At least 3 examples expected (multi-row, single-tx, e-statement).
	assert USER_PROMPT.count('"transactions"') >= 4  # 1 schema + 3 examples


# ---------- vision_complete helper ----------

def test_vision_complete_returns_message_content(monkeypatch):
	"""vision_complete should call Groq sync client and return choices[0].message.content."""
	from unittest.mock import MagicMock
	from app.ai import groq_client

	mock_response = MagicMock()
	mock_response.choices = [MagicMock(message=MagicMock(content='{"transactions":[]}'))]

	mock_client = MagicMock()
	mock_client.chat.completions.create.return_value = mock_response

	monkeypatch.setattr(groq_client, "_get_sync_client", lambda: mock_client)

	result = groq_client.vision_complete(
		image_b64="ZmFrZQ==",
		image_mime="image/png",
		system_prompt="sys",
		user_prompt="usr",
	)
	assert result == '{"transactions":[]}'

	# Verify call shape: model from settings, JSON response_format, temperature low.
	call = mock_client.chat.completions.create.call_args
	assert call.kwargs["response_format"] == {"type": "json_object"}
	assert call.kwargs["temperature"] == 0.1
	assert call.kwargs["max_tokens"] >= 4096
	assert call.kwargs["messages"][0]["role"] == "system"
	assert call.kwargs["messages"][1]["role"] == "user"
	# Image must be in user message content array as data: URL.
	user_content = call.kwargs["messages"][1]["content"]
	assert isinstance(user_content, list)
	image_part = [p for p in user_content if p.get("type") == "image_url"][0]
	assert image_part["image_url"]["url"].startswith("data:image/png;base64,")


def test_vision_complete_returns_empty_string_when_no_content(monkeypatch):
	from unittest.mock import MagicMock
	from app.ai import groq_client

	mock_response = MagicMock()
	mock_response.choices = [MagicMock(message=MagicMock(content=None))]
	mock_client = MagicMock()
	mock_client.chat.completions.create.return_value = mock_response
	monkeypatch.setattr(groq_client, "_get_sync_client", lambda: mock_client)

	result = groq_client.vision_complete(
		image_b64="ZmFrZQ==", image_mime="image/jpeg",
		system_prompt="s", user_prompt="u",
	)
	assert result == ""


# ---------- ImageVisionParser helpers ----------

from datetime import date
from decimal import Decimal


# Magic byte prefixes for testing _detect_image_mime
PNG_HEADER = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG_HEADER = b"\xff\xd8\xff" + b"\x00" * 16
WEBP_HEADER = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 8


def test_detect_image_mime_png():
	from app.import_data.parsers.image_vision import _detect_image_mime
	assert _detect_image_mime(PNG_HEADER) == "image/png"


def test_detect_image_mime_jpeg():
	from app.import_data.parsers.image_vision import _detect_image_mime
	assert _detect_image_mime(JPEG_HEADER) == "image/jpeg"


def test_detect_image_mime_webp():
	from app.import_data.parsers.image_vision import _detect_image_mime
	assert _detect_image_mime(WEBP_HEADER) == "image/webp"


def test_detect_image_mime_unknown_returns_none():
	from app.import_data.parsers.image_vision import _detect_image_mime
	assert _detect_image_mime(b"%PDF-1.4") is None
	assert _detect_image_mime(b"random bytes") is None
	assert _detect_image_mime(b"") is None


def test_parse_vision_response_valid():
	from app.import_data.parsers.image_vision import _parse_vision_response
	raw = '{"transactions":[{"date":"2026-01-01","amount":100,"currency":"IDR","description":"test"}]}'
	items = _parse_vision_response(raw)
	assert len(items) == 1
	assert items[0]["date"] == "2026-01-01"


def test_parse_vision_response_empty_array():
	from app.import_data.parsers.image_vision import _parse_vision_response
	assert _parse_vision_response('{"transactions":[]}') == []


def test_parse_vision_response_malformed_json():
	from app.import_data.parsers.image_vision import _parse_vision_response
	assert _parse_vision_response("not json") == []
	assert _parse_vision_response("") == []


def test_parse_vision_response_missing_transactions_key():
	from app.import_data.parsers.image_vision import _parse_vision_response
	assert _parse_vision_response('{"foo":"bar"}') == []


def test_parse_vision_response_transactions_not_a_list():
	from app.import_data.parsers.image_vision import _parse_vision_response
	assert _parse_vision_response('{"transactions":"not a list"}') == []


# ---------- _compute_confidence ----------

def test_confidence_full_row():
	from app.import_data.parsers.image_vision import _compute_confidence
	c = _compute_confidence({
		"description": "GoPay to Xsolla",
		"merchant": "Xsolla",
		"bank_category": "Transfer",
		"amount": -90000,
	})
	assert c == Decimal("1.00")


def test_confidence_missing_bank_category():
	from app.import_data.parsers.image_vision import _compute_confidence
	c = _compute_confidence({
		"description": "GoPay to Xsolla",
		"merchant": "Xsolla",
		"bank_category": None,
		"amount": -90000,
	})
	assert c == Decimal("0.90")


def test_confidence_missing_merchant():
	from app.import_data.parsers.image_vision import _compute_confidence
	c = _compute_confidence({
		"description": "Send Money",
		"merchant": None,
		"bank_category": None,
		"amount": -35000,
	})
	assert c == Decimal("0.80")


def test_confidence_generic_one_word_description():
	from app.import_data.parsers.image_vision import _compute_confidence
	for word in ("Transfer", "Bayar", "Top Up", "transfer"):
		c = _compute_confidence({
			"description": word,
			"merchant": None,
			"bank_category": None,
			"amount": -1000,
		})
		assert c == Decimal("0.65"), f"Expected 0.65 for description={word!r}, got {c}"


# ---------- _to_parsed_row ----------

def test_to_parsed_row_valid():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{
			"date": "2026-03-01",
			"time": "18:33:00",
			"amount": -90000,
			"currency": "IDR",
			"merchant": "Xsolla",
			"description": "GoPay to Xsolla",
			"bank_category": None,
		},
		line_no=1,
	)
	assert row is not None
	assert row.line_no == 1
	assert row.transaction_date == date(2026, 3, 1)
	assert row.amount == Decimal("-90000")
	assert row.currency == "IDR"
	assert row.merchant_name == "Xsolla"
	assert row.description == "GoPay to Xsolla"
	assert row.category is None
	assert row.confidence_score == Decimal("0.90")
	# raw_text should contain the original JSON of the item.
	assert "Xsolla" in row.raw_text


def test_to_parsed_row_invalid_date_returns_none():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "not-a-date", "amount": 100, "description": "x"},
		line_no=1,
	)
	assert row is None


def test_to_parsed_row_missing_date_returns_none():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"amount": 100, "description": "x"},
		line_no=1,
	)
	assert row is None


def test_to_parsed_row_zero_amount_returns_none():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "2026-01-01", "amount": 0, "description": "x"},
		line_no=1,
	)
	assert row is None


def test_to_parsed_row_invalid_amount_returns_none():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "2026-01-01", "amount": "abc", "description": "x"},
		line_no=1,
	)
	assert row is None


def test_to_parsed_row_empty_description_returns_none():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "2026-01-01", "amount": 100, "description": "   "},
		line_no=1,
	)
	assert row is None


def test_to_parsed_row_currency_default_idr():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "2026-01-01", "amount": 100, "description": "test"},
		line_no=1,
	)
	assert row is not None
	assert row.currency == "IDR"


def test_to_parsed_row_currency_usd():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "2026-01-01", "amount": -100, "currency": "USD", "description": "test"},
		line_no=1,
	)
	assert row is not None
	assert row.currency == "USD"


def test_to_parsed_row_currency_unknown_defaults_idr():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{"date": "2026-01-01", "amount": 100, "currency": "EUR", "description": "test"},
		line_no=1,
	)
	assert row is not None
	assert row.currency == "IDR"


def test_to_parsed_row_bank_category_passthrough():
	from app.import_data.parsers.image_vision import _to_parsed_row
	row = _to_parsed_row(
		{
			"date": "2026-01-01",
			"amount": -1000,
			"description": "GoPay",
			"bank_category": "Transfer",
		},
		line_no=1,
	)
	assert row is not None
	assert row.category == "Transfer"


# ---------- ImageVisionParser.parse() main flow ----------

import json

# Re-use header bytes defined earlier as a "valid-looking" image.
_VALID_IMAGE_BYTES = PNG_HEADER

_VALID_RESPONSE = json.dumps({
	"transactions": [
		{"date":"2026-03-01","time":"18:33:00","amount":-90000,"currency":"IDR","merchant":"Xsolla","description":"GoPay to Xsolla","bank_category":None},
		{"date":"2026-03-01","time":"19:00:00","amount":50000,"currency":"IDR","merchant":None,"description":"Top Up","bank_category":"Top Up"},
	]
})


def _patch_vision(monkeypatch, *return_values):
	"""Patch vision_complete to return the given values in sequence (one per call)."""
	from app.import_data.parsers import image_vision as iv
	calls = {"n": 0}
	def fake(*args, **kwargs):
		i = calls["n"]
		calls["n"] += 1
		val = return_values[min(i, len(return_values) - 1)]
		if isinstance(val, Exception):
			raise val
		return val
	monkeypatch.setattr(iv, "vision_complete", fake)
	monkeypatch.setattr(iv.time, "sleep", lambda s: None)  # speed up retries
	return calls


def test_parse_empty_bytes_returns_empty(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser
	calls = _patch_vision(monkeypatch, _VALID_RESPONSE)
	rows = ImageVisionParser().parse(b"")
	assert rows == []
	assert calls["n"] == 0  # vision not even called


def test_parse_oversized_bytes_returns_empty(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser
	calls = _patch_vision(monkeypatch, _VALID_RESPONSE)
	huge = PNG_HEADER + b"\x00" * (11 * 1024 * 1024)
	rows = ImageVisionParser().parse(huge)
	assert rows == []
	assert calls["n"] == 0


def test_parse_wrong_magic_bytes_returns_empty(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser
	calls = _patch_vision(monkeypatch, _VALID_RESPONSE)
	rows = ImageVisionParser().parse(b"%PDF-1.4\n... not an image ...")
	assert rows == []
	assert calls["n"] == 0


def test_parse_valid_response_returns_rows(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser
	_patch_vision(monkeypatch, _VALID_RESPONSE)
	rows = ImageVisionParser().parse(_VALID_IMAGE_BYTES)
	assert len(rows) == 2
	assert rows[0].line_no == 1
	assert rows[1].line_no == 2
	assert rows[0].amount == Decimal("-90000")
	assert rows[1].amount == Decimal("50000")


def test_parse_skips_invalid_rows(monkeypatch):
	"""Rows with bad date, zero amount, or empty description should be skipped — others kept."""
	response = json.dumps({
		"transactions": [
			{"date":"2026-03-01","amount":-1000,"currency":"IDR","description":"valid"},
			{"date":"BAD","amount":-1000,"currency":"IDR","description":"bad date"},
			{"date":"2026-03-01","amount":0,"currency":"IDR","description":"zero amount"},
			{"date":"2026-03-01","amount":-1000,"currency":"IDR","description":"  "},
			{"date":"2026-03-01","amount":-2000,"currency":"IDR","description":"also valid"},
		]
	})
	from app.import_data.parsers.image_vision import ImageVisionParser
	_patch_vision(monkeypatch, response)
	rows = ImageVisionParser().parse(_VALID_IMAGE_BYTES)
	assert len(rows) == 2
	assert rows[0].description == "valid"
	assert rows[1].description == "also valid"
	# line_no reflects only valid rows.
	assert rows[0].line_no == 1
	assert rows[1].line_no == 2


def test_parse_groq_api_exception_retries_once(monkeypatch):
	"""First call fails with exception, retry succeeds → rows returned."""
	from app.import_data.parsers.image_vision import ImageVisionParser
	calls = _patch_vision(monkeypatch, RuntimeError("Groq 500"), _VALID_RESPONSE)
	rows = ImageVisionParser().parse(_VALID_IMAGE_BYTES)
	assert len(rows) == 2
	assert calls["n"] == 2


def test_parse_groq_retries_then_fails_raises(monkeypatch):
	"""If both first and retry raise, parser propagates exception (service.py catches → job failed)."""
	from app.import_data.parsers.image_vision import ImageVisionParser
	_patch_vision(monkeypatch, RuntimeError("Groq 500"), RuntimeError("Groq 500 again"))
	with pytest.raises(RuntimeError, match="Groq 500"):
		ImageVisionParser().parse(_VALID_IMAGE_BYTES)


def test_parse_malformed_json_retries_then_returns_empty(monkeypatch):
	"""Bad JSON → retry with corrective prompt prefix. If still bad → return []."""
	from app.import_data.parsers.image_vision import ImageVisionParser
	calls = _patch_vision(monkeypatch, "not json", "still not json")
	rows = ImageVisionParser().parse(_VALID_IMAGE_BYTES)
	assert rows == []
	assert calls["n"] == 2


def test_parse_malformed_json_recovers_on_retry(monkeypatch):
	"""Bad JSON first, valid JSON on retry → rows returned."""
	from app.import_data.parsers.image_vision import ImageVisionParser
	calls = _patch_vision(monkeypatch, "not json", _VALID_RESPONSE)
	rows = ImageVisionParser().parse(_VALID_IMAGE_BYTES)
	assert len(rows) == 2
	assert calls["n"] == 2


def test_parse_empty_transactions_array_returns_empty(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser
	_patch_vision(monkeypatch, '{"transactions":[]}')
	rows = ImageVisionParser().parse(_VALID_IMAGE_BYTES)
	assert rows == []
