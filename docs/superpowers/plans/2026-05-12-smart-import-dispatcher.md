# Smart Import Dispatcher Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `source_type`-based parser routing with content-based routing — build `dispatcher.py` + `sniff.py` + `PdfVisionParser` so that uploads are routed by sniffing MIME + (for PDFs) BNI signature, with non-BNI PDFs rasterized per-page via PyMuPDF and delegated to existing `ImageVisionParser`.

**Architecture:** New `dispatcher.py` module exposes `dispatch(file_bytes) → Parser`. `sniff.py` does magic-byte MIME detection + BNI text signature check. `PdfVisionParser` wraps PyMuPDF rasterize + composes `ImageVisionParser` per page (line_no renumbered globally). `service.py:process_job` swaps `get_parser(source_type)` for `dispatch(file_bytes)` — single-line change. `source_type` enum unchanged, frontend unchanged, schema unchanged.

**Tech Stack:** Python 3.12, PyMuPDF (`pymupdf` package, import as `fitz`), pdfplumber (existing — for BNI signature peek), pytest with `unittest.mock` mocking.

**Spec reference:** `docs/superpowers/specs/2026-05-12-smart-import-dispatcher-design.md`

**Commit policy (project memory override):** Agent does NOT commit per task. Run tests at end of each task and verify green. The PM (main session) will do ONE final commit after full verification, format `feat: smart import dispatcher` (no scope, no co-author trailer). Agent must never run `git commit` or `git push`.

**Working directory:** `/Users/bagusdeva/Documents/Personal Projects/smart-finance`. Backend venv: `backend/venv/bin/python`, `backend/venv/bin/pytest`, `backend/venv/bin/pip`.

**Test fixtures (already present, gitignored):**
- `backend/tests/fixtures/bni/bni-2025-10.pdf` (text-based BNI, 5 pages)
- `backend/tests/fixtures/mandiri/mandiri-statement.pdf` (image-only PDF, 3 pages, iLovePDF Producer)
- `backend/tests/fixtures/permata/permatabank-statement.pdf` (image-only PDF, 2 pages, iLovePDF Producer)
- `backend/tests/fixtures/vision/ewallet/dana-list-1.jpeg` (8 tx multi-row list)

**Indentation:** TAB (not spaces) for Python files. Reference existing parsers (`pdf_bni.py`, `image_vision.py`) for style.

**Test environment:** Pytest auto-bootstraps schema from `Base.metadata` against `financeai_test` DB. No alembic migration needed for tests.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `backend/requirements.txt` | MODIFY | Add `pymupdf>=1.24,<2.0` line |
| `backend/app/import_data/parsers/sniff.py` | CREATE | `sniff_mime()`, `_looks_like_csv()`, `has_bni_signature()` — pure utility functions |
| `backend/app/import_data/parsers/pdf_vision.py` | CREATE | `PdfVisionParser` class — rasterize + delegate to `ImageVisionParser` per page |
| `backend/app/import_data/dispatcher.py` | CREATE | `dispatch()` function + `UnsupportedFileType` exception |
| `backend/app/import_data/service.py` | MODIFY (1 line in `process_job`) | Replace `get_parser(source_type)` with `dispatch(file_bytes)` |
| `backend/tests/test_sniff.py` | CREATE | Unit tests for sniff module |
| `backend/tests/test_pdf_vision_parser.py` | CREATE | Unit tests for PdfVisionParser (mocked fitz + ImageVisionParser) |
| `backend/tests/test_dispatcher.py` | CREATE | Unit tests for dispatcher routing |
| `backend/tests/test_dispatcher_live.py` | CREATE | Live integration tests (gated by `VISION_TEST_LIVE=1`) |

---

## Task 1: Add PyMuPDF dependency

Goal: install `pymupdf` (imports as `fitz`) into venv and lock to requirements.txt.

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Read current requirements.txt to find insertion point**

```bash
cat /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/requirements.txt | grep -n "pdfplumber"
```

Expected: shows `pdfplumber>=0.11,<0.12` line with its line number. We'll add `pymupdf` right after it (PDF-related deps grouped).

- [ ] **Step 2: Add pymupdf line to requirements.txt**

Use Edit tool on `backend/requirements.txt`. Find the line:

```
pdfplumber>=0.11,<0.12
```

Replace with:

```
pdfplumber>=0.11,<0.12
pymupdf>=1.24,<2.0
```

- [ ] **Step 3: Install in venv**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pip install "pymupdf>=1.24,<2.0"
```

Expected: install completes successfully. Output ends with `Successfully installed pymupdf-X.Y.Z` (X.Y.Z ≥ 1.24).

- [ ] **Step 4: Verify import works**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/python -c "
import fitz
print('pymupdf version:', fitz.__version__)
# Sanity check: open one of the fixture PDFs
doc = fitz.open('tests/fixtures/bni/bni-2025-10.pdf')
print(f'BNI PDF pages: {len(doc)}')
pix = doc[0].get_pixmap(dpi=150)
print(f'Page 1 rasterized: {pix.width}x{pix.height} px')
doc.close()
"
```

Expected output: shows version + `BNI PDF pages: 5` + `Page 1 rasterized: ~1240x1750 px` (dimensions may vary by ~10px). If any error: stop and report.

- [ ] **Step 5: Confirm no test regression**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -5
```

Expected: existing 123 passed + 5 skipped (Phase 1 baseline). No new failures introduced by the dependency.

---

## Task 2: Build `sniff.py` with TDD

Goal: pure utility functions for MIME detection + BNI signature peek. No parser dependencies.

**Files:**
- Create: `backend/app/import_data/parsers/sniff.py`
- Create: `backend/tests/test_sniff.py`

- [ ] **Step 1: Write failing tests for sniff_mime**

Create `backend/tests/test_sniff.py`:

```python
"""Tests untuk sniff.py — MIME detection + BNI signature.

Pure unit tests dengan synthetic inputs. Tidak panggil Groq atau pdfplumber
beneran kecuali via mock.
"""

import pytest

# Magic byte prefixes for testing
PNG_HEADER = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG_HEADER = b"\xff\xd8\xff" + b"\x00" * 16
WEBP_HEADER = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 8
PDF_HEADER = b"%PDF-1.4\n%mock content"


# ---------- sniff_mime ----------

def test_sniff_mime_png():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(PNG_HEADER) == "image/png"


def test_sniff_mime_jpeg():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(JPEG_HEADER) == "image/jpeg"


def test_sniff_mime_webp():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(WEBP_HEADER) == "image/webp"


def test_sniff_mime_pdf():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(PDF_HEADER) == "application/pdf"


def test_sniff_mime_csv():
	from app.import_data.parsers.sniff import sniff_mime
	csv = b"date,amount,description\n2026-01-01,1000,test\n"
	assert sniff_mime(csv) == "text/csv"


def test_sniff_mime_empty_returns_none():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(b"") is None


def test_sniff_mime_unknown_binary_returns_none():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(b"\x00\x01\x02\x03random binary") is None


# ---------- _looks_like_csv ----------

def test_looks_like_csv_with_comma():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a,b,c\n1,2,3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_semicolon():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a;b;c\n1;2;3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_tab():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a\tb\tc\n1\t2\t3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_pipe():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a|b|c\n1|2|3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_bom():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"\xef\xbb\xbfdate,amount\n2026-01-01,100\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_rejects_no_newline():
	from app.import_data.parsers.sniff import _looks_like_csv
	assert _looks_like_csv(b"a,b,c") is False


def test_looks_like_csv_rejects_no_delimiter():
	from app.import_data.parsers.sniff import _looks_like_csv
	# Plain text with newlines but no delimiters → not CSV
	assert _looks_like_csv(b"plain text\nmore plain text\n") is False


def test_looks_like_csv_rejects_binary():
	from app.import_data.parsers.sniff import _looks_like_csv
	assert _looks_like_csv(b"\x00\x01\x02\xff\xfe\xfd") is False


def test_looks_like_csv_handles_crlf_only():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a,b,c\r\n1,2,3\r\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_handles_cr_only():
	from app.import_data.parsers.sniff import _looks_like_csv
	# Excel-on-Mac convention
	csv = b"a,b,c\r1,2,3\r"
	assert _looks_like_csv(csv) is True


# ---------- has_bni_signature ----------

def test_has_bni_signature_positive(monkeypatch):
	"""Mock pdfplumber to return BNI marker text."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = (
		"Laporan Mutasi Rekening\nPeriode: 1 - 31 Oktober 2025\n"
		"wondr by BNI"
	)
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is True


def test_has_bni_signature_with_bni_word(monkeypatch):
	"""BNI marker via ' BNI ' (with spaces) instead of 'wondr'."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = (
		"Laporan Mutasi Rekening\nPT Bank Negara Indonesia "
		"transferred via BNI Internet Banking"
	)
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is True


def test_has_bni_signature_no_marker(monkeypatch):
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = "BCA mutasi statement\nperiode 2026"
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_empty_text(monkeypatch):
	"""Image-only PDF: extract_text returns empty string."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = ""
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_none_text(monkeypatch):
	"""extract_text returns None (some PDFs cause this)."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = None
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_no_pages(monkeypatch):
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_pdf = MagicMock()
	mock_pdf.pages = []
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_pdfplumber_raises(monkeypatch):
	"""Corrupted PDF: pdfplumber.open raises → return False."""
	from app.import_data.parsers import sniff

	def _raise(*a, **kw):
		raise ValueError("corrupted pdf")
	monkeypatch.setattr(sniff.pdfplumber, "open", _raise)
	assert sniff.has_bni_signature(b"%PDF garbage") is False


def test_has_bni_signature_avoids_false_positive_on_substring(monkeypatch):
	"""Text contains 'BNIDAGANG' (not 'BNI' as standalone word) should NOT match."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = "BCA statement\nmerchant: BNIDAGANGSEJAHTERA"
	# Missing "Laporan Mutasi Rekening" so this would already fail at first check,
	# but assert the explicit case.
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_sniff.py -v
```

Expected: All tests fail with `ModuleNotFoundError: No module named 'app.import_data.parsers.sniff'`.

- [ ] **Step 3: Create `sniff.py` with full implementation**

Create `backend/app/import_data/parsers/sniff.py`:

```python
"""MIME detection + BNI signature peek — pure utilities for dispatcher.

sniff_mime: magic-byte detection (PNG/JPEG/WebP/PDF) + CSV heuristic.
has_bni_signature: open PDF with pdfplumber, check page 1 text for BNI markers.

Tidak depend ke parser classes (penghindaran circular import). Dispatcher
yang nge-link sniff result ke parser.
"""

import io

import pdfplumber


def sniff_mime(file_bytes: bytes) -> str | None:
	"""Magic-byte MIME detection. Returns None kalau format tidak dikenal."""
	if not file_bytes:
		return None
	if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
		return "image/png"
	if file_bytes[:3] == b"\xff\xd8\xff":
		return "image/jpeg"
	if len(file_bytes) >= 12 and file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
		return "image/webp"
	if file_bytes[:5] == b"%PDF-":
		return "application/pdf"
	if _looks_like_csv(file_bytes):
		return "text/csv"
	return None


def _looks_like_csv(file_bytes: bytes) -> bool:
	"""Heuristic: decodes as UTF-8, has line breaks, first line has delimiter."""
	sample = file_bytes[:5120]
	try:
		text = sample.decode("utf-8-sig")
	except UnicodeDecodeError:
		try:
			text = sample.decode("utf-8")
		except UnicodeDecodeError:
			return False

	# Must have line breaks (any flavor).
	if "\n" not in text and "\r" not in text:
		return False

	# Find first non-empty line (handle CR, LF, CRLF).
	normalized = text.replace("\r\n", "\n").replace("\r", "\n")
	lines = [l for l in normalized.split("\n") if l]
	if not lines:
		return False
	first_line = lines[0]

	# Must have at least one common delimiter on the first line.
	delim_counts = {d: first_line.count(d) for d in (",", ";", "\t", "|")}
	return max(delim_counts.values()) > 0


def has_bni_signature(file_bytes: bytes) -> bool:
	"""Open PDF, peek page 1 text, return True kalau match BNI marker.

	BNI e-Statement (PDFium-generated via wondr app) selalu punya:
	- "Laporan Mutasi Rekening" header
	- Branding "wondr" atau " BNI " (with word boundaries)

	Defensive: kalau pdfplumber error atau text kosong (image-only PDF) → False.
	"""
	try:
		with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
			if not pdf.pages:
				return False
			raw = pdf.pages[0].extract_text() or ""
			text = raw.lower()
	except Exception:
		return False
	if "laporan mutasi rekening" not in text:
		return False
	# Use space-padded match for " bni " to avoid substring false-positives
	# like "BNIDAGANG" or merchant names containing "bni".
	padded = f" {text} "
	return "wondr" in text or " bni " in padded
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_sniff.py -v
```

Expected: All ~26 tests pass.

- [ ] **Step 5: Confirm no regression**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -5
```

Expected: 123 baseline + ~26 new = ~149 passed, 5 skipped.

---

## Task 3: Build `PdfVisionParser` with TDD

Goal: parser yang rasterize PDF per halaman + delegate ke ImageVisionParser. Same `parse(bytes) → list[ParsedRow]` contract.

**Files:**
- Create: `backend/app/import_data/parsers/pdf_vision.py`
- Create: `backend/tests/test_pdf_vision_parser.py`

- [ ] **Step 1: Write failing tests for PdfVisionParser**

Create `backend/tests/test_pdf_vision_parser.py`:

```python
"""Tests untuk PdfVisionParser.

Unit tests pakai mocked fitz + mocked ImageVisionParser supaya tidak
panggil Groq / tidak butuh real PDF. Live integration tests dipisah ke
test_dispatcher_live.py.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.import_data.parsers.base import ParsedRow


def _make_row(line_no: int, desc: str = "test") -> ParsedRow:
	return ParsedRow(
		line_no=line_no,
		transaction_date=date(2026, 1, 1),
		amount=Decimal("1000"),
		currency="IDR",
		merchant_name=None,
		description=desc,
		category=None,
		confidence_score=Decimal("0.90"),
		raw_text='{"date":"2026-01-01"}',
	)


def _setup_mocks(monkeypatch, num_pages: int, rows_per_page: list[list[ParsedRow]]):
	"""Mock fitz.open to return doc with N pages, and ImageVisionParser to
	return rows_per_page[i] for page i. Returns the captured call counts."""
	from app.import_data.parsers import pdf_vision

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
		return rows_per_page[i]
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)
	return call_idx


def test_pdf_vision_parse_corrupted_pdf_returns_empty(monkeypatch):
	from app.import_data.parsers import pdf_vision
	def _raise(**kw):
		raise ValueError("corrupted")
	monkeypatch.setattr(pdf_vision.fitz, "open", _raise)
	parser = pdf_vision.PdfVisionParser()
	assert parser.parse(b"garbage") == []


def test_pdf_vision_parse_empty_pdf_returns_empty(monkeypatch):
	from app.import_data.parsers import pdf_vision
	_setup_mocks(monkeypatch, num_pages=0, rows_per_page=[])
	parser = pdf_vision.PdfVisionParser()
	assert parser.parse(b"%PDF-1.4 mock") == []


def test_pdf_vision_parse_single_page(monkeypatch):
	from app.import_data.parsers import pdf_vision
	_setup_mocks(
		monkeypatch,
		num_pages=1,
		rows_per_page=[[_make_row(1, "row a"), _make_row(2, "row b")]],
	)
	parser = pdf_vision.PdfVisionParser()
	rows = parser.parse(b"%PDF-1.4 mock")
	assert len(rows) == 2
	assert rows[0].line_no == 1
	assert rows[1].line_no == 2
	assert rows[0].description == "row a"
	assert rows[1].description == "row b"


def test_pdf_vision_parse_concats_multiple_pages_with_global_line_no(monkeypatch):
	"""3 pages: page1 has 2 rows, page2 has 1 row, page3 has 3 rows → 6 total,
	line_no global 1..6."""
	from app.import_data.parsers import pdf_vision
	_setup_mocks(
		monkeypatch,
		num_pages=3,
		rows_per_page=[
			[_make_row(1, "p1r1"), _make_row(2, "p1r2")],
			[_make_row(1, "p2r1")],
			[_make_row(1, "p3r1"), _make_row(2, "p3r2"), _make_row(3, "p3r3")],
		],
	)
	parser = pdf_vision.PdfVisionParser()
	rows = parser.parse(b"%PDF-1.4 mock")
	assert len(rows) == 6
	# Verify global line_no renumber
	assert [r.line_no for r in rows] == [1, 2, 3, 4, 5, 6]
	# Verify description ordering preserved
	assert [r.description for r in rows] == ["p1r1", "p1r2", "p2r1", "p3r1", "p3r2", "p3r3"]


def test_pdf_vision_parse_skips_page_on_rasterize_failure(monkeypatch):
	"""Page 2 raises on get_pixmap → skipped, pages 1+3 still parsed."""
	from app.import_data.parsers import pdf_vision

	pages = []
	for i in range(3):
		page = MagicMock()
		if i == 1:
			page.get_pixmap.side_effect = RuntimeError("rasterize fail")
		else:
			pix = MagicMock()
			pix.tobytes.return_value = b"png" + str(i).encode()
			page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		return [_make_row(1, f"page-call-{i}")]
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	parser = pdf_vision.PdfVisionParser()
	rows = parser.parse(b"%PDF mock")
	assert len(rows) == 2  # pages 1 + 3 (page 2 skipped)
	assert [r.line_no for r in rows] == [1, 2]
	assert [r.description for r in rows] == ["page-call-0", "page-call-1"]


def test_pdf_vision_parse_skips_page_on_vision_failure(monkeypatch):
	"""ImageVisionParser.parse raises on 2nd call → skip, others kept."""
	from app.import_data.parsers import pdf_vision

	pages = []
	for i in range(3):
		page = MagicMock()
		pix = MagicMock()
		pix.tobytes.return_value = b"png" + str(i).encode()
		page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		if i == 1:
			raise RuntimeError("groq down")
		return [_make_row(1, f"page-{i}")]
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	parser = pdf_vision.PdfVisionParser()
	rows = parser.parse(b"%PDF mock")
	assert len(rows) == 2
	assert [r.description for r in rows] == ["page-0", "page-2"]


def test_pdf_vision_parse_passes_png_bytes_to_image_parser(monkeypatch):
	"""Verify the bytes passed to ImageVisionParser.parse are the pixmap PNG output."""
	from app.import_data.parsers import pdf_vision

	page = MagicMock()
	pix = MagicMock()
	pix.tobytes.return_value = b"\x89PNG\r\n\x1a\n_specific_marker_"
	page.get_pixmap.return_value = pix
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter([page])
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	captured = {}
	def fake_parse(self, file_bytes):
		captured["bytes"] = file_bytes
		return []
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	pdf_vision.PdfVisionParser().parse(b"%PDF mock")
	assert captured["bytes"] == b"\x89PNG\r\n\x1a\n_specific_marker_"
	# Verify get_pixmap called with dpi=150
	page.get_pixmap.assert_called_once_with(dpi=150)
	# Verify tobytes called with "png"
	pix.tobytes.assert_called_once_with("png")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_pdf_vision_parser.py -v
```

Expected: All tests fail with `ModuleNotFoundError: No module named 'app.import_data.parsers.pdf_vision'`.

- [ ] **Step 3: Create `pdf_vision.py`**

Create `backend/app/import_data/parsers/pdf_vision.py`:

```python
"""PDF → vision parser composition.

Rasterize tiap halaman PDF jadi PNG via PyMuPDF, delegate ke ImageVisionParser
buat extract transactions per halaman. Concat hasil dengan line_no global.

DPI = 150 (balance quality vs file size — A4 page ~1.5MB PNG, well within
ImageVisionParser 10MB limit).

Page-level isolation: 1 halaman gagal (rasterize crash atau vision call crash)
tidak abort entire parse. Skip halaman, lanjut. Acceptable trade-off untuk
multi-page statement.
"""

import fitz

from app.import_data.parsers.base import ParsedRow
from app.import_data.parsers.image_vision import ImageVisionParser


class PdfVisionParser:
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
					# Rasterize fail — skip page, continue
					continue
				try:
					page_rows = image_parser.parse(png_bytes)
				except Exception:
					# Vision call fail (after parser's own retry) — skip page
					continue
				for row in page_rows:
					row.line_no = next_line_no
					next_line_no += 1
					all_rows.append(row)
		finally:
			doc.close()

		return all_rows
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_pdf_vision_parser.py -v
```

Expected: All 7 tests pass.

- [ ] **Step 5: Confirm no regression**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -5
```

Expected: ~149 + 7 = ~156 passed, 5 skipped.

---

## Task 4: Build `dispatcher.py` with TDD

Goal: top-level `dispatch(file_bytes) → Parser` function. Composes sniff + parser selection.

**Files:**
- Create: `backend/app/import_data/dispatcher.py`
- Create: `backend/tests/test_dispatcher.py`

- [ ] **Step 1: Write failing tests for dispatcher**

Create `backend/tests/test_dispatcher.py`:

```python
"""Tests untuk dispatcher — pilih parser berdasarkan file content.

Mocks sniff functions supaya bisa test routing isolasi dari pdfplumber.
"""

import pytest


# Sample magic bytes
PNG = b"\x89PNG\r\n\x1a\n_fake_png_"
JPEG = b"\xff\xd8\xff_fake_jpeg_"
WEBP = b"RIFF\x00\x00\x00\x00WEBP_fake_"
PDF = b"%PDF-1.4\n_fake_pdf_"
CSV = b"date,amount\n2026-01-01,100\n"


def test_dispatch_png_returns_image_vision():
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.image_vision import ImageVisionParser
	parser = dispatch(PNG)
	assert isinstance(parser, ImageVisionParser)


def test_dispatch_jpeg_returns_image_vision():
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.image_vision import ImageVisionParser
	assert isinstance(dispatch(JPEG), ImageVisionParser)


def test_dispatch_webp_returns_image_vision():
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.image_vision import ImageVisionParser
	assert isinstance(dispatch(WEBP), ImageVisionParser)


def test_dispatch_csv_returns_manual_csv():
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.manual_csv import ManualCsvParser
	assert isinstance(dispatch(CSV), ManualCsvParser)


def test_dispatch_pdf_with_bni_signature_returns_pdf_bni(monkeypatch):
	from app.import_data import dispatcher
	from app.import_data.parsers.pdf_bni import PdfBniParser
	monkeypatch.setattr(dispatcher, "has_bni_signature", lambda b: True)
	parser = dispatcher.dispatch(PDF)
	assert isinstance(parser, PdfBniParser)


def test_dispatch_pdf_without_bni_signature_returns_pdf_vision(monkeypatch):
	from app.import_data import dispatcher
	from app.import_data.parsers.pdf_vision import PdfVisionParser
	monkeypatch.setattr(dispatcher, "has_bni_signature", lambda b: False)
	parser = dispatcher.dispatch(PDF)
	assert isinstance(parser, PdfVisionParser)


def test_dispatch_empty_raises_unsupported():
	from app.import_data.dispatcher import dispatch, UnsupportedFileType
	with pytest.raises(UnsupportedFileType, match="Empty"):
		dispatch(b"")


def test_dispatch_unknown_format_raises_unsupported():
	from app.import_data.dispatcher import dispatch, UnsupportedFileType
	with pytest.raises(UnsupportedFileType, match="Unrecognized"):
		dispatch(b"\x00\x01\x02\x03random binary garbage")


def test_dispatch_unsupported_file_type_is_exception_subclass():
	"""UnsupportedFileType must inherit from Exception so service.py catch-all works."""
	from app.import_data.dispatcher import UnsupportedFileType
	assert issubclass(UnsupportedFileType, Exception)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_dispatcher.py -v
```

Expected: All fail with `ModuleNotFoundError: No module named 'app.import_data.dispatcher'`.

- [ ] **Step 3: Create `dispatcher.py`**

Create `backend/app/import_data/dispatcher.py`:

```python
"""Smart Import Dispatcher.

Single entry point untuk pilih parser berdasarkan FILE CONTENT (bukan
source_type metadata dari frontend). Routing logic:

  - image/png|jpeg|webp           → ImageVisionParser
  - application/pdf + BNI sig     → PdfBniParser (existing text parser)
  - application/pdf + non-BNI     → PdfVisionParser (rasterize → vision)
  - text/csv                      → ManualCsvParser
  - unknown                       → raise UnsupportedFileType

Service layer call `dispatch(file_bytes)` di `process_job`. source_type yang
user pilih di frontend disimpan di ImportJob untuk audit/display, tapi tidak
mempengaruhi parser selection.
"""

from app.import_data.parsers.base import Parser
from app.import_data.parsers.image_vision import ImageVisionParser
from app.import_data.parsers.manual_csv import ManualCsvParser
from app.import_data.parsers.pdf_bni import PdfBniParser
from app.import_data.parsers.pdf_vision import PdfVisionParser
from app.import_data.parsers.sniff import has_bni_signature, sniff_mime


class UnsupportedFileType(Exception):
	"""Raised when file format cannot be routed to any registered parser."""


def dispatch(file_bytes: bytes) -> Parser:
	"""Pick parser based on file content. Pure routing — no I/O beyond
	what's needed to peek at content."""
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_dispatcher.py -v
```

Expected: All 9 tests pass.

- [ ] **Step 5: Confirm no regression**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -5
```

Expected: ~156 + 9 = ~165 passed, 5 skipped.

---

## Task 5: Integrate dispatcher into `service.py`

Goal: replace `get_parser(source_type)` call in `process_job` with `dispatch(file_bytes)`. Verify existing tests still pass (CSV manual_csv flow → dispatcher routes to ManualCsvParser → same outcome).

**Files:**
- Modify: `backend/app/import_data/service.py` (1 line change in `process_job`)

- [ ] **Step 1: Read current process_job block (lines 155-181)**

```bash
sed -n '155,185p' /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/app/import_data/service.py
```

You'll see roughly:

```python
async def process_job(job_id: UUID) -> None:
	async with AsyncSessionLocal() as session:
		job = await session.get(ImportJob, job_id)
		if job is None or job.deleted_at is not None:
			return
		if job.status != ImportJobStatus.pending:
			return

		job.status = ImportJobStatus.processing
		await session.commit()

		try:
			file_bytes = (UPLOADS_ROOT / job.file_path).read_bytes()
			parser = get_parser(job.source_type.value)
			parsed = parser.parse(file_bytes)
		except Exception as exc:
			job.status = ImportJobStatus.failed
			job.error_message = str(exc)[:500]
			await session.commit()
			return
```

The single line to replace: `parser = get_parser(job.source_type.value)`. The outer `except Exception` already catches `UnsupportedFileType` (which inherits from `Exception`), so no new try/except wrapping needed.

- [ ] **Step 2: Apply the line replacement using Edit tool**

In `backend/app/import_data/service.py`, find:

```python
			parser = get_parser(job.source_type.value)
			parsed = parser.parse(file_bytes)
```

Replace with:

```python
			parser = dispatch(file_bytes)
			parsed = parser.parse(file_bytes)
```

- [ ] **Step 3: Update imports at top of service.py**

In `backend/app/import_data/service.py`, find the imports block. Locate the line:

```python
from app.import_data.parsers import get_parser
```

Replace with:

```python
from app.import_data.dispatcher import dispatch
```

(`get_parser` is no longer used by service.py. It remains importable from `app.import_data.parsers` for tests and future use.)

- [ ] **Step 4: Verify the file is syntactically valid**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/python -c "from app.import_data.service import process_job; print('OK')"
```

Expected: `OK`. If `ImportError` or syntax error: stop and report.

- [ ] **Step 5: Check for any existing test that depends on `get_parser` raising NotImplementedError for stubs**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && grep -rn "pdf_bca\|pdf_mandiri\|pdf_bri\|csv_bibit\|csv_ipot" tests/
```

If any test uses these source_types AND expects NotImplementedError to bubble up: that test needs adjustment because dispatcher now content-routes (the source_type value is ignored). For each such test:
- If the test was just verifying the stub state (no semantic value now) → mark with `pytest.mark.skip(reason="dispatcher now content-routes; source_type metadata only")` or delete.
- If the test uploads actual file bytes (CSV/PDF) with mislabeled source_type → it likely still passes because dispatcher routes by content. Just run it and verify.

Report any test that needed change.

- [ ] **Step 6: Run full backend test suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -15
```

Expected: All tests still pass. Specifically `test_import.py::test_manual_csv_full_flow` should pass — its CSV bytes are dispatched to ManualCsvParser (same parser as before, just selected differently).

If any test fails: investigate. Common cause: a test that was implicitly relying on `get_parser` raising `NotImplementedError` for stub source_types. Adjust per Step 5 guidance.

---

## Task 6: Add live integration tests (gated)

Goal: end-to-end tests against real Groq + real fixture PDFs/images, gated by `VISION_TEST_LIVE=1`. Agent does NOT run them — the PM in main session triggers manually during verification.

**Files:**
- Create: `backend/tests/test_dispatcher_live.py`

- [ ] **Step 1: Create live test file**

Create `backend/tests/test_dispatcher_live.py`:

```python
"""Live integration tests untuk Smart Import Dispatcher.

Pakai real Groq API + real fixture files. Gated dengan VISION_TEST_LIVE=1
(plus GROQ_API_KEY non-empty). PM trigger manual setelah agent selesai.

Run manual:
    VISION_TEST_LIVE=1 backend/venv/bin/pytest tests/test_dispatcher_live.py -v
"""

import os
from pathlib import Path

import pytest

from app.config import get_settings


pytestmark = pytest.mark.skipif(
	os.getenv("VISION_TEST_LIVE") != "1" or not get_settings().GROQ_API_KEY,
	reason="VISION_TEST_LIVE=1 + GROQ_API_KEY required",
)


FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load(rel_path: str) -> bytes:
	path = FIXTURE_DIR / rel_path
	if not path.exists():
		pytest.skip(f"Fixture {rel_path} tidak tersedia (gitignored)")
	return path.read_bytes()


def test_live_bni_pdf_routes_to_pdf_bni(monkeypatch):
	"""BNI PDF should dispatch to PdfBniParser (text-based, no Groq call)."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.pdf_bni import PdfBniParser

	parser = dispatch(_load("bni/bni-2025-10.pdf"))
	assert isinstance(parser, PdfBniParser)
	# Actually parse to confirm extraction still works (expected 57 rows from Phase 1).
	rows = parser.parse(_load("bni/bni-2025-10.pdf"))
	assert len(rows) == 57


def test_live_dana_image_routes_to_image_vision():
	"""Dana JPEG → ImageVisionParser. Real Groq call."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.image_vision import ImageVisionParser

	file_bytes = _load("vision/ewallet/dana-list-1.jpeg")
	parser = dispatch(file_bytes)
	assert isinstance(parser, ImageVisionParser)
	rows = parser.parse(file_bytes)
	assert len(rows) >= 5, f"Expected at least 5 rows, got {len(rows)}"


def test_live_mandiri_pdf_via_rasterize_vision():
	"""Mandiri image-only PDF → dispatcher routes to PdfVisionParser →
	rasterize 3 pages → 3 Groq vision calls → concat rows."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.pdf_vision import PdfVisionParser

	file_bytes = _load("mandiri/mandiri-statement.pdf")
	parser = dispatch(file_bytes)
	assert isinstance(parser, PdfVisionParser)
	rows = parser.parse(file_bytes)
	# Mandiri 3-page statement should have several transactions.
	assert len(rows) >= 3, f"Expected at least 3 rows from 3-page Mandiri PDF, got {len(rows)}"
	# Sanity: line_no should be globally numbered starting from 1
	assert [r.line_no for r in rows] == list(range(1, len(rows) + 1))


def test_live_permata_pdf_via_rasterize_vision():
	"""Permata image-only PDF → PdfVisionParser → 2 Groq calls."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.pdf_vision import PdfVisionParser

	file_bytes = _load("permata/permatabank-statement.pdf")
	parser = dispatch(file_bytes)
	assert isinstance(parser, PdfVisionParser)
	rows = parser.parse(file_bytes)
	assert len(rows) >= 2, f"Expected at least 2 rows from 2-page Permata PDF, got {len(rows)}"


def test_live_csv_bytes_routes_to_manual_csv():
	"""Inline CSV bytes → ManualCsvParser. No Groq call."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.manual_csv import ManualCsvParser

	csv = (
		b"date,amount,merchant,description,category\n"
		b"2026-04-15,-58000,Gojek,GoFood Sudirman,Makan\n"
		b"2026-04-16,5000000,PT Konstruksi Jaya,Gaji April,Pemasukan\n"
	)
	parser = dispatch(csv)
	assert isinstance(parser, ManualCsvParser)
	rows = parser.parse(csv)
	assert len(rows) == 2
```

- [ ] **Step 2: Verify the file imports cleanly (all tests skipped without env flag)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_dispatcher_live.py -v
```

Expected: All 5 tests SKIPPED with reason "VISION_TEST_LIVE=1 + GROQ_API_KEY required".

- [ ] **Step 3: Do NOT set VISION_TEST_LIVE=1**

The PM will trigger live tests in main session. Agent must not consume Groq quota.

---

## Task 7: Final verification — agent reports back

Agent does NOT commit. After completing Tasks 1-6, run final verification commands and report.

- [ ] **Step 1: Backend full test suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -20
```

Expected: All tests pass. ~123 baseline + ~42 new unit tests (sniff + dispatcher + pdf_vision) = ~165 passed, ~10 skipped (5 Phase-1 live + 5 Phase-2 live). Report PASS/FAIL/SKIP counts.

- [ ] **Step 2: Frontend typecheck (no changes expected)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5
```

Expected: No errors. Phase 2 didn't touch frontend.

- [ ] **Step 3: PyMuPDF sanity check**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/python -c "
import fitz
from app.import_data.dispatcher import dispatch
from app.import_data.parsers.pdf_bni import PdfBniParser
from app.import_data.parsers.pdf_vision import PdfVisionParser

# Dispatch a real BNI PDF and confirm routing without invoking Groq
with open('tests/fixtures/bni/bni-2025-10.pdf', 'rb') as f:
    p = dispatch(f.read())
print(f'BNI fixture → {type(p).__name__} (expected PdfBniParser)')

# Dispatch a real Mandiri PDF (image-only)
with open('tests/fixtures/mandiri/mandiri-statement.pdf', 'rb') as f:
    p = dispatch(f.read())
print(f'Mandiri fixture → {type(p).__name__} (expected PdfVisionParser)')
"
```

Expected output:
```
BNI fixture → PdfBniParser (expected PdfBniParser)
Mandiri fixture → PdfVisionParser (expected PdfVisionParser)
```

This confirms routing works against real PDFs WITHOUT calling Groq. If routing is wrong: stop and report.

- [ ] **Step 4: Git status report**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && git status
```

Expected:

**Modified:**
- `backend/requirements.txt`
- `backend/app/import_data/service.py`

**New:**
- `backend/app/import_data/dispatcher.py`
- `backend/app/import_data/parsers/sniff.py`
- `backend/app/import_data/parsers/pdf_vision.py`
- `backend/tests/test_sniff.py`
- `backend/tests/test_dispatcher.py`
- `backend/tests/test_pdf_vision_parser.py`
- `backend/tests/test_dispatcher_live.py`

NOT committed.

- [ ] **Step 5: Report**

Output a final summary block with:
- ✅/❌ per task (1-7)
- PyMuPDF version installed (from `pip show pymupdf | grep Version`)
- Backend test results: passed/skipped/failed counts
- Output of Step 3 routing sanity (BNI → PdfBniParser, Mandiri → PdfVisionParser?)
- Frontend typecheck: clean? Yes/No
- List of modified/created files
- Any deviation from plan (e.g. Task 5 Step 5 found a test needing adjustment, lint auto-fixed something, unexpected count)
- Any concerns the PM should know about before running live tests

---

## Self-Review Notes (internal — not for agent)

**Spec coverage check:**
- Goal 1 (replace source_type routing with content-based): Task 5 (service.py change) ✓
- Goal 2 (build dispatcher.py): Task 4 ✓
- Goal 3 (build PdfVisionParser): Task 3 ✓
- Goal 4 (build sniff.py): Task 2 ✓
- Goal 5 (no schema/frontend/enum change): Task 5 only changes service.py; no migrations or frontend touched ✓
- Goal 6 (graceful error handling): Task 3 page-level isolation tests, Task 4 UnsupportedFileType test, existing service.py catch-all wraps dispatch ✓

**Non-goals respected:** No openpyxl, no Pluang CSV adapter, no frontend, no per-bank text parsers, no schema migration, no `get_parser()` removal.

**Type consistency:**
- `sniff_mime(file_bytes) -> str | None` consistent across all callers
- `has_bni_signature(file_bytes) -> bool` consistent
- `dispatch(file_bytes) -> Parser` matches existing `Parser` Protocol
- `PdfVisionParser.parse(file_bytes) -> list[ParsedRow]` matches existing Parser contract
- `UnsupportedFileType` is `Exception` subclass — caught by service.py's `except Exception`

**Placeholder scan:** No TBD/TODO/handle-edge-cases language. All steps have concrete code or exact commands.

**Risks the agent should report on:**
1. **PyMuPDF wheel availability** for Python 3.12 on macOS arm64 — should be fine, but verify Task 1 Step 3 install completes.
2. **`has_bni_signature` opens PDF twice** (once for signature check in dispatcher, once for actual parsing in PdfBniParser). Could be optimized later by caching, but for MVP the duplicate pdfplumber open is acceptable (~50ms overhead).
3. **Existing tests in `test_import.py`** — should pass without modification because CSV routing outcome unchanged. If anything fails: report it.
4. **`get_parser` remaining as unused export from service.py** — already removed from service.py imports in Task 5 Step 3. Still importable from `app.import_data.parsers` for direct lookup in tests.
5. **CSV heuristic** might false-positive on text files with commas (e.g. README, log files). Trade-off accepted for MVP — `ManualCsvParser` is lenient, returns empty/few rows for noise, user sees review screen with 0 rows.
