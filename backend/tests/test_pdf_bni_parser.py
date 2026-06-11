"""Tests untuk parser BNI e-Statement PDF.

Helper tests pakai synthetic input. Integration tests pakai fixture PDF
yang di-gitignore di backend/tests/fixtures/bni/ (skip kalau tidak ada).
"""

from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.import_data.parsers.pdf_bni import (
	_BNI_KNOWN_CATEGORIES,
	_apply_bni_fallback,
	_parse_bni_amount,
	_parse_bni_date,
	classify_line,
)


# ---------- _parse_bni_date ----------

def test_parse_bni_date_october():
	assert _parse_bni_date("01 Oct 2025") == date(2025, 10, 1)


def test_parse_bni_date_february():
	assert _parse_bni_date("28 Feb 2026") == date(2026, 2, 28)


def test_parse_bni_date_invalid_returns_none():
	assert _parse_bni_date("not a date") is None
	assert _parse_bni_date("32 Oct 2025") is None
	assert _parse_bni_date("01 XYZ 2025") is None


# ---------- _parse_bni_amount ----------

def test_parse_bni_amount_positive():
	assert _parse_bni_amount("+100,000") == Decimal("100000")
	assert _parse_bni_amount("+7,500,000") == Decimal("7500000")


def test_parse_bni_amount_negative():
	assert _parse_bni_amount("-2,000,000") == Decimal("-2000000")
	assert _parse_bni_amount("-1,000") == Decimal("-1000")


def test_parse_bni_amount_unsigned_treated_positive():
	assert _parse_bni_amount("69,040") == Decimal("69040")


def test_parse_bni_amount_invalid_returns_none():
	assert _parse_bni_amount("abc") is None
	assert _parse_bni_amount("") is None


# ---------- classify_line ----------

def test_classify_line_date_with_category():
	kind, payload = classify_line("01 Oct 2025 Transfer")
	assert kind == "date_cat"
	assert payload == (date(2025, 10, 1), "Transfer")


def test_classify_line_date_with_multiword_category():
	kind, payload = classify_line("02 Oct 2025 Pembayaran Qris")
	assert kind == "date_cat"
	assert payload == (date(2025, 10, 2), "Pembayaran Qris")


def test_classify_line_amount_balance():
	kind, payload = classify_line("+100,000 169,040")
	assert kind == "amt_bal"
	assert payload == (Decimal("100000"), Decimal("169040"))


def test_classify_line_amount_balance_negative():
	kind, payload = classify_line("-2,000,000 5,669,040")
	assert kind == "amt_bal"
	assert payload == (Decimal("-2000000"), Decimal("5669040"))


def test_classify_line_time_description():
	kind, payload = classify_line("19:27:33 WIB BNI - PT AIRPAY INTERNATIONAL INDONESIA")
	assert kind == "time_desc"
	assert payload == ("19:27:33", "BNI - PT AIRPAY INTERNATIONAL INDONESIA")


def test_classify_line_time_with_short_description():
	kind, payload = classify_line("03:37:16 WIB MANDIRI -")
	assert kind == "time_desc"
	assert payload == ("03:37:16", "MANDIRI -")


def test_classify_line_skip_header():
	assert classify_line("Laporan Mutasi Rekening")[0] == "skip"
	assert classify_line("Periode: 1 - 31 Oktober 2025")[0] == "skip"
	assert classify_line("Saldo Awal 69,040")[0] == "skip"
	assert classify_line("Saldo Akhir 50,036")[0] == "skip"
	assert classify_line("Tanggal & Waktu Rincian Transaksi Nominal (IDR) Saldo (IDR)")[0] == "skip"
	assert classify_line("")[0] == "skip"
	assert classify_line("   ")[0] == "skip"


def test_classify_line_skip_footer():
	# Footer pattern variation
	footer = "peserta penjaminan Lembaga Penjamin Simpanan (LPS). 1 dari 5"
	assert classify_line(footer)[0] == "skip"


# ---------- _apply_bni_fallback ----------

def test_apply_bni_fallback_when_categorizer_returns_none():
	# Biaya → Biaya Bank
	assert _apply_bni_fallback(None, "Biaya") == "Biaya Bank"
	# Ewallet → Top Up
	assert _apply_bni_fallback(None, "Ewallet") == "Top Up"
	# Transfer → Transfer
	assert _apply_bni_fallback(None, "Transfer") == "Transfer"


def test_apply_bni_fallback_generic_categories_stay_none():
	assert _apply_bni_fallback(None, "Pembayaran Qris") is None
	assert _apply_bni_fallback(None, "Virtual Account") is None
	assert _apply_bni_fallback(None, "Tarik Tunai") is None
	assert _apply_bni_fallback(None, "Lainnya") is None


def test_apply_bni_fallback_does_not_override_categorizer_match():
	# Kalau categorizer sudah dapat hasil, fallback tidak overwrite.
	assert _apply_bni_fallback("Makan & Minum", "Biaya") == "Makan & Minum"
	assert _apply_bni_fallback("Pemasukan", "Transfer") == "Pemasukan"


def test_bni_known_categories_set():
	assert _BNI_KNOWN_CATEGORIES == {
		"Biaya", "Ewallet", "Lainnya",
		"Pembayaran Qris", "Tarik Tunai",
		"Transfer", "Virtual Account",
	}


# ---------- Integration tests dengan fixture PDFs ----------

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "bni"


def _load_fixture(name: str) -> bytes:
	"""Load fixture PDF; pytest.skip kalau tidak ada (CI environment)."""
	path = FIXTURE_DIR / name
	if not path.exists():
		pytest.skip(f"Fixture {name} tidak tersedia (gitignored)")
	return path.read_bytes()


def _parser():
	from app.import_data.parsers.pdf_bni import PdfBniParser
	return PdfBniParser()


def test_parse_oct_2025_count():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	assert len(rows) == 57


def test_parse_nov_2025_count():
	rows = _parser().parse(_load_fixture("bni-2025-11.pdf"))
	assert len(rows) == 37


def test_parse_feb_2026_count():
	rows = _parser().parse(_load_fixture("bni-2026-02.pdf"))
	assert len(rows) == 35


def test_parse_apr_2026_count():
	rows = _parser().parse(_load_fixture("bni-2026-04.pdf"))
	assert len(rows) == 47


def test_parse_oct_2025_dates_in_range():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	for r in rows:
		assert r.transaction_date.year == 2025
		assert r.transaction_date.month == 10
		assert 1 <= r.transaction_date.day <= 31


def test_parse_oct_2025_signs_match_summary():
	"""Sum signed amounts harus sesuai summary dari header PDF.

	bni-2025-10.pdf: Total Pemasukan +13,687,644 / Total Pengeluaran -13,706,648.
	"""
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	total_in = sum((r.amount for r in rows if r.amount > 0), Decimal("0"))
	total_out = sum((r.amount for r in rows if r.amount < 0), Decimal("0"))
	assert total_in == Decimal("13687644")
	assert total_out == Decimal("-13706648")


def test_parse_oct_2025_first_tx_correct():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	first = rows[0]
	assert first.line_no == 1
	assert first.transaction_date == date(2025, 10, 1)
	assert first.amount == Decimal("100000")
	assert first.currency == "IDR"
	assert first.description is not None and "AIRPAY" in first.description.upper()


def test_parse_categorizer_pemasukan_special_case():
	"""Description 'MANDIRI -' (exact, no name) → 'Pemasukan' via existing categorizer."""
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	mandiri_rows = [r for r in rows if r.description and r.description.strip().upper() == "MANDIRI -"]
	assert len(mandiri_rows) >= 1
	for r in mandiri_rows:
		assert r.category == "Pemasukan"


def test_parse_categorizer_biaya_fallback():
	"""Tx dengan deskripsi generic 'Admin Kartu' / 'EWALLET TOP UP GOPAY' bisa
	dapat 'Biaya Bank' via BNI fallback (kalau categorizer tidak match).
	"""
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	# Cari row dengan amount kecil negatif yang punya BNI category 'Biaya'.
	# Setidaknya ada beberapa biaya transfer / admin di sample.
	biaya_bank_rows = [r for r in rows if r.category == "Biaya Bank"]
	assert len(biaya_bank_rows) >= 1


def test_parse_empty_bytes_returns_empty():
	assert _parser().parse(b"") == []


def test_parse_garbage_bytes_returns_empty():
	assert _parser().parse(b"this is not a PDF file") == []


def test_parse_raw_text_includes_three_lines():
	rows = _parser().parse(_load_fixture("bni-2025-10.pdf"))
	# raw_text harus berisi tanggal, jam, dan amount line — pakai separator.
	first = rows[0]
	assert " | " in first.raw_text
	assert "Oct 2025" in first.raw_text
	assert "WIB" in first.raw_text
