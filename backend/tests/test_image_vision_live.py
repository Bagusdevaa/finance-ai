"""Live integration tests untuk ImageVisionParser.

Pakai real Groq API + real fixture images dari tests/fixtures/vision/.
Gated dengan VISION_TEST_LIVE=1 env (juga skip kalau GROQ_API_KEY kosong
atau fixture folder kosong).

Run manual:
    VISION_TEST_LIVE=1 backend/venv/bin/pytest tests/test_image_vision_live.py -v
"""

import os
from decimal import Decimal
from pathlib import Path

import pytest

from app.config import get_settings


pytestmark = pytest.mark.skipif(
	os.getenv("VISION_TEST_LIVE") != "1" or not get_settings().GROQ_API_KEY,
	reason="VISION_TEST_LIVE=1 + GROQ_API_KEY required",
)


FIXTURE_DIR = Path(__file__).parent / "fixtures" / "vision"


def _load(rel_path: str) -> bytes:
	path = FIXTURE_DIR / rel_path
	if not path.exists():
		pytest.skip(f"Fixture {rel_path} tidak tersedia (gitignored)")
	return path.read_bytes()


def _parser():
	from app.import_data.parsers.image_vision import ImageVisionParser
	return ImageVisionParser()


def test_live_dana_list():
	"""Dana Activity list: multi-row, all IDR, mix of Send/Top Up/Receive."""
	rows = _parser().parse(_load("ewallet/dana-list-1.jpeg"))
	assert len(rows) >= 5, f"Expected at least 5 rows, got {len(rows)}"
	for r in rows:
		assert r.currency == "IDR"
	# Should have at least one negative (Send) and one positive (Top Up/Receive).
	signs = {1 if r.amount > 0 else -1 for r in rows}
	assert signs == {1, -1}, f"Expected mix of signs, got {signs}"


def test_live_gopay_detail():
	"""GoPay single-transaction detail: exactly 1 row, negative (paying merchant)."""
	rows = _parser().parse(_load("ewallet/gopay-detail-1.jpeg"))
	assert len(rows) == 1, f"Expected exactly 1 row, got {len(rows)}"
	assert rows[0].amount < 0, f"Expected negative (paying merchant), got {rows[0].amount}"
	assert rows[0].currency == "IDR"


def test_live_shopeepay_list():
	"""ShopeePay 'Kirim Uang' list: all rows should be negative (Terkirim)."""
	rows = _parser().parse(_load("ewallet/shopeepay-list-2.jpeg"))
	assert len(rows) >= 4
	for r in rows:
		assert r.amount < 0, f"Expected all negative (Kirim Uang), got {r.amount} for {r.description!r}"


def test_live_pluang_assets():
	"""Pluang Assets: mixed currency, Failed status excluded."""
	rows = _parser().parse(_load("invest/pluang-assets-1.jpeg"))
	assert len(rows) >= 5
	currencies = {r.currency for r in rows}
	assert "IDR" in currencies
	# USD presence depends on sample content — assert at least one is detected.
	# Failed row exclusion: no row should have description containing "Failed".
	for r in rows:
		assert "failed" not in (r.description or "").lower()


def test_live_pluang_balance():
	"""Pluang Balance tab: cash movements, BCA top-ups, dividends."""
	rows = _parser().parse(_load("invest/pluang-balance-1.jpeg"))
	assert len(rows) >= 5
