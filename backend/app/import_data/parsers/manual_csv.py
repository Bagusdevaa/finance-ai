"""Manual CSV parser.

Format kolom (header line 1):
  date,amount,merchant,description,category

- date: berbagai format diterima — ISO (YYYY-MM-DD), DD/MM/YYYY, DD/MM/YY, MM/DD/YYYY
- amount: signed (positif = income, negatif = expense). Boleh format ID (1.500,00) atau US (1500.00)
- merchant/description/category: opsional, empty → None

Delimiter di auto-detect — bisa "," (US) atau ";" (Indonesia/Eropa).
Row malformed di-skip (jangan gagalkan keseluruhan job).
"""

import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


_DATE_FORMATS = (
	"%Y-%m-%d",
	"%d/%m/%Y",
	"%d/%m/%y",
	"%m/%d/%Y",
	"%d-%m-%Y",
	"%d-%m-%y",
)


def _parse_date(s: str) -> date:
	for fmt in _DATE_FORMATS:
		try:
			return datetime.strptime(s, fmt).date()
		except ValueError:
			continue
	# Last resort: ISO via fromisoformat (handles 'YYYY-MM-DD HH:MM:SS' too)
	return date.fromisoformat(s[:10])


def _parse_amount(s: str) -> Decimal:
	# Excel Indonesia kadang export "Rp 1.500,00" — strip currency, normalize separator.
	s = s.replace("Rp", "").replace("rp", "").strip()
	# Heuristik separator desimal: kalau ada "," dan posisinya setelah "." terakhir,
	# anggap "," desimal (format ID/EU). Selain itu format US.
	if "," in s and "." in s:
		if s.rfind(",") > s.rfind("."):
			s = s.replace(".", "").replace(",", ".")
		else:
			s = s.replace(",", "")
	elif "," in s:
		# Hanya ","; kalau ada 2+ digit setelah, anggap desimal ID; kalau ribuan, strip.
		dec = s.split(",")
		if len(dec) == 2 and len(dec[1]) <= 2:
			s = s.replace(",", ".")
		else:
			s = s.replace(",", "")
	return Decimal(s)


def _detect_delimiter(text: str) -> str:
	# Cek baris pertama (header) — pilih yang paling banyak muncul.
	first_line = text.split("\n", 1)[0]
	candidates = [",", ";", "\t", "|"]
	best = max(candidates, key=lambda c: first_line.count(c))
	return best if first_line.count(best) > 0 else ","


@register(ImportSourceType.manual_csv.value)
class ManualCsvParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		# utf-8-sig handles BOM yang sering ditambahkan Excel.
		text = file_bytes.decode("utf-8-sig", errors="replace")
		# Normalize line endings — Excel on Mac saves \r, Windows \r\n.
		text = text.replace("\r\n", "\n").replace("\r", "\n")
		delimiter = _detect_delimiter(text)
		reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
		rows: list[ParsedRow] = []
		for i, raw in enumerate(reader, start=2):
			try:
				date_str = (raw.get("date") or "").strip()
				amount_str = (raw.get("amount") or "").strip()
				if not date_str or not amount_str:
					continue
				rows.append(
					ParsedRow(
						line_no=i,
						transaction_date=_parse_date(date_str),
						amount=_parse_amount(amount_str),
						merchant_name=(raw.get("merchant") or "").strip() or None,
						description=(raw.get("description") or "").strip() or None,
						category=(raw.get("category") or "").strip() or None,
						confidence_score=Decimal("1.00"),
						raw_text=delimiter.join(
							f"{k}={v}" for k, v in raw.items() if k is not None
						),
					)
				)
			except (KeyError, ValueError, InvalidOperation):
				continue
		return rows
