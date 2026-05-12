# ImageVisionParser Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working ImageVisionParser that accepts image bytes (PNG/JPEG/WebP) and returns `list[ParsedRow]` by calling Groq Llama 3.2 90B Vision, parsing JSON output, and validating fields — so the existing `image_vision` source_type stops raising NotImplementedError.

**Architecture:** Single generic prompt (no platform branching), strict JSON output via Groq's `response_format`, per-row validation with row-level skip-on-error (never fail whole job), confidence scoring based on field completeness. Sync `vision_complete()` helper in `groq_client.py` (parser must stay sync per existing `Parser` Protocol). Drop-in to existing import pipeline — `service.py` unchanged.

**Tech Stack:** Python 3.12, Groq Python SDK (sync `Groq` client + AsyncGroq existing), pdfplumber (not used here), pytest-asyncio (existing tests), pytest mocking via `unittest.mock`.

**Spec reference:** `docs/superpowers/specs/2026-05-12-image-vision-parser-design.md`

**Commit policy (project memory override):** Agent does NOT commit per task. Run tests at end of each task and verify green. The PM (main session) will do ONE final commit after full verification, format `feat: image vision parser` (no scope, no co-author trailer). Agent must never run `git commit` or `git push`.

**Working directory:** `/Users/bagusdeva/Documents/Personal Projects/smart-finance`. Backend venv binaries: `backend/venv/bin/python`, `backend/venv/bin/pytest`. Use absolute paths — don't `source venv/bin/activate` (it doesn't persist across Bash tool invocations).

**Test fixtures:** Already present in `backend/tests/fixtures/vision/ewallet/` and `backend/tests/fixtures/vision/invest/` (gitignored). 9 sample images. If folder empty (CI), live tests `pytest.skip()`.

**Indentation:** TAB (not spaces) for Python files. Match existing style — see `backend/app/import_data/parsers/manual_csv.py` for reference.

**Spec correction (apply during implementation):** The spec showed `async def vision_complete(...)` in Section "Vision LLM call structure". This is **incorrect in practice** — the parser's `parse(file_bytes)` is synchronous per the existing `Parser` Protocol (see `backend/app/import_data/parsers/base.py`), and `parse()` is invoked from an already-running event loop in `service.py:process_job`. Calling `asyncio.run()` from there raises `RuntimeError: cannot be called from a running event loop`. **Correct implementation: `vision_complete()` is a sync function using `groq.Groq` (sync client), not `AsyncGroq`.** The Groq SDK provides both clients with identical method signatures. The existing `chat_stream()` helper continues to use AsyncGroq for streaming. No behavior change vs spec intent.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/ai/vision_prompts.py` (create) | `SYSTEM_PROMPT` and `USER_PROMPT` string constants. No logic, no functions |
| `backend/app/ai/groq_client.py` (modify) | Add sync `vision_complete()` helper alongside existing async `chat_stream()` |
| `backend/app/import_data/parsers/image_vision.py` (replace stub) | `ImageVisionParser` class + helper functions (image MIME detection, JSON parse, row mapping, confidence scoring) |
| `backend/tests/test_image_vision_parser.py` (create) | Unit tests with mocked `vision_complete`. Always run |
| `backend/tests/test_image_vision_live.py` (create) | Integration tests against real Groq + real fixture images. Gated by `VISION_TEST_LIVE=1` env |
| `backend/.env.example` (modify) | Update `GROQ_VISION_MODEL` default to model verified available in Task 1 |

---

## Task 1: Verify Groq vision model + update `.env.example`

Goal: confirm which Groq vision model is currently available and pick the best one (prefer 90B). Lock the model name into `.env.example`.

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: List available Groq models**

Run from project root:

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/python -c "
import asyncio
from groq import AsyncGroq
from app.config import get_settings
async def check():
    api_key = get_settings().GROQ_API_KEY
    if not api_key:
        print('NO_API_KEY')
        return
    c = AsyncGroq(api_key=api_key)
    models = await c.models.list()
    vision_models = sorted([m.id for m in models.data if 'vision' in m.id.lower()])
    print('VISION_MODELS:', vision_models)
asyncio.run(check())
"
```

Expected: Output like `VISION_MODELS: ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview']` or similar list. If `NO_API_KEY`, stop and report — the `.env` file is missing `GROQ_API_KEY` and you can't proceed without it.

- [ ] **Step 2: Choose model with priority**

From the output:
1. If any model matches pattern `llama-*-90b-vision*` (regardless of preview/general suffix) → use that
2. Else if any model matches `llama-*-11b-vision*` → use that
3. Else stop and report — no vision model available

Record the chosen model name (e.g. `llama-3.2-90b-vision-preview`).

- [ ] **Step 3: Update `.env.example` with chosen model**

Read current `.env.example`:

```bash
grep "GROQ_VISION_MODEL" /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/.env.example
```

If a line exists, edit it. If no line, append. Final content for that line:

```
GROQ_VISION_MODEL=llama-3.2-90b-vision-preview  # Use 11b variant if 90b deprecated or rate-limited
```

(Replace `llama-3.2-90b-vision-preview` with the actual chosen model name from Step 2.)

- [ ] **Step 4: Update local `.env` if it exists**

```bash
ls /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/.env 2>/dev/null && grep -q "GROQ_VISION_MODEL" /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/.env && echo "EXISTS_HAS_MODEL" || echo "MISSING_OR_NO_MODEL"
```

If the file exists AND has `GROQ_VISION_MODEL`: edit in place to match Step 3 choice.
If the file exists but doesn't have the line: append it.
If file doesn't exist: skip (only `.env.example` was the requirement).

- [ ] **Step 5: Sanity check — actually call the model**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/python -c "
from groq import Groq
from app.config import get_settings
s = get_settings()
c = Groq(api_key=s.GROQ_API_KEY)
r = c.chat.completions.create(
    model=s.GROQ_VISION_MODEL,
    messages=[{'role':'user','content':'Reply with one word: pong'}],
    max_tokens=10,
)
print('OK:', r.choices[0].message.content)
"
```

Expected: Output like `OK: pong` (case may vary, just confirm non-error). This verifies:
- Sync `Groq` client works (we need sync for the parser)
- Model name is accepted by Groq API
- Network/auth path works

If error: investigate before proceeding. Common: rate limit (wait + retry), model unavailable (re-do Step 2 with fallback).

---

## Task 2: Create `vision_prompts.py`

Goal: extract prompt constants into a separate module so they can be unit-tested and tuned without touching parser logic.

**Files:**
- Create: `backend/app/ai/vision_prompts.py`
- Create: `backend/tests/test_image_vision_parser.py` (test file scaffold — more tests added in later tasks)

- [ ] **Step 1: Write the failing test for prompt constants**

Create `backend/tests/test_image_vision_parser.py` with:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: ImportError on `from app.ai.vision_prompts import SYSTEM_PROMPT, USER_PROMPT` — module doesn't exist yet.

- [ ] **Step 3: Create `vision_prompts.py` with full prompt content**

Create `backend/app/ai/vision_prompts.py`:

```python
"""Prompt templates untuk ImageVisionParser.

Dipisah dari parser logic supaya bisa di-tune (atau di-A/B) tanpa
nyentuh parsing/validation code. Constants saja, no functions.
"""


SYSTEM_PROMPT = """You are a precise data extraction assistant for Indonesian banking, e-wallet, and investment app screenshots and statements. Your job is to extract every visible transaction from the image into strict JSON.

Be thorough: look at every row, every panel, every detail. Don't miss transactions hiding at the top or bottom edges. Don't invent transactions that aren't there.

Output ONLY valid JSON matching the requested schema. No prose, no markdown fences, no commentary."""


USER_PROMPT = """Extract all visible transactions from this image into a JSON object with this exact shape:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM:SS" | null,
      "amount": -35000,
      "currency": "IDR" | "USD",
      "merchant": "Xsolla" | null,
      "description": "concise human-readable summary",
      "bank_category": "Transfer" | null
    }
  ]
}

CRITICAL RULES:

1. SIGN convention (positive = money in, negative = money out):
   - Explicit "+" or "-" prefix wins.
   - "DB", "Debit", "Dr" suffix means negative.
   - "CR", "Credit", "Cr" suffix means positive.
   - "Top Up", "Receive Money", "Dividends Received", "Add USD Cash" means positive.
   - "Send Money", "Buy", "Bayar", "Move IDR Cash to USD Cash" means negative.
   - When uncertain, infer from semantic context: paying merchant = negative, receiving money = positive.

2. STATUS FILTER: SKIP transactions with status Failed / Cancelled / Pending / Gagal / Dibatalkan. Include only Successful / Selesai / SUCCESS / Completed / status implied by lack of error indicator.

3. DATE construction:
   - "29 Oct 2025" or "01 Mar 2026" - use directly, convert to ISO.
   - "25 Februari 2026" - Indonesian months. Convert to ISO.
   - Only "DD/MM" shown with period header like "PERIODE: MARET 2026" - construct full ISO using header year/month.
   - If date cannot be determined, OMIT the row entirely.

4. CURRENCY detection:
   - "Rp" symbol or no symbol means IDR.
   - "$" or "USD" means USD.
   - Each row has its own currency. Don't convert FX.

5. SINGLE-TX DETAIL: If image shows 1 transaction in detail view (big amount on top + metadata rows below), return array of 1 object using those fields.

6. NO TRANSACTIONS visible (blank page, settings screen, profile page): return {"transactions": []}.

7. Numbers: parse "1.500.000,00" (Indonesian), "1,500,000.00" (US), "Rp35.000", "-$160.57" all correctly into plain numeric form. NO thousand separators in output.

8. Skip non-transaction rows: "SALDO AWAL", "SALDO AKHIR", "Total Pemasukan", header rows, balance summaries.

9. Don't invent fields. If merchant/category not visible, use null.

EXAMPLES:

Multi-row list (Dana Activity):
{
  "transactions": [
    {"date":"2025-10-29","time":"19:39:00","amount":-35000,"currency":"IDR","merchant":null,"description":"Send Money","bank_category":"Send Money"},
    {"date":"2025-10-29","time":"19:39:00","amount":35000,"currency":"IDR","merchant":null,"description":"Top Up","bank_category":"Top Up"}
  ]
}

Single-tx detail (GoPay):
{
  "transactions": [
    {"date":"2026-03-01","time":"18:33:00","amount":-90000,"currency":"IDR","merchant":"[BOKU] Xsolla (USA). Inc","description":"GoPay payment to Xsolla via GoPay Saldo, Jakarta Selatan","bank_category":null}
  ]
}

E-statement (BCA Maret 2026):
{
  "transactions": [
    {"date":"2026-03-07","time":null,"amount":19600,"currency":"IDR","merchant":"BUDI HARTONO","description":"BI-FAST CR BIF TRANSFER DR 501","bank_category":null},
    {"date":"2026-03-07","time":null,"amount":-19600,"currency":"IDR","merchant":null,"description":"TRANSAKSI DEBIT QRC014 INDOMARET","bank_category":null}
  ]
}

Return ONLY the JSON object. No prose."""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: 6 tests pass.

---

## Task 3: Add `vision_complete()` sync helper to `groq_client.py`

Goal: a single function that takes prompts + base64 image + MIME, calls Groq vision API synchronously with JSON-object response_format, returns raw assistant message content.

**Files:**
- Modify: `backend/app/ai/groq_client.py`
- Modify: `backend/tests/test_image_vision_parser.py` (append tests)

- [ ] **Step 1: Append failing tests for `vision_complete`**

Append to `backend/tests/test_image_vision_parser.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py::test_vision_complete_returns_message_content tests/test_image_vision_parser.py::test_vision_complete_returns_empty_string_when_no_content -v
```

Expected: AttributeError — `vision_complete` and `_get_sync_client` don't exist in `groq_client` yet.

- [ ] **Step 3: Add sync helper to `groq_client.py`**

Read current file first:

```bash
cat /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/app/ai/groq_client.py
```

Then append (after the existing `chat_stream` function at end of file):

```python


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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: all 8 tests pass (6 from Task 2 + 2 new).

---

## Task 4: Build ImageVisionParser helper functions (TDD with synthetic inputs)

Goal: build the small pure functions the parser composes — image MIME detection, JSON response parsing, confidence scoring, row dict → ParsedRow mapping.

**Files:**
- Create: `backend/app/import_data/parsers/image_vision.py` (replace stub)
- Modify: `backend/tests/test_image_vision_parser.py` (append helper tests)

- [ ] **Step 1: Append failing helper tests**

Append to `backend/tests/test_image_vision_parser.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: ImportError or AttributeError for `_detect_image_mime`, `_parse_vision_response`, `_compute_confidence`, `_to_parsed_row` — they don't exist in `image_vision.py` yet (current file is stub).

- [ ] **Step 3: Replace `image_vision.py` stub with helpers + class scaffold**

Replace the entire content of `backend/app/import_data/parsers/image_vision.py` with:

```python
"""Image vision parser via Groq Llama 3.2 90B Vision.

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
	"transfer", "bayar", "top up", "topup", "send money", "receive money",
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
		# Implemented in Task 5.
		raise NotImplementedError("parse() will be implemented in Task 5")
```

- [ ] **Step 4: Run tests to verify helpers pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: All helper tests pass (Task 2 + Task 3 + Task 4 = ~30 tests). `parse()` integration tests not added yet.

- [ ] **Step 5: Confirm no regression elsewhere**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -5
```

Expected: existing 82 tests + new helper tests pass. The `ImportSourceType.image_vision` enum already exists (no schema change needed).

---

## Task 5: Implement `parse()` main flow with retry

Goal: tie helpers + vision_complete + retry logic into the main `parse()` method.

**Files:**
- Modify: `backend/app/import_data/parsers/image_vision.py` (replace `ImageVisionParser` class body)
- Modify: `backend/tests/test_image_vision_parser.py` (append integration-style tests with mocked vision)

- [ ] **Step 1: Append failing tests for parse() flow**

Append to `backend/tests/test_image_vision_parser.py`:

```python
# ---------- ImageVisionParser.parse() main flow ----------

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: 10 new parse() tests fail with `NotImplementedError: parse() will be implemented in Task 5`.

- [ ] **Step 3: Replace `ImageVisionParser` class body with full implementation**

In `backend/app/import_data/parsers/image_vision.py`, replace ONLY the class definition at the bottom (the existing `ImageVisionParser` with `NotImplementedError`) with:

```python
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
```

- [ ] **Step 4: Run all unit tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_parser.py -v
```

Expected: all tests pass (~40 total: 6 prompt + 2 vision_complete + ~20 helpers + 10 parse flow).

- [ ] **Step 5: Confirm no regression in full suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -10
```

Expected: 82 existing tests + ~40 new tests all pass. No errors.

---

## Task 6: Create live integration tests (gated)

Goal: tests against real Groq that exercise actual fixture images. Gated by env flag — agent does NOT need to run these (the PM in main session will run them during verification).

**Files:**
- Create: `backend/tests/test_image_vision_live.py`

- [ ] **Step 1: Create the live test file**

Create `backend/tests/test_image_vision_live.py`:

```python
"""Live integration tests untuk ImageVisionParser.

Pakai real Groq API + real fixture images dari tests/fixtures/vision/.
Gated dengan VISION_TEST_LIVE=1 env (juga skip kalau GROQ_API_KEY kosong
atau fixture folder kosong).

Run manual:
    VISION_TEST_LIVE=1 backend/venv/bin/pytest tests/test_image_vision_live.py -v
"""

import os
from decimal import Decimal
from pathlib import Path

import pytest

from app.config import get_settings


pytestmark = pytest.mark.skipif(
	os.getenv("VISION_TEST_LIVE") != "1" or not get_settings().GROQ_API_KEY,
	reason="VISION_TEST_LIVE=1 + GROQ_API_KEY required",
)


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "vision"


def _load(rel_path: str) -> bytes:
	path = FIXTURE_DIR / rel_path
	if not path.exists():
		pytest.skip(f"Fixture {rel_path} tidak tersedia (gitignored)")
	return path.read_bytes()


def _parser():
	from app.import_data.parsers.image_vision import ImageVisionParser
	return ImageVisionParser()


def test_live_dana_list():
	"""Dana Activity list: multi-row, all IDR, mix of Send/Top Up/Receive."""
	rows = _parser().parse(_load("ewallet/dana-list-1.jpeg"))
	assert len(rows) >= 5, f"Expected at least 5 rows, got {len(rows)}"
	for r in rows:
		assert r.currency == "IDR"
	# Should have at least one negative (Send) and one positive (Top Up/Receive).
	signs = {1 if r.amount > 0 else -1 for r in rows}
	assert signs == {1, -1}, f"Expected mix of signs, got {signs}"


def test_live_gopay_detail():
	"""GoPay single-transaction detail: exactly 1 row, negative (paying merchant)."""
	rows = _parser().parse(_load("ewallet/gopay-detail-1.jpeg"))
	assert len(rows) == 1, f"Expected exactly 1 row, got {len(rows)}"
	assert rows[0].amount < 0, f"Expected negative (paying merchant), got {rows[0].amount}"
	assert rows[0].currency == "IDR"


def test_live_shopeepay_list():
	"""ShopeePay 'Kirim Uang' list: all rows should be negative (Terkirim)."""
	rows = _parser().parse(_load("ewallet/shopeepay-list-2.jpeg"))
	assert len(rows) >= 4
	for r in rows:
		assert r.amount < 0, f"Expected all negative (Kirim Uang), got {r.amount} for {r.description!r}"


def test_live_pluang_assets():
	"""Pluang Assets: mixed currency, Failed status excluded."""
	rows = _parser().parse(_load("invest/pluang-assets-1.jpeg"))
	assert len(rows) >= 5
	currencies = {r.currency for r in rows}
	assert "IDR" in currencies
	# USD presence depends on sample content — assert at least one is detected.
	# Failed row exclusion: no row should have description containing "Failed".
	for r in rows:
		assert "failed" not in (r.description or "").lower()


def test_live_pluang_balance():
	"""Pluang Balance tab: cash movements, BCA top-ups, dividends."""
	rows = _parser().parse(_load("invest/pluang-balance-1.jpeg"))
	assert len(rows) >= 5
```

- [ ] **Step 2: Verify the file imports cleanly (skipped without env flag)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_image_vision_live.py -v
```

Expected: All 5 tests SKIPPED with reason "VISION_TEST_LIVE=1 + GROQ_API_KEY required" (because env flag not set).

- [ ] **Step 3: Do NOT run live tests yourself**

The PM will run live tests in main session after verification. Agent must not consume Groq quota by setting `VISION_TEST_LIVE=1`.

---

## Task 7: Final verification — agent reports back

Agent does NOT commit. After completing Tasks 1-6, run final verification commands and report.

- [ ] **Step 1: Backend full test suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -20
```

Expected: All tests pass. ~82 existing + ~40 new parser unit tests + 5 SKIPPED live tests. Report PASS/FAIL/SKIP counts.

- [ ] **Step 2: Frontend typecheck (no changes expected)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5
```

Expected: No errors. Phase 1 didn't change frontend.

- [ ] **Step 3: Git status report**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && git status
```

Expected modified files:
- `backend/.env.example`
- `backend/app/ai/groq_client.py`
- `backend/app/import_data/parsers/image_vision.py`

Expected new files:
- `backend/app/ai/vision_prompts.py`
- `backend/tests/test_image_vision_parser.py`
- `backend/tests/test_image_vision_live.py`

NOT committed.

- [ ] **Step 4: Report**

Output a final summary block with:
- ✅/❌ per task (1-7)
- Chosen Groq vision model name + reasoning (90b vs 11b fallback)
- Backend test results: passed/skipped/failed counts
- Frontend typecheck: clean? Yes/No
- List of modified/created files
- Any deviation from plan (e.g. Groq SDK doesn't have sync Groq client → workaround used, model unavailable → fallback chosen, lint auto-fixed something)
- Any concerns the PM should know about before running live tests

---

## Self-Review Notes (internal — not for agent)

**Spec coverage check:**
- Goal 1 (handle 3 paradigma): Task 5 parse() composes the flow; live tests in Task 6 validate each paradigm against real fixtures ✓
- Goal 2 (output to ParsedRow contract): `_to_parsed_row` in Task 4 enforces ✓
- Goal 3 (use 90B vision): Task 1 selection + .env.example update ✓
- Goal 4 (graceful failure at every level): Task 5 retry logic + Task 4 helpers all use None/[] returns on bad input ✓
- Goal 5 (confidence scoring): `_compute_confidence` in Task 4 ✓

**Non-goals respected:**
- No PDF input handling ✓ (only image magic bytes accepted)
- No multi-image batch ✓ (parse takes single bytes)
- No platform-specific prompt ✓ (single generic USER_PROMPT)
- No Protocol signature change ✓ (parse stays sync, returns list[ParsedRow])
- No schema change ✓
- No FX conversion ✓

**Type consistency:**
- `vision_complete(image_b64, image_mime, system_prompt, user_prompt, ...)` signature consistent across Task 3 def + Task 5 callers
- `_to_parsed_row(item, line_no)` consistent in Task 4 def + Task 5 caller
- `_parse_vision_response(raw) -> list[dict]` consistent
- `_detect_image_mime(file_bytes) -> str | None` consistent
- `_compute_confidence(item) -> Decimal` consistent

**Placeholder scan:** No TBD/TODO/handle-edge-cases language in any step. All steps have concrete code or exact commands.

**Risks the agent should report on:**
1. Sync `Groq` client may have different default behavior than `AsyncGroq` (timeout, retries) — verify in Task 1 Step 5
2. `response_format={"type":"json_object"}` is OpenAI-compat; Groq supports it but may require specific model versions. If model rejects this param, fallback: omit it and rely on prompt instructions.
3. Vision model rate limits on Groq — Task 1 confirms basic access; per-RPM/TPM limits not checked here. PM should monitor during live tests.
4. The retry-on-bad-JSON heuristic checks `raw.strip() not in ('{"transactions":[]}', '{"transactions": []}')` — if Groq legitimately returns empty array with non-canonical whitespace, this could unnecessary retry. Trade-off accepted (cost: 1 extra Groq call in rare edge case).
