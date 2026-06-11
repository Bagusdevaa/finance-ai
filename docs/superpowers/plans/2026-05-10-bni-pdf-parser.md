# BNI e-Statement PDF Parser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working PDF parser for BNI e-Statement (text-based, 3-line-per-tx layout) and wire it through backend + frontend so user can upload a BNI PDF on the `/import` page and see the transactions in the review screen.

**Architecture:** New parser `PdfBniParser` implements the existing `Parser` Protocol. Auto-registered via `@register("pdf_bni")` decorator. Parser uses linear state-machine over text lines from `pdfplumber.extract_text()`. Hybrid categorizer: existing `categorize_rule_based()` first, BNI's intrinsic category as fallback for unmatched rows. Backend enum + Alembic migration add `pdf_bni` value. Frontend type union + import page button enable BNI upload.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, Alembic, pdfplumber 0.11, pytest-asyncio. Frontend Next.js 14 App Router, TypeScript.

**Spec reference:** `docs/superpowers/specs/2026-05-10-bni-pdf-parser-design.md`

**Commit policy (project memory override):** Do NOT commit per task. Run tests at end of each task and verify green. The orchestrator (PM, main session) will do ONE final commit after full verification, format `feat: bni pdf parser` (no scope, no co-author trailer). Agent must never run `git commit` itself.

**Working directory:** `/Users/bagusdeva/Documents/Personal Projects/smart-finance`. Backend venv: `backend/venv/bin/python`, `backend/venv/bin/pytest`, `backend/venv/bin/alembic`. Use these absolute interpreter paths to avoid shell activation issues.

**Test fixtures:** `backend/tests/fixtures/bni/` contains 4 PDF samples (gitignored). If folder is empty (e.g. CI environment), parser tests `pytest.skip()`. Counts are: oct_2025=57, nov_2025=37, feb_2026=35, apr_2026=47.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `backend/app/import_data/models.py` (modify line 40-47) | Enum source-of-truth: add `pdf_bni` value |
| `backend/alembic/versions/<new>_add_pdf_bni_source_type.py` (create) | DB enum migration: `ALTER TYPE import_source_type ADD VALUE 'pdf_bni'` |
| `backend/app/import_data/parsers/pdf_bni.py` (create) | Parser implementation: state machine, line classifiers, hybrid categorizer |
| `backend/app/import_data/parsers/__init__.py` (modify) | Register parser via import side-effect |
| `backend/tests/test_pdf_bni_parser.py` (create) | Unit tests for helpers + integration tests with fixture PDFs |
| `frontend/lib/api/types.ts` (modify line 194-201) | Add `"pdf_bni"` to `ImportSourceType` union |
| `frontend/app/(app)/import/page.tsx` (modify line 50) | Enable BNI button, wire to `pdf_bni` source type |

---

## Task 1: Add `pdf_bni` to backend enum and create Alembic migration

**Files:**
- Modify: `backend/app/import_data/models.py:40-47`
- Create: `backend/alembic/versions/<timestamp>_add_pdf_bni_source_type.py`

- [ ] **Step 1: Add enum value**

Edit `backend/app/import_data/models.py` lines 40-47. Add `pdf_bni` between `pdf_bri` and `csv_bibit` to keep banks grouped:

```python
class ImportSourceType(str, Enum):
	pdf_bca = "pdf_bca"
	pdf_mandiri = "pdf_mandiri"
	pdf_bri = "pdf_bri"
	pdf_bni = "pdf_bni"
	csv_bibit = "csv_bibit"
	csv_ipot = "csv_ipot"
	image_vision = "image_vision"
	manual_csv = "manual_csv"
```

- [ ] **Step 2: Generate migration skeleton**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/alembic revision -m "add pdf_bni source type"
```

Expected: Creates a new file like `alembic/versions/<timestamp>_add_pdf_bni_source_type.py`. The autogenerate flag is intentionally NOT used — Alembic does not detect Postgres enum value additions.

- [ ] **Step 3: Edit the generated migration**

Replace the entire body of the new migration file with:

```python
"""add pdf_bni source type

Revision ID: <leave the generated one>
Revises: f359acc39754
Create Date: <leave the generated one>

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '<leave the generated one>'
down_revision: Union[str, None] = 'f359acc39754'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Postgres tidak mengizinkan ALTER TYPE ADD VALUE di dalam transaction block.
# Set per-migration to disable transactional DDL for this revision.
def upgrade() -> None:
	with op.get_context().autocommit_block():
		op.execute("ALTER TYPE import_source_type ADD VALUE IF NOT EXISTS 'pdf_bni'")


def downgrade() -> None:
	# Postgres tidak punya cara native untuk DROP VALUE dari enum tanpa
	# rebuild type. Skip downgrade — enum value yang tidak terpakai aman.
	pass
```

Keep the auto-generated `revision` and `Create Date` values. Do not change `down_revision` from `f359acc39754` (latest existing migration head).

- [ ] **Step 4: Run migration against dev DB**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/alembic upgrade head
```

Expected output: `INFO  [alembic.runtime.migration] Running upgrade f359acc39754 -> <new>, add pdf_bni source type`. Exit code 0.

- [ ] **Step 5: Verify enum value exists in DB**

```bash
docker exec smart-finance-postgres-1 psql -U postgres -d financeai -c "SELECT unnest(enum_range(NULL::import_source_type))"
```

Expected: list includes `pdf_bni` alongside other 7 values.

- [ ] **Step 6: Run existing tests to confirm no regression**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_import.py -v
```

Expected: All existing import tests pass (pytest schema bootstrap will pick up the new enum value automatically since it reads `Base.metadata`).

---

## Task 2: Build parser helpers (TDD — synthetic inputs only)

**Files:**
- Create: `backend/app/import_data/parsers/pdf_bni.py`
- Create: `backend/tests/test_pdf_bni_parser.py`

- [ ] **Step 1: Write failing helper tests**

Create `backend/tests/test_pdf_bni_parser.py`:

```python
"""Tests untuk parser BNI e-Statement PDF.

Helper tests pakai synthetic input. Integration tests pakai fixture PDF
yang di-gitignore di backend/tests/fixtures/bni/ (skip kalau tidak ada).
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.import_data.parsers.pdf_bni import (
	_BNI_KNOWN_CATEGORIES,
	_apply_bni_fallback,
	_parse_bni_amount,
	_parse_bni_date,
	classify_line,
)


# ---------- _parse_bni_date ----------

def test_parse_bni_date_october():
	assert _parse_bni_date("01 Oct 2025") == date(2025, 10, 1)


def test_parse_bni_date_february():
	assert _parse_bni_date("28 Feb 2026") == date(2026, 2, 28)


def test_parse_bni_date_invalid_returns_none():
	assert _parse_bni_date("not a date") is None
	assert _parse_bni_date("32 Oct 2025") is None
	assert _parse_bni_date("01 XYZ 2025") is None


# ---------- _parse_bni_amount ----------

def test_parse_bni_amount_positive():
	assert _parse_bni_amount("+100,000") == Decimal("100000")
	assert _parse_bni_amount("+7,500,000") == Decimal("7500000")


def test_parse_bni_amount_negative():
	assert _parse_bni_amount("-2,000,000") == Decimal("-2000000")
	assert _parse_bni_amount("-1,000") == Decimal("-1000")


def test_parse_bni_amount_unsigned_treated_positive():
	assert _parse_bni_amount("69,040") == Decimal("69040")


def test_parse_bni_amount_invalid_returns_none():
	assert _parse_bni_amount("abc") is None
	assert _parse_bni_amount("") is None


# ---------- classify_line ----------

def test_classify_line_date_with_category():
	kind, payload = classify_line("01 Oct 2025 Transfer")
	assert kind == "date_cat"
	assert payload == (date(2025, 10, 1), "Transfer")


def test_classify_line_date_with_multiword_category():
	kind, payload = classify_line("02 Oct 2025 Pembayaran Qris")
	assert kind == "date_cat"
	assert payload == (date(2025, 10, 2), "Pembayaran Qris")


def test_classify_line_amount_balance():
	kind, payload = classify_line("+100,000 169,040")
	assert kind == "amt_bal"
	assert payload == (Decimal("100000"), Decimal("169040"))


def test_classify_line_amount_balance_negative():
	kind, payload = classify_line("-2,000,000 5,669,040")
	assert kind == "amt_bal"
	assert payload == (Decimal("-2000000"), Decimal("5669040"))


def test_classify_line_time_description():
	kind, payload = classify_line("19:27:33 WIB BNI - PT AIRPAY INTERNATIONAL INDONESIA")
	assert kind == "time_desc"
	assert payload == ("19:27:33", "BNI - PT AIRPAY INTERNATIONAL INDONESIA")


def test_classify_line_time_with_short_description():
	kind, payload = classify_line("03:37:16 WIB MANDIRI -")
	assert kind == "time_desc"
	assert payload == ("03:37:16", "MANDIRI -")


def test_classify_line_skip_header():
	assert classify_line("Laporan Mutasi Rekening")[0] == "skip"
	assert classify_line("Periode: 1 - 31 Oktober 2025")[0] == "skip"
	assert classify_line("Saldo Awal 69,040")[0] == "skip"
	assert classify_line("Saldo Akhir 50,036")[0] == "skip"
	assert classify_line("Tanggal & Waktu Rincian Transaksi Nominal (IDR) Saldo (IDR)")[0] == "skip"
	assert classify_line("")[0] == "skip"
	assert classify_line("   ")[0] == "skip"


def test_classify_line_skip_footer():
	# Footer pattern variation
	footer = "peserta penjaminan Lembaga Penjamin Simpanan (LPS). 1 dari 5"
	assert classify_line(footer)[0] == "skip"


# ---------- _apply_bni_fallback ----------

def test_apply_bni_fallback_when_categorizer_returns_none():
	# Biaya → Biaya Bank
	assert _apply_bni_fallback(None, "Biaya") == "Biaya Bank"
	# Ewallet → Top Up
	assert _apply_bni_fallback(None, "Ewallet") == "Top Up"
	# Transfer → Transfer
	assert _apply_bni_fallback(None, "Transfer") == "Transfer"


def test_apply_bni_fallback_generic_categories_stay_none():
	assert _apply_bni_fallback(None, "Pembayaran Qris") is None
	assert _apply_bni_fallback(None, "Virtual Account") is None
	assert _apply_bni_fallback(None, "Tarik Tunai") is None
	assert _apply_bni_fallback(None, "Lainnya") is None


def test_apply_bni_fallback_does_not_override_categorizer_match():
	# Kalau categorizer sudah dapat hasil, fallback tidak overwrite.
	assert _apply_bni_fallback("Makan & Minum", "Biaya") == "Makan & Minum"
	assert _apply_bni_fallback("Pemasukan", "Transfer") == "Pemasukan"


def test_bni_known_categories_set():
	assert _BNI_KNOWN_CATEGORIES == {
		"Biaya", "Ewallet", "Lainnya",
		"Pembayaran Qris", "Tarik Tunai",
		"Transfer", "Virtual Account",
	}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_pdf_bni_parser.py -v
```

Expected: ImportError on `from app.import_data.parsers.pdf_bni import ...` because the module currently only has the stub (raises NotImplementedError, no helpers exported).

- [ ] **Step 3: Implement parser helpers**

Replace the entire content of `backend/app/import_data/parsers/pdf_bni.py` with:

```python
"""BNI e-Statement PDF parser.

Format: text-based PDF (Producer=PDFium) dari aplikasi/web banking BNI.
Tiap transaksi 3 baris di hasil text extraction:

	01 Oct 2025 Transfer                  ← date + BNI category
	+100,000 169,040                      ← signed amount + running balance
	19:27:33 WIB BNI - PT AIRPAY ...      ← time + description

Lines lain (header, footer, saldo summary, disclaimer) di-skip.

Categorization hybrid:
  1. Coba categorize_rule_based(merchant=None, description) seperti CSV parser
  2. Kalau None, fallback ke pemetaan kategori intrinsik BNI:
     Biaya → "Biaya Bank", Ewallet → "Top Up", Transfer → "Transfer".
     Kategori BNI lain (Pembayaran Qris, Virtual Account, Tarik Tunai,
     Lainnya) terlalu generik untuk fallback aman → biarkan None.
"""

import io
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Literal, Tuple

import pdfplumber

from app.ai.categorizer import categorize_rule_based
from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


# Bulan English abbreviation → angka (BNI selalu English meskipun konten lain Indonesian).
_MONTHS = {
	"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
	"Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

_DATE_RE = re.compile(
	r"^(\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\s+(.+)$"
)
_AMT_BAL_RE = re.compile(r"^([+-]?[\d,]+)\s+([\d,]+)$")
_TIME_DESC_RE = re.compile(r"^(\d{2}:\d{2}:\d{2}) WIB\s+(.+)$")

# Set kategori intrinsik BNI yang dikenal (untuk confidence scoring).
_BNI_KNOWN_CATEGORIES: set[str] = {
	"Biaya", "Ewallet", "Lainnya",
	"Pembayaran Qris", "Tarik Tunai",
	"Transfer", "Virtual Account",
}

# BNI category → internal category fallback. Hanya untuk yang punya
# pemetaan jelas; kategori generik (Qris, Virtual Account, dll) kosong.
_BNI_CATEGORY_FALLBACK: dict[str, str] = {
	"Biaya": "Biaya Bank",
	"Ewallet": "Top Up",
	"Transfer": "Transfer",
}


def _parse_bni_date(s: str) -> date | None:
	"""Parse 'DD MMM YYYY' (English month). Return None kalau invalid."""
	parts = s.strip().split()
	if len(parts) != 3:
		return None
	day_s, mon_s, year_s = parts
	month = _MONTHS.get(mon_s)
	if month is None:
		return None
	try:
		return date(int(year_s), month, int(day_s))
	except ValueError:
		return None


def _parse_bni_amount(s: str) -> Decimal | None:
	"""Parse signed amount dengan koma sebagai thousands separator.

	'+100,000' → Decimal('100000'); '-1,000' → Decimal('-1000');
	'69,040' (unsigned) → Decimal('69040').
	"""
	s = s.strip().replace(",", "")
	if not s:
		return None
	try:
		return Decimal(s)
	except InvalidOperation:
		return None


LineKind = Literal["date_cat", "amt_bal", "time_desc", "skip"]


def classify_line(line: str) -> Tuple[LineKind, object]:
	"""Klasifikasi 1 baris ke salah satu dari 4 kategori state machine.

	Returns (kind, payload):
	  - "date_cat": payload = (date, bni_category_str)
	  - "amt_bal":  payload = (signed_amount, balance)
	  - "time_desc": payload = (time_str, description)
	  - "skip":     payload = None
	"""
	stripped = line.strip()
	if not stripped:
		return "skip", None

	m = _DATE_RE.match(stripped)
	if m:
		dt = _parse_bni_date(f"{m.group(1)} {m.group(2)} {m.group(3)}")
		if dt is not None:
			return "date_cat", (dt, m.group(4).strip())

	m = _AMT_BAL_RE.match(stripped)
	if m:
		amt = _parse_bni_amount(m.group(1))
		bal = _parse_bni_amount(m.group(2))
		if amt is not None and bal is not None:
			return "amt_bal", (amt, bal)

	m = _TIME_DESC_RE.match(stripped)
	if m:
		return "time_desc", (m.group(1), m.group(2).strip())

	return "skip", None


def _apply_bni_fallback(categorizer_result: str | None, bni_category: str) -> str | None:
	"""Hybrid: kalau categorizer sudah hasil, pakai itu. Else cek BNI fallback map."""
	if categorizer_result is not None:
		return categorizer_result
	return _BNI_CATEGORY_FALLBACK.get(bni_category)


@register(ImportSourceType.pdf_bni.value)
class PdfBniParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		# Implemented in Task 3.
		raise NotImplementedError("parse() will be implemented in Task 3")
```

- [ ] **Step 4: Run helper tests to verify they pass**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_pdf_bni_parser.py -v
```

Expected: All helper tests pass (28 tests). The parser registration runs on import but `parse()` not yet called.

---

## Task 3: Implement parse() state machine + integration tests

**Files:**
- Modify: `backend/app/import_data/parsers/pdf_bni.py` (replace `parse()` body)
- Modify: `backend/tests/test_pdf_bni_parser.py` (append integration tests)

- [ ] **Step 1: Append failing integration tests**

Add to the END of `backend/tests/test_pdf_bni_parser.py`:

```python
# ---------- Integration tests dengan fixture PDFs ----------

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "bni"


def _load_fixture(name: str) -> bytes:
	"""Load fixture PDF; pytest.skip kalau tidak ada (CI environment)."""
	path = FIXTURE_DIR / name
	if not path.exists():
		pytest.skip(f"Fixture {name} tidak tersedia (gitignored)")
	return path.read_bytes()


def _parser():
	from app.import_data.parsers.pdf_bni import PdfBniParser
	return PdfBniParser()


def test_parse_oct_2025_count():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	assert len(rows) == 57


def test_parse_nov_2025_count():
	rows = _parser().parse(_load_fixture("bni-2025-11.pdf"))
	assert len(rows) == 37


def test_parse_feb_2026_count():
	rows = _parser().parse(_load_fixture("bni-2026-02.pdf"))
	assert len(rows) == 35


def test_parse_apr_2026_count():
	rows = _parser().parse(_load_fixture("bni-2026-04.pdf"))
	assert len(rows) == 47


def test_parse_oct_2025_dates_in_range():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	for r in rows:
		assert r.transaction_date.year == 2025
		assert r.transaction_date.month == 10
		assert 1 <= r.transaction_date.day <= 31


def test_parse_oct_2025_signs_match_summary():
	"""Sum signed amounts harus sesuai summary dari header PDF.

	bni-2025-10.pdf: Total Pemasukan +13,687,644 / Total Pengeluaran -13,706,648.
	"""
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	total_in = sum((r.amount for r in rows if r.amount > 0), Decimal("0"))
	total_out = sum((r.amount for r in rows if r.amount < 0), Decimal("0"))
	assert total_in == Decimal("13687644")
	assert total_out == Decimal("-13706648")


def test_parse_oct_2025_first_tx_correct():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	first = rows[0]
	assert first.line_no == 1
	assert first.transaction_date == date(2025, 10, 1)
	assert first.amount == Decimal("100000")
	assert first.currency == "IDR"
	assert first.description is not None and "AIRPAY" in first.description.upper()


def test_parse_categorizer_pemasukan_special_case():
	"""Description 'MANDIRI -' (exact, no name) → 'Pemasukan' via existing categorizer."""
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	mandiri_rows = [r for r in rows if r.description and r.description.strip().upper() == "MANDIRI -"]
	assert len(mandiri_rows) >= 1
	for r in mandiri_rows:
		assert r.category == "Pemasukan"


def test_parse_categorizer_biaya_fallback():
	"""Tx dengan deskripsi generic 'Admin Kartu' / 'EWALLET TOP UP GOPAY' bisa
	dapat 'Biaya Bank' via BNI fallback (kalau categorizer tidak match).
	"""
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	# Cari row dengan amount kecil negatif yang punya BNI category 'Biaya'.
	# Setidaknya ada beberapa biaya transfer / admin di sample.
	biaya_bank_rows = [r for r in rows if r.category == "Biaya Bank"]
	assert len(biaya_bank_rows) >= 1


def test_parse_empty_bytes_returns_empty():
	assert _parser().parse(b"") == []


def test_parse_garbage_bytes_returns_empty():
	assert _parser().parse(b"this is not a PDF file") == []


def test_parse_raw_text_includes_three_lines():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	# raw_text harus berisi tanggal, jam, dan amount line — pakai separator.
	first = rows[0]
	assert " | " in first.raw_text
	assert "Oct 2025" in first.raw_text
	assert "WIB" in first.raw_text
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_pdf_bni_parser.py -v
```

Expected: New integration tests fail with `NotImplementedError: parse() will be implemented in Task 3`. Helper tests still pass.

- [ ] **Step 3: Replace `PdfBniParser.parse()` with full implementation**

Replace the entire `PdfBniParser` class at the bottom of `backend/app/import_data/parsers/pdf_bni.py` with:

```python
@register(ImportSourceType.pdf_bni.value)
class PdfBniParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		if not file_bytes:
			return []
		try:
			lines = self._extract_lines(file_bytes)
		except Exception:
			# pdfplumber raises various exceptions on corrupt/non-PDF input.
			# Parser harus graceful — kembalikan list kosong, biarkan service
			# layer record job sebagai review dengan 0 rows.
			return []

		rows: list[ParsedRow] = []
		i = 0
		line_no = 0
		while i < len(lines):
			kind, payload = classify_line(lines[i])
			if kind != "date_cat":
				i += 1
				continue

			tx_date, bni_cat = payload  # type: ignore[misc]

			# Peek next line: harus amt_bal.
			if i + 1 >= len(lines):
				break
			kind2, payload2 = classify_line(lines[i + 1])
			if kind2 != "amt_bal":
				# Block tidak lengkap. Skip date line saja, biarkan baris ke-i+1
				# di-evaluate ulang sebagai potential date_cat berikutnya.
				i += 1
				continue
			amount, _balance = payload2  # type: ignore[misc]

			# Peek line ke-3: harus time_desc.
			if i + 2 >= len(lines):
				break
			kind3, payload3 = classify_line(lines[i + 2])
			if kind3 != "time_desc":
				i += 1
				continue
			_time, description = payload3  # type: ignore[misc]

			# Build row.
			line_no += 1
			cat = _apply_bni_fallback(
				categorize_rule_based(merchant=None, description=description),
				bni_cat,
			)
			confidence = Decimal("1.00")
			if not description.strip() or bni_cat not in _BNI_KNOWN_CATEGORIES:
				confidence = Decimal("0.70")

			raw_text = " | ".join((lines[i], lines[i + 1], lines[i + 2]))

			rows.append(
				ParsedRow(
					line_no=line_no,
					transaction_date=tx_date,
					amount=amount,
					currency="IDR",
					merchant_name=None,
					description=description,
					category=cat,
					confidence_score=confidence,
					raw_text=raw_text,
				)
			)
			i += 3

		return rows

	@staticmethod
	def _extract_lines(file_bytes: bytes) -> list[str]:
		"""Extract semua text lines dari semua halaman, preserve order."""
		lines: list[str] = []
		with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
			for page in pdf.pages:
				text = page.extract_text() or ""
				lines.extend(text.split("\n"))
		return lines
```

- [ ] **Step 4: Run all parser tests**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/test_pdf_bni_parser.py -v
```

Expected: All tests pass. If fixture folder is empty, integration tests show as `SKIPPED`. Helper tests always run. Confirm: 28 helper passes + 12 integration passes = 40 (or 28 + 12 SKIPPED if fixtures missing).

- [ ] **Step 5: Confirm no regression in full backend test suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v
```

Expected: 51 existing tests + ≤40 new tests pass. No new failures elsewhere.

---

## Task 4: Register parser in `__init__.py`

**Files:**
- Modify: `backend/app/import_data/parsers/__init__.py`

- [ ] **Step 1: Add import**

Edit `backend/app/import_data/parsers/__init__.py`. Add `pdf_bni` to the import block (sorted alphabetically within the alias-import):

```python
"""Import semua parser modules supaya @register decorator dieksekusi."""

from app.import_data.parsers import (  # noqa: F401
	csv_bibit,
	csv_ipot,
	image_vision,
	manual_csv,
	pdf_bca,
	pdf_bni,
	pdf_bri,
	pdf_mandiri,
)
from app.import_data.parsers.base import (  # noqa: F401
	Parser,
	ParsedRow,
	ParserError,
	get_parser,
)
```

- [ ] **Step 2: Verify registration via Python REPL**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/python -c "from app.import_data.parsers import get_parser; p = get_parser('pdf_bni'); print(type(p).__name__)"
```

Expected stdout: `PdfBniParser`

- [ ] **Step 3: Re-run full backend tests to confirm no break**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v
```

Expected: All tests pass.

---

## Task 5: Frontend — type union + enable BNI button

**Files:**
- Modify: `frontend/lib/api/types.ts:194-201`
- Modify: `frontend/app/(app)/import/page.tsx:50`

- [ ] **Step 1: Read existing type to understand format**

```bash
sed -n '190,205p' /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend/lib/api/types.ts
```

You'll see something like:

```typescript
export type ImportSourceType =
	| "pdf_bca"
	| "pdf_mandiri"
	| "pdf_bri"
	| "csv_bibit"
	| "csv_ipot"
	| "image_vision"
	| "manual_csv";
```

- [ ] **Step 2: Add `pdf_bni` to the union**

Edit `frontend/lib/api/types.ts`. After the `"pdf_bri"` line, add:

```typescript
	| "pdf_bni"
```

Final type should be:

```typescript
export type ImportSourceType =
	| "pdf_bca"
	| "pdf_mandiri"
	| "pdf_bri"
	| "pdf_bni"
	| "csv_bibit"
	| "csv_ipot"
	| "image_vision"
	| "manual_csv";
```

- [ ] **Step 3: Read import page line ~50 to confirm format**

```bash
sed -n '45,55p' /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend/app/\(app\)/import/page.tsx
```

You'll see something like:

```tsx
{ id: "bca", name: "BCA", logo: "B", fmt: "PDF", group: "bank", sourceType: "pdf_bca" },
{ id: "mandiri", name: "Mandiri", logo: "M", fmt: "PDF", group: "bank", sourceType: "pdf_mandiri" },
{ id: "bri", name: "BRI", logo: "R", fmt: "PDF", group: "bank", sourceType: "pdf_bri" },
{ id: "bni", name: "BNI", logo: "N", fmt: "PDF", group: "bank", sourceType: "pdf_bca", disabled: true },
```

- [ ] **Step 4: Enable BNI button and route to `pdf_bni`**

Replace the `bni` line:

```tsx
{ id: "bni", name: "BNI", logo: "N", fmt: "PDF", group: "bank", sourceType: "pdf_bni" },
```

(Removed `disabled: true`, changed `sourceType` from `"pdf_bca"` → `"pdf_bni"`.)

- [ ] **Step 5: Run TypeScript check**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: No errors. (If user uses npm instead of pnpm, fall back to `npm run typecheck` or `npx tsc --noEmit` — but project uses pnpm per package manager artifacts.)

- [ ] **Step 6: Run lint**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec next lint
```

Expected: No lint errors on modified files.

---

## Task 6: Final verification — agent reports back

The agent does NOT commit. After completing Tasks 1-5, run final verification commands and report results:

- [ ] **Step 1: Backend full test suite**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -20
```

Expected: All tests pass. Report PASS/FAIL counts.

- [ ] **Step 2: Confirm migration applied and revertible-clean**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/alembic current
```

Expected: Output shows the new migration revision as current head.

- [ ] **Step 3: Frontend typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5
```

Expected: No errors.

- [ ] **Step 4: Git status report**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && git status
```

Expected: Modified files listed, no commit yet. Report exact list of touched files. PM (main session) will commit with the right message format.

- [ ] **Step 5: Report**

Output a final summary block with:
- Tasks completed (1-5)
- Backend tests: passed/skipped count
- Frontend typecheck: clean? Yes/No
- Migration applied: revision id
- List of modified/created files
- Any deviation from plan (e.g. lint auto-fixed something, or test count mismatched fixture count)

---

## Self-Review Notes

(Internal — not for agent.)

**Spec coverage check:**
- Goal 1 (parser implementation): Tasks 2 + 3 ✓
- Goal 2 (`pdf_bni` source type backend + frontend): Tasks 1 + 5 ✓
- Goal 3 (no behavior change to existing parsers): All tasks limited to additive changes; Task 1 step 6 + Task 3 step 5 explicitly run regression ✓
- Goal 4 (hybrid categorizer): Task 2 helpers + Task 3 parse() integration ✓

**Type/name consistency:**
- `_BNI_KNOWN_CATEGORIES` (set) used in both Task 2 (test) and Task 3 (parser) — consistent
- `_apply_bni_fallback(categorizer_result, bni_category)` signature matches across test + impl
- `classify_line` returns `(LineKind, payload)` — used consistently
- ParsedRow fields match spec (line_no = sequential index, currency="IDR", merchant_name=None, etc.)

**Placeholder scan:** No TBD/TODO/handle-edge-cases language. All steps have either complete code or exact bash commands.

**Risks:**
- Test count assertions (57/37/35/47) might be off-by-one if pdfplumber version difference shifts text extraction. Agent will report mismatch via Step 5.
- Fixture skip behavior assumes pytest.skip works — it does in pytest>=3 (project uses pytest 7+).
