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
