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
