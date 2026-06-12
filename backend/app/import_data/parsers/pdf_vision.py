"""PDF → vision parser composition.

Rasterize tiap halaman PDF jadi PNG via PyMuPDF, delegate ke ImageVisionParser
buat extract transactions per halaman. Concat hasil dengan line_no global.

DPI = 150 (balance quality vs file size — A4 page ~1.5MB PNG, well within
ImageVisionParser 10MB limit).

Page-level isolation: 1 halaman gagal (rasterize crash atau vision call crash)
tidak abort entire parse. Skip halaman, lanjut. Acceptable trade-off untuk
multi-page statement.
"""

from collections import Counter

import fitz

from app.import_data.parsers.base import ParsedHolding, ParsedRow, ParseResult
from app.import_data.parsers.image_vision import ImageVisionParser


class PdfVisionParser:
	def parse(self, file_bytes: bytes) -> ParseResult:
		try:
			doc = fitz.open(stream=file_bytes, filetype="pdf")
		except Exception:
			return ParseResult()

		image_parser = ImageVisionParser()
		all_rows: list[ParsedRow] = []
		all_holdings: list[ParsedHolding] = []
		content_types_seen: list[str] = []
		first_balance_summary_raw: dict | None = None
		next_line_no = 1
		next_h_line_no = 1

		try:
			for page in doc:
				try:
					pix = page.get_pixmap(dpi=150)
					png_bytes = pix.tobytes("png")
				except Exception:
					continue
				try:
					page_result = image_parser.parse(png_bytes)
				except Exception:
					continue

				content_types_seen.append(page_result.content_type)
				for row in page_result.rows:
					row.line_no = next_line_no
					next_line_no += 1
					all_rows.append(row)
				for h in page_result.holdings:
					h.line_no = next_h_line_no
					next_h_line_no += 1
					all_holdings.append(h)
				# Take first page's balance_summary (typically only page 1 has it for statements)
				if first_balance_summary_raw is None:
					raw = getattr(page_result, "_balance_summary_raw", None)
					if raw is not None:
						first_balance_summary_raw = raw
		finally:
			doc.close()

		# Aggregate content_type: most common across pages
		if content_types_seen:
			content_type = Counter(content_types_seen).most_common(1)[0][0]
		else:
			content_type = "unknown"

		result = ParseResult(
			rows=all_rows,
			holdings=all_holdings,
			content_type=content_type,
		)
		if first_balance_summary_raw is not None:
			result._balance_summary_raw = first_balance_summary_raw  # type: ignore[attr-defined]
		return result
