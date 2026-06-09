"""Tests untuk ManualCsvParser smart header detection."""

import csv
import io
from pathlib import Path

from app.import_data.parsers.manual_csv import (
	ManualCsvParser,
	_detect_header_row_index,
)

_PLUANG_CSV = (
	Path(__file__).parent / "fixtures/vision/invest/pluang-transaction-report.csv"
)


def test_detect_header_row_falls_back_to_zero():
	# No recognizable aliases → legacy behavior (row 0 is header).
	rows = [["foo", "bar"], ["1", "2"]]
	assert _detect_header_row_index(rows) == 0


def test_detect_header_row_needs_two_matches():
	# Single alias match is below threshold → fall back to 0.
	rows = [["date", "whatever"], ["x", "y"]]
	assert _detect_header_row_index(rows) == 0


def test_detect_header_row_picks_pluang_line_8():
	text = _PLUANG_CSV.read_text(encoding="utf-8-sig")
	rows = list(csv.reader(io.StringIO(text)))
	# Real header is the 8th line → index 7.
	assert _detect_header_row_index(rows) == 7


def test_pluang_csv_extracts_rows():
	result = ManualCsvParser().parse(_PLUANG_CSV.read_bytes())
	assert len(result.rows) >= 5


def test_normal_csv_header_at_row_0_still_works():
	csv_bytes = (
		b"date,amount,merchant\n"
		b"2026-04-15,-58000,Gojek\n"
		b"2026-04-16,5000000,Gaji\n"
	)
	result = ManualCsvParser().parse(csv_bytes)
	assert len(result.rows) == 2
