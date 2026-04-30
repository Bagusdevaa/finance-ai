"""Manual CSV parser.

Format kolom (header line 1):
  date,amount,merchant,description,category

- date: ISO 8601 (YYYY-MM-DD)
- amount: signed Decimal (positif = income, negatif = expense)
- merchant/description/category: opsional, empty cell → None

Row malformed di-skip (jangan gagalkan keseluruhan job).
"""

import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


@register(ImportSourceType.manual_csv.value)
class ManualCsvParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		# utf-8-sig handles BOM yang sering ditambahkan Excel.
		text = file_bytes.decode("utf-8-sig", errors="replace")
		reader = csv.DictReader(io.StringIO(text))
		rows: list[ParsedRow] = []
		# start=2 karena header adalah line 1.
		for i, raw in enumerate(reader, start=2):
			try:
				date_str = (raw.get("date") or "").strip()
				amount_str = (raw.get("amount") or "").strip()
				if not date_str or not amount_str:
					continue
				rows.append(
					ParsedRow(
						line_no=i,
						transaction_date=date.fromisoformat(date_str),
						amount=Decimal(amount_str),
						merchant_name=(raw.get("merchant") or "").strip() or None,
						description=(raw.get("description") or "").strip() or None,
						category=(raw.get("category") or "").strip() or None,
						confidence_score=Decimal("1.00"),
						raw_text=",".join(
							f"{k}={v}" for k, v in raw.items() if k is not None
						),
					)
				)
			except (KeyError, ValueError, InvalidOperation):
				# Skip malformed row, lanjut row berikutnya.
				continue
		return rows
