"""Tests untuk PdfVisionParser.

Unit tests pakai mocked fitz + mocked ImageVisionParser supaya tidak
panggil Groq / tidak butuh real PDF. Live integration tests dipisah ke
test_dispatcher_live.py.
"""

from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock

import pytest

from app.import_data.parsers.base import ParsedRow, ParseResult


def _make_row(line_no: int, desc: str = "test") -> ParsedRow:
	return ParsedRow(
		line_no=line_no,
		transaction_date=date(2026, 1, 1),
		amount=Decimal("1000"),
		currency="IDR",
		merchant_name=None,
		description=desc,
		category=None,
		confidence_score=Decimal("0.90"),
		raw_text='{"date":"2026-01-01"}',
	)


def _setup_mocks(monkeypatch, num_pages: int, rows_per_page: list[list[ParsedRow]]):
	"""Mock fitz.open to return doc with N pages, and ImageVisionParser to return
	ParseResult with rows_per_page[i] for page i."""
	from app.import_data.parsers import pdf_vision

	pages = []
	for i in range(num_pages):
		page = MagicMock()
		pix = MagicMock()
		pix.tobytes.return_value = b"fake_png_page_" + str(i).encode()
		page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	mock_doc.__len__.return_value = num_pages
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kwargs: mock_doc)

	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		return ParseResult(rows=rows_per_page[i], content_type="statement")
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)
	return call_idx


def test_pdf_vision_parse_corrupted_pdf_returns_empty(monkeypatch):
	from app.import_data.parsers import pdf_vision
	def _raise(**kw):
		raise ValueError("corrupted")
	monkeypatch.setattr(pdf_vision.fitz, "open", _raise)
	parser = pdf_vision.PdfVisionParser()
	assert parser.parse(b"garbage").rows == []


def test_pdf_vision_parse_empty_pdf_returns_empty(monkeypatch):
	from app.import_data.parsers import pdf_vision
	_setup_mocks(monkeypatch, num_pages=0, rows_per_page=[])
	parser = pdf_vision.PdfVisionParser()
	assert parser.parse(b"%PDF-1.4 mock").rows == []


def test_pdf_vision_parse_single_page(monkeypatch):
	from app.import_data.parsers import pdf_vision
	_setup_mocks(
		monkeypatch,
		num_pages=1,
		rows_per_page=[[_make_row(1, "row a"), _make_row(2, "row b")]],
	)
	parser = pdf_vision.PdfVisionParser()
	result = parser.parse(b"%PDF-1.4 mock")
	rows = result.rows
	assert len(rows) == 2
	assert rows[0].line_no == 1
	assert rows[1].line_no == 2
	assert rows[0].description == "row a"
	assert rows[1].description == "row b"


def test_pdf_vision_parse_concats_multiple_pages_with_global_line_no(monkeypatch):
	"""3 pages: page1 has 2 rows, page2 has 1 row, page3 has 3 rows → 6 total,
	line_no global 1..6."""
	from app.import_data.parsers import pdf_vision
	_setup_mocks(
		monkeypatch,
		num_pages=3,
		rows_per_page=[
			[_make_row(1, "p1r1"), _make_row(2, "p1r2")],
			[_make_row(1, "p2r1")],
			[_make_row(1, "p3r1"), _make_row(2, "p3r2"), _make_row(3, "p3r3")],
		],
	)
	parser = pdf_vision.PdfVisionParser()
	result = parser.parse(b"%PDF-1.4 mock")
	rows = result.rows
	assert len(rows) == 6
	# Verify global line_no renumber
	assert [r.line_no for r in rows] == [1, 2, 3, 4, 5, 6]
	# Verify description ordering preserved
	assert [r.description for r in rows] == ["p1r1", "p1r2", "p2r1", "p3r1", "p3r2", "p3r3"]


def test_pdf_vision_parse_skips_page_on_rasterize_failure(monkeypatch):
	"""Page 2 raises on get_pixmap → skipped, pages 1+3 still parsed."""
	from app.import_data.parsers import pdf_vision

	pages = []
	for i in range(3):
		page = MagicMock()
		if i == 1:
			page.get_pixmap.side_effect = RuntimeError("rasterize fail")
		else:
			pix = MagicMock()
			pix.tobytes.return_value = b"png" + str(i).encode()
			page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		return ParseResult(rows=[_make_row(1, f"page-call-{i}")], content_type="statement")
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	parser = pdf_vision.PdfVisionParser()
	result = parser.parse(b"%PDF mock")
	rows = result.rows
	assert len(rows) == 2  # pages 1 + 3 (page 2 skipped)
	assert [r.line_no for r in rows] == [1, 2]
	assert [r.description for r in rows] == ["page-call-0", "page-call-1"]


def test_pdf_vision_parse_skips_page_on_vision_failure(monkeypatch):
	"""ImageVisionParser.parse raises on 2nd call → skip, others kept."""
	from app.import_data.parsers import pdf_vision

	pages = []
	for i in range(3):
		page = MagicMock()
		pix = MagicMock()
		pix.tobytes.return_value = b"png" + str(i).encode()
		page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		if i == 1:
			raise RuntimeError("groq down")
		return ParseResult(rows=[_make_row(1, f"page-{i}")], content_type="statement")
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	parser = pdf_vision.PdfVisionParser()
	result = parser.parse(b"%PDF mock")
	rows = result.rows
	assert len(rows) == 2
	assert [r.description for r in rows] == ["page-0", "page-2"]


def test_pdf_vision_parse_passes_png_bytes_to_image_parser(monkeypatch):
	"""Verify the bytes passed to ImageVisionParser.parse are the pixmap PNG output."""
	from app.import_data.parsers import pdf_vision

	page = MagicMock()
	pix = MagicMock()
	pix.tobytes.return_value = b"\x89PNG\r\n\x1a\n_specific_marker_"
	page.get_pixmap.return_value = pix
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter([page])
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	captured = {}
	def fake_parse(self, file_bytes):
		captured["bytes"] = file_bytes
		return ParseResult()
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	pdf_vision.PdfVisionParser().parse(b"%PDF mock")
	assert captured["bytes"] == b"\x89PNG\r\n\x1a\n_specific_marker_"
	# Verify get_pixmap called with dpi=150
	page.get_pixmap.assert_called_once_with(dpi=150)
	# Verify tobytes called with "png"
	pix.tobytes.assert_called_once_with("png")


def test_pdf_vision_aggregates_holdings_across_pages(monkeypatch):
	from app.import_data.parsers import pdf_vision
	from app.import_data.parsers.base import ParsedHolding

	pages = []
	for i in range(2):
		page = MagicMock()
		pix = MagicMock()
		pix.tobytes.return_value = b"png" + str(i).encode()
		page.get_pixmap.return_value = pix
		pages.append(page)
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	def fake_parse(self, file_bytes):
		# Page 1: 1 holding, page 2: 2 holdings
		if file_bytes.endswith(b"0"):
			return ParseResult(
				rows=[],
				holdings=[ParsedHolding(line_no=1, ticker="QQQ", qty=Decimal("0.225"))],
				content_type="holding",
			)
		return ParseResult(
			rows=[],
			holdings=[
				ParsedHolding(line_no=1, ticker="BTC", qty=Decimal("0.001")),
				ParsedHolding(line_no=2, ticker="GOLD", qty=Decimal("9.378")),
			],
			content_type="holding",
		)
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	result = pdf_vision.PdfVisionParser().parse(b"%PDF mock")
	assert result.content_type == "holding"
	assert len(result.holdings) == 3
	# Global line_no renumber
	assert [h.line_no for h in result.holdings] == [1, 2, 3]
	assert [h.ticker for h in result.holdings] == ["QQQ", "BTC", "GOLD"]


def test_pdf_vision_content_type_majority_vote(monkeypatch):
	from app.import_data.parsers import pdf_vision

	pages = [MagicMock() for _ in range(3)]
	for i, p in enumerate(pages):
		pix = MagicMock()
		pix.tobytes.return_value = b"png" + str(i).encode()
		p.get_pixmap.return_value = pix
	mock_doc = MagicMock()
	mock_doc.__iter__.return_value = iter(pages)
	monkeypatch.setattr(pdf_vision.fitz, "open", lambda **kw: mock_doc)

	types = ["statement", "statement", "receipt"]
	call_idx = {"n": 0}
	def fake_parse(self, file_bytes):
		i = call_idx["n"]
		call_idx["n"] += 1
		return ParseResult(content_type=types[i])
	monkeypatch.setattr(pdf_vision.ImageVisionParser, "parse", fake_parse)

	result = pdf_vision.PdfVisionParser().parse(b"%PDF mock")
	assert result.content_type == "statement"  # 2 of 3 votes
