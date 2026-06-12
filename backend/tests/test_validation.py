"""Unit tests for math-check + confidence warning utilities."""

from datetime import date
from decimal import Decimal

from app.import_data.parsers.base import ParsedRow
from app.import_data.validation import apply_balance_warning, run_balance_check


def _row(amount: str, confidence: str = "1.00") -> ParsedRow:
	return ParsedRow(
		line_no=1,
		transaction_date=date(2026, 1, 1),
		amount=Decimal(amount),
		description="test",
		confidence_score=Decimal(confidence),
	)


# ---------- run_balance_check ----------

def test_balance_check_matches_when_sum_equals_delta():
	rows = [_row("100"), _row("-50")]
	result = run_balance_check(rows, saldo_awal=Decimal("1000"), saldo_akhir=Decimal("1050"))
	assert result is not None
	assert result.matches is True
	assert result.sum_transactions == Decimal("50")
	assert result.expected_delta == Decimal("50")
	assert result.diff_pct == Decimal("0.00")


def test_balance_check_within_1pct_tolerance_returns_match():
	# expected delta 1000, actual 1005 → 0.5% diff < 1% tolerance
	rows = [_row("1005")]
	result = run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=Decimal("1000"))
	assert result.matches is True


def test_balance_check_mismatch_outside_tolerance():
	# expected delta 1000, actual 1100 → 10% diff
	rows = [_row("1100")]
	result = run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=Decimal("1000"))
	assert result.matches is False
	assert result.diff_pct == Decimal("10.00")


def test_balance_check_zero_delta_with_nonzero_sum_is_mismatch():
	# saldo unchanged but transactions sum to non-zero — clearly miss
	rows = [_row("500")]
	result = run_balance_check(rows, saldo_awal=Decimal("1000"), saldo_akhir=Decimal("1000"))
	assert result.matches is False
	assert result.diff_pct == Decimal("100.00")


def test_balance_check_zero_delta_zero_sum_matches():
	result = run_balance_check([], saldo_awal=Decimal("1000"), saldo_akhir=Decimal("1000"))
	assert result.matches is True
	assert result.diff_pct == Decimal("0")


def test_balance_check_missing_saldo_awal_returns_none():
	rows = [_row("100")]
	assert run_balance_check(rows, saldo_awal=None, saldo_akhir=Decimal("100")) is None


def test_balance_check_missing_saldo_akhir_returns_none():
	rows = [_row("100")]
	assert run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=None) is None


def test_balance_check_negative_balance_change():
	# user spent money: saldo 1000 → 200, sum should be -800
	rows = [_row("-500"), _row("-300")]
	result = run_balance_check(rows, saldo_awal=Decimal("1000"), saldo_akhir=Decimal("200"))
	assert result.matches is True
	assert result.sum_transactions == Decimal("-800")
	assert result.expected_delta == Decimal("-800")


def test_balance_check_exactly_at_tolerance_boundary_matches():
	# diff_pct == 1.00% → matches (≤ tolerance)
	rows = [_row("1010")]  # 1% diff from 1000
	result = run_balance_check(rows, saldo_awal=Decimal("0"), saldo_akhir=Decimal("1000"))
	assert result.matches is True
	assert result.diff_pct == Decimal("1.00")


# ---------- apply_balance_warning ----------

def test_apply_balance_warning_caps_high_confidence():
	rows = [_row("100", "1.00"), _row("200", "0.90")]
	apply_balance_warning(rows)
	assert rows[0].confidence_score == Decimal("0.70")
	assert rows[1].confidence_score == Decimal("0.70")


def test_apply_balance_warning_leaves_low_confidence_alone():
	rows = [_row("100", "0.50"), _row("200", "0.30")]
	apply_balance_warning(rows)
	assert rows[0].confidence_score == Decimal("0.50")
	assert rows[1].confidence_score == Decimal("0.30")


def test_apply_balance_warning_custom_cap():
	rows = [_row("100", "1.00")]
	apply_balance_warning(rows, cap=Decimal("0.50"))
	assert rows[0].confidence_score == Decimal("0.50")
