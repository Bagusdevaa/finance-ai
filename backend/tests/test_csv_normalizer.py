"""Tests untuk csv_normalizer: Recipe, fingerprint, apply, infer, orchestrate."""

import pytest

from app.import_data.csv_normalizer import (
	RECIPE_SCHEMA_VERSION,
	Recipe,
	RecipeInferenceError,
	compute_fingerprint,
	read_csv_rows,
)


def test_fingerprint_normalizes_case_and_whitespace():
	a = compute_fingerprint(["Date", "Amount"], ",")
	b = compute_fingerprint(["date", " amount "], ",")
	assert a == b


def test_fingerprint_is_order_sensitive():
	a = compute_fingerprint(["Date", "Amount"], ",")
	b = compute_fingerprint(["Amount", "Date"], ",")
	assert a != b


def test_fingerprint_is_hex_sha256():
	fp = compute_fingerprint(["x"], ",")
	assert len(fp) == 64
	int(fp, 16)  # raises if not hex


def test_recipe_from_llm_json_minimal():
	r = Recipe.from_llm_json(
		{"date": {"column": "Tgl"}, "amount": {"column": "Jml"}}
	)
	assert r.date_column == "Tgl"
	assert r.amount_column == "Jml"
	assert r.currency_fixed == "IDR"
	assert r.sign_column is None
	assert r.schema_version == RECIPE_SCHEMA_VERSION
	assert r.confidence == 0.7  # default when LLM omits it


def test_recipe_from_llm_json_missing_required_raises():
	with pytest.raises(RecipeInferenceError):
		Recipe.from_llm_json({"amount": {"column": "Jml"}})  # no date


def test_recipe_roundtrip_to_json_and_from_cache():
	d = {
		"source_label": "Pluang",
		"confidence": 0.9,
		"date": {"column": "Order Date", "format": "%a, %b %d, %Y"},
		"amount": {"column": "Total Amount"},
		"currency": {"mode": "column", "column": "Currency", "fixed": "IDR"},
		"fx_rate_column": "USD-IDR Conversion Rate*",
		"sign": {"column": "Transaction Type", "out_values": ["BUY"], "in_values": ["SELL"], "default": "as_is"},
		"description_template": "{Transaction Type} {Product Name}",
		"merchant": {"column": "Product Name"},
		"category_rules": [{"column": "Transaction", "in": ["Crypto"], "category": "Investasi"}],
		"skip": [{"column": "Status", "not_in": ["SUCCESS"]}],
	}
	r = Recipe.from_llm_json(d)
	restored = Recipe.from_cache(r.to_json(), schema_version=99)
	assert restored.date_column == "Order Date"
	assert restored.fx_rate_column == "USD-IDR Conversion Rate*"
	assert restored.sign_out_values == ["BUY"]
	assert restored.category_rules == [{"column": "Transaction", "in": ["Crypto"], "category": "Investasi"}]
	assert restored.schema_version == 99  # from cache column, not CURRENT


def test_read_csv_rows_detects_pluang_header():
	from pathlib import Path

	fixture = Path(__file__).parent / "fixtures/vision/invest/pluang-transaction-report.csv"
	all_rows, header_idx, delimiter = read_csv_rows(fixture.read_bytes())
	assert delimiter == ","
	assert header_idx == 7  # Pluang real header at line 8
	assert "Order Date" in all_rows[header_idx]


from decimal import Decimal

from app.import_data.csv_normalizer import apply_recipe


def _pluang_recipe() -> Recipe:
	return Recipe.from_llm_json(
		{
			"source_label": "Pluang",
			"confidence": 0.95,
			"date": {"column": "Order Date", "format": "%a, %b %d, %Y"},
			"amount": {"column": "Total Amount"},
			"currency": {"mode": "column", "column": "Currency", "fixed": "IDR"},
			"fx_rate_column": "USD-IDR Conversion Rate*",
			"sign": {
				"column": "Transaction Type",
				"out_values": ["BUY", "TOP UP", "IDR USD"],
				"in_values": ["SELL"],
				"default": "as_is",
			},
			"description_template": "{Transaction Type} {Product Name}",
			"merchant": {"column": "Product Name"},
			"category_rules": [
				{"column": "Transaction", "in": ["Crypto", "US Stocks", "Forex", "Gold"], "category": "Investasi"},
				{"column": "Transaction", "in": ["Top Up"], "category": "Top Up"},
			],
			"skip": [{"column": "Status", "not_in": ["SUCCESS", "Selesai", "Completed"]}],
		}
	)


def test_apply_recipe_pluang_fixture():
	from pathlib import Path

	fixture = Path(__file__).parent / "fixtures/vision/invest/pluang-transaction-report.csv"
	all_rows, header_idx, _ = read_csv_rows(fixture.read_bytes())
	result = apply_recipe(all_rows, header_idx, _pluang_recipe())

	assert len(result.rows) >= 5

	# QQQ buy: USD 3.46 × rate 16420 → IDR, BUY → negative.
	qqq = next(r for r in result.rows if "QQQ" in (r.description or ""))
	assert qqq.currency == "IDR"
	assert qqq.amount < 0
	assert abs(qqq.amount) > Decimal("1000")  # converted, not raw 3.46
	assert qqq.category == "Investasi"
	assert qqq.merchant_name == "QQQ"

	# LUNA sell: IDR, SELL → positive.
	luna = next(r for r in result.rows if "LUNA" in (r.description or ""))
	assert luna.amount > 0
	assert luna.category == "Investasi"


def test_apply_recipe_skips_unsuccessful():
	recipe = Recipe.from_llm_json(
		{
			"date": {"column": "d", "format": "%Y-%m-%d"},
			"amount": {"column": "a"},
			"skip": [{"column": "st", "not_in": ["SUCCESS"]}],
		}
	)
	all_rows = [
		["d", "a", "st"],
		["2026-01-01", "1000", "SUCCESS"],
		["2026-01-02", "2000", "FAILED"],
	]
	result = apply_recipe(all_rows, 0, recipe)
	assert len(result.rows) == 1
	assert result.rows[0].amount == Decimal("1000")


def test_apply_recipe_foreign_currency_without_rate_is_flagged():
	recipe = Recipe.from_llm_json(
		{
			"date": {"column": "d", "format": "%Y-%m-%d"},
			"amount": {"column": "a"},
			"currency": {"mode": "column", "column": "cur", "fixed": "IDR"},
			"fx_rate_column": "rate",
			"confidence": 1.0,
		}
	)
	all_rows = [
		["d", "a", "cur", "rate"],
		["2026-01-01", "100", "USD", ""],  # no rate → cannot convert
	]
	result = apply_recipe(all_rows, 0, recipe)
	assert len(result.rows) == 1
	row = result.rows[0]
	assert row.currency == "USD"  # kept native
	assert row.confidence_score <= Decimal("0.70")  # flagged


def test_apply_recipe_sign_default_negative():
	recipe = Recipe.from_llm_json(
		{
			"date": {"column": "d", "format": "%Y-%m-%d"},
			"amount": {"column": "a"},
			"sign": {"column": "t", "out_values": ["BUY"], "in_values": ["SELL"], "default": "negative"},
		}
	)
	all_rows = [["d", "a", "t"], ["2026-01-01", "500", "WEIRD"]]
	result = apply_recipe(all_rows, 0, recipe)
	assert result.rows[0].amount == Decimal("-500")
