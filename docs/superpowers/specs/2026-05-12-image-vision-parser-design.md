# ImageVisionParser — Design (Phase 1)

**Status:** Draft, pending implementation
**Date:** 2026-05-12
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch target:** `bugfix` (current) or new `feat/image-vision-parser`

---

## Context

FinanceAI saat ini punya `image_vision.py` sebagai stub (`raise NotImplementedError`). User memutuskan strategi hybrid untuk import pipeline: BNI tetap pakai `PdfBniParser` dedicated, sementara screenshot e-wallet (GoPay/OVO/Dana/ShopeePay) dan platform invest (Stockbit/Pluang) di-handle oleh single `ImageVisionParser` via Groq Llama 3.2 90B Vision.

Ini Phase 1 dari 3-phase roadmap yang lebih besar:
- **Phase 1 (spec ini):** Build `ImageVisionParser` core. Input: image bytes (PNG/JPEG/WebP). Output: `list[ParsedRow]`.
- **Phase 2 (future):** Smart Import Dispatcher di `service.py` — sniff MIME + magic bytes + PDF text signature, auto-route file ke parser yang tepat. PDF rasterizer untuk bank PDFs (BCA/Mandiri/Permata).
- **Phase 3 (future):** Frontend `/import` redesign — collapse 15 tiles ke 1 dropzone besar.

Phase 1 ship-able standalone: parser bisa di-trigger via existing `source_type="image_vision"` di frontend (sudah wired untuk GoPay/OVO/Dana/Stockbit/Pluang tiles).

Sample images sudah ada di `backend/tests/fixtures/vision/` (gitignored, 9 image dari 5 platform: Dana, GoPay, ShopeePay, Pluang assets, Pluang balance + bonus MyBCA e-statement JPEG).

## Goals

1. Implementasikan parser image vision yang handle 3 paradigma layout: multi-row list, single-tx detail view, e-statement table.
2. Output deterministik ke `ParsedRow` contract (no schema change).
3. Pakai Groq Llama 3.2 90B Vision model untuk akurasi maksimal.
4. Graceful failure di setiap level: corrupt image → empty list (no crash), bad LLM JSON → retry once → empty list, row-level validation fail → skip row, keep others.
5. Confidence scoring per-row sesuai threshold display existing (≥0.8 OK / 0.5-0.8 warn / <0.5 err).

## Non-goals

- Tidak handle PDF input. (Deferred ke Phase 2 dispatcher + rasterizer.)
- Tidak handle multi-image upload dalam 1 job. (1 image = 1 ImportJob; frontend handle multi-upload sebagai N requests.)
- Tidak ada platform-specific prompt atau parser variant. Single generic prompt yang handle semua.
- Tidak modify `Parser` Protocol signature (tetap `parse(file_bytes: bytes)`).
- Tidak modify schema `ParsedRow` atau `ImportRow`.
- Tidak handle FX conversion. Currency disimpan per-row.
- Tidak handle CSV (Pluang transaction report). CSV concerns belongs to `manual_csv` parser atau Phase 2 extension.

## Sample Analysis (Findings dari inspect 9 fixtures)

**3 paradigma layout terkonfirmasi:**

| Paradigma | Sample | Karakteristik |
|-----------|--------|---------------|
| Multi-row list | dana-list-1, shopeepay-list-2/3, pluang-assets-1, pluang-balance-1 | Header tanggal/period, row dengan icon + action + date + signed amount |
| Single-tx detail | gopay-detail-1/2, dana-detail-1 | 1 transaksi, big amount + 10+ metadata fields (merchant, ID, terminal, dll) |
| E-statement table | mybca-statement.jpeg | Format formal: TANGGAL\|KETERANGAN\|MUTASI\|SALDO + multi-line description + "DB" suffix untuk debit |

**Variasi sign convention:**
- Explicit `-Rp35.000` (Dana, ShopeePay)
- Explicit `+Rp1,041,725` / `-$160.57` (Pluang, mixed currency)
- No sign, inferred from context (GoPay detail — merchant payment = negative)
- "DB" suffix (MyBCA — debit indicator)

**Variasi date format:**
- "29 Oct 2025 • 19:39" (Dana)
- "25 Februari 2026" (ShopeePay, full Indonesian month)
- "01 Mar 2026" + separate "Waktu: 18:33" (GoPay detail)
- "01/03" only, year dari header `PERIODE: MARET 2026` (MyBCA)
- "09 May 2026, 19:19" (Pluang)

**Variasi currency:** Mostly IDR; Pluang screens punya mixed IDR + USD di same image.

**Status filter needed:** Pluang menampilkan "Failed" rows; MyBCA biasa skip "SALDO AWAL" baris (bukan transaksi).

## Design

### Architecture & file structure

```
backend/app/ai/
├── groq_client.py             (MODIFY: tambah async vision_complete())
└── vision_prompts.py          (NEW: SYSTEM_PROMPT, USER_PROMPT, few-shot examples)

backend/app/import_data/parsers/
└── image_vision.py            (REPLACE stub: full ImageVisionParser)

backend/tests/
├── test_image_vision_parser.py    (NEW: unit tests with mocked Groq)
└── test_image_vision_live.py      (NEW: integration tests gated by VISION_TEST_LIVE=1)
```

### Parser API contract

```python
@register(ImportSourceType.image_vision.value)
class ImageVisionParser:
    def parse(self, file_bytes: bytes) -> list[ParsedRow]:
        ...
```

Match existing `Parser` Protocol — drop-in seperti `PdfBniParser`. Service layer tidak perlu diubah.

**Input validation (urutan):**
1. Empty bytes → return `[]`
2. Size > 10MB → return `[]` (Groq vision practical limit; 99% screenshot mobile <500KB)
3. Magic bytes check:
   - PNG: `\x89PNG\r\n\x1a\n` (8 bytes) → MIME `image/png`
   - JPEG: `\xff\xd8\xff` (3 bytes) → MIME `image/jpeg`
   - WebP: `RIFF....WEBP` → MIME `image/webp`
   - Else → return `[]`

**Output:** `list[ParsedRow]` per existing kontrak. Empty list valid (image tanpa tx terdeteksi).

### Vision LLM call structure

Tambahan di `groq_client.py`:

```python
async def vision_complete(
    image_b64: str,
    image_mime: str,
    system_prompt: str,
    user_prompt: str,
    *,
    model: str | None = None,
    max_tokens: int = 4096,
) -> str:
    """Single-shot vision completion. Returns raw assistant content string."""
    client = _get_client()
    response = await client.chat.completions.create(
        model=model or _settings.GROQ_VISION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": [
                {"type": "text", "text": user_prompt},
                {"type": "image_url", "image_url": {
                    "url": f"data:{image_mime};base64,{image_b64}"
                }},
            ]},
        ],
        temperature=0.1,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    return response.choices[0].message.content or ""
```

**Parameter decisions:**

| Param | Value | Reasoning |
|-------|-------|-----------|
| `model` | `llama-3.2-90b-vision-preview` (via `GROQ_VISION_MODEL` env) | Akurasi maksimal untuk image padat. Trade-off: latency 3-5s, rate limit lebih ketat |
| `temperature` | `0.1` | Task = factual extraction, bukan generation. Low temp = less hallucination |
| `max_tokens` | `4096` | Image dengan 50 row × ~80 token/row JSON = 4000. Default Groq 1024 nggak cukup |
| `response_format` | `{"type": "json_object"}` | Force valid JSON output (OpenAI-compat mode). Reduce parse failures vs free-form |

**Model availability note:** Groq deprecates preview models periodically (cek di console.groq.com/docs/models). Sebelum write tests, agent harus verify model availability:

```bash
backend/venv/bin/python -c "
import asyncio
from groq import AsyncGroq
from app.config import get_settings
async def check():
    c = AsyncGroq(api_key=get_settings().GROQ_API_KEY)
    models = await c.models.list()
    vision_models = [m.id for m in models.data if 'vision' in m.id.lower()]
    print(vision_models)
asyncio.run(check())
"
```

Jika `llama-3.2-90b-vision-preview` tidak ada di list, fallback prioritas: (1) latest `llama-*-90b-vision-*`, (2) `llama-3.2-11b-vision-preview`, (3) latest `llama-*-11b-vision-*`. Hardcode model name yang dipilih ke `.env.example` dan dokumentasikan di commit message.

**Config env override:**
- `.env.example`: tambah/update `GROQ_VISION_MODEL=llama-3.2-90b-vision-preview`
- Backend test: `VISION_TEST_LIVE=1` flag untuk opt-in real Groq integration tests

### Prompt template

File `app/ai/vision_prompts.py`:

```python
SYSTEM_PROMPT = """You are a precise data extraction assistant for Indonesian
banking, e-wallet, and investment app screenshots and statements. Your job is
to extract every visible transaction from the image into strict JSON.

Be thorough: look at every row, every panel, every detail. Don't miss
transactions hiding at the top or bottom edges. Don't invent transactions
that aren't there.

Output ONLY valid JSON matching the requested schema. No prose, no markdown
fences, no commentary."""

USER_PROMPT = """Extract all visible transactions from this image into a JSON
object with this exact shape:

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
   - "DB", "Debit", "Dr" suffix → negative.
   - "CR", "Credit", "Cr" suffix → positive.
   - "Top Up", "Receive Money", "Dividends Received", "Add USD Cash" → positive.
   - "Send Money", "Buy", "Bayar", "Move IDR Cash to USD Cash" → negative.
   - When uncertain, infer from semantic context.

2. STATUS FILTER: SKIP transactions with status Failed / Cancelled / Pending /
   Gagal / Dibatalkan. Include only Successful / Selesai / SUCCESS / Completed
   / status implied by lack of error indicator.

3. DATE construction:
   - "29 Oct 2025" or "01 Mar 2026" → use directly.
   - "25 Februari 2026" → Indonesian months. Convert to ISO.
   - Only "DD/MM" shown with period header like "PERIODE: MARET 2026" →
     construct full ISO using header year/month.
   - If date cannot be determined, OMIT the row entirely.

4. CURRENCY detection:
   - "Rp" symbol or no symbol → IDR.
   - "$" or "USD" → USD.
   - Each row has its own currency. Don't convert FX.

5. SINGLE-TX DETAIL: If image shows 1 transaction in detail view (big amount
   on top + metadata rows below), return array of 1 object using those fields.

6. NO TRANSACTIONS visible (blank page, settings screen, profile page):
   return {"transactions": []}.

7. Numbers: parse "1.500.000,00" (Indonesian), "1,500,000.00" (US), "Rp35.000",
   "-$160.57" all correctly into plain numeric form. NO thousand separators
   in output.

8. Skip non-transaction rows: "SALDO AWAL", "SALDO AKHIR", "Total Pemasukan",
   header rows, balance summaries.

9. Don't invent fields. If merchant/category not visible → null.

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

### JSON parsing & field mapping

```python
def _parse_vision_response(raw: str) -> list[dict]:
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError:
        return []
    items = obj.get("transactions", [])
    return items if isinstance(items, list) else []
```

Mapping per item ke ParsedRow:

| Vision JSON field | ParsedRow field | Validasi |
|-------------------|-----------------|----------|
| `date` (str) | `transaction_date` | `date.fromisoformat()`. Fail → skip row |
| `time` (str or null) | (di-merge ke `raw_text`) | Optional |
| `amount` (number) | `amount` | `Decimal(str(amount))`. Fail atau == 0 → skip row |
| `currency` (str) | `currency` | ∈ {"IDR","USD"} else default "IDR" |
| `merchant` (str or null) | `merchant_name` | Strip; empty/None → None |
| `description` (str) | `description` | Required; empty → skip row |
| `bank_category` (str or null) | `category` | Pass-through. Service layer existing run `categorize_rule_based()` di atasnya kalau None |
| (counter) | `line_no` | Increment per valid row, 1-indexed |
| (calc) | `confidence_score` | See Confidence scoring section |
| (calc) | `raw_text` | `json.dumps(item, ensure_ascii=False)` |

### Error handling & retry

**3 layer protection (urutan):**

1. **Image validation fail** (size/format/empty): return `[]` immediately. Log warning. Service.py akan set job status `review` dengan 0 rows.

2. **Groq API fail** (timeout/5xx/429 rate limit): retry **sekali** dengan exponential backoff (2 detik). Kalau retry juga fail: raise exception. Service.py catch → job status `failed` dengan `error_message` truncated to 500 chars.

3. **Bad JSON response** dari LLM (parse error atau missing `transactions` key): retry **sekali** dengan modified user_prompt prefix:
   ```
   "Your previous response could not be parsed as JSON. Output STRICT JSON
   only, matching the schema. No prose, no markdown fences."
   ```
   Kalau retry still fail: return `[]` (graceful — user lihat empty review screen, bisa coba upload ulang).

**Row-level validation fail tidak pernah fail seluruh job.** Skip invalid row, continue dengan sisanya. Log count di service layer.

**Skip conditions per row:**
- `date` tidak ada atau tidak valid ISO
- `amount` tidak ada, 0, atau gak bisa di-Decimal
- `description` kosong setelah strip

### Confidence scoring

Per-row, berdasarkan completeness field:

| Kondisi | Confidence |
|---------|-----------|
| `description` ada + `merchant` ada + `bank_category` ada + amount non-zero | `1.00` |
| `description` ada + `merchant` ada, `bank_category` null | `0.90` |
| `description` ada, `merchant` null | `0.80` |
| Description hanya 1 kata generic ("Transfer", "Bayar", "Top Up") | `0.65` |

Display threshold di review screen tetap existing: `>=0.8` OK / `0.5-0.8` warn / `<0.5` err.

Tidak ada "image-level confidence" — confidence is per-row. Vision LLM self-assessment tidak reliable enough.

### Dependencies

**Existing (no change):**
- `groq>=0.11.0,<1.0` — sudah di requirements.txt
- `pdfplumber>=0.11,<0.12` — sudah di requirements.txt (tidak dipakai langsung di Phase 1, tapi sudah ada untuk Phase 2)

**No new dependencies needed.** Base64 encoding pakai stdlib `base64`. JSON parsing pakai stdlib `json`.

### Config changes

**`backend/.env.example`** (tidak commit `.env` real):
- Update default: `GROQ_VISION_MODEL=llama-3.2-90b-vision-preview`
- Tambah doc comment: "Use 11b variant if 90b deprecated or rate-limited"

**No alembic migration needed** (tidak ada schema change).

**No frontend change needed** (sudah pre-wired untuk `source_type=image_vision`).

## Testing strategy

### Unit tests (mocked Groq) — `tests/test_image_vision_parser.py`

Mock `vision_complete()` to return predefined JSON strings. Test parser logic in isolation:

- `test_parse_empty_bytes` → `[]`
- `test_parse_oversized_bytes` (11MB random) → `[]`
- `test_parse_wrong_magic_bytes` (PDF header) → `[]`
- `test_parse_valid_multi_row_response` → 3 rows extracted correctly
- `test_parse_valid_single_tx_response` → 1 row
- `test_parse_empty_transactions_array` → `[]`
- `test_parse_malformed_json` → `[]` (after 1 retry mock also returns garbage)
- `test_parse_skips_row_invalid_date`
- `test_parse_skips_row_invalid_amount`
- `test_parse_skips_row_empty_description`
- `test_parse_currency_default_idr_when_missing`
- `test_parse_currency_invalid_value_defaults_idr`
- `test_parse_confidence_full_row` → 1.00
- `test_parse_confidence_missing_merchant` → 0.80
- `test_parse_confidence_missing_category` → 0.90
- `test_parse_raw_text_preserves_original_json`
- `test_parse_groq_api_exception_retries_once`
- `test_parse_groq_retry_also_fails_raises`

### Integration tests (real Groq) — `tests/test_image_vision_live.py`

Gated by `pytest.mark.skipif(os.getenv("VISION_TEST_LIVE") != "1" or not GROQ_API_KEY)`.

- `test_live_dana_list` — load `dana-list-1.jpeg`, assert ≥8 rows, all currency=IDR, mix of positive/negative amounts
- `test_live_gopay_detail` — load `gopay-detail-1.jpeg`, assert exactly 1 row, amount negative, merchant contains "Xsolla"
- `test_live_pluang_assets` — load `pluang-assets-1.jpeg`, assert mixed currencies (some IDR, some USD), "Failed" rows excluded
- `test_live_pluang_balance` — load `pluang-balance-1.jpeg`, assert ≥7 rows
- `test_live_shopeepay_list` — load `shopeepay-list-2.jpeg`, assert all rows amount negative (all "Terkirim")
- `test_live_mybca_statement` — load `mybca-statement.jpeg`, assert "SALDO AWAL" tidak masuk sebagai row, semua "DB" rows negative, semua row tanpa DB suffix positive

Live tests run manual (saya yang trigger) atau di staging environment dengan Groq quota terpisah. Tidak masuk default CI run.

### Edge cases yang explicitly covered

- Empty file bytes
- File too big (>10MB)
- Wrong format (PDF input)
- LLM returns invalid JSON (after retry fail)
- LLM returns valid JSON tapi missing `transactions` key
- Row dengan date invalid → skipped, others kept
- Row dengan amount = 0 → skipped (LLM likely missed)
- Mixed currency dalam 1 image → per-row currency preserved
- Single-tx detail view → array of 1 returned correctly
- Empty array (image tanpa tx) → `[]` returned, job goes to review with 0 rows

## Verification (post-implementation)

Yang saya jalankan di main session setelah agent selesai:

1. `pytest tests/test_image_vision_parser.py -v` — semua unit pass
2. `pytest tests/ -v` — no regression (82 existing tests + new harus stay green)
3. `pnpm exec tsc --noEmit` — frontend masih clean
4. **Live smoke test** dengan real Groq:
   - Start uvicorn (kalau belum)
   - Register/use smoke test user
   - Upload `dana-list-1.jpeg` via `/v1/import/upload` dengan `source_type=image_vision`
   - Poll until status `review`
   - Inspect rows_total, sample 3 rows, verify reasonable
   - Repeat untuk 1 single-tx detail (gopay) dan 1 e-statement (mybca)

## Out of scope (future phases)

- PDF input handling (Phase 2 — dispatcher + rasterizer for BCA/Mandiri/Permata)
- Smart Import Dispatcher (Phase 2 — MIME sniff + content signature routing)
- Frontend redesign (Phase 3 — 1 dropzone, optional platform tag)
- Pluang CSV parser (separate extension on ManualCsvParser or new csv_pluang)
- FX rate conversion (USD → IDR) — leave raw, user concern
- Capture transaction time as structured field (currently in raw_text only)
- Multi-image batch upload in 1 ImportJob
- Platform-specific prompt tuning (single generic prompt for Phase 1)
- LLM-based row deduplication (rely on existing duplicate-check in service.py)
