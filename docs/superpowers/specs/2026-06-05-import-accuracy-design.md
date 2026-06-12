# Import Accuracy (Phase 4) — Design

**Status:** Draft, pending implementation
**Date:** 2026-06-05
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch:** `feat/import-accuracy` (already created)

---

## Context

Phase 1-3 shipped end-to-end import pipeline (image vision + PDF rasterize + content-based dispatcher + redesigned UI). External feedback (from a Claude Browser consultation user shared) validated the arsitektur direction but caught **2 gaps** that limit accuracy:

1. **No financial validate step.** For statement-style content with running balance, sum of extracted transactions should equal `saldo_akhir - saldo_awal`. Mismatch → strong signal of vision hallucination/miss. Currently we only rely on per-row `confidence_score` from vision, which is over-confident because LLM has no ground truth.

2. **No content type classification.** Dispatcher routes by MIME (PDF/image/CSV) and vision asumsi semua = transaction list. Holding screenshots (Pluang Asset tab) get extracted as transactions — wrong data shape. Receipt fotos handled accidentally OK but no different schema applied.

User is using app for daily personal finance. They explicitly chose accuracy over coverage expansion ("data masuk dengan benar > support format lebih banyak"). User upload mix of: e-wallet screenshots, bank PDFs (BNI/BCA/Mandiri/Permata), investasi screenshots/CSV (Pluang/Stockbit/Bibit), foto receipt.

## Goals

1. **Validate step:** Math-check sum transactions vs saldo delta for statements. On mismatch (>1% tolerance), drop all row confidences to max 0.70 (warn tier) and surface warning banner in review screen.
2. **Classify step:** Vision LLM classifies content_type (statement / receipt / holding / unknown) in same call as extraction. No extra API cost.
3. **Holdings detection (no DB write):** When content_type=holding, extract holdings shape data and display as read-only panel in review screen. User manually copies to `/assets/holdings` page. No auto-populate of `stock_holdings` table.
4. **Backward compat:** Existing parsers (`manual_csv`, `pdf_bni`, `image_vision`, `pdf_vision`) continue working without rewrite — only adapter shim needed for return type change.

## Non-goals

- **HEIC support, Excel parsing, file size limit relaxation** — Phase 5 (A1 bundle).
- **Smart-CSV upgrade for Pluang 21-col rich format** — Phase 5 (D bundle).
- **Auto-populate stock_holdings table** — user explicitly picked "detect + flag, no DB write".
- **Multi-asset StockHolding model extension** (crypto qty precision, asset_type enum) — separate scope.
- **Strict mode math-check** (block confirm until user fixes) — user picked soft warning.
- **Pre-classify with separate LLM call** — user picked "in vision call same prompt".
- **Reconciliation across heterogeneous sources** (e-wallet screenshot of tx that's also in e-statement = dobel) — defer.
- **Multi-currency base normalization with FX rate at tx time** — separate scope.
- **Privacy: local VLM for sensitive tier** — long-term consideration, defer.
- **Bulk row operations in review**, **per-file progress %** — UX polish, defer.

## Design

### Architecture overview

Current pipeline (Phase 2 dispatcher):
```
file_bytes → dispatch() → parser.parse() → list[ParsedRow] → service.process_job() → ImportRow rows
```

Phase 4 pipeline:
```
file_bytes → dispatch() → parser.parse() → ParseResult { rows, holdings, content_type, balance_check }
            ↓
service.process_job():
  1. Apply balance warning if balance_check.matches == False
  2. Persist transactions to ImportRow (existing)
  3. Persist content_type, balance_check, detected_holdings as JSON columns on ImportJob (NEW)
            ↓
review screen reads ImportJob → shows:
  - Banner (if balance mismatch)
  - Existing review table (transactions)
  - Detected Holdings panel (if holdings present)
```

**Key principle:** Parser is now responsible for classification + balance extraction. Math-check itself (sum vs delta) runs in service layer (cheap, deterministic, runs regardless of parser).

### Data model

#### New dataclasses (`backend/app/import_data/parsers/base.py`)

```python
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal


@dataclass
class ParsedHolding:
	line_no: int
	ticker: str           # "QQQ", "BTC", "BBCA", "GOLD"
	qty: Decimal          # 0.225 shares, 0.00056 BTC, 9.378 gram
	avg_price: Decimal | None = None   # per unit; may be missing on holding screenshots
	market_value: Decimal | None = None # total value if shown
	currency: str = "IDR"
	asset_type: Literal["stock", "crypto", "gold", "cash", "unknown"] = "unknown"
	confidence_score: Decimal = field(default_factory=lambda: Decimal("1.00"))
	raw_text: str = ""


@dataclass
class BalanceCheck:
	saldo_awal: Decimal
	saldo_akhir: Decimal
	sum_transactions: Decimal       # sum of all signed tx amounts
	expected_delta: Decimal          # saldo_akhir - saldo_awal
	actual_delta: Decimal            # == sum_transactions
	matches: bool                    # True if |expected - actual| / |expected| <= 0.01
	diff_pct: Decimal                # percentage diff, 2 decimal places


@dataclass
class ParseResult:
	rows: list[ParsedRow] = field(default_factory=list)
	holdings: list[ParsedHolding] = field(default_factory=list)
	content_type: Literal["statement", "receipt", "holding", "unknown"] = "unknown"
	balance_check: BalanceCheck | None = None  # populated only if statement + has saldo data
```

Existing `ParsedRow` stays unchanged.

#### Parser Protocol change

```python
class Parser(Protocol):
	def parse(self, file_bytes: bytes) -> ParseResult: ...
```

Was: `parse(file_bytes: bytes) -> list[ParsedRow]`.

#### `ImportJob` model additions (DB migration)

```python
# backend/app/import_data/models.py
class ImportJob(...):
	# existing fields ...
	
	# Phase 4 additions
	content_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
	balance_check: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
	detected_holdings: Mapped[list | None] = mapped_column(JSONB, nullable=True)
```

Alembic migration: `ALTER TABLE import_jobs ADD COLUMN content_type VARCHAR(20), ADD COLUMN balance_check JSONB, ADD COLUMN detected_holdings JSONB`.

### Parser backward compat

Existing parsers (`ManualCsvParser`, `PdfBniParser`, `PdfVisionParser`) only return transactions. Shim:

```python
# Old code (e.g. PdfBniParser.parse):
return rows  # list[ParsedRow]

# New code (1-line change):
return ParseResult(rows=rows)
```

`PdfVisionParser` delegates to `ImageVisionParser.parse()` per page and concats. Updated to handle ParseResult from each page:

```python
# pdf_vision.py — concat across pages
all_rows: list[ParsedRow] = []
all_holdings: list[ParsedHolding] = []
content_types: set[str] = set()
balance_checks: list[BalanceCheck] = []

for page in doc:
	page_result = image_parser.parse(png_bytes)
	all_rows.extend(page_result.rows)
	all_holdings.extend(page_result.holdings)
	content_types.add(page_result.content_type)
	if page_result.balance_check:
		balance_checks.append(page_result.balance_check)

# Aggregate: content_type = most common, balance_check = first (or null)
return ParseResult(
	rows=all_rows,
	holdings=all_holdings,
	content_type=Counter(content_types).most_common(1)[0][0] if content_types else "unknown",
	balance_check=balance_checks[0] if balance_checks else None,
)
```

`ImageVisionParser` is the heaviest change — must classify + extract appropriate schema.

### Vision prompt evolution

`backend/app/ai/vision_prompts.py` USER_PROMPT extended. Key additions:

```
Step 1 — CLASSIFY content_type sebelum extract:
- "statement": multi-row transaction list dengan saldo running (bank mutasi, e-wallet history list)
- "receipt": 1 transaction detail view (single tx receipt, e-wallet single tx detail)
- "holding": portfolio/asset snapshot dengan ticker + quantity (Pluang Asset, Stockbit Portfolio, Bibit holdings)
- "unknown": tidak match ketiga di atas

Step 2 — EXTRACT sesuai schema yang berlaku.

OUTPUT JSON shape:
{
  "content_type": "statement" | "receipt" | "holding" | "unknown",
  "transactions": [...],     // populated for statement/receipt/unknown
  "holdings": [...],          // populated for holding
  "balance_summary": {        // populated ONLY if statement AND saldo visible
    "saldo_awal": <number>,
    "saldo_akhir": <number>,
    "currency": "IDR" | "USD"
  }
}

Schema "transactions" item: <existing schema unchanged>

Schema "holdings" item:
{
  "ticker": "QQQ" | "BTC" | "BBCA" | "GOLD",
  "qty": <number>,                       // 0.225 for shares, 0.00056 for BTC, 9.378 for gram
  "avg_price": <number> | null,
  "market_value": <number> | null,
  "currency": "IDR" | "USD",
  "asset_type": "stock" | "crypto" | "gold" | "cash"
}

CRITICAL RULES (additions to existing rules):
- "Saldo Awal X" dan "Saldo Akhir X" → balance_summary, JANGAN ke transactions
- Holding screenshot biasanya tidak ada date — JANGAN invent date
- Multi-asset (QQQ + BTC + GOLD di same Pluang screen) → semua ke holdings dengan correct asset_type
- "Available USD Cash $317.85" pattern → holding asset_type=cash, ticker=USD
- Ticker IDX 4 huruf (BBCA, TLKM), US ticker bisa 3-5 (QQQ, AAPL), crypto bisa 3-4 (BTC, ETH)
```

Plus 1 few-shot example untuk holding screenshot (Pluang Asset format).

### Math-check implementation

New module `backend/app/import_data/validation.py`:

```python
from decimal import Decimal
from app.import_data.parsers.base import ParsedRow, BalanceCheck


_TOLERANCE_PCT = Decimal("0.01")  # 1% — acceptable for rounding noise


def run_balance_check(
	transactions: list[ParsedRow],
	saldo_awal: Decimal | None,
	saldo_akhir: Decimal | None,
) -> BalanceCheck | None:
	"""Math-check: sum(transactions) == saldo_akhir - saldo_awal?
	
	Returns None if saldo data missing. Returns BalanceCheck with matches=False
	if delta > 1% of expected.
	"""
	if saldo_awal is None or saldo_akhir is None:
		return None
	
	# Note: balance_check runs on raw parser output before user excludes anything in
	# review. ParsedRow has no is_excluded field — that's on ImportRow post-DB.
	sum_txs = sum((r.amount for r in transactions), Decimal("0"))
	expected_delta = saldo_akhir - saldo_awal
	
	if expected_delta == 0:
		# Special case: balance unchanged. If sum_txs != 0, mismatch (any value > 0%)
		diff_pct = Decimal("100.00") if sum_txs != 0 else Decimal("0")
	else:
		diff = abs(sum_txs - expected_delta)
		diff_pct = (diff / abs(expected_delta) * 100).quantize(Decimal("0.01"))
	
	matches = diff_pct <= _TOLERANCE_PCT * 100
	
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
	"""On balance mismatch, cap confidence di semua row ke max 0.70 (warn tier)."""
	for r in rows:
		if r.confidence_score > cap:
			r.confidence_score = cap
```

**Snapshot semantics:** balance_check is a parse-time snapshot. If user excludes rows in review screen later, balance_check is NOT re-run. This is acceptable because the check signals raw vision accuracy, not user's curation.

### Service layer integration

`process_job` in `backend/app/import_data/service.py:174-186` adapts:

```python
# Before (current):
file_bytes = (UPLOADS_ROOT / job.file_path).read_bytes()
parser = dispatch(file_bytes)
parsed = parser.parse(file_bytes)
# ... loop parsed, create ImportRow

# After (Phase 4):
file_bytes = (UPLOADS_ROOT / job.file_path).read_bytes()
parser = dispatch(file_bytes)
result: ParseResult = parser.parse(file_bytes)

# Math-check: backfill balance_check if parser didn't run it
# (e.g. for legacy parsers manual_csv that don't extract balances)
if result.content_type == "statement" and result.balance_check is None:
	# Best-effort: try extract saldo from parser raw_text — not implemented for V1
	pass

# Apply confidence warning if mismatch detected
if result.balance_check and not result.balance_check.matches:
	apply_balance_warning(result.rows)

# Persist Phase 4 metadata to ImportJob
job.content_type = result.content_type
job.balance_check = _balance_check_to_dict(result.balance_check) if result.balance_check else None
job.detected_holdings = [_holding_to_dict(h) for h in result.holdings] if result.holdings else None

# Create ImportRow records as before
for p in result.rows:
	# ... existing logic
```

Helper functions `_balance_check_to_dict` and `_holding_to_dict` convert dataclass → JSON-serializable dict for JSONB storage.

### Detail response schema additions

`ImportJobDetailResponse` Pydantic schema (`backend/app/import_data/schemas.py`) extends:

```python
class BalanceCheckResponse(BaseModel):
	saldo_awal: Decimal
	saldo_akhir: Decimal
	sum_transactions: Decimal
	expected_delta: Decimal
	actual_delta: Decimal
	matches: bool
	diff_pct: Decimal


class DetectedHoldingResponse(BaseModel):
	line_no: int
	ticker: str
	qty: Decimal
	avg_price: Decimal | None
	market_value: Decimal | None
	currency: str
	asset_type: str
	confidence_score: Decimal


class ImportJobDetailResponse(BaseModel):
	# existing fields ...
	content_type: str | None = None
	balance_check: BalanceCheckResponse | None = None
	detected_holdings: list[DetectedHoldingResponse] | None = None
```

### Frontend changes

`JobReviewPanel.tsx` (`frontend/app/(app)/import/_components/`) — 2 additions:

#### 1. Balance warning banner

Render at top of review panel (just below header, above transaction table) IF `job.balance_check && !job.balance_check.matches`:

```tsx
{job.balance_check && !job.balance_check.matches && (
	<div className="mb-5 border border-amber-300 bg-amber-50 px-4 py-3 text-[13px]">
		<div className="font-medium text-amber-900 mb-1">
			⚠️ Ekstraksi mungkin tidak lengkap atau berlebih
		</div>
		<div className="text-amber-800 font-mono text-xs">
			Total transaksi: {fmtRp(String(job.balance_check.sum_transactions))} ·
			Delta saldo: {fmtRp(String(job.balance_check.expected_delta))} ·
			Selisih: {String(job.balance_check.diff_pct)}%
		</div>
		<div className="mt-1.5 text-amber-800 text-xs">
			Confidence semua row diturunkan ke max 0.70. Periksa dan koreksi sebelum simpan.
		</div>
	</div>
)}
```

#### 2. Detected Holdings panel

Render below transactions table IF `job.detected_holdings && job.detected_holdings.length > 0`:

```tsx
{job.detected_holdings && job.detected_holdings.length > 0 && (
	<div className="mt-6 border border-gray-200">
		<div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
			<div className="text-[11px] font-medium uppercase tracking-label text-gray-500">
				Detected Holdings ({job.detected_holdings.length})
			</div>
			<a href="/assets/holdings" className="text-[11px] text-gray-700 hover:text-gray-950 underline">
				Buka Holdings page →
			</a>
		</div>
		<table className="w-full text-[12px]">
			<thead>
				<tr className="border-b border-gray-200">
					<th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Ticker</th>
					<th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-label text-gray-400">Qty</th>
					<th className="px-4 py-2 text-right text-[10px] font-medium uppercase tracking-label text-gray-400">Avg Price</th>
					<th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Currency</th>
					<th className="px-4 py-2 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Type</th>
				</tr>
			</thead>
			<tbody>
				{job.detected_holdings.map((h, i) => (
					<tr key={i} className="border-b border-gray-100 last:border-b-0">
						<td className="px-4 py-2 font-mono text-gray-950">{h.ticker}</td>
						<td className="px-4 py-2 text-right font-mono">{String(h.qty)}</td>
						<td className="px-4 py-2 text-right font-mono">{h.avg_price ? fmtRp(String(h.avg_price)) : "—"}</td>
						<td className="px-4 py-2 font-mono text-gray-600">{h.currency}</td>
						<td className="px-4 py-2 text-gray-600">{h.asset_type}</td>
					</tr>
				))}
			</tbody>
		</table>
		<div className="border-t border-gray-200 bg-gray-50 px-4 py-2 text-[10px] text-gray-500">
			Detected dari upload kamu. Klik "Buka Holdings page" untuk input manual ke portfolio.
		</div>
	</div>
)}
```

`frontend/lib/api/types.ts` adds the response shapes.

## Edge cases

| Case | Behavior |
|------|----------|
| Statement, balance_check.matches=True | No banner, confidence preserved |
| Statement, balance_check.matches=False, diff_pct=87% | Banner shown, all rows capped to 0.70 |
| Statement, expected_delta=0 (balance unchanged) but sum_txs > 0 | Banner shown (mismatch), rows capped |
| Statement, vision didn't extract saldo_summary | balance_check = None, no banner, no cap |
| Receipt classify | balance_check skip (single tx, no delta concept) |
| Holding classify | balance_check skip, holdings displayed, transactions=[] |
| Unknown classify | balance_check skip, treat as transaction list (current behavior) |
| Old jobs pre-migration | content_type=null, no banner, no holdings panel |
| User excludes rows post-confirm in review | balance_check NOT re-run (parse-time snapshot) |
| Multi-page PDF, mixed content_type per page (rare) | Aggregate: pick most common, take first balance_check |
| Tolerance edge: diff_pct = exactly 1.00% | matches=True (≤ tolerance) |

## Testing strategy

### Unit tests

**`backend/tests/test_validation.py` (NEW):**
- `test_balance_check_matches_when_sum_equals_delta`
- `test_balance_check_within_tolerance_returns_match`
- `test_balance_check_mismatch_outside_tolerance`
- `test_balance_check_zero_delta_with_nonzero_sum_mismatch`
- `test_balance_check_zero_delta_zero_sum_matches`
- `test_balance_check_missing_saldo_awal_returns_none`
- `test_balance_check_negative_balance_change`
- `test_apply_balance_warning_caps_high_confidence`
- `test_apply_balance_warning_leaves_low_confidence_alone`

**`backend/tests/test_image_vision_parser.py` (EXTEND):**
- `test_parse_returns_parse_result_type` — return type assertion
- `test_classify_statement_includes_balance_summary` — mock vision return statement-shaped JSON
- `test_classify_holding_returns_holdings_array` — mock vision return holding-shaped JSON
- `test_classify_holding_no_transactions` — holdings array populated, rows empty
- `test_classify_receipt_balance_check_none` — receipt → no balance_check
- `test_classify_unknown_falls_back_to_transactions`
- `test_parse_to_parsed_holding_conversion` — JSON dict → ParsedHolding
- `test_holdings_validation_invalid_qty_skipped`

**`backend/tests/test_pdf_vision_parser.py` (EXTEND):**
- `test_multi_page_aggregates_holdings_across_pages`
- `test_multi_page_content_type_majority_vote`

**`backend/tests/test_import.py` (EXTEND):**
- `test_process_job_persists_content_type_to_import_job`
- `test_process_job_persists_balance_check_jsonb`
- `test_process_job_persists_detected_holdings_jsonb`
- `test_process_job_applies_balance_warning_on_mismatch`

### Live integration tests

**`backend/tests/test_dispatcher_live.py` (EXTEND):**
- `test_live_bni_classify_statement_balance_check_passes` — BNI parser doesn't extract balances (text parser), expect balance_check=None OR populated only if math-check service backfills
- `test_live_pluang_asset_screenshot_classify_holding` — expect content_type=holding, holdings array ≥ 5 entries (QQQ, BTC, GOLD, etc), transactions empty
- `test_live_mandiri_pdf_classify_statement_balance_check_populated` — Mandiri sample has Saldo Awal/Akhir visible

### Manual QA (frontend)

- [ ] Upload BNI PDF → review screen, no warning banner (balance check should match if extracted accurately, OR be None if not extracted)
- [ ] Upload Pluang asset screenshot → review screen, transactions empty, holdings panel shown with detected items
- [ ] Click "Buka Holdings page" → navigates to `/assets/holdings`
- [ ] Upload manually-crafted bad data (force mismatch) → warning banner shows with correct numbers
- [ ] Edit a row in review → balance_check display stays (no re-run)
- [ ] Confirm import → transactions saved, holdings JSON discarded after job confirmed

## Migration & rollout

### Database migration

`backend/alembic/versions/<new>_add_content_type_balance_check_holdings.py`:

```python
def upgrade() -> None:
	op.add_column("import_jobs", sa.Column("content_type", sa.String(20), nullable=True))
	op.add_column("import_jobs", sa.Column("balance_check", postgresql.JSONB, nullable=True))
	op.add_column("import_jobs", sa.Column("detected_holdings", postgresql.JSONB, nullable=True))


def downgrade() -> None:
	op.drop_column("import_jobs", "detected_holdings")
	op.drop_column("import_jobs", "balance_check")
	op.drop_column("import_jobs", "content_type")
```

3 nullable columns, no data backfill needed. Old jobs read with null values → frontend gracefully shows no banner/holdings panel.

### Rollout sequence

1. Backend changes + migration (no frontend yet) — review screen still works (uses existing fields)
2. Frontend changes — banner + holdings panel start appearing for new uploads
3. No data backfill — old jobs forever have null Phase 4 fields, that's fine

### Backward compat

- Existing parsers `ManualCsvParser`, `PdfBniParser` need 1-line change each: `return rows` → `return ParseResult(rows=rows)`
- `PdfVisionParser` needs slight refactor to aggregate ParseResult across pages
- `ImageVisionParser` is the heaviest change — full prompt + JSON parsing + classification logic
- Existing tests update import paths + return type assertions

## Verification (post-implementation, PM/main session)

1. `make migrate` — new columns applied
2. `make test` — pytest 163 + new tests should pass (~180 total expected)
3. `pnpm exec tsc --noEmit` — frontend types clean
4. Live tests with `VISION_TEST_LIVE=1` — 7 live tests (5 phase-2 + 2 new phase-4): all pass
5. Manual upload of BNI PDF + Pluang screenshot + e-statement with intentional bad data → verify UI behavior matches edge cases table

## Out of scope (future iterations)

- A1: HEIC support, Excel parsing, file size limit relaxation, password PDF detection
- D: Smart-CSV upgrade for Pluang 21-col rich format
- Auto-populate `stock_holdings` table from detected holdings
- Multi-asset StockHolding model extension (crypto qty, asset_type enum)
- Strict math-check mode (block confirm until match)
- Pre-classify with separate cheap LLM call (would reduce vision call complexity)
- User-tag at upload as classify override
- Re-extract on bad confidence (let user retry vision parse)
- Vision model fallback chain (Scout → 11B → text-only)
- Reconciliation across heterogeneous sources (dedup screenshot vs e-statement same tx)
- Multi-currency base normalization with FX rate at tx time
- Privacy: local VLM for sensitive financial data
- Bulk row operations in review screen
- Per-file progress % in multi-upload
