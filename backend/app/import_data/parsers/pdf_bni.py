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
from datetime import date
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
