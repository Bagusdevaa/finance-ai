"""Live integration tests untuk Smart Import Dispatcher.

Pakai real Groq API + real fixture files. Gated dengan VISION_TEST_LIVE=1
(plus GROQ_API_KEY non-empty). PM trigger manual setelah agent selesai.

Run manual:
    VISION_TEST_LIVE=1 backend/venv/bin/pytest tests/test_dispatcher_live.py -v
"""

import os
from pathlib import Path

import pytest

from app.config import get_settings


pytestmark = pytest.mark.skipif(
	os.getenv("VISION_TEST_LIVE") != "1" or not get_settings().GROQ_API_KEY,
	reason="VISION_TEST_LIVE=1 + GROQ_API_KEY required",
)


FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load(rel_path: str) -> bytes:
	path = FIXTURE_DIR / rel_path
	if not path.exists():
		pytest.skip(f"Fixture {rel_path} tidak tersedia (gitignored)")
	return path.read_bytes()


def test_live_bni_pdf_routes_to_pdf_bni(monkeypatch):
	"""BNI PDF should dispatch to PdfBniParser (text-based, no Groq call)."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.pdf_bni import PdfBniParser

	parser = dispatch(_load("bni/bni-2025-10.pdf"))
	assert isinstance(parser, PdfBniParser)
	# Actually parse to confirm extraction still works (expected 57 rows from Phase 1).
	rows = parser.parse(_load("bni/bni-2025-10.pdf"))
	assert len(rows) == 57


def test_live_dana_image_routes_to_image_vision():
	"""Dana JPEG → ImageVisionParser. Real Groq call."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.image_vision import ImageVisionParser

	file_bytes = _load("vision/ewallet/dana-list-1.jpeg")
	parser = dispatch(file_bytes)
	assert isinstance(parser, ImageVisionParser)
	rows = parser.parse(file_bytes)
	assert len(rows) >= 5, f"Expected at least 5 rows, got {len(rows)}"


def test_live_mandiri_pdf_via_rasterize_vision():
	"""Mandiri image-only PDF → dispatcher routes to PdfVisionParser →
	rasterize 3 pages → 3 Groq vision calls → concat rows.

	Sample statement structure: page 1 = cover, page 2 = account summary,
	page 3 = transaction table with 2 admin-fee debits (Biaya Adm Rp 6.000
	+ Saldo Min Rp 3.378). Allow 1-4 to tolerate vision variance.
	"""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.pdf_vision import PdfVisionParser

	file_bytes = _load("mandiri/mandiri-statement.pdf")
	parser = dispatch(file_bytes)
	assert isinstance(parser, PdfVisionParser)
	rows = parser.parse(file_bytes)
	assert 1 <= len(rows) <= 4, (
		f"Mandiri sample has 2 admin-fee txs; expected 1-4 rows, got {len(rows)}"
	)
	# Sanity: line_no should be globally numbered starting from 1
	assert [r.line_no for r in rows] == list(range(1, len(rows) + 1))
	# All extracted txs should be negative (admin fees / debits)
	assert all(r.amount < 0 for r in rows), (
		f"Mandiri sample has only debit (admin fee) txs, got: "
		f"{[(r.description, r.amount) for r in rows]}"
	)


def test_live_permata_pdf_via_rasterize_vision():
	"""Permata image-only PDF → PdfVisionParser → 2 Groq calls.

	Sample period (Apr 2026) has NO real transactions — TOTAL DEBET=0 and
	TOTAL KREDIT=0. Parser should return empty list. Test validates:
	(1) dispatcher routes non-BNI PDF to PdfVisionParser,
	(2) rasterize+vision pipeline doesn't crash on multi-page 0-tx PDF,
	(3) prompt's skip-SALDO-AWAL rule prevents false positives.
	"""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.pdf_vision import PdfVisionParser

	file_bytes = _load("permata/permatabank-statement.pdf")
	parser = dispatch(file_bytes)
	assert isinstance(parser, PdfVisionParser)
	rows = parser.parse(file_bytes)
	# Permata 0-tx period: expect 0 rows, tolerate up to 2 for vision variance.
	assert 0 <= len(rows) <= 2, (
		f"Permata sample period has 0 real txs; expected 0-2 rows "
		f"(vision variance OK), got {len(rows)}: "
		f"{[(r.description, r.amount) for r in rows[:3]]}"
	)


def test_live_csv_bytes_routes_to_manual_csv():
	"""Inline CSV bytes → ManualCsvParser. No Groq call."""
	from app.import_data.dispatcher import dispatch
	from app.import_data.parsers.manual_csv import ManualCsvParser

	csv = (
		b"date,amount,merchant,description,category\n"
		b"2026-04-15,-58000,Gojek,GoFood Sudirman,Makan\n"
		b"2026-04-16,5000000,PT Konstruksi Jaya,Gaji April,Pemasukan\n"
	)
	parser = dispatch(csv)
	assert isinstance(parser, ManualCsvParser)
	rows = parser.parse(csv)
	assert len(rows) == 2
