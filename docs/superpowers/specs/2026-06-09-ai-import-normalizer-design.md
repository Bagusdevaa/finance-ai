# AI Import Normalizer — Design

**Status:** Approved (brainstorming session with bagus@constructland.com)
**Date:** 2026-06-09
**Branch:** continue on `feat/import-accuracy`
**Supersedes:** the per-platform-parser direction for CSV. Builds on Phase 5 (`manual_csv` smart header-scan, `formatAmount`, qty-null holdings).

---

## Context & motivation

Phase 5 shipped a generic alias-based CSV parser (`manual_csv`). In live use on a real Pluang export it ingested rows but threw away meaning:

- **Currency ignored** — a US$3.46 QQQ buy stored as `3.46` IDR → displayed "+Rp 3" (wrong data, not just display).
- **Descriptions useless** — "Crypto", "Top Up" (asset class) instead of "Beli QQQ" (asset).
- **Sign wrong** — every row positive; a BUY (expense) and a SELL (income) both shown `+`.
- **No category** — all blank.

Root cause: a structured broker export (Pluang has Product Name, Transaction Type, per-row Currency, even a USD-IDR rate column) is too rich for generic alias-matching. The naive fix — a dedicated parser per broker — does not scale (Stockbit, Ajaib, Bibit, IPOT, unknown future brokers all need one).

**The user's insight, adopted:** extract any file, then let a model normalize it into our canonical schema — so we never hand-write a parser per source. An external review independently reached the same conclusion (deterministic-first, LLM for *mapping* not number-reading, validation gate, cache the recipe per source).

This design covers ONLY the extraction stage (raw → canonical transactions) for **CSV/text files**. It is one slice of a larger import pipeline; other slices (transfer reconciliation, classification learning loop, dedup overhaul, Excel) are explicitly deferred to their own specs.

---

## Goals

1. Any CSV/text financial export (Pluang, Bibit, IPOT, bank export, Google Sheet) parses into meaningful transactions **without a per-source parser**.
2. For the user's Pluang file specifically: correct IDR amounts, meaningful descriptions ("Beli QQQ"), correct sign, "Investasi" category.
3. USD rows converted to IDR using the file's **own per-row rate** — never a hardcoded rate. Original value preserved for transparency.
4. The system **learns formats**: first upload of a format infers a recipe via LLM; subsequent uploads of the same format reuse the cached recipe with **zero LLM calls** (deterministic, free, fast).
5. Numbers are **never transcribed by the LLM** — the LLM only decides column mapping & rules; Python reads cells and does arithmetic. No hallucinated amounts.

## Non-goals (separate future specs)

- **Excel/.xlsx/.xls** — CSV/text only for v1.
- **Transfer reconciliation** & exclude-internal-transfers-from-totals (Bibit→BNI net-zero, account-registry pairing). This is the real home of the user's "investasi = transfer, exclude from totals" decision; it lands in a later phase. For now the normalizer only **tags** `category="Investasi"` and sets a sensible sign.
- **Classification learning loop** (rules → Qdrant similarity → LLM, learning from user corrections).
- **Deterministic transaction-hash dedup overhaul** — keep the existing idempotency guard as-is.
- **Multi-currency dashboard aggregation / FX totals.**
- **Pluang Forex per-type currency edge** (Currency column reads "USD" but Total Amount is already IDR for Forex rows) — accepted imperfection; such rows are flagged, not silently wrong.
- **manual_csv feature upgrade** — it is rewired as a fallback, with zero logic changes (see Architecture).

---

## Approach (chosen)

**Recipe-infer + code-apply, with caching.** Rejected alternatives:
- *Full-extract per file* (LLM returns every row): expensive on big files, risks number hallucination, never learns.
- *Hybrid two-path by size*: two codepaths to maintain.

The chosen approach handles mixed file sizes via **sampling** in a single path: small files send all rows as the "sample", large files send a representative sample. The LLM call happens once per new format; caching makes repeats free.

---

## Architecture

### Flow (in service `process_job`, for CSV source)

```
CSV bytes
  │  code: decode (utf-8-sig) → rows×cols (csv.reader), detect header row
  │        (reuse Phase 5 _detect_header_row_index)
  │  code: compute fingerprint = sha256(normalized header cols + delimiter)
  │
  ├─ recipe cache lookup by fingerprint
  │     ├─ hit & schema_version current → APPLY (no LLM)        ← cheap, deterministic
  │     ├─ hit & schema_version stale    → re-infer, overwrite
  │     └─ miss                          → infer via LLM → save
  │
  ├─ code: apply_recipe(all_rows, recipe) → ParsedRow[]   (numbers & FX in Python)
  │
  ├─ FALLBACK to manual_csv (Phase 5) when:
  │     • LLM inference fails (bad JSON after 1 retry), OR
  │     • recipe.confidence < 0.5, OR
  │     • apply_recipe yields 0 rows (self-heal: re-infer once first)
  │
  └─ existing downstream: categorize fallback → math-check (Phase 4) → persist → Qdrant index
```

**Routing change:** the dispatcher currently returns `ManualCsvParser` for `text/csv`. The CSV path now runs through the normalizer orchestrated in the **service layer** (which holds the DB session needed for the recipe cache). This is a deliberate, justified deviation from the rigid `Parser.parse(bytes)` Protocol — the CSV path uniquely needs DB (cache) + LLM, unlike pure parsers. `manual_csv` is no longer the dispatcher's CSV target; it is invoked by the orchestrator as a fallback.

**manual_csv is NOT upgraded.** It stays exactly as Phase 5 left it — best-effort safety net only. Adding currency/FX/per-type logic to it would rebuild the very thing the AI path exists to do. It already degrades gracefully (returns empty / skips bad rows). We deliberately do **not** make it a cheap "tier-0 try-first" path: it "succeeds" (non-empty) on rich formats like Pluang and would prevent escalation to the AI path — reintroducing the original bug. The cheap deterministic path is the **cached recipe**, not manual_csv.

### New components

| File | Status | Responsibility |
|------|--------|----------------|
| `backend/app/ai/groq_client.py` | MODIFY | Add `text_complete(system_prompt, user_prompt, *, model, max_tokens)` — sync, single-shot text completion, `GROQ_MODEL` (llama-3.3-70b), temp 0.1, JSON output |
| `backend/app/import_data/csv_normalizer.py` | NEW | `Recipe` dataclass + JSON validation; `compute_fingerprint()`; `infer_recipe()` (LLM); `apply_recipe()` (pure) |
| `backend/app/ai/recipe_prompts.py` | NEW | System + user prompt templates for recipe inference (mirrors `vision_prompts.py` split) |
| `backend/app/import_data/models.py` | MODIFY | New `ImportRecipe` table |
| `backend/alembic/versions/*` | NEW | Migration for `import_recipes` |
| `backend/app/import_data/service.py` | MODIFY | Orchestrate CSV path: fingerprint → cache get/infer/save → apply → fallback |
| `backend/app/import_data/dispatcher.py` | MODIFY | CSV routing note: service handles CSV via normalizer (dispatcher still classifies mime) |

Existing `manual_csv.py` stays; its Phase 5 tests remain as the fallback regression suite.

---

## The Recipe

A small JSON object the LLM produces once per format; `apply_recipe` executes it deterministically over all rows.

```json
{
  "source_label": "Pluang",
  "confidence": 0.0,
  "date":     { "column": "Order Date", "format": "%a, %b %d, %Y" },
  "amount":   { "column": "Total Amount" },
  "currency": { "mode": "column", "column": "Currency", "fixed": "IDR" },
  "fx_rate_column": "USD-IDR Conversion Rate*",
  "sign": {
    "column": "Transaction Type",
    "out_values": ["BUY", "TOP UP", "IDR USD"],
    "in_values":  ["SELL"],
    "default": "as_is"
  },
  "description_template": "{Transaction Type} {Product Name}",
  "merchant": { "column": "Product Name" },
  "category_rules": [
    { "column": "Transaction", "in": ["Crypto", "US Stocks", "Forex", "Gold"], "category": "Investasi" },
    { "column": "Transaction", "in": ["Top Up"], "category": "Top Up" }
  ],
  "skip": [ { "column": "Status", "not_in": ["SUCCESS", "Selesai", "Completed"] } ]
}
```

Field semantics:
- `date.format` — Python strptime format; `apply` falls back to Phase 5 `_DATE_FORMATS` auto-detect if parse fails.
- `currency.mode` — `"column"` (read per-row) or `"fixed"` (constant `currency.fixed`).
- `fx_rate_column` — `null` if none; otherwise the column holding the row's conversion-to-IDR rate.
- `sign.default` — `"as_is"` (trust amount sign), `"negative"`, or `"positive"` for rows whose `sign.column` value matches neither list.
- `description_template` — `{Column Name}` placeholders filled from the row; missing/empty placeholders collapse to a clean string.
- `category_rules` — first matching rule wins; no match → `null` → service-layer categorizer fallback runs.
- `skip` — drop the row if a skip rule matches (e.g. status not successful).

### `apply_recipe(all_rows, header_idx, recipe)` — per data row (all deterministic)

1. **Skip** — if any `skip` rule matches, drop the row.
2. **Date** — parse `date.column` cell with `date.format`; fallback to `_DATE_FORMATS`. Unparseable → skip row.
3. **Amount** — parse `amount.column` cell with Phase 5 `_parse_amount`. Unparseable/empty → skip row.
4. **Currency** — from `currency` (column or fixed).
5. **FX** — if currency ≠ "IDR":
   - rate present & parseable → `amount_idr = amount × rate`; set currency = "IDR".
   - no/invalid rate → keep amount + native currency, **downgrade confidence to ~0.70** (flag for review).
   - **Arithmetic is Python, never the LLM.**
6. **Sign** — `sign.column` value ∈ `out_values` → negative; ∈ `in_values` → positive; else apply `sign.default`.
7. **Description** — fill `description_template`.
8. **Merchant** — from `merchant.column` (nullable).
9. **Category** — first matching `category_rules`, else `null`.
10. **Per-row confidence** → existing green/yellow/red buckets:
    - `1.00` — all core fields present; IDR native or cleanly converted.
    - `~0.70` — unconvertible foreign currency, sign fell to default, or category null.
    - lower — ambiguous date/amount.

**Transparency:** the original native value (e.g. `US$3.46 @16420`) is preserved in `ParsedRow.raw_text` and appended to the transaction note, so the user can always see the pre-conversion figure.

**Uncovered transaction types** (a type absent from the LLM's sample on a large file) → `sign.default` + null category + flagged confidence. Never silently wrong.

### Worked example — the user's Pluang row that showed "+Rp 3"

Source: `US Stocks · BUY · QQQ · USD · Total Amount 3.46 · rate 16420 · Status SUCCESS`
- skip? Status SUCCESS → keep
- currency USD, rate 16420 → `3.46 × 16420 = 56,813.20` → IDR
- sign: "BUY" ∈ out_values → negative
- description: "BUY QQQ"; merchant: QQQ; category: US Stocks → "Investasi"
- **Result: "Beli QQQ" · Investasi · −Rp 56.813** (was "(kosong) · (kosong) · +Rp 3")

---

## Caching & versioning

**Fingerprint:** `sha256(delimiter + "|".join(normalized header columns))`, where each column is lowercased + trimmed, in original order. Same column layout → same fingerprint.

**Table `import_recipes`** (Alembic migration; UUID PK + `TimestampMixin` per project convention):

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `fingerprint` | String, **unique index** | lookup key |
| `source_label` | String | display/debug |
| `recipe_json` | JSONB | the recipe |
| `schema_version` | Integer | recipe-format version (code constant `RECIPE_SCHEMA_VERSION`) |
| `confidence` | Numeric(3,2) | LLM confidence at inference |
| `created_at` / `updated_at` | timestamp | TimestampMixin |

**Global (no `user_id`).** A recipe contains only column-mapping, no PII, so it is shared across users. This is deliberate: a format learned from one upload speeds up every other user's import of that format — a network effect that compounds as the user base grows (relevant to the monetization roadmap).

**Lookup logic:**
- hit & `schema_version == RECIPE_SCHEMA_VERSION` → apply (no LLM).
- hit & stale `schema_version` → re-infer, overwrite (our recipe logic improved).
- miss → infer → insert.
- **Self-heal:** if applying a cached recipe yields 0 valid rows, re-infer once and overwrite (format value-shape changed but columns didn't).

Concurrency: two simultaneous first-uploads of a new format both infer and upsert on the unique `fingerprint` — last write wins, harmless.

---

## LLM inference

- New `text_complete()` in `groq_client.py`: sync (parsers/orchestrator are sync), model `GROQ_MODEL` (`llama-3.3-70b-versatile`), temperature 0.1, JSON output, retry once on unparseable JSON.
- Prompt (`recipe_prompts.py`): canonical schema explanation + the file's header row + up to ~15 sample data rows + instruction: *"Identify which columns map to date/amount/currency/sign/description/category and the rules. Output the recipe JSON. Do NOT transcribe row values or compute numbers."*
- Sampling: small file → all rows (capped ~15–20 in the prompt). Large file → first N plus a few from the middle/end to surface diverse transaction types.

---

## Error handling summary

| Condition | Behavior |
|-----------|----------|
| LLM bad JSON after 1 retry | fallback to `manual_csv` |
| recipe.confidence < 0.5 | fallback to `manual_csv` |
| recipe applies, math-check fails / rows uncertain | apply + flag (existing yellow/red review UI) |
| not a financial CSV (no date/amount mappable; manual_csv also 0 rows) | existing "Tidak ada data finansial" empty-state (Phase 5) |
| foreign currency, no rate | keep native value + flag |

No path hard-fails the job.

---

## Testing strategy

**Backend unit (no LLM — pure):**
- `apply_recipe` with a fixed Pluang recipe + the existing fixture (`tests/fixtures/vision/invest/pluang-transaction-report.csv`): assert the QQQ row → amount ≈ `−56813` / currency IDR / description "BUY QQQ" / category "Investasi"; a SELL row → positive; non-SUCCESS rows skipped; a USD row without rate → flagged (confidence ≤ 0.70).
- `compute_fingerprint`: stable, order-sensitive, same headers → same hash; different columns → different hash.
- `Recipe` JSON validation: well-formed dict → Recipe; missing required keys → raises.

**Backend unit (mocked LLM):**
- `infer_recipe` with `text_complete` monkeypatched to return a canned Pluang recipe JSON → valid Recipe; bad JSON → retry path → on repeated failure, raises (caller falls back).

**Service-level:**
- Cache miss → `text_complete` called once, recipe row saved.
- Cache hit → **assert `text_complete` NOT called**; rows still produced.
- Stale `schema_version` → re-infer.
- `text_complete` raises → `manual_csv` fallback produces the legacy result (no crash).

**Live (gated `VISION_TEST_LIVE=1`, 1 Groq call):**
- Real `infer_recipe` on the Pluang fixture → `apply_recipe` → ≥ 5 rows, the QQQ row converted to IDR (amount > 1000, currency IDR).

**Regression:** all Phase 5 `test_manual_csv.py` tests stay green (manual_csv unchanged, now the fallback).

**Final verification:** `make test` green (≈ 196 prior + new) · `pnpm exec tsc --noEmit` clean (frontend largely unaffected — converting to IDR means existing Rp display still applies).

---

## Out of scope → Phase 6.5+ roadmap

- Transfer reconciliation + exclude internal transfers/investasi from income/expense totals (account registry, pairing heuristic, fuzzy embedding match, `transfer` entity).
- Classification learning loop (Qdrant similarity from user corrections).
- Excel/.xlsx support.
- Deterministic transaction-hash idempotent dedup.
- Multi-currency dashboard aggregation.
- Pluang Forex per-type currency precision.
