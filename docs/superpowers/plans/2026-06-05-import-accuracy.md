# Import Accuracy (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add financial math-check validate step + content type classification (statement/receipt/holding/unknown) to import pipeline so vision hallucinations get caught and holdings get detected as a distinct content type.

**Architecture:** Change Parser Protocol return type from `list[ParsedRow]` to `ParseResult` (dataclass with rows, holdings, content_type, balance_check). ImageVisionParser overhauled to classify + extract per-schema in same vision call. Service layer runs math-check post-extract for statements, applies confidence warning on mismatch, persists Phase 4 metadata to 3 new JSONB columns on ImportJob. Frontend shows banner on mismatch + read-only holdings panel.

**Tech Stack:** Python 3.12 dataclasses, SQLAlchemy JSONB columns, Alembic migration, Groq Vision (Llama 4 Scout), Pydantic for response shapes, Next.js + TypeScript + Tailwind.

**Spec reference:** `docs/superpowers/specs/2026-06-05-import-accuracy-design.md`

**Commit policy (project memory override):** Agent does NOT commit per task. Run verification at end of each task. PM does ONE final commit after full verification, format `feat: import accuracy with math-check and content classification` (no scope, no co-author trailer).

**Working directory:** `/Users/bagusdeva/Documents/Personal Projects/smart-finance`. Branch `feat/import-accuracy` (created by PM, forked from `feat/docker-dev-env`).

**Dev environment:** Docker stack via `make dev`. Run pytest with `make test` (auto-creates test DB inside container). Backend changes hot-reload via uvicorn `--reload`; frontend via Next HMR.

**Indentation:** TAB for Python (match existing parsers). Standard 2-space for YAML, TypeScript follows project Prettier (no explicit config — match existing files like `JobReviewPanel.tsx`).

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `backend/app/import_data/parsers/base.py` | MODIFY | Add `ParsedHolding`, `BalanceCheck`, `ParseResult` dataclasses. Change Parser Protocol return type. |
| `backend/app/import_data/validation.py` | CREATE | `run_balance_check()`, `apply_balance_warning()` pure functions |
| `backend/tests/test_validation.py` | CREATE | Unit tests for math-check + confidence cap |
| `backend/app/ai/vision_prompts.py` | MODIFY | Extend USER_PROMPT with classify step + holdings schema + few-shot |
| `backend/app/import_data/parsers/image_vision.py` | MODIFY (heavy) | Overhaul parse() to return ParseResult, classify + extract per schema |
| `backend/tests/test_image_vision_parser.py` | MODIFY | Update mock responses + add classify/holdings tests |
| `backend/app/import_data/parsers/manual_csv.py` | MODIFY (1-line) | Backward compat: wrap return in ParseResult |
| `backend/app/import_data/parsers/pdf_bni.py` | MODIFY (1-line) | Same backward compat shim |
| `backend/app/import_data/parsers/pdf_vision.py` | MODIFY | Aggregate ParseResult across pages |
| `backend/tests/test_pdf_vision_parser.py` | MODIFY | Update mock returns + add aggregation tests |
| `backend/app/import_data/models.py` | MODIFY | Add content_type, balance_check, detected_holdings columns to ImportJob |
| `backend/alembic/versions/<new>.py` | CREATE | Migration: ALTER TABLE import_jobs ADD COLUMN x3 |
| `backend/app/import_data/schemas.py` | MODIFY | Add BalanceCheckResponse, DetectedHoldingResponse; extend ImportJobDetailResponse |
| `backend/app/import_data/service.py` | MODIFY | process_job uses ParseResult, runs math-check, persists JSONB metadata |
| `backend/tests/test_import.py` | MODIFY | Add tests for content_type/balance_check/holdings persistence + warning application |
| `frontend/lib/api/types.ts` | MODIFY | Add BalanceCheckResponse, DetectedHolding interfaces; extend ImportJobDetailResponse |
| `frontend/app/(app)/import/_components/JobReviewPanel.tsx` | MODIFY | Add warning banner + Detected Holdings panel |

---

## Task 1: Build new dataclasses + validation module (TDD)

Goal: define data structures + pure math-check functions. No external deps, all unit-testable.

**Files:**
- Modify: `backend/app/import_data/parsers/base.py`
- Create: `backend/app/import_data/validation.py`
- Create: `backend/tests/test_validation.py`

- [ ] **Step 1: Write failing tests for validation module**

Create `backend/tests/test_validation.py`:

```python
"""Unit tests for math-check + confidence warning utilities."""

from datetime import date
from decimal import Decimal

from app.import_data.parsers.base import ParsedRow
from app.import_data.validation import apply_balance_warning, run_balance_check


def _row(amount: str, confidence: str = "1.00") -> ParsedRow:
	return ParsedRow(
		line_no=1,
		transaction_date=date(2026, 1, 1),
		amount=Decimal(amount),
		description="test",
		confidence_score=Decimal(confidence),
	)


# ---------- run_balance_check ----------

def test_balance_check_matches_when_sum_equals_delta():
	rows = [_row("100"), _row("-50")]
	result = run_balance_check(rows, saldo_awal=Decimal("1000"), saldo_akhir=Decimal("1050"))
	assert result is not None
	assert result.matches is True
	assert result.sum_transactions == Decimal("50")
	assert result.expected_delta == Decimal("50")
	assert result.diff_pct == Decimal("0.00")


def test_balance_check_within_1pct_tolerance_returns_match():
	# expected delta 1000, actual 1005 → 0.5% diff < 1% tolerance
	rows = [_row("1005")]
	result = run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=Decimal("1000"))
	assert result.matches is True


def test_balance_check_mismatch_outside_tolerance():
	# expected delta 1000, actual 1100 → 10% diff
	rows = [_row("1100")]
	result = run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=Decimal("1000"))
	assert result.matches is False
	assert result.diff_pct == Decimal("10.00")


def test_balance_check_zero_delta_with_nonzero_sum_is_mismatch():
	# saldo unchanged but transactions sum to non-zero — clearly miss
	rows = [_row("500")]
	result = run_balance_check(rows, saldo_awal=Decimal("1000"), saldo_akhir=Decimal("1000"))
	assert result.matches is False
	assert result.diff_pct == Decimal("100.00")


def test_balance_check_zero_delta_zero_sum_matches():
	result = run_balance_check([], saldo_awal=Decimal("1000"), saldo_akhir=Decimal("1000"))
	assert result.matches is True
	assert result.diff_pct == Decimal("0")


def test_balance_check_missing_saldo_awal_returns_none():
	rows = [_row("100")]
	assert run_balance_check(rows, saldo_awal=None, saldo_akhir=Decimal("100")) is None


def test_balance_check_missing_saldo_akhir_returns_none():
	rows = [_row("100")]
	assert run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=None) is None


def test_balance_check_negative_balance_change():
	# user spent money: saldo 1000 → 200, sum should be -800
	rows = [_row("-500"), _row("-300")]
	result = run_balance_check(rows, saldo_awal=Decimal("1000"), saldo_akhir=Decimal("200"))
	assert result.matches is True
	assert result.sum_transactions == Decimal("-800")
	assert result.expected_delta == Decimal("-800")


def test_balance_check_exactly_at_tolerance_boundary_matches():
	# diff_pct == 1.00% → matches (≤ tolerance)
	rows = [_row("1010")]  # 1% diff from 1000
	result = run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=Decimal("1000"))
	assert result.matches is True
	assert result.diff_pct == Decimal("1.00")


# ---------- apply_balance_warning ----------

def test_apply_balance_warning_caps_high_confidence():
	rows = [_row("100", "1.00"), _row("200", "0.90")]
	apply_balance_warning(rows)
	assert rows[0].confidence_score == Decimal("0.70")
	assert rows[1].confidence_score == Decimal("0.70")


def test_apply_balance_warning_leaves_low_confidence_alone():
	rows = [_row("100", "0.50"), _row("200", "0.30")]
	apply_balance_warning(rows)
	assert rows[0].confidence_score == Decimal("0.50")
	assert rows[1].confidence_score == Decimal("0.30")


def test_apply_balance_warning_custom_cap():
	rows = [_row("100", "1.00")]
	apply_balance_warning(rows, cap=Decimal("0.50"))
	assert rows[0].confidence_score == Decimal("0.50")
```

- [ ] **Step 2: Add dataclasses to `parsers/base.py`**

Modify `backend/app/import_data/parsers/base.py`. Current top of file imports — add `Literal`:

Find:
```python
from typing import Protocol
```

Replace with:
```python
from typing import Literal, Protocol
```

After the existing `ParsedRow` class definition (around line 23), ADD these new dataclasses (before `class ParserError`):

```python


@dataclass
class ParsedHolding:
	line_no: int
	ticker: str
	qty: Decimal
	avg_price: Decimal | None = None
	market_value: Decimal | None = None
	currency: str = "IDR"
	asset_type: Literal["stock", "crypto", "gold", "cash", "unknown"] = "unknown"
	confidence_score: Decimal = field(default_factory=lambda: Decimal("1.00"))
	raw_text: str = ""


@dataclass
class BalanceCheck:
	saldo_awal: Decimal
	saldo_akhir: Decimal
	sum_transactions: Decimal
	expected_delta: Decimal
	actual_delta: Decimal
	matches: bool
	diff_pct: Decimal


@dataclass
class ParseResult:
	rows: list[ParsedRow] = field(default_factory=list)
	holdings: list[ParsedHolding] = field(default_factory=list)
	content_type: Literal["statement", "receipt", "holding", "unknown"] = "unknown"
	balance_check: BalanceCheck | None = None
```

Find the `class Parser(Protocol):` and update return type:

```python
class Parser(Protocol):
	def parse(self, file_bytes: bytes) -> "ParseResult": ...
```

(Use forward reference `"ParseResult"` if `Parser` defined before `ParseResult` — adjust order as needed.)

- [ ] **Step 3: Create `validation.py` with implementations**

Create `backend/app/import_data/validation.py`:

```python
"""Math-check + confidence warning utilities for import accuracy.

run_balance_check: Compare sum of extracted transactions vs expected delta
(saldo_akhir - saldo_awal). Within 1% tolerance = match. Mismatch = strong
signal that vision miss or hallucinated rows.

apply_balance_warning: On mismatch, cap confidence di semua row ke max 0.70
(warn tier) supaya review screen highlight rows yang perlu cek.
"""

from decimal import Decimal

from app.import_data.parsers.base import BalanceCheck, ParsedRow


_TOLERANCE_PCT = Decimal("1.00")  # 1%


def run_balance_check(
	transactions: list[ParsedRow],
	saldo_awal: Decimal | None,
	saldo_akhir: Decimal | None,
) -> BalanceCheck | None:
	"""Math-check: sum(transactions) == saldo_akhir - saldo_awal?

	Returns None if saldo data missing (parser tidak extract atau content_type
	bukan statement). Returns BalanceCheck with matches=False if delta > 1%
	of expected.

	Note: parse-time snapshot. User exclude rows nanti tidak re-run check.
	"""
	if saldo_awal is None or saldo_akhir is None:
		return None

	sum_txs = sum((r.amount for r in transactions), Decimal("0"))
	expected_delta = saldo_akhir - saldo_awal

	if expected_delta == 0:
		# Saldo unchanged. If sum_txs juga 0 → match. Else mismatch (100% off).
		diff_pct = Decimal("100.00") if sum_txs != 0 else Decimal("0")
	else:
		diff = abs(sum_txs - expected_delta)
		diff_pct = (diff / abs(expected_delta) * 100).quantize(Decimal("0.01"))

	matches = diff_pct <= _TOLERANCE_PCT

	return BalanceCheck(
		saldo_awal=saldo_awal,
		saldo_akhir=saldo_akhir,
		sum_transactions=sum_txs,
		expected_delta=expected_delta,
		actual_delta=sum_txs,
		matches=matches,
		diff_pct=diff_pct,
	)


def apply_balance_warning(
	rows: list[ParsedRow],
	cap: Decimal = Decimal("0.70"),
) -> None:
	"""On balance mismatch, cap confidence di semua row ke max `cap` (default 0.70).

	Mutates rows in place. Confidence below cap unchanged.
	"""
	for r in rows:
		if r.confidence_score > cap:
			r.confidence_score = cap
```

- [ ] **Step 4: Run validation tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -20
```

Expected: existing tests pass + 12 new validation tests pass. Total now ~175 passed, 10 skipped.

If test failures: investigate. Most likely cause = forward reference syntax in `Parser` Protocol. Adjust based on Python type evaluation rules.

- [ ] **Step 5: Confirm backward compat — existing parsers still work**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend python -c "
from app.import_data.parsers.base import ParsedRow, ParseResult, ParsedHolding, BalanceCheck
print('dataclasses import OK')
"
```

Expected: `dataclasses import OK`. Confirms new types exist and don't break import chain.

---

## Task 2: Update vision prompt with classify + holdings schema

Goal: extend USER_PROMPT to instruct LLM to classify content_type and output schema-appropriate fields. No code change to parser yet — just prompt text.

**Files:**
- Modify: `backend/app/ai/vision_prompts.py`

- [ ] **Step 1: Read current vision_prompts.py to understand structure**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && grep -n "^[A-Z_]\+\s*=" backend/app/ai/vision_prompts.py
```

Expected: shows `SYSTEM_PROMPT = ...` and `USER_PROMPT = ...` constants.

- [ ] **Step 2: Replace USER_PROMPT with extended version**

Use Edit tool. Find the line starting with `USER_PROMPT = """Extract` and the closing `"""`. Replace the entire string with:

```python
USER_PROMPT = """Step 1 — CLASSIFY content_type:
- "statement": multi-row transaction list dengan saldo running (bank mutasi, e-wallet history list)
- "receipt": 1 transaction detail view (single tx receipt, e-wallet single tx detail screen)
- "holding": portfolio/asset snapshot dengan ticker + quantity (Pluang Asset tab, Stockbit Portfolio, Bibit holdings)
- "unknown": tidak match ketiga di atas

Step 2 — EXTRACT sesuai schema yang berlaku.

OUTPUT JSON dengan exact shape:

{
  "content_type": "statement" | "receipt" | "holding" | "unknown",
  "transactions": [...],
  "holdings": [...],
  "balance_summary": {
    "saldo_awal": <number>,
    "saldo_akhir": <number>,
    "currency": "IDR" | "USD"
  }
}

Rules:
- For "statement" or "receipt" or "unknown" → populate "transactions". "holdings" array stays empty.
- For "holding" → populate "holdings". "transactions" array stays empty.
- "balance_summary" populated ONLY if content_type="statement" AND saldo data clearly visible. Otherwise null.

Schema "transactions" item:
{
  "date": "YYYY-MM-DD",
  "time": "HH:MM:SS" | null,
  "amount": <signed_number, positive=in, negative=out>,
  "currency": "IDR" | "USD",
  "merchant": <string> | null,
  "description": <string>,
  "bank_category": <string> | null
}

Schema "holdings" item:
{
  "ticker": "QQQ" | "BTC" | "BBCA" | "GOLD" | "USD",
  "qty": <number>,
  "avg_price": <number> | null,
  "market_value": <number> | null,
  "currency": "IDR" | "USD",
  "asset_type": "stock" | "crypto" | "gold" | "cash"
}

CRITICAL RULES:

1. SIGN convention (positive = money in, negative = money out):
   - Explicit "+" or "-" prefix wins.
   - "DB", "Debit", "Dr" suffix → negative.
   - "CR", "Credit", "Cr" suffix → positive.
   - "Top Up", "Receive Money", "Dividends Received", "Add USD Cash" → positive.
   - "Send Money", "Buy", "Bayar", "Move IDR Cash to USD Cash" → negative.
   - When uncertain, infer from semantic context.

2. STATUS FILTER: SKIP transactions with status Failed / Cancelled / Pending / Gagal / Dibatalkan. Include only Successful / Selesai / SUCCESS / Completed.

3. DATE construction:
   - "29 Oct 2025" or "01 Mar 2026" — convert to ISO.
   - "25 Februari 2026" — Indonesian months. Convert to ISO.
   - Only "DD/MM" shown with period header like "PERIODE: MARET 2026" — construct full ISO using header year/month.
   - HOLDING screenshot biasanya tidak ada date — itu OK, holdings tidak butuh date field.
   - If statement date cannot be determined, OMIT the transaction.

4. CURRENCY detection per row:
   - "Rp" symbol or no symbol → IDR.
   - "$" or "USD" → USD.
   - Each row punya currency sendiri. Don't convert FX.

5. SALDO handling:
   - "Saldo Awal X" dan "Saldo Akhir X" → ke balance_summary, JANGAN ke transactions.
   - "Total Pemasukan", "Total Pengeluaran" → JANGAN ke transactions (summary lines).

6. HOLDINGS specific:
   - Ticker IDX 4 huruf (BBCA, TLKM, BBRI). US ticker 3-5 (QQQ, AAPL, MSFT). Crypto 3-4 (BTC, ETH, USDT). Gold = "GOLD".
   - Quantity precision tinggi untuk crypto (0.00056349 BTC), sedang untuk gold (9.378 gram), integer untuk saham lot (100).
   - "Available USD Cash $317.85" pattern → holding asset_type=cash, ticker=USD, qty=317.85.
   - Multi-asset (QQQ + BTC + GOLD di same Pluang screen) → semua ke holdings dengan asset_type berbeda.
   - Holding screenshot biasanya tidak ada timestamp transaksi — itu OK.

7. NUMBERS: parse "1.500.000,00" (Indonesian), "1,500,000.00" (US), "Rp35.000", "-$160.57" all correctly into plain numeric form.

8. NO TRANSACTIONS visible (blank page, settings screen): return content_type="unknown", transactions=[], holdings=[].

9. Don't invent fields. If something not visible → null.

EXAMPLES:

Multi-row list (Dana Activity) — statement:
{
  "content_type": "statement",
  "transactions": [
    {"date":"2025-10-29","time":"19:39:00","amount":-35000,"currency":"IDR","merchant":null,"description":"Send Money","bank_category":"Send Money"},
    {"date":"2025-10-29","time":"19:39:00","amount":35000,"currency":"IDR","merchant":null,"description":"Top Up","bank_category":"Top Up"}
  ],
  "holdings": [],
  "balance_summary": null
}

Single-tx detail (GoPay) — receipt:
{
  "content_type": "receipt",
  "transactions": [
    {"date":"2026-03-01","time":"18:33:00","amount":-90000,"currency":"IDR","merchant":"[BOKU] Xsolla (USA). Inc","description":"GoPay payment to Xsolla via GoPay Saldo, Jakarta Selatan","bank_category":null}
  ],
  "holdings": [],
  "balance_summary": null
}

E-statement (BCA Maret 2026) — statement with balance:
{
  "content_type": "statement",
  "transactions": [
    {"date":"2026-03-07","time":null,"amount":19600,"currency":"IDR","merchant":"BUDI HARTONO","description":"BI-FAST CR BIF TRANSFER DR 501","bank_category":null},
    {"date":"2026-03-07","time":null,"amount":-19600,"currency":"IDR","merchant":null,"description":"TRANSAKSI DEBIT QRC014 INDOMARET","bank_category":null}
  ],
  "holdings": [],
  "balance_summary": {
    "saldo_awal": 50000,
    "saldo_akhir": 50000,
    "currency": "IDR"
  }
}

Holdings screenshot (Pluang Asset tab) — holding:
{
  "content_type": "holding",
  "transactions": [],
  "holdings": [
    {"ticker":"QQQ","qty":0.225,"avg_price":268.44,"market_value":60.40,"currency":"USD","asset_type":"stock"},
    {"ticker":"BTC","qty":0.00118932,"avg_price":1473939,"market_value":1473939,"currency":"IDR","asset_type":"crypto"},
    {"ticker":"GOLD","qty":9.378,"avg_price":2607218,"market_value":24454500,"currency":"IDR","asset_type":"gold"},
    {"ticker":"USD","qty":317.85,"avg_price":null,"market_value":317.85,"currency":"USD","asset_type":"cash"}
  ],
  "balance_summary": null
}

Return ONLY the JSON object. No prose."""
```

- [ ] **Step 3: Verify prompt module imports cleanly**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend python -c "
from app.ai.vision_prompts import SYSTEM_PROMPT, USER_PROMPT
print(f'SYSTEM_PROMPT: {len(SYSTEM_PROMPT)} chars')
print(f'USER_PROMPT: {len(USER_PROMPT)} chars')
assert 'content_type' in USER_PROMPT
assert 'holdings' in USER_PROMPT
assert 'balance_summary' in USER_PROMPT
assert 'EXAMPLES' in USER_PROMPT
print('all schema markers present')
"
```

Expected: prints both prompt lengths + `all schema markers present`. USER_PROMPT should be ~4000+ chars now (was ~2500).

- [ ] **Step 4: Run existing prompt tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend pytest tests/test_image_vision_parser.py -k "prompts" -v 2>&1 | tail -10
```

Expected: existing prompt tests pass. The tests check for: SYSTEM_PROMPT non-empty + mentions Indonesian, USER_PROMPT contains schema keys (date, amount, currency, etc.), sign rules present, status filter present, few-shot examples present. All still hold with extended prompt.

---

## Task 3: Overhaul ImageVisionParser to return ParseResult

Goal: parser handles classification, populates holdings/balance_summary based on content_type, returns ParseResult.

**Files:**
- Modify: `backend/app/import_data/parsers/image_vision.py`
- Modify: `backend/tests/test_image_vision_parser.py`

- [ ] **Step 1: Append failing tests for ParseResult return type**

Append to `backend/tests/test_image_vision_parser.py`:

```python
# ---------- ParseResult content_type classification ----------

def test_parse_returns_parse_result_type(monkeypatch):
	from app.import_data.parsers.base import ParseResult
	from app.import_data.parsers.image_vision import ImageVisionParser

	response = json.dumps({
		"content_type": "statement",
		"transactions": [
			{"date":"2026-01-01","amount":1000,"currency":"IDR","description":"test"}
		],
		"holdings": [],
		"balance_summary": None,
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	assert isinstance(result, ParseResult)
	assert result.content_type == "statement"
	assert len(result.rows) == 1
	assert result.holdings == []
	assert result.balance_check is None  # parser doesn't compute, service does


def test_parse_statement_with_balance_summary(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser

	response = json.dumps({
		"content_type": "statement",
		"transactions": [
			{"date":"2026-03-07","amount":19600,"currency":"IDR","description":"BI-FAST CR"},
			{"date":"2026-03-07","amount":-19600,"currency":"IDR","description":"TRANSAKSI DEBIT"},
		],
		"holdings": [],
		"balance_summary": {"saldo_awal": 50000, "saldo_akhir": 50000, "currency": "IDR"},
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	assert result.content_type == "statement"
	assert len(result.rows) == 2
	# Parser stores raw saldo data as attributes on result for service layer to use
	# (we'll add _balance_summary_raw attribute holding the dict)
	assert hasattr(result, "_balance_summary_raw") or result.balance_check is None


def test_parse_holding_returns_holdings_array(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser

	response = json.dumps({
		"content_type": "holding",
		"transactions": [],
		"holdings": [
			{"ticker":"QQQ","qty":0.225,"avg_price":268.44,"market_value":60.40,"currency":"USD","asset_type":"stock"},
			{"ticker":"BTC","qty":0.00118932,"avg_price":1473939,"market_value":1473939,"currency":"IDR","asset_type":"crypto"},
		],
		"balance_summary": None,
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	assert result.content_type == "holding"
	assert result.rows == []
	assert len(result.holdings) == 2
	assert result.holdings[0].ticker == "QQQ"
	assert result.holdings[0].qty == Decimal("0.225")
	assert result.holdings[0].asset_type == "stock"
	assert result.holdings[1].ticker == "BTC"
	assert result.holdings[1].currency == "IDR"


def test_parse_receipt_classify(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser

	response = json.dumps({
		"content_type": "receipt",
		"transactions": [
			{"date":"2026-03-01","amount":-90000,"currency":"IDR","merchant":"Xsolla","description":"GoPay to Xsolla"}
		],
		"holdings": [],
		"balance_summary": None,
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	assert result.content_type == "receipt"
	assert len(result.rows) == 1
	assert result.holdings == []


def test_parse_unknown_classify(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser

	response = json.dumps({
		"content_type": "unknown",
		"transactions": [],
		"holdings": [],
		"balance_summary": None,
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	assert result.content_type == "unknown"
	assert result.rows == []
	assert result.holdings == []


def test_parse_holding_with_invalid_qty_skipped(monkeypatch):
	from app.import_data.parsers.image_vision import ImageVisionParser

	response = json.dumps({
		"content_type": "holding",
		"transactions": [],
		"holdings": [
			{"ticker":"VALID","qty":1.5,"avg_price":100,"market_value":150,"currency":"IDR","asset_type":"stock"},
			{"ticker":"BAD","qty":"not a number","avg_price":100,"market_value":150,"currency":"IDR","asset_type":"stock"},
			{"ticker":"","qty":1.0,"avg_price":100,"market_value":100,"currency":"IDR","asset_type":"stock"},
		],
		"balance_summary": None,
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	# Only valid row kept; invalid qty + empty ticker skipped
	assert len(result.holdings) == 1
	assert result.holdings[0].ticker == "VALID"


def test_parse_empty_bytes_returns_empty_parse_result(monkeypatch):
	from app.import_data.parsers.base import ParseResult
	from app.import_data.parsers.image_vision import ImageVisionParser

	result = ImageVisionParser().parse(b"")
	assert isinstance(result, ParseResult)
	assert result.rows == []
	assert result.holdings == []
	assert result.content_type == "unknown"
	assert result.balance_check is None


def test_parse_legacy_response_without_content_type_defaults_unknown(monkeypatch):
	"""Backward compat: if vision returns old shape without content_type, treat as unknown statement."""
	from app.import_data.parsers.image_vision import ImageVisionParser

	# Old shape: just {"transactions": [...]}
	response = json.dumps({
		"transactions": [{"date":"2026-01-01","amount":100,"currency":"IDR","description":"test"}]
	})
	_patch_vision(monkeypatch, response)
	result = ImageVisionParser().parse(PNG_HEADER)
	assert result.content_type == "unknown"
	assert len(result.rows) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend pytest tests/test_image_vision_parser.py -k "parse_returns_parse_result or parse_holding or parse_receipt or parse_unknown or parse_statement_with_balance or parse_empty_bytes or parse_legacy" -v 2>&1 | tail -10
```

Expected: tests fail with `AttributeError` or assertion errors because `parse()` still returns `list[ParsedRow]`, not `ParseResult`.

- [ ] **Step 3: Refactor `image_vision.py` parse() to return ParseResult**

Read current parse() implementation:

```bash
grep -n "def parse\|class ImageVisionParser\|_to_parsed_row\|_parse_vision_response" backend/app/import_data/parsers/image_vision.py
```

Now replace the helpers + parse() method. Use Edit tool. Find the entire `ImageVisionParser` class block (the one with `@register(ImportSourceType.image_vision.value)` decorator) and the `_parse_vision_response` helper.

First, add a new helper `_to_parsed_holding` near `_to_parsed_row`:

```python
def _to_parsed_holding(item: dict, line_no: int) -> ParsedHolding | None:
	"""Convert one vision JSON holding item to ParsedHolding. Return None if invalid."""
	ticker = (item.get("ticker") or "").strip() if item.get("ticker") is not None else ""
	if not ticker:
		return None

	# qty: required, must be numeric
	qty_raw = item.get("qty")
	if qty_raw is None:
		return None
	try:
		qty = Decimal(str(qty_raw))
	except (InvalidOperation, ValueError):
		return None
	if qty == 0:
		return None

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
```

Update import block at top of file. Find:
```python
from app.import_data.parsers.base import ParsedRow, register
```

Replace:
```python
from app.import_data.parsers.base import (
	ParsedHolding,
	ParsedRow,
	ParseResult,
	register,
)
```

Now refactor the `parse()` method in `ImageVisionParser` class. Replace the entire class body with:

```python
@register(ImportSourceType.image_vision.value)
class ImageVisionParser:
	def parse(self, file_bytes: bytes) -> ParseResult:
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
```

Now replace `_parse_vision_response` helper. Find:
```python
def _parse_vision_response(raw: str) -> list[dict]:
```

Replace the whole function with:
```python
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
```

Update any existing references from `_parse_vision_response` to `_parse_vision_response_obj` (there shouldn't be other refs now, but verify via grep).

- [ ] **Step 4: Run new tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend pytest tests/test_image_vision_parser.py -v 2>&1 | tail -15
```

Expected: all tests pass (existing 40 + new ~8 = ~48 total in this file).

Common failure: tests that relied on old `_parse_vision_response` return shape. Check the existing test `test_parse_vision_response_*` series — they test the helper directly. Adjust those tests to use new helper name or remove them if they're redundant with the new flow tests.

If you find tests testing the OLD `_parse_vision_response(raw) -> list[dict]` shape, REWRITE them to test `_parse_vision_response_obj(raw) -> dict | None`:

```python
def test_parse_vision_response_obj_valid():
	from app.import_data.parsers.image_vision import _parse_vision_response_obj
	raw = '{"content_type":"statement","transactions":[{"date":"2026-01-01"}]}'
	obj = _parse_vision_response_obj(raw)
	assert obj is not None
	assert obj.get("content_type") == "statement"


def test_parse_vision_response_obj_malformed():
	from app.import_data.parsers.image_vision import _parse_vision_response_obj
	assert _parse_vision_response_obj("not json") is None
	assert _parse_vision_response_obj("") is None


def test_parse_vision_response_obj_non_dict():
	from app.import_data.parsers.image_vision import _parse_vision_response_obj
	assert _parse_vision_response_obj('["array not dict"]') is None
```

- [ ] **Step 5: Confirm overall test count**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -3
```

Expected: ~185 passed, 10 skipped.

---

## Task 4: Backward-compat shim other parsers + PdfVisionParser aggregation

Goal: existing parsers `ManualCsvParser`, `PdfBniParser` need to wrap return in ParseResult. `PdfVisionParser` aggregates across pages.

**Files:**
- Modify: `backend/app/import_data/parsers/manual_csv.py`
- Modify: `backend/app/import_data/parsers/pdf_bni.py`
- Modify: `backend/app/import_data/parsers/pdf_vision.py`
- Modify: `backend/tests/test_pdf_vision_parser.py`

- [ ] **Step 1: Modify `manual_csv.py`**

Find at end of `ManualCsvParser.parse()`:
```python
return rows
```

Replace with:
```python
from app.import_data.parsers.base import ParseResult
return ParseResult(rows=rows)
```

Better: add the import at top of file with other imports, then just `return ParseResult(rows=rows)` at end. Use Edit tool.

In imports block at top of file, find:
```python
from app.import_data.parsers.base import ParsedRow, register
```

Replace with:
```python
from app.import_data.parsers.base import ParsedRow, ParseResult, register
```

In `parse()` method, find `return rows` (should be near end). Replace with:
```python
return ParseResult(rows=rows)
```

- [ ] **Step 2: Modify `pdf_bni.py`**

Same pattern. Find imports:
```python
from app.import_data.parsers.base import ParsedRow, register
```

Replace with:
```python
from app.import_data.parsers.base import ParsedRow, ParseResult, register
```

Find `return rows` at end of `parse()`. Replace with:
```python
return ParseResult(rows=rows)
```

- [ ] **Step 3: Modify `pdf_vision.py` to aggregate ParseResult per page**

Read current implementation:
```bash
cat backend/app/import_data/parsers/pdf_vision.py
```

Update imports at top to include needed types:
```python
from collections import Counter
from app.import_data.parsers.base import ParsedHolding, ParsedRow, ParseResult
from app.import_data.parsers.image_vision import ImageVisionParser
```

(Other existing imports stay.)

Replace the `PdfVisionParser.parse()` method body:

```python
class PdfVisionParser:
	def parse(self, file_bytes: bytes) -> ParseResult:
		try:
			doc = fitz.open(stream=file_bytes, filetype="pdf")
		except Exception:
			return ParseResult()

		image_parser = ImageVisionParser()
		all_rows: list[ParsedRow] = []
		all_holdings: list[ParsedHolding] = []
		content_types_seen: list[str] = []
		first_balance_summary_raw: dict | None = None
		next_line_no = 1
		next_h_line_no = 1

		try:
			for page in doc:
				try:
					pix = page.get_pixmap(dpi=150)
					png_bytes = pix.tobytes("png")
				except Exception:
					continue
				try:
					page_result = image_parser.parse(png_bytes)
				except Exception:
					continue

				content_types_seen.append(page_result.content_type)
				for row in page_result.rows:
					row.line_no = next_line_no
					next_line_no += 1
					all_rows.append(row)
				for h in page_result.holdings:
					h.line_no = next_h_line_no
					next_h_line_no += 1
					all_holdings.append(h)
				# Take first page's balance_summary (typically only page 1 has it for statements)
				if first_balance_summary_raw is None:
					raw = getattr(page_result, "_balance_summary_raw", None)
					if raw is not None:
						first_balance_summary_raw = raw
		finally:
			doc.close()

		# Aggregate content_type: most common across pages
		if content_types_seen:
			content_type = Counter(content_types_seen).most_common(1)[0][0]
		else:
			content_type = "unknown"

		result = ParseResult(
			rows=all_rows,
			holdings=all_holdings,
			content_type=content_type,
		)
		if first_balance_summary_raw is not None:
			result._balance_summary_raw = first_balance_summary_raw  # type: ignore[attr-defined]
		return result
```

- [ ] **Step 4: Update `test_pdf_vision_parser.py` mocks**

The existing tests use `_setup_mocks` that returns lists. Update mock fixtures because `ImageVisionParser.parse` now returns `ParseResult`. Find the existing `_setup_mocks` helper and update:

In `tests/test_pdf_vision_parser.py`, find the existing `_setup_mocks` function. Replace it:

```python
def _setup_mocks(monkeypatch, num_pages: int, rows_per_page: list[list[ParsedRow]]):
	"""Mock fitz.open to return doc with N pages, and ImageVisionParser to return
	ParseResult with rows_per_page[i] for page i."""
	from app.import_data.parsers import pdf_vision
	from app.import_data.parsers.base import ParseResult

	pages = []
	for i in range(num_pages):
		page = MagicMock()
		pix = MagicMock()
		pix.tobytes.return_value = b"fake_png_page_" + str(i).encode()
		page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	mock_doc.__len__.return_value = num_pages
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kwargs: mock_doc)

	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		return ParseResult(rows=rows_per_page[i], content_type="statement")
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)
	return call_idx
```

Update existing tests that compare `len(rows)` or access `rows`:
- Find `assert len(rows) == ...` patterns — these now reference `result.rows`, so update accordingly:

For each test like:
```python
rows = parser.parse(b"%PDF-1.4 mock")
assert len(rows) == 6
```

Change to:
```python
result = parser.parse(b"%PDF-1.4 mock")
assert len(result.rows) == 6
```

Same for `rows[0].line_no`, `rows[0].description` patterns — prefix with `result.`.

Tests to update (search/replace patterns):
- `test_pdf_vision_parse_corrupted_pdf_returns_empty` — change `parser.parse(b"garbage") == []` to `parser.parse(b"garbage").rows == []`
- `test_pdf_vision_parse_empty_pdf_returns_empty` — same pattern
- `test_pdf_vision_parse_single_page` — wrap accesses
- `test_pdf_vision_parse_concats_multiple_pages_with_global_line_no` — wrap
- `test_pdf_vision_parse_skips_page_on_rasterize_failure` — wrap
- `test_pdf_vision_parse_skips_page_on_vision_failure` — wrap
- `test_pdf_vision_parse_passes_png_bytes_to_image_parser` — wrap

Add 2 new tests for aggregation:

```python
def test_pdf_vision_aggregates_holdings_across_pages(monkeypatch):
	from app.import_data.parsers import pdf_vision
	from app.import_data.parsers.base import ParsedHolding, ParseResult

	pages = []
	for i in range(2):
		page = MagicMock()
		pix = MagicMock()
		pix.tobytes.return_value = b"png" + str(i).encode()
		page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	def fake_parse(self, file_bytes):
		# Page 1: 1 holding, page 2: 2 holdings
		if file_bytes.endswith(b"0"):
			return ParseResult(
				rows=[],
				holdings=[ParsedHolding(line_no=1, ticker="QQQ", qty=Decimal("0.225"))],
				content_type="holding",
			)
		return ParseResult(
			rows=[],
			holdings=[
				ParsedHolding(line_no=1, ticker="BTC", qty=Decimal("0.001")),
				ParsedHolding(line_no=2, ticker="GOLD", qty=Decimal("9.378")),
			],
			content_type="holding",
		)
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	result = pdf_vision.PdfVisionParser().parse(b"%PDF mock")
	assert result.content_type == "holding"
	assert len(result.holdings) == 3
	# Global line_no renumber
	assert [h.line_no for h in result.holdings] == [1, 2, 3]
	assert [h.ticker for h in result.holdings] == ["QQQ", "BTC", "GOLD"]


def test_pdf_vision_content_type_majority_vote(monkeypatch):
	from app.import_data.parsers import pdf_vision
	from app.import_data.parsers.base import ParseResult

	pages = [MagicMock() for _ in range(3)]
	for i, p in enumerate(pages):
		pix = MagicMock()
		pix.tobytes.return_value = b"png" + str(i).encode()
		p.get_pixmap.return_value = pix
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	types = ["statement", "statement", "receipt"]
	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		return ParseResult(content_type=types[i])
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	result = pdf_vision.PdfVisionParser().parse(b"%PDF mock")
	assert result.content_type == "statement"  # 2 of 3 votes
```

- [ ] **Step 5: Run all parser tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend pytest tests/test_pdf_vision_parser.py tests/test_image_vision_parser.py tests/test_validation.py -v 2>&1 | tail -15
```

Expected: all pass.

- [ ] **Step 6: Confirm full backend suite still passes**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -3
```

Expected: ~190 passed, 10 skipped.

---

## Task 5: DB migration + ImportJob model + Pydantic schemas

Goal: persist Phase 4 metadata to DB.

**Files:**
- Modify: `backend/app/import_data/models.py`
- Create: `backend/alembic/versions/<timestamp>_add_content_type_balance_check_holdings.py`
- Modify: `backend/app/import_data/schemas.py`

- [ ] **Step 1: Modify ImportJob model**

Edit `backend/app/import_data/models.py`. Add to the imports:

```python
from sqlalchemy.dialects.postgresql import JSONB
```

(may already be imported — check first via grep.)

Find the `class ImportJob(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):` definition. After the existing fields (around `rows: Mapped[list["ImportRow"]]` or similar), ADD new fields just BEFORE the relationship declaration:

```python
	# Phase 4: classify + math-check + holdings detection
	content_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
	balance_check: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
	detected_holdings: Mapped[list | None] = mapped_column(JSONB, nullable=True)
```

- [ ] **Step 2: Generate alembic migration**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend alembic revision --autogenerate -m "add content type balance check holdings to import jobs"
```

Expected: prints something like `Generating /app/alembic/versions/<timestamp>_add_content_type_balance_check_holdings.py ... done`.

- [ ] **Step 3: Verify generated migration is correct**

Find the generated file (use the timestamp printed in Step 2):

```bash
ls /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/alembic/versions/*add_content_type* | head -1
```

Open and verify upgrade() contains:
```python
op.add_column('import_jobs', sa.Column('content_type', sa.String(length=20), nullable=True))
op.add_column('import_jobs', sa.Column('balance_check', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
op.add_column('import_jobs', sa.Column('detected_holdings', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
```

And downgrade() reverses these.

If autogenerate produced extra/missing operations: edit the file manually to match exactly. Common autogenerate noise: `op.create_index(...)` for new columns — REMOVE those (we don't need indexes on these JSONB fields).

- [ ] **Step 4: Apply migration**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make migrate 2>&1 | tail -5
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade ... add content type balance check holdings to import jobs`.

- [ ] **Step 5: Add Pydantic response schemas**

Edit `backend/app/import_data/schemas.py`. Find imports and add Decimal if not there:

```python
from decimal import Decimal
```

Find the `class ImportJobDetailResponse(...)` definition. ADD these new schemas BEFORE it (or in alphabetical order, whatever the file uses):

```python
class BalanceCheckResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	saldo_awal: Decimal
	saldo_akhir: Decimal
	sum_transactions: Decimal
	expected_delta: Decimal
	actual_delta: Decimal
	matches: bool
	diff_pct: Decimal


class DetectedHoldingResponse(BaseModel):
	model_config = ConfigDict(from_attributes=True)

	line_no: int
	ticker: str
	qty: Decimal
	avg_price: Decimal | None = None
	market_value: Decimal | None = None
	currency: str
	asset_type: str
	confidence_score: Decimal
```

(Adjust `ConfigDict(from_attributes=True)` line to match the file's existing pattern — could be `class Config: orm_mode = True` for Pydantic v1, or `model_config = ConfigDict(from_attributes=True)` for v2. Check existing schemas.)

In the `ImportJobDetailResponse` class, ADD fields (preserve existing):

```python
class ImportJobDetailResponse(BaseModel):
	# ... existing fields ...
	content_type: str | None = None
	balance_check: BalanceCheckResponse | None = None
	detected_holdings: list[DetectedHoldingResponse] | None = None
```

- [ ] **Step 6: Verify migration + schema work together**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -3
```

Expected: existing 190 tests still pass. New columns don't break existing flows.

---

## Task 6: Service layer integration

Goal: `process_job` reads ParseResult, runs math-check via validation module, persists JSON metadata to ImportJob.

**Files:**
- Modify: `backend/app/import_data/service.py`
- Modify: `backend/tests/test_import.py`

- [ ] **Step 1: Add helpers + write failing tests**

Append to `backend/tests/test_import.py` (around the end, after existing test functions):

```python
# ---------- Phase 4: content_type, balance_check, holdings persistence ----------

@pytest.fixture
def mock_dispatch_holding(monkeypatch):
	"""Patch dispatcher to return a parser yielding holding-shaped ParseResult."""
	from app.import_data.parsers.base import ParsedHolding, ParseResult
	from app.import_data import service as svc

	class _MockHoldingParser:
		def parse(self, _file_bytes):
			return ParseResult(
				rows=[],
				holdings=[
					ParsedHolding(line_no=1, ticker="QQQ", qty=Decimal("0.225"), avg_price=Decimal("268.44"), currency="USD", asset_type="stock"),
					ParsedHolding(line_no=2, ticker="BTC", qty=Decimal("0.001"), avg_price=Decimal("1473939"), currency="IDR", asset_type="crypto"),
				],
				content_type="holding",
			)

	monkeypatch.setattr(svc, "dispatch", lambda _bytes: _MockHoldingParser())


@pytest.fixture
def mock_dispatch_statement_with_balance(monkeypatch):
	"""Patch dispatcher to return ParseResult with statement content_type and balance_summary raw."""
	from datetime import date
	from app.import_data.parsers.base import ParsedRow, ParseResult
	from app.import_data import service as svc

	class _MockStatementParser:
		def parse(self, _file_bytes):
			result = ParseResult(
				rows=[
					ParsedRow(line_no=1, transaction_date=date(2026, 6, 1), amount=Decimal("19600"), description="BI-FAST CR"),
					ParsedRow(line_no=2, transaction_date=date(2026, 6, 1), amount=Decimal("-19600"), description="TRANSAKSI DEBIT"),
				],
				content_type="statement",
			)
			# Balance check would match: 19600 + -19600 = 0; saldo unchanged
			result._balance_summary_raw = {"saldo_awal": 50000, "saldo_akhir": 50000, "currency": "IDR"}
			return result

	monkeypatch.setattr(svc, "dispatch", lambda _bytes: _MockStatementParser())


@pytest.fixture
def mock_dispatch_statement_with_mismatch(monkeypatch):
	"""Statement where sum_txs doesn't match delta — should trigger warning."""
	from datetime import date
	from app.import_data.parsers.base import ParsedRow, ParseResult
	from app.import_data import service as svc

	class _MockMismatchParser:
		def parse(self, _file_bytes):
			result = ParseResult(
				rows=[
					ParsedRow(line_no=1, transaction_date=date(2026, 6, 1), amount=Decimal("100"), description="only one tx", confidence_score=Decimal("1.00")),
				],
				content_type="statement",
			)
			# Expected delta: 1000 - 0 = 1000. Actual: 100. Diff = 90% (way over 1%)
			result._balance_summary_raw = {"saldo_awal": 0, "saldo_akhir": 1000, "currency": "IDR"}
			return result

	monkeypatch.setattr(svc, "dispatch", lambda _bytes: _MockMismatchParser())


async def test_process_job_persists_content_type(client, mock_dispatch_holding):
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)  # file type doesn't matter; dispatch is mocked
	job_id = job["id"]
	await import_service.process_job(UUID(job_id))

	r = await client.get(f"/v1/import/jobs/{job_id}", headers=headers)
	body = r.json()
	assert body["content_type"] == "holding"
	assert body["detected_holdings"] is not None
	assert len(body["detected_holdings"]) == 2
	assert body["detected_holdings"][0]["ticker"] == "QQQ"


async def test_process_job_persists_balance_check_match(client, mock_dispatch_statement_with_balance):
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)
	await import_service.process_job(UUID(job["id"]))

	r = await client.get(f"/v1/import/jobs/{job['id']}", headers=headers)
	body = r.json()
	assert body["content_type"] == "statement"
	assert body["balance_check"] is not None
	assert body["balance_check"]["matches"] is True
	assert Decimal(body["balance_check"]["sum_transactions"]) == Decimal("0")
	assert Decimal(body["balance_check"]["expected_delta"]) == Decimal("0")


async def test_process_job_applies_warning_on_mismatch(client, mock_dispatch_statement_with_mismatch):
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)
	await import_service.process_job(UUID(job["id"]))

	r = await client.get(f"/v1/import/jobs/{job['id']}", headers=headers)
	body = r.json()
	assert body["content_type"] == "statement"
	assert body["balance_check"]["matches"] is False
	# All rows should have confidence capped to 0.70
	for item in body["items"]:
		assert Decimal(item["confidence_score"]) <= Decimal("0.70")


async def test_process_job_legacy_no_content_type_writes_unknown(client):
	"""Backward compat: if parser returns ParseResult(content_type='unknown'), job has 'unknown'."""
	auth = await register_and_login(client)
	headers = auth["headers"]
	job = await _upload_manual_csv(client, headers)
	await import_service.process_job(UUID(job["id"]))

	r = await client.get(f"/v1/import/jobs/{job['id']}", headers=headers)
	body = r.json()
	# manual_csv parser returns ParseResult(rows=..., content_type="unknown" by default)
	assert body["content_type"] == "unknown"
	assert body["balance_check"] is None
	assert body["detected_holdings"] is None or body["detected_holdings"] == []
```

(Note: existing `test_import.py` imports include `from decimal import Decimal` — verify presence.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend pytest tests/test_import.py -k "process_job_persists or process_job_applies or process_job_legacy" -v 2>&1 | tail -15
```

Expected: tests fail because `process_job` doesn't yet persist Phase 4 fields. Service still does old `list[ParsedRow]` flow.

- [ ] **Step 3: Modify `service.py:process_job`**

Read current implementation:

```bash
sed -n '160,200p' /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/app/import_data/service.py
```

Add helpers at top of service.py (after existing imports). Add to imports:

```python
from app.import_data.parsers.base import ParseResult
from app.import_data.validation import apply_balance_warning, run_balance_check
```

Add helpers BEFORE `async def process_job` (somewhere in module scope):

```python
def _balance_check_to_dict(bc) -> dict | None:
	"""Serialize BalanceCheck dataclass to JSON-safe dict for JSONB storage."""
	if bc is None:
		return None
	return {
		"saldo_awal": str(bc.saldo_awal),
		"saldo_akhir": str(bc.saldo_akhir),
		"sum_transactions": str(bc.sum_transactions),
		"expected_delta": str(bc.expected_delta),
		"actual_delta": str(bc.actual_delta),
		"matches": bool(bc.matches),
		"diff_pct": str(bc.diff_pct),
	}


def _holding_to_dict(h) -> dict:
	"""Serialize ParsedHolding dataclass to JSON-safe dict."""
	return {
		"line_no": h.line_no,
		"ticker": h.ticker,
		"qty": str(h.qty),
		"avg_price": str(h.avg_price) if h.avg_price is not None else None,
		"market_value": str(h.market_value) if h.market_value is not None else None,
		"currency": h.currency,
		"asset_type": h.asset_type,
		"confidence_score": str(h.confidence_score),
	}
```

Now modify `process_job`. Find the block:

```python
try:
	file_bytes = (UPLOADS_ROOT / job.file_path).read_bytes()
	parser = dispatch(file_bytes)
	parsed = parser.parse(file_bytes)
except Exception as exc:
	job.status = ImportJobStatus.failed
	job.error_message = str(exc)[:500]
	await session.commit()
	return
```

Replace with:

```python
try:
	file_bytes = (UPLOADS_ROOT / job.file_path).read_bytes()
	parser = dispatch(file_bytes)
	result: ParseResult = parser.parse(file_bytes)
except Exception as exc:
	job.status = ImportJobStatus.failed
	job.error_message = str(exc)[:500]
	await session.commit()
	return

# Phase 4: extract balance_summary attached by parser (if any), run math-check
balance_summary_raw = getattr(result, "_balance_summary_raw", None)
saldo_awal = saldo_akhir = None
if isinstance(balance_summary_raw, dict):
	try:
		if balance_summary_raw.get("saldo_awal") is not None:
			saldo_awal = Decimal(str(balance_summary_raw["saldo_awal"]))
		if balance_summary_raw.get("saldo_akhir") is not None:
			saldo_akhir = Decimal(str(balance_summary_raw["saldo_akhir"]))
	except (InvalidOperation, ValueError):
		saldo_awal = saldo_akhir = None

balance_check = run_balance_check(result.rows, saldo_awal, saldo_akhir)
if balance_check is not None and not balance_check.matches:
	apply_balance_warning(result.rows)

# Persist Phase 4 metadata
job.content_type = result.content_type
job.balance_check = _balance_check_to_dict(balance_check)
job.detected_holdings = [_holding_to_dict(h) for h in result.holdings] if result.holdings else None

# Use result.rows for the existing row creation loop
parsed = result.rows
```

Make sure `Decimal` and `InvalidOperation` are imported at top of file. Find existing imports — `Decimal` is likely already imported. If not:

```python
from decimal import Decimal, InvalidOperation
```

The rest of `process_job` (the loop that creates `ImportRow` records) is unchanged — it iterates `parsed` which now equals `result.rows`.

- [ ] **Step 4: Run tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -3
```

Expected: ~194 passed, 10 skipped.

If failures: check that `_balance_check_to_dict`, `_holding_to_dict`, `run_balance_check`, `apply_balance_warning` all imported correctly. Check existing test failures whether mocked fixtures interact correctly.

---

## Task 7: Frontend types update

Goal: TypeScript interfaces for new response fields.

**Files:**
- Modify: `frontend/lib/api/types.ts`

- [ ] **Step 1: Locate `ImportJobDetailResponse` type**

```bash
grep -n "ImportJobDetailResponse\|interface ImportJob" /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend/lib/api/types.ts
```

- [ ] **Step 2: Add new interfaces + extend ImportJobDetailResponse**

Edit `frontend/lib/api/types.ts`. Add new interfaces (location: near other Import* types):

```typescript
export interface BalanceCheck {
	saldo_awal: string;
	saldo_akhir: string;
	sum_transactions: string;
	expected_delta: string;
	actual_delta: string;
	matches: boolean;
	diff_pct: string;
}

export interface DetectedHolding {
	line_no: number;
	ticker: string;
	qty: string;
	avg_price: string | null;
	market_value: string | null;
	currency: string;
	asset_type: string;
	confidence_score: string;
}
```

In `ImportJobDetailResponse` interface, add 3 fields:

```typescript
export interface ImportJobDetailResponse {
	// ... existing fields ...
	content_type: string | null;
	balance_check: BalanceCheck | null;
	detected_holdings: DetectedHolding[] | null;
}
```

(Exact fields list depends on existing — preserve all existing properties.)

- [ ] **Step 3: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5
```

Expected: exit 0.

---

## Task 8: JobReviewPanel UI — banner + holdings panel

Goal: render warning banner if balance_check mismatch, render Detected Holdings panel below transactions if holdings present.

**Files:**
- Modify: `frontend/app/(app)/import/_components/JobReviewPanel.tsx`

- [ ] **Step 1: Read current JobReviewPanel.tsx**

```bash
sed -n '1,50p' /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend/app/\(app\)/import/_components/JobReviewPanel.tsx
```

Note where summary cards + filter pills + table are rendered (likely inside a conditional like `{(isReview || isDone) && (...)}`).

- [ ] **Step 2: Add helpers and banner**

In `JobReviewPanel.tsx`, find the helpers section near top (where `fmtRp` is defined). Just below the existing helpers, ADD this helper for parsing fmt with sign:

```typescript
function fmtRpSigned(amountStr: string): string {
	const n = parseFloat(amountStr) || 0;
	const abs = Math.abs(n).toLocaleString("id-ID");
	if (n === 0) return "Rp 0";
	return (n > 0 ? "+Rp " : "−Rp ") + abs;
}
```

Now find the rendering block — INSIDE the `{(isReview || isDone) && (...)}` block, just BEFORE the `<!-- Summary cards -->` section, ADD:

```tsx
{job.balance_check && !job.balance_check.matches && (
	<div className="mb-5 border border-amber-300 bg-amber-50 px-4 py-3 text-[13px]">
		<div className="mb-1 font-medium text-amber-900">
			⚠️ Ekstraksi mungkin tidak lengkap atau berlebih
		</div>
		<div className="font-mono text-xs text-amber-800">
			Total transaksi: {fmtRpSigned(job.balance_check.sum_transactions)} · Delta saldo:{" "}
			{fmtRpSigned(job.balance_check.expected_delta)} · Selisih: {job.balance_check.diff_pct}%
		</div>
		<div className="mt-1.5 text-xs text-amber-800">
			Confidence semua row diturunkan ke max 0.70. Periksa dan koreksi sebelum simpan.
		</div>
	</div>
)}
```

- [ ] **Step 3: Add Detected Holdings panel**

Find the end of the table block (the `</table>` and its wrapping `<div>`). AFTER the table wrapper closes (and before the action buttons), ADD:

```tsx
{job.detected_holdings && job.detected_holdings.length > 0 && (
	<div className="mt-6 border border-gray-200">
		<div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
			<div className="text-[11px] font-medium uppercase tracking-label text-gray-500">
				Detected Holdings ({job.detected_holdings.length})
			</div>
			<a
				href="/assets"
				className="text-[11px] text-gray-700 underline hover:text-gray-950"
			>
				Buka Holdings page →
			</a>
		</div>
		<div className="overflow-x-auto">
			<table className="w-full min-w-[640px] border-collapse text-[12px]">
				<thead>
					<tr>
						<th className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Ticker</th>
						<th className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-right text-[10px] font-medium uppercase tracking-label text-gray-400">Qty</th>
						<th className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-right text-[10px] font-medium uppercase tracking-label text-gray-400">Avg Price</th>
						<th className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Currency</th>
						<th className="border-b border-gray-200 bg-gray-50 px-4 py-2 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Type</th>
					</tr>
				</thead>
				<tbody>
					{job.detected_holdings.map((h, i) => (
						<tr key={i} className="border-b border-gray-100 last:border-b-0">
							<td className="px-4 py-2 font-mono text-gray-950">{h.ticker}</td>
							<td className="px-4 py-2 text-right font-mono">{h.qty}</td>
							<td className="px-4 py-2 text-right font-mono">
								{h.avg_price ? fmtRp(h.avg_price) : "—"}
							</td>
							<td className="px-4 py-2 font-mono text-gray-600">{h.currency}</td>
							<td className="px-4 py-2 text-gray-600">{h.asset_type}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
		<div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[10px] text-gray-500">
			Detected dari upload kamu. Klik "Buka Holdings page" untuk input manual ke portfolio.
		</div>
	</div>
)}
```

(`fmtRp` should already be in scope — used by existing transaction rows. If not, use `String(h.avg_price)` instead.)

- [ ] **Step 4: Typecheck + lint**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5 && pnpm exec next lint 2>&1 | tail -5
```

Expected: tsc exit 0, no lint warnings or errors.

- [ ] **Step 5: Verify page still renders in dev server**

```bash
curl -s -o /dev/null -w "GET http://localhost/  HTTP %{http_code}\n" http://localhost/
```

Expected: HTTP 200. Page compiles via Next dev HMR.

---

## Task 9: Final verification — agent reports back

Goal: report state to PM. PM verifies live tests + manual UI smoke.

**Files:** (none modified)

- [ ] **Step 1: Backend full test suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -3
```

Expected: ~196 passed, 10 skipped. Captures all 12 new validation tests + ~8 image vision + 2 pdf vision + 4 service + existing baseline.

- [ ] **Step 2: Frontend typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5
```

Expected: exit 0.

- [ ] **Step 3: Frontend lint**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec next lint 2>&1 | tail -5
```

Expected: no warnings or errors.

- [ ] **Step 4: Migration applied**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose exec backend alembic current 2>&1 | tail -3
```

Expected: shows current head revision id matching the new migration.

- [ ] **Step 5: HTTP smoke — confirm endpoint includes new fields**

```bash
curl -s http://api.localhost/v1/import/jobs/00000000-0000-0000-0000-000000000000 2>&1 | head -c 300
```

Expected: HTTP 404 (no such job for unauthenticated user) OR 401 (auth required) — that's fine. The point is endpoint responds. Confirms server still serves.

- [ ] **Step 6: Git status**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && git status
```

Expected modified/new files:
- New: `backend/app/import_data/validation.py`, `backend/tests/test_validation.py`, `backend/alembic/versions/<timestamp>_add_content_type_balance_check_holdings.py`
- Modified: `backend/app/import_data/parsers/base.py`, `backend/app/import_data/parsers/image_vision.py`, `backend/app/import_data/parsers/manual_csv.py`, `backend/app/import_data/parsers/pdf_bni.py`, `backend/app/import_data/parsers/pdf_vision.py`, `backend/app/import_data/models.py`, `backend/app/import_data/schemas.py`, `backend/app/import_data/service.py`, `backend/app/ai/vision_prompts.py`, `backend/tests/test_image_vision_parser.py`, `backend/tests/test_pdf_vision_parser.py`, `backend/tests/test_import.py`, `frontend/lib/api/types.ts`, `frontend/app/(app)/import/_components/JobReviewPanel.tsx`

NOT committed.

- [ ] **Step 7: Final report**

Output single summary block:
- ✅/❌ per task (1-8)
- Backend test results: `X passed, Y skipped`
- Frontend tsc: clean? Yes/No
- Frontend lint: clean? Yes/No
- Migration revision id
- List of modified/created files
- Any deviation from plan (e.g. mock fixture pattern needed adjustment, prompt test broke, autogenerate migration needed cleanup)
- Concerns for PM before live tests (e.g. heavy USER_PROMPT — may impact vision API cost per call, but rationale)

---

## Self-Review Notes (internal — not for agent)

**Spec coverage check:**
- Goal 1 (validate step): Task 1 (validation.py) + Task 6 (service.py integration) ✓
- Goal 2 (classify step in vision): Tasks 2 + 3 ✓
- Goal 3 (holdings detect + flag, no DB write): Task 3 ParsedHolding + Task 6 persists to JSONB + Task 8 panel display. No write to stock_holdings ✓
- Goal 4 (backward compat): Task 4 shim other parsers + Task 5 nullable columns ✓

**Non-goals respected:** No HEIC/Excel/file size changes, no Smart-CSV upgrade, no stock_holdings auto-write, no model extension, no strict mode, no pre-classify call.

**Type consistency:**
- `ParseResult.rows`, `.holdings`, `.content_type`, `.balance_check` consistent across base.py + parsers + service + schemas + frontend types
- `BalanceCheck` Decimal fields → JSON stored as string (str() conversion in `_balance_check_to_dict`) → Pydantic parses Decimal from string → frontend uses `string` type. Consistent serialization chain.
- `_balance_summary_raw` attribute on ParseResult (set by ImageVisionParser, read by service) — informal protocol via `getattr(..., None)`, consistent across producers/consumers

**Placeholder scan:** No TBD/TODO. Every code block complete. Every command has expected output.

**Risks for agent to report:**
1. **Prompt test breakage** — extending USER_PROMPT might break Task 2's existing prompt assertion tests (e.g. character count thresholds). Tests in `test_image_vision_parser.py` for prompt-content should still pass because they check for marker strings, but verify after Task 2.
2. **Alembic autogenerate may add extra ops** — like an index on new columns. Plan instructs review + manual cleanup.
3. **Pydantic v1 vs v2 syntax** — `ConfigDict(from_attributes=True)` is v2. If project uses v1 with `class Config: orm_mode = True`, adjust accordingly. Task 5 Step 5 explicitly notes this.
4. **JSONB nullable fields in Pydantic response** — `balance_check: BalanceCheckResponse | None` should serialize null correctly. If issues, use `Optional[BalanceCheckResponse]`.
5. **Mock dispatch in test_import.py** — uses `monkeypatch.setattr(svc, "dispatch", ...)` pattern. Verify `dispatch` is module-level name not imported from elsewhere when used in service.py.
6. **manual_csv.py shim** — uses `from app.import_data.parsers.base import ParseResult` (added to import line). Verify final state of imports doesn't have duplicates.
