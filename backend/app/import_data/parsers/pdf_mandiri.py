"""Mandiri PDF parser. TODO: implement when sample mutasi PDFs are available."""

from app.import_data.models import ImportSourceType
from app.import_data.parsers.base import ParsedRow, register


@register(ImportSourceType.pdf_mandiri.value)
class PdfMandiriParser:
	def parse(self, file_bytes: bytes) -> list[ParsedRow]:
		raise NotImplementedError(
			"PDF Mandiri parser belum diimplementasikan; pakai manual_csv untuk sekarang"
		)
