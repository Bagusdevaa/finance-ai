"""Math-check + confidence warning utilities for import accuracy.

run_balance_check: Compare sum of extracted transactions vs expected delta
(saldo_akhir - saldo_awal). Within 1% tolerance = match. Mismatch = strong
signal that vision miss or hallucinated rows.

apply_balance_warning: On mismatch, cap confidence di semua row ke max 0.70
(warn tier) supaya review screen highlight rows yang perlu cek.
"""

from decimal import Decimal

from app.import_data.parsers.base import BalanceCheck, ParsedRow


_TOLERANCE_PCT = Decimal("1.00")  # 1%


def run_balance_check(
	transactions: list[ParsedRow],
	saldo_awal: Decimal | None,
	saldo_akhir: Decimal | None,
) -> BalanceCheck | None:
	"""Math-check: sum(transactions) == saldo_akhir - saldo_awal?

	Returns None if saldo data missing (parser tidak extract atau content_type
	bukan statement). Returns BalanceCheck with matches=False if delta > 1%
	of expected.

	Note: parse-time snapshot. User exclude rows nanti tidak re-run check.
	"""
	if saldo_awal is None or saldo_akhir is None:
		return None

	sum_txs = sum((r.amount for r in transactions), Decimal("0"))
	expected_delta = saldo_akhir - saldo_awal

	if expected_delta == 0:
		# Saldo unchanged. If sum_txs juga 0 → match. Else mismatch (100% off).
		diff_pct = Decimal("100.00") if sum_txs != 0 else Decimal("0")
	else:
		diff = abs(sum_txs - expected_delta)
		diff_pct = (diff / abs(expected_delta) * 100).quantize(Decimal("0.01"))

	matches = diff_pct <= _TOLERANCE_PCT

	return BalanceCheck(
		saldo_awal=saldo_awal,
		saldo_akhir=saldo_akhir,
		sum_transactions=sum_txs,
		expected_delta=expected_delta,
		actual_delta=sum_txs,
		matches=matches,
		diff_pct=diff_pct,
	)


def apply_balance_warning(
	rows: list[ParsedRow],
	cap: Decimal = Decimal("0.70"),
) -> None:
	"""On balance mismatch, cap confidence di semua row ke max `cap` (default 0.70).

	Mutates rows in place. Confidence below cap unchanged.
	"""
	for r in rows:
		if r.confidence_score > cap:
			r.confidence_score = cap
