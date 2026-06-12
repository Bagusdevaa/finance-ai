# Import Polish (Phase 5) — Design

**Status:** Draft, pending user review (handover from previous session at context limit)
**Date:** 2026-06-09
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch:** `feat/import-accuracy` (continue on existing branch from Phase 4)

---

## Context

Phase 4 (commit `cb2a723`) shipped math-check + classify. User started daily use and reported 3 concrete pain points:

1. **Pluang CSV not parsed** — drops file, `manual_csv` returns 0 rows because Pluang format has 7 metadata lines before real header at line 8.
2. **Currency display wrong** — Pluang trade history correctly extracted USD vs IDR by backend, but frontend `fmtRp()` hardcodes "Rp" prefix for all rows.
3. **Sidebar overflow** — Riwayat Import section grows unbounded; after many imports, scroll behaviour bad.

Plus 2 issues caught during live verification with user-provided screenshots:

4. **Pluang Portfolio screenshot extracted 0 holdings** — vision correctly classified `content_type=holding`, but Portfolio "Assets" tab shows market_value only (no qty). Current schema rejects holdings without qty.
5. **Random file UX** — user uploads selfie (or any irrelevant file), job ends status=Review with 0 rows. Empty review table is confusing.

User explicitly skipped performance investigation ("F"); reported no perf issue in actual usage.

Sample fixtures already copied to `backend/tests/fixtures/vision/invest/`:
- `pluang-portfolio-tab.jpeg` — Pluang Portfolio Assets tab (market_value only, no qty visible)
- `pluang-trades-multicurrency.jpeg` — Pluang Asset transaction history (mixed USD/IDR)

## Goals

1. **Smart-CSV header-scan** — detect header row by scanning first 20 lines, picking row with most matched aliases. Pluang/Bibit/IPOT CSVs with metadata prefix become parseable without per-platform adapters.
2. **Sidebar scroll** — `JobsHistorySidebar` jobs list scrolls within max-height container, doesn't push page height.
3. **Random file empty state** — when content_type=unknown AND 0 rows AND 0 holdings, replace empty review table with friendly "no financial data detected" card.
4. **Allow qty=null in ParsedHolding** — accept holdings with `market_value` but no `qty` (Pluang Portfolio summary view). Drop only if BOTH qty AND market_value missing.
5. **Currency-aware display** — `formatAmount(value, currency)` shows `$` for USD, `Rp` for IDR. Apply to JobReviewPanel (tx table + holdings panel) + Transactions list page.

## Non-goals

- **Performance optimization** — user skipped (F bundle).
- **Dashboard/budget/assets currency display** — defer (Section 5 caller list is JobReviewPanel + Transactions only).
- **FX conversion** (USD → IDR aggregation for dashboard totals) — separate big scope.
- **Holdings auto-write to `stock_holdings`** — Phase 4 chose "detect + flag, no DB write"; stays that way.
- **Multi-asset model extension** (crypto qty precision, asset_type DB enum) — separate scope.
- **Pluang CSV 21-col rich extraction** — basic via smart-CSV header-scan only. Fees/Quantity/USD-IDR rate columns ignored for now.
- **Cross-account transfer dedup** (Jenius VISA + BCA double-count) — separate scope.
- **Credit card account type** — separate scope.
- **Recurring tx detection** — separate scope.
- **HEIC support** — defer.

## Design

### File structure

| File | Status | Responsibility |
|------|--------|----------------|
| `backend/app/import_data/parsers/manual_csv.py` | MODIFY | Add `_detect_header_row_index()` helper + use it in `_build_header_map` path |
| `backend/tests/test_manual_csv.py` (or extend `test_import.py`) | NEW or MODIFY | Test header-scan picks Pluang's line 8 |
| `backend/tests/fixtures/csv/pluang-transaction-report.csv` | NEW (copy from root) | Pluang real export sample (gitignored or sanitized) |
| `backend/app/import_data/parsers/base.py` | MODIFY (1-line) | `ParsedHolding.qty` type: `Decimal | None` |
| `backend/app/import_data/parsers/image_vision.py` | MODIFY | `_to_parsed_holding`: allow qty=None; skip only if BOTH qty AND market_value missing |
| `backend/app/ai/vision_prompts.py` | MODIFY (small) | Update HOLDINGS rule #6 to say qty optional for summary views |
| `backend/tests/test_image_vision_parser.py` | MODIFY | Update holding tests for qty=null case |
| `frontend/lib/formatRupiah.ts` | MODIFY | Add `formatAmount(value, currency, options)` function |
| `frontend/app/(app)/import/_components/JobReviewPanel.tsx` | MODIFY | Use `formatAmount(amount, row.currency)` for tx rows + holdings panel; add empty state card for unknown+0+0 |
| `frontend/app/(app)/transactions/page.tsx` | MODIFY | Use `formatAmount(amount, currency)` instead of `fmtRp` |
| `frontend/app/(app)/import/_components/JobsHistorySidebar.tsx` | MODIFY | Wrap jobs list in `max-h-[calc(100vh-200px)] overflow-y-auto` container |

### 1. Smart-CSV header-scan

**Current:** `ManualCsvParser._build_header_map(fieldnames)` reads line 1 (csv.DictReader auto-detect). Pluang line 1 = `"Name":, "I KADEK..."` has commas (delimiter sniff passes) but no recognized column aliases (date/amount/etc).

**Fix:** scan first 20 raw rows. For each row, count how many cells match an alias from `_HEADER_ALIASES`. Pick row with highest score IF score ≥ 2. Else fallback to row 0 (legacy behavior).

Implementation sketch in `manual_csv.py`:

```python
def _detect_header_row_index(rows: list[list[str]], max_scan: int = 20) -> int:
	"""Scan up to `max_scan` rows, return index with most alias matches.

	Threshold: row must have ≥2 alias matches to qualify. Else returns 0
	(legacy behavior — first row treated as header).
	"""
	best_idx = 0
	best_score = 0
	for i, raw in enumerate(rows[:max_scan]):
		score = sum(
			1 for cell in raw
			if cell and any(
				cell.strip().lower() in aliases
				for aliases in _HEADER_ALIASES.values()
			)
		)
		if score > best_score:
			best_score = score
			best_idx = i
	return best_idx if best_score >= 2 else 0
```

Refactor `ManualCsvParser.parse`: read all rows first (not `csv.DictReader`), call `_detect_header_row_index`, then build dict reader from `rows[header_idx:]` treating row at that index as header.

For Pluang fixture: line 8 (0-indexed = 7) has `["Order Date","Order Time","Order Number","Transaction","Transaction Type","Product Name",...]`. `_HEADER_ALIASES["date"]` includes "order date" (need to add) and "transaction date". `_HEADER_ALIASES["amount"]` includes "total amount" (need to add). Score should be ≥2.

**Additional alias entries to add** in `_HEADER_ALIASES`:
- `"date"`: add `"order date"`
- `"amount"`: add `"total amount"`
- `"description"`: add `"product name"`, `"transaction"`
- `"type"`: add `"transaction type"`

### 2. Sidebar scroll

`frontend/app/(app)/import/_components/JobsHistorySidebar.tsx` — wrap the jobs list in scroll container:

```tsx
{visibleJobs.length === 0 ? (
	<div className="border border-dashed ...">Belum ada import...</div>
) : (
	<div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
		<div className="space-y-1.5">
			<AnimatePresence initial={false}>
				{visibleJobs.map(...)}
			</AnimatePresence>
		</div>
	</div>
)}
```

`pr-1` adds small right padding so scrollbar doesn't overlap card content.

### 3. Random file empty state

In `JobReviewPanel.tsx`, after the existing logic that determines `isReview/isDone`, add helper:

```tsx
const isEmptyUnknown =
	(isReview || isDone) &&
	job.content_type === "unknown" &&
	(job.items?.length ?? 0) === 0 &&
	(job.detected_holdings?.length ?? 0) === 0;
```

Render BEFORE summary cards block — if `isEmptyUnknown`, replace the entire summary/filter/table block with:

```tsx
{isEmptyUnknown ? (
	<div className="border border-gray-200 bg-gray-50 px-6 py-10 text-center">
		<div className="mb-3 text-3xl">🔍</div>
		<div className="mb-2 font-medium text-gray-950">
			Tidak ada data finansial terdeteksi
		</div>
		<div className="mb-4 max-w-md mx-auto text-[13px] text-gray-600">
			File ini tidak terlihat seperti statement bank, screenshot transaksi, atau export keuangan.
		</div>
		<div className="text-[12px] text-gray-500">
			Format yang didukung: PDF e-statement · screenshot history e-wallet/invest · CSV/Excel export
		</div>
	</div>
) : (
	<>
		{/* existing summary cards + filter pills + table */}
	</>
)}
```

Confirm button hidden when `isEmptyUnknown` (use existing `includedRows === 0` already handles this — verify).

### 4. Allow qty=null in ParsedHolding

**`parsers/base.py`:** change one line in `ParsedHolding` dataclass:

```python
qty: Decimal | None = None   # was: qty: Decimal
```

**`parsers/image_vision.py._to_parsed_holding`** logic change:

```python
def _to_parsed_holding(item: dict, line_no: int) -> ParsedHolding | None:
	ticker = (item.get("ticker") or "").strip() if item.get("ticker") is not None else ""
	if not ticker:
		return None

	# qty: optional now
	qty = None
	if item.get("qty") is not None:
		try:
			qty = Decimal(str(item["qty"]))
			if qty == 0:
				qty = None
		except (InvalidOperation, ValueError):
			qty = None

	# avg_price: optional (existing)
	# market_value: optional (existing)
	# ... parse those ...

	# Skip if BOTH qty AND market_value missing (no useful data)
	if qty is None and market_value is None:
		return None

	return ParsedHolding(line_no=line_no, ticker=ticker, qty=qty, ...)
```

**Vision prompt (`vision_prompts.py`)** rule #6 update — add line:

```
- qty optional kalau view summary saja (cuma market value visible, qty tidak shown). market_value required kalau qty tidak ada.
```

**Frontend `JobReviewPanel.tsx`** holdings panel cell render:

```tsx
<td className="...text-right font-mono">{h.qty ?? "—"}</td>
```

(Pydantic schema `DetectedHoldingResponse.qty: Decimal | None` already allows null per current spec.)

### 5. Currency-aware display

**`frontend/lib/formatRupiah.ts`** — add new function alongside existing:

```typescript
export function formatAmount(
	value: number | string | null,
	currency: string = "IDR",
	options?: { withSign?: boolean }
): string {
	if (value === null || value === undefined) return "—";
	const n = typeof value === "string" ? parseFloat(value) : value;
	if (!Number.isFinite(n)) return "—";
	const abs = Math.abs(n);

	let formatted: string;
	let prefix: string;
	if (currency === "USD") {
		formatted = abs.toLocaleString("en-US", {
			minimumFractionDigits: abs < 1 ? 2 : 0,
			maximumFractionDigits: 2,
		});
		prefix = "$";
	} else {
		formatted = Math.round(abs).toLocaleString("id-ID");
		prefix = "Rp ";
	}

	if (options?.withSign) {
		return (n >= 0 ? "+" : "−") + prefix + formatted;
	}
	return (n < 0 ? "−" : "") + prefix + formatted;
}
```

Existing `formatRupiah` stays (used by 7 other call sites — defer those to a future "full currency-aware" pass).

**`JobReviewPanel.tsx`** call site updates:

```tsx
// Tx row amount cell
<td>{formatAmount(row.amount, row.currency, { withSign: true })}</td>

// Balance check banner
Total transaksi: {formatAmount(job.balance_check.sum_transactions, "IDR", { withSign: true })}

// Holdings panel cells
<td>{formatAmount(h.avg_price, h.currency)}</td>
<td>{formatAmount(h.market_value, h.currency)}</td>
```

**`transactions/page.tsx`** — replace existing `formatRupiah` calls for tx amount with `formatAmount(tx.amount, tx.currency, { withSign: true })`. Verify `TransactionResponse` includes `currency` field (should, already in DB).

## Testing strategy

### Backend unit tests

- `test_manual_csv.py::test_header_row_at_line_8` — load Pluang fixture, assert `_detect_header_row_index` returns 7 (0-indexed line 8) and final rows extracted ≥ 5.
- `test_manual_csv.py::test_header_scan_falls_back_to_row_0` — synthetic CSV with no recognizable headers should return index 0.
- `test_image_vision_parser.py::test_to_parsed_holding_accepts_qty_null` — mock JSON `{"ticker":"QQQ","qty":null,"market_value":12000000,"currency":"IDR"}` → ParsedHolding produced with qty=None.
- `test_image_vision_parser.py::test_to_parsed_holding_skips_when_qty_and_market_value_both_null` — should return None.

### Live integration (gated by VISION_TEST_LIVE=1)

- `test_dispatcher_live.py::test_live_pluang_portfolio_classify_holding` (NEW) — load `pluang-portfolio-tab.jpeg`, expect content_type=holding, holdings ≥ 3 (QQQ, GLD, GOLD market values), all qty=None.

### Frontend manual QA

- [ ] Drop random non-financial file (sample selfie or random PDF) → review screen shows "Tidak ada data finansial terdeteksi" card, no transaction table
- [ ] Drop Pluang Portfolio screenshot → review shows Detected Holdings panel with QQQ/GLD/GOLD; qty column shows "—"; market_value column shows correct Rp values
- [ ] Drop Pluang trade history → review tx table shows USD rows with `$` prefix (e.g. `+$155.65`), IDR rows with `Rp ` prefix
- [ ] Transactions page after confirm → mixed currency txs display with correct prefix
- [ ] Sidebar with 20+ jobs → list scrolls within `~calc(100vh-200px)` container, doesn't push page; scroll only affects list, header stays
- [ ] Drop Pluang transaction_report CSV → review shows ≥5 rows extracted (smart-CSV header scan)

## Verification (post-implementation)

PM (next session) runs after agent execution:

1. `make test` — target 195+ passed (was 187 + ~6 new tests)
2. `pnpm exec tsc --noEmit` — clean
3. Manual QA checklist above in real browser
4. `VISION_TEST_LIVE=1 make test` for new live test (1 Groq call) — verify Pluang Portfolio classify=holding with holdings extracted

## Out of scope (Phase 6+ candidates)

- Cross-account transfer dedup (Jenius VISA + BCA double-count)
- Credit card account_type with payment-vs-charge distinction
- Multi-asset `stock_holdings` model extension (crypto/gold/multi-currency)
- Holdings auto-write from ParseResult to stock_holdings
- FX conversion (USD ↔ IDR) for dashboard totals
- Pluang CSV rich-column extraction (Fees, Quantity, USD-IDR Rate, Order Number — 21-col)
- Binance support (need sample first)
- HEIC support (iPhone screenshots)
- Excel (.xlsx/.xls) support
- Full currency-aware display refactor across dashboard/budget/assets/chat/onboarding/StatCard
- Recurring tx detection
- Performance optimization (user reported none — defer)
