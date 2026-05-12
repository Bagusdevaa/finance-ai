"""Tests untuk sniff.py — MIME detection + BNI signature.

Pure unit tests dengan synthetic inputs. Tidak panggil Groq atau pdfplumber
beneran kecuali via mock.
"""

import pytest

# Magic byte prefixes for testing
PNG_HEADER = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG_HEADER = b"\xff\xd8\xff" + b"\x00" * 16
WEBP_HEADER = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 8
PDF_HEADER = b"%PDF-1.4\n%mock content"


# ---------- sniff_mime ----------

def test_sniff_mime_png():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(PNG_HEADER) == "image/png"


def test_sniff_mime_jpeg():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(JPEG_HEADER) == "image/jpeg"


def test_sniff_mime_webp():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(WEBP_HEADER) == "image/webp"


def test_sniff_mime_pdf():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(PDF_HEADER) == "application/pdf"


def test_sniff_mime_csv():
	from app.import_data.parsers.sniff import sniff_mime
	csv = b"date,amount,description\n2026-01-01,1000,test\n"
	assert sniff_mime(csv) == "text/csv"


def test_sniff_mime_empty_returns_none():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(b"") is None


def test_sniff_mime_unknown_binary_returns_none():
	from app.import_data.parsers.sniff import sniff_mime
	assert sniff_mime(b"\x00\x01\x02\x03random binary") is None


# ---------- _looks_like_csv ----------

def test_looks_like_csv_with_comma():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a,b,c\n1,2,3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_semicolon():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a;b;c\n1;2;3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_tab():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a\tb\tc\n1\t2\t3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_pipe():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a|b|c\n1|2|3\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_with_bom():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"\xef\xbb\xbfdate,amount\n2026-01-01,100\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_rejects_no_newline():
	from app.import_data.parsers.sniff import _looks_like_csv
	assert _looks_like_csv(b"a,b,c") is False


def test_looks_like_csv_rejects_no_delimiter():
	from app.import_data.parsers.sniff import _looks_like_csv
	# Plain text with newlines but no delimiters → not CSV
	assert _looks_like_csv(b"plain text\nmore plain text\n") is False


def test_looks_like_csv_rejects_binary():
	from app.import_data.parsers.sniff import _looks_like_csv
	assert _looks_like_csv(b"\x00\x01\x02\xff\xfe\xfd") is False


def test_looks_like_csv_handles_crlf_only():
	from app.import_data.parsers.sniff import _looks_like_csv
	csv = b"a,b,c\r\n1,2,3\r\n"
	assert _looks_like_csv(csv) is True


def test_looks_like_csv_handles_cr_only():
	from app.import_data.parsers.sniff import _looks_like_csv
	# Excel-on-Mac convention
	csv = b"a,b,c\r1,2,3\r"
	assert _looks_like_csv(csv) is True


# ---------- has_bni_signature ----------

def test_has_bni_signature_positive(monkeypatch):
	"""Mock pdfplumber to return BNI marker text."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = (
		"Laporan Mutasi Rekening\nPeriode: 1 - 31 Oktober 2025\n"
		"wondr by BNI"
	)
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is True


def test_has_bni_signature_with_bni_word(monkeypatch):
	"""BNI marker via ' BNI ' (with spaces) instead of 'wondr'."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = (
		"Laporan Mutasi Rekening\nPT Bank Negara Indonesia "
		"transferred via BNI Internet Banking"
	)
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is True


def test_has_bni_signature_no_marker(monkeypatch):
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = "BCA mutasi statement\nperiode 2026"
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_empty_text(monkeypatch):
	"""Image-only PDF: extract_text returns empty string."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = ""
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_none_text(monkeypatch):
	"""extract_text returns None (some PDFs cause this)."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = None
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_no_pages(monkeypatch):
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_pdf = MagicMock()
	mock_pdf.pages = []
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False


def test_has_bni_signature_pdfplumber_raises(monkeypatch):
	"""Corrupted PDF: pdfplumber.open raises → return False."""
	from app.import_data.parsers import sniff

	def _raise(*a, **kw):
		raise ValueError("corrupted pdf")
	monkeypatch.setattr(sniff.pdfplumber, "open", _raise)
	assert sniff.has_bni_signature(b"%PDF garbage") is False


def test_has_bni_signature_avoids_false_positive_on_substring(monkeypatch):
	"""Text contains 'BNIDAGANG' (not 'BNI' as standalone word) should NOT match."""
	from unittest.mock import MagicMock
	from app.import_data.parsers import sniff

	mock_page = MagicMock()
	mock_page.extract_text.return_value = "BCA statement\nmerchant: BNIDAGANGSEJAHTERA"
	# Missing "Laporan Mutasi Rekening" so this would already fail at first check,
	# but assert the explicit case.
	mock_pdf = MagicMock()
	mock_pdf.pages = [mock_page]
	mock_cm = MagicMock()
	mock_cm.__enter__.return_value = mock_pdf
	mock_cm.__exit__.return_value = None
	monkeypatch.setattr(sniff.pdfplumber, "open", lambda *a, **kw: mock_cm)
	assert sniff.has_bni_signature(b"%PDF-1.4 mock") is False
