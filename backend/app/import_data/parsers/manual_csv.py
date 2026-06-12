"""Manual CSV parser dengan smart header detection.

Tujuannya: terima berbagai format CSV dari user — bank export, Google Sheet
custom, dll — tanpa user harus rename kolom dulu.

Header alias yang dikenali (case-insensitive, di-trim):
  - date:        date, tanggal, tgl, tanggal transaksi, transaction date, posting date
  - amount:      amount, jumlah, nominal, total, mutasi, value, rupiah
  - merchant:    merchant, nama merchant, payee, penerima
  - description: description, deskripsi, keterangan, notes, catatan, memo, narasi
  - category:    category, kategori, label, tag
  - debit:       debit, pengeluaran, expense, keluar
  - credit:      kredit, credit, pemasukan, income, masuk
  - type:        type, tipe, jenis, transaction type   (nilai: debit/kredit/in/out/dr/cr)

Sign convention transaksi:
  - Kalau ada kolom `amount` saja → pakai apa adanya (negatif = expense).
  - Kalau ada `amount` + `type` → flip ke negatif kalau type menunjukkan pengeluaran.
  - Kalau ada `debit` + `credit` (kolom terpisah, format bank) → debit = negatif,
	credit = positif. Yang kosong di-skip.

Format yang didukung:
  - Date: ISO (YYYY-MM-DD), DD/MM/YYYY, DD/MM/YY, MM/DD/YYYY, DD-MM-YYYY
  - Amount: 1500.00 (US), 1.500,00 (ID/EU), Rp 1.500, "1,500.00", dll.
  - Delimiter: auto-detect comma/semicolon/tab/pipe.
  - Line ending: \\r, \\n, \\r\\n.
  - BOM: di-strip otomatis (utf-8-sig).

Row malformed di-skip — jangan fail-kan keseluruhan job.
"""

import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, ParseResult, register


_DATE_FORMATS = (
	"%Y-%m-%d",
	"%d/%m/%Y",
	"%d/%m/%y",
	"%m/%d/%Y",
	"%d-%m-%Y",
	"%d-%m-%y",
	"%a, %b %d, %Y",  # Pluang export: "Sun, Aug 31, 2025"
)


# Canonical field → set of accepted header aliases (lowercase, trimmed).
_HEADER_ALIASES: dict[str, set[str]] = {
	"date": {"date", "tanggal", "tgl", "tanggal transaksi", "transaction date", "posting date", "trans date", "order date"},
	"amount": {"amount", "jumlah", "nominal", "total", "mutasi", "value", "rupiah", "nilai", "total amount"},
	"merchant": {"merchant", "merchant name", "nama merchant", "payee", "penerima", "nama"},
	"description": {"description", "deskripsi", "keterangan", "notes", "note", "catatan", "memo", "narasi", "remark", "remarks", "product name", "transaction"},
	"category": {"category", "kategori", "label", "tag", "tags"},
	"debit": {"debit", "pengeluaran", "expense", "keluar", "dr"},
	"credit": {"kredit", "credit", "pemasukan", "income", "masuk", "cr"},
	"type": {"type", "tipe", "jenis", "transaction type", "tipe transaksi", "jenis transaksi"},
}

# Type values yang DIKENAL menentukan sign. Selain itu, kolom `type` di-treat
# sebagai metadata (mis. "Pembayaran Qris", "Transfer") dan sign ditentukan
# dari kolom amount itu sendiri.
_TYPE_DEBIT_VALUES = {"debit", "dr", "pengeluaran", "keluar", "out", "expense"}
_TYPE_CREDIT_VALUES = {"kredit", "credit", "cr", "pemasukan", "masuk", "in", "income"}

# Flattened set of every alias — for header-row scoring.
_ALL_ALIASES: set[str] = set().union(*_HEADER_ALIASES.values())


def _build_header_map(fieldnames: list[str | None]) -> dict[str, str]:
	"""Map canonical key → actual CSV header. First match wins per canonical."""
	result: dict[str, str] = {}
	for raw in fieldnames:
		if not raw:
			continue
		normalized = raw.strip().lower()
		for canonical, aliases in _HEADER_ALIASES.items():
			if canonical in result:
				continue
			if normalized in aliases:
				result[canonical] = raw
				break
	return result


def _detect_header_row_index(rows: list[list[str]], max_scan: int = 20) -> int:
	"""Scan up to `max_scan` rows; return the index of the row with the most
	header-alias matches.

	Banyak export (Pluang, beberapa bank) menaruh metadata di baris awal sebelum
	header asli. Threshold: butuh ≥2 alias match supaya kebawa. Kalau tidak ada
	yang qualify, return 0 (legacy — baris pertama dianggap header).
	"""
	best_idx = 0
	best_score = 0
	for i, raw in enumerate(rows[:max_scan]):
		score = sum(1 for cell in raw if cell and cell.strip().lower() in _ALL_ALIASES)
		if score > best_score:
			best_score = score
			best_idx = i
	return best_idx if best_score >= 2 else 0


def _parse_date(s: str) -> date:
	for fmt in _DATE_FORMATS:
		try:
			return datetime.strptime(s, fmt).date()
		except ValueError:
			continue
	return date.fromisoformat(s[:10])


def _parse_amount(s: str) -> Decimal:
	# Strip currency symbols & whitespace.
	for token in ("Rp", "rp", "IDR", "idr"):
		s = s.replace(token, "")
	s = s.replace("\xa0", " ").strip()
	if not s:
		raise InvalidOperation("empty amount")
	# Heuristik separator desimal:
	# - Kalau ada "," dan "." → yang lebih kanan = desimal, yang lain ribuan.
	# - Kalau cuma ",", dan setelah "," ada ≤ 2 digit → desimal ID. Lainnya = ribuan.
	# - Kalau cuma "." dengan multiple titik, atau setelah "." ada 3 digit (e.g. 5.000.000) → titik = ribuan ID.
	if "," in s and "." in s:
		if s.rfind(",") > s.rfind("."):
			s = s.replace(".", "").replace(",", ".")
		else:
			s = s.replace(",", "")
	elif "," in s:
		dec = s.split(",")
		if len(dec) == 2 and len(dec[1]) <= 2:
			s = s.replace(",", ".")
		else:
			s = s.replace(",", "")
	elif "." in s:
		parts = s.lstrip("-").split(".")
		# Multiple titik (5.000.000) atau 1 titik dengan 3+ digit setelah → titik = ribuan.
		# 1 titik dengan ≤ 2 digit setelah (1500.50) → titik = desimal (US format).
		if len(parts) > 2 or (len(parts) == 2 and len(parts[1]) >= 3):
			s = s.replace(".", "")
	# Strip parens style negative: "(58000)" → "-58000".
	if s.startswith("(") and s.endswith(")"):
		s = "-" + s[1:-1]
	return Decimal(s)


def _detect_delimiter(text: str) -> str:
	first_line = text.split("\n", 1)[0]
	candidates = [",", ";", "\t", "|"]
	best = max(candidates, key=lambda c: first_line.count(c))
	return best if first_line.count(best) > 0 else ","


def _resolve_amount(
	raw: dict[str, str | None], headers: dict[str, str]
) -> Decimal | None:
	"""Return signed Decimal or None kalau row tidak punya amount info."""
	# Kasus 1: kolom debit + credit terpisah (format bank export).
	if "debit" in headers and "credit" in headers:
		debit = (raw.get(headers["debit"]) or "").strip()
		credit = (raw.get(headers["credit"]) or "").strip()
		if debit and debit not in {"0", "0,00", "0.00", "-"}:
			return -abs(_parse_amount(debit))
		if credit and credit not in {"0", "0,00", "0.00", "-"}:
			return abs(_parse_amount(credit))
		return None

	# Kasus 2: kolom amount (mungkin + kolom type untuk sign).
	if "amount" in headers:
		raw_amount = (raw.get(headers["amount"]) or "").strip()
		if not raw_amount or raw_amount == "-":
			return None
		amount = _parse_amount(raw_amount)
		# Hanya flip sign kalau kolom type SECARA EKSPLISIT mengindikasikan arah.
		# Kalau valuenya method/kategori (e.g. "Pembayaran Qris", "Transfer"),
		# trust sign dari kolom amount.
		if "type" in headers:
			tval = (raw.get(headers["type"]) or "").strip().lower()
			if tval in _TYPE_DEBIT_VALUES:
				amount = -abs(amount)
			elif tval in _TYPE_CREDIT_VALUES:
				amount = abs(amount)
		return amount

	return None


@register(ImportSourceType.manual_csv.value)
class ManualCsvParser:
	def parse(self, file_bytes: bytes) -> ParseResult:
		text = file_bytes.decode("utf-8-sig", errors="replace")
		text = text.replace("\r\n", "\n").replace("\r", "\n")
		delimiter = _detect_delimiter(text)
		all_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
		if not all_rows:
			return ParseResult()

		header_idx = _detect_header_row_index(all_rows)
		fieldnames = [c.strip() for c in all_rows[header_idx]]
		headers = _build_header_map(fieldnames)

		# Minimum yang dibutuhkan: date + (amount atau debit/credit).
		if "date" not in headers:
			return ParseResult()
		has_amount_source = (
			"amount" in headers or ("debit" in headers and "credit" in headers)
		)
		if not has_amount_source:
			return ParseResult()

		rows: list[ParsedRow] = []
		# File line of first data row = header_idx + 2 (1-based, header is +1).
		for i, raw_cells in enumerate(all_rows[header_idx + 1 :], start=header_idx + 2):
			raw = dict(zip(fieldnames, raw_cells))
			try:
				date_str = (raw.get(headers["date"]) or "").strip()
				if not date_str:
					continue
				amount = _resolve_amount(raw, headers)
				if amount is None:
					continue
				rows.append(
					ParsedRow(
						line_no=i,
						transaction_date=_parse_date(date_str),
						amount=amount,
						merchant_name=_pick(raw, headers, "merchant"),
						description=_pick(raw, headers, "description"),
						category=_pick(raw, headers, "category"),
						confidence_score=Decimal("1.00"),
						raw_text=delimiter.join(
							f"{k}={v}" for k, v in raw.items() if k is not None
						),
					)
				)
			except (KeyError, ValueError, InvalidOperation):
				continue
		return ParseResult(rows=rows)


def _pick(
	raw: dict[str, str | None], headers: dict[str, str], canonical: str
) -> str | None:
	if canonical not in headers:
		return None
	val = (raw.get(headers[canonical]) or "").strip()
	return val or None
