# Smart Import Dispatcher — Design (Phase 2)

**Status:** Draft, pending implementation
**Date:** 2026-05-12
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch target:** `bugfix` (current) or new `feat/smart-dispatcher`

---

## Context

FinanceAI import pipeline saat ini menggunakan `source_type` value (dari frontend tile selection) sebagai routing key — `service.py:process_job` call `get_parser(job.source_type.value)` untuk pick parser. Ini brittle: kalau user pilih tile "BCA" tapi upload CSV, parser-nya (`pdf_bca` stub) raise NotImplementedError dan job langsung fail.

Phase 1 (selesai 2026-05-12, commit `39963e4`) ship `ImageVisionParser` yang handle screenshot. Phase 2 mengubah routing dari **platform-keyed** ke **content-based**: backend sniff MIME + content signature dari file bytes, lalu pilih parser yang tepat — terlepas dari `source_type` value yang user pilih.

Sample yang user drop di session sebelumnya menunjukkan finding penting: **Mandiri & Permata PDFs di sample adalah image-only PDFs** (di-convert via iLovePDF, text layer kosong: `text_len=0`, `words=0`). Routing logic-nya jadi clean: PDF dengan text layer + BNI signature → `PdfBniParser`; semua PDF lain (termasuk image-only) → rasterize per halaman → `ImageVisionParser`.

Phase 2 ship-able standalone. Phase 3 (frontend `/import` redesign — collapse 15 tiles ke 1 dropzone) ada di top untuk follow-up.

## Goals

1. Replace `source_type`-based routing dengan **content-based routing** di `service.py`.
2. Build `dispatcher.py` module — single function `dispatch(file_bytes) → Parser` yang sniff format + return parser instance.
3. Build `PdfVisionParser` — wrap PyMuPDF page rasterization + delegate to existing `ImageVisionParser` per halaman. Multi-page → concat rows.
4. Build shared `sniff.py` — MIME detection via magic bytes + BNI signature detection via pdfplumber text peek.
5. No schema change, no frontend change, no `source_type` enum change. Backward compatible.
6. Graceful error handling: corrupt PDF → return empty rows, page-level isolation (1 page fail doesn't fail whole job), unsupported format → job failed with clear message.

## Non-goals

- **Excel support (.xlsx/.xls)** — deferred to Phase 4 (separate scope: openpyxl dependency + magic byte detection + xlsx→CSV adapter).
- **Pluang CSV adapter** (rich 21-column transaction report) — deferred to Phase 4. Sample present di `backend/tests/fixtures/vision/invest/pluang-transaction-report.csv`.
- **Frontend changes** — Phase 3 scope. Frontend tetap kirim `source_type`, backend ignore for routing tapi tetap store di `ImportJob.source_type` untuk audit/display.
- **Per-bank text PDF parsers (BCA/Mandiri text-based)** — won't build. Vision via rasterize handles all non-BNI PDFs.
- **`get_parser()` removal** — keep for now (tests use it for direct parser lookup). Mark deprecated, remove in future cleanup phase.
- **Schema migration** — `source_type` enum tidak diubah. `auto` value tidak ditambah (frontend tetap kirim platform values).
- **CSV magic-byte enhancement** — heuristic-based detection cukup untuk MVP; iterate kalau ada false-positive nyata.

## Sample Analysis (Findings dari inspect 2026-05-12)

**Mandiri & Permata PDFs di fixtures:** image-only (no text layer).

| File | Pages | Text len | Words | Images | Producer |
|------|-------|----------|-------|--------|----------|
| `mandiri/mandiri-statement.pdf` | 3 | 0 | 0 | 1 full-page | iLovePDF |
| `permata/permatabank-statement.pdf` | 2 | 0 | 0 | 1 full-page | iLovePDF |
| `bni/bni-2025-10.pdf` | 5 | 1388 | 219 | 2 (logo) | PDFium |

**Implication:** routing tidak bisa rely on text content untuk non-BNI banks. Dispatcher harus check BNI signature DULU (sebelum fallback ke vision rasterize). Kalau text layer empty atau BNI signature absent → rasterize semua halaman → vision.

## Design

### Architecture & file structure

```
backend/app/import_data/
├── dispatcher.py            (NEW: dispatch(file_bytes) → Parser, UnsupportedFileType exception)
├── parsers/
│   ├── base.py              (UNCHANGED: registry tetap untuk direct lookup di tests)
│   ├── sniff.py             (NEW: sniff_mime(), _looks_like_csv(), has_bni_signature())
│   ├── image_vision.py      (UNCHANGED)
│   ├── pdf_bni.py           (UNCHANGED)
│   ├── pdf_vision.py        (NEW: PdfVisionParser — rasterize multi-page → delegate to ImageVisionParser)
│   ├── manual_csv.py        (UNCHANGED)
│   └── __init__.py          (UNCHANGED — pdf_vision imported directly by dispatcher, no @register decorator needed)
└── service.py               (MODIFY: line 175 replace get_parser(source_type) with dispatch(file_bytes))
```

**Separation of concerns:**
- `dispatcher.py` — pure routing logic. No I/O beyond peeking at file bytes.
- `sniff.py` — utility detection functions, no state, no parser dependencies.
- `PdfVisionParser` — wraps PDF rasterization + delegates per-page to existing `ImageVisionParser` via composition. Same `parse(file_bytes)` contract as other parsers.
- `service.py` — replaces 1 line. No new logic added; failure handling for `UnsupportedFileType` wraps the dispatch call.

### `sniff_mime()` detection logic

```python
def sniff_mime(file_bytes: bytes) -> str | None:
	"""Magic-byte MIME detection. Returns None kalau format tidak dikenal."""
	if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
		return "image/png"
	if file_bytes[:3] == b"\xff\xd8\xff":
		return "image/jpeg"
	if file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
		return "image/webp"
	if file_bytes[:5] == b"%PDF-":
		return "application/pdf"
	if _looks_like_csv(file_bytes):
		return "text/csv"
	return None
```

**CSV heuristic (`_looks_like_csv`):**
1. Try decode as UTF-8 / utf-8-sig. Kalau fail → return False.
2. Check first 5 KB punya minimal 1 newline character.
3. Detect delimiter by counting `,`, `;`, `\t`, `|` di first line. Pick yang terbanyak (kalau > 0).
4. (Optional bolt-on) Check 2-3 lines berikutnya punya jumlah delimiter konsisten (±1).

False-positive ringan acceptable — kalau `.txt` non-CSV file di-route ke `ManualCsvParser`, parser-nya lenient dan return empty atau few-row noise. User lihat review screen kosong, paham.

**BNI signature detection (`has_bni_signature`):**
```python
def has_bni_signature(file_bytes: bytes) -> bool:
	"""Open PDF, peek page 1 text, return True kalau match BNI marker."""
	try:
		with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
			if not pdf.pages:
				return False
			text = (pdf.pages[0].extract_text() or "").lower()
	except Exception:
		return False
	# BNI e-Statement always has "Laporan Mutasi Rekening" + "wondr" or "BNI" branding.
	if "laporan mutasi rekening" not in text:
		return False
	return "wondr" in text or " bni " in f" {text} "
```

Note: " bni " dengan spasi di kedua sisi untuk hindari false-positive di "BNIDAGANG" atau merchant names yang kebetulan punya substring "bni". Comparison lowercase.

### Dispatcher API

```python
class UnsupportedFileType(Exception):
	"""Raised kalau file format tidak bisa di-route ke parser manapun."""
	pass


def dispatch(file_bytes: bytes) -> Parser:
	"""Pick parser based on file content. Pure routing — no business logic."""
	if not file_bytes:
		raise UnsupportedFileType("Empty file")

	mime = sniff_mime(file_bytes)

	if mime in ("image/png", "image/jpeg", "image/webp"):
		return ImageVisionParser()
	if mime == "application/pdf":
		if has_bni_signature(file_bytes):
			return PdfBniParser()
		return PdfVisionParser()
	if mime == "text/csv":
		return ManualCsvParser()
	raise UnsupportedFileType(
		f"Unrecognized file format (mime sniff returned {mime!r})"
	)
```

### `service.py` integration

Single-line change at line 175 in `process_job`:

```python
# Before:
parser = get_parser(job.source_type.value)
parsed = parser.parse(file_bytes)

# After:
try:
	parser = dispatch(file_bytes)
	parsed = parser.parse(file_bytes)
except UnsupportedFileType as exc:
	job.status = ImportJobStatus.failed
	job.error_message = str(exc)[:500]
	await session.commit()
	return
```

`job.source_type` tetap disimpan dari saat upload untuk audit & display. `get_parser()` di `base.py` tidak dihapus — tetap berguna untuk unit tests yang ingin instantiate specific parser tanpa lewat dispatcher.

### `PdfVisionParser` implementation

```python
import io
import fitz  # pymupdf

from app.import_data.parsers.base import ParsedRow
from app.import_data.parsers.image_vision import ImageVisionParser


class PdfVisionParser:
	"""Rasterize multi-page PDF, parse each page via ImageVisionParser, concat rows."""

	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		try:
			doc = fitz.open(stream=file_bytes, filetype="pdf")
		except Exception:
			return []

		image_parser = ImageVisionParser()
		all_rows: list[ParsedRow] = []
		next_line_no = 1

		try:
			for page in doc:
				try:
					pix = page.get_pixmap(dpi=150)
					png_bytes = pix.tobytes("png")
				except Exception:
					# Page-level rasterize fail — skip page, continue
					continue
				try:
					page_rows = image_parser.parse(png_bytes)
				except Exception:
					# Page-level vision call fail — skip page, continue
					continue
				for row in page_rows:
					row.line_no = next_line_no
					next_line_no += 1
					all_rows.append(row)
		finally:
			doc.close()

		return all_rows
```

**Design decisions:**

- **DPI = 150**: balance antara quality dan file size. 300 DPI menghasilkan PNG yang sangat besar (>5MB per halaman, melebihi 10MB limit di ImageVisionParser). 72 DPI terlalu rendah, vision LLM miss small text. 150 DPI sweet spot — A4 page = ~1240×1750 px, typical PNG ~1-2 MB (well within limit). High-color/heavy-imagery statements could push closer to 10MB; agent should add a warning log + fallback to JPEG 95% kualitas kalau PNG > 8 MB selama implementation kalau muncul.
- **PNG output (lossless)**: digits & small text di statement penting. JPEG compression bisa hilangkan akurasi angka kecil. Trade-off bandwidth diterima.
- **Per-page composition**: `PdfVisionParser` instantiate `ImageVisionParser` sekali, lalu loop. Tidak duplicate vision call logic, tidak duplicate retry logic — semua reuse Phase 1 work.
- **Page-level isolation**: error di 1 halaman tidak abort entire job. Statement 5 halaman di mana halaman 3 corrupt → masih dapat 4 halaman worth of rows.
- **`row.line_no` reassignment**: `ImageVisionParser` mengembalikan `line_no` 1-indexed per call. Setelah concat, kita renumber global supaya konsisten.
- **No `@register` decorator**: `PdfVisionParser` di-instantiate langsung oleh dispatcher, tidak via `get_parser()` lookup. Tidak ada `ImportSourceType` enum value untuk parser ini.

### Error handling matrix

| Failure mode | Behavior |
|--------------|----------|
| Empty file bytes | `UnsupportedFileType("Empty file")` → job status `failed` dengan error message |
| Magic bytes tidak dikenal | `UnsupportedFileType(...)` → job failed |
| PDF corrupt (PyMuPDF can't open) | `PdfVisionParser.parse()` return `[]` → job goes to `review` dengan 0 rows |
| BNI signature detection crash (pdfplumber error) | `has_bni_signature()` catches & returns False → route ke `PdfVisionParser` |
| Per-page rasterize crash | Skip that page, log warning, continue dengan halaman lain |
| Per-page vision call crash (Groq API down after retry) | Skip that page, continue |
| ImageVisionParser per-page returns `[]` | Acceptable — page mungkin halaman kosong atau header-only |
| CSV heuristic false-positive (text file but not CSV) | Route to `ManualCsvParser` → returns `[]` atau few-row noise → user lihat empty review |

**Page-level isolation philosophy:** lebih baik partial result yang user bisa konfirmasi/edit daripada full fail. Service layer existing duplicate-check + manual edit di review screen akan handle noise.

### Dependencies

**Tambah ke `backend/requirements.txt`:**
```
pymupdf>=1.24,<2.0
```

PyMuPDF adalah pure Python wheel, no system deps (no Poppler, no ImageMagick). Compatible dengan Docker deploy yang sudah ada.

**No new deps untuk:**
- Pillow (sudah transitive dari pdfplumber)
- Magic byte detection (manual implementation di `sniff.py`)
- Async/event-loop concerns (`PdfVisionParser` sync, sama seperti parser lain)

**Excel dependency (openpyxl) NOT added** — deferred ke Phase 4.

### Testing strategy

**Unit tests (mocked) — `tests/test_dispatcher.py` (new):**

- `test_sniff_mime_png` / `jpeg` / `webp` / `pdf` — recognize each magic byte
- `test_sniff_mime_unknown` — random bytes → None
- `test_sniff_mime_empty` — empty bytes → None
- `test_looks_like_csv_with_comma` / `with_semicolon` / `with_tab` / `with_pipe`
- `test_looks_like_csv_rejects_no_newline`
- `test_looks_like_csv_rejects_no_delimiter`
- `test_looks_like_csv_rejects_binary`
- `test_has_bni_signature_positive` — mock pdfplumber to return BNI text
- `test_has_bni_signature_no_match` — text tanpa BNI markers
- `test_has_bni_signature_empty_text` — image-only PDF (text=0) → False
- `test_has_bni_signature_pdfplumber_error` — pdfplumber raises → False
- `test_dispatch_png_returns_image_vision`
- `test_dispatch_jpeg_returns_image_vision`
- `test_dispatch_webp_returns_image_vision`
- `test_dispatch_pdf_with_bni_signature_returns_pdf_bni` — mock has_bni_signature → True
- `test_dispatch_pdf_without_bni_signature_returns_pdf_vision` — mock → False
- `test_dispatch_csv_returns_manual_csv`
- `test_dispatch_empty_raises_unsupported`
- `test_dispatch_unknown_format_raises_unsupported`

**Unit tests (mocked) — `tests/test_pdf_vision_parser.py` (new):**

- `test_parse_corrupted_pdf_returns_empty` — random bytes → `[]`, no exception
- `test_parse_concats_rows_from_multiple_pages` — mock fitz to return 3 pages, mock image_parser to return [1 row, 2 rows, 1 row] → 4 total rows
- `test_parse_renumbers_line_no_globally` — page 1 line_no=[1], page 2 line_no=[1,2] → output line_no=[1,2,3]
- `test_parse_skips_page_on_rasterize_failure` — mock page.get_pixmap to raise on page 2 → skip page 2, keep pages 1+3
- `test_parse_skips_page_on_vision_failure` — mock image_parser.parse to raise on page 2 → skip, keep others
- `test_parse_empty_pdf_returns_empty` — fitz.open succeeds but doc has 0 pages

**Service-level integration — `tests/test_import.py` (modify, add cases):**

- `test_dispatcher_routes_uploaded_pdf_to_correct_parser` — upload BNI PDF, assert mocked PdfBniParser called (not PdfVisionParser)
- `test_dispatcher_unsupported_format_marks_job_failed` — upload random bytes, assert status=failed dengan error_message berisi "Unrecognized"

**Live integration tests — `tests/test_dispatcher_live.py` (new, gated dengan `VISION_TEST_LIVE=1`):**

- `test_live_mandiri_pdf_via_rasterize_vision` — load `mandiri-statement.pdf`, dispatch → PdfVisionParser, expect ≥3 rows (3 pages with content)
- `test_live_permata_pdf_via_rasterize_vision` — load `permatabank-statement.pdf`, expect ≥2 rows
- `test_live_bni_pdf_routes_to_text_parser` — load `bni-2025-10.pdf`, assert PdfBniParser used (no Groq call), 57 rows
- `test_live_dana_image_routes_to_vision` — load `vision/ewallet/dana-list-1.jpeg`, expect ≥5 rows

**Live test cost:** 1 BNI (no Groq) + 1 Dana (1 Groq) + 3 Mandiri pages (3 Groq) + 2 Permata pages (2 Groq) = **6 Groq vision calls per full live run**.

### Test fixtures

Semua sudah present (gitignored):
- `backend/tests/fixtures/bni/bni-2025-10.pdf` (text-based BNI)
- `backend/tests/fixtures/mandiri/mandiri-statement.pdf` (image-only PDF, 3 pages)
- `backend/tests/fixtures/permata/permatabank-statement.pdf` (image-only PDF, 2 pages)
- `backend/tests/fixtures/vision/ewallet/dana-list-1.jpeg` (multi-row e-wallet)

No additional fixtures needed for Phase 2.

## Verification (post-implementation)

Yang saya jalankan di main session setelah agent selesai:

1. `cd backend && venv/bin/pytest tests/ -v` — full suite passes, no regression
2. `cd backend && venv/bin/pytest tests/test_dispatcher.py tests/test_pdf_vision_parser.py -v` — Phase 2 unit tests pass
3. `cd frontend && pnpm exec tsc --noEmit` — frontend masih clean (tidak ada perubahan)
4. **Live integration**: set `VISION_TEST_LIVE=1`, run `pytest tests/test_dispatcher_live.py -v` — semua pass; eyeball Mandiri & Permata extraction quality
5. **Live HTTP smoke** end-to-end:
   - Start uvicorn (kalau belum)
   - Register/use smoke user
   - Upload `mandiri-statement.pdf` dengan `source_type=pdf_mandiri` (sengaja salah-ish: tile sebut Mandiri, dispatcher route lewat content)
   - Poll until `review`
   - Verify rows extracted dengan reasonable count

## Out of scope (future phases)

- **Excel support (.xlsx, .xls)** — Phase 4
- **Pluang CSV adapter** (rich 21-column report) — Phase 4
- **Frontend `/import` redesign** (collapse tiles to 1 dropzone) — Phase 3
- **Per-bank text-based PDF parsers (BCA/Mandiri text-based)** — won't build, vision handles
- **Drop `get_parser()` & `@register` decorators** — Phase 5 cleanup
- **MIME content-type from HTTP upload header** — IGNORED for security/correctness. Always sniff magic bytes from bytes.
- **Filename-based detection** — IGNORED. Magic bytes lebih reliable daripada extension.
- **Multi-image upload in 1 ImportJob** (zip of images) — out of scope, may revisit Phase 4
- **PDF rasterize DPI auto-tuning per page size** — DPI fixed at 150, iterate kalau ada quality issue muncul
