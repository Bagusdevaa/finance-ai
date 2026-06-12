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
