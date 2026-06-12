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
		["2026-01-01", "100", "USD", ""],  # no rate → treat as IDR, flag for review
	]
	result = apply_recipe(all_rows, 0, recipe)
	assert len(result.rows) == 1
	row = result.rows[0]
	assert row.currency == "IDR"  # treated as home currency, not kept as foreign
	assert row.confidence_score <= Decimal("0.70")  # flagged


def test_apply_recipe_default_category_fallback():
	recipe = Recipe.from_llm_json(
		{
			"date": {"column": "d", "format": "%Y-%m-%d"},
			"amount": {"column": "a"},
			"default_category": "Investasi",
			"category_rules": [
				{"column": "type", "in": ["Top Up"], "category": "Top Up"},
			],
		}
	)
	# row type "Crypto" does not match any rule → should fall back to default_category
	all_rows = [
		["d", "a", "type"],
		["2026-01-01", "500000", "Crypto"],
	]
	result = apply_recipe(all_rows, 0, recipe)
	assert len(result.rows) == 1
	assert result.rows[0].category == "Investasi"


def test_recipe_skip_blocklist():
	recipe = Recipe.from_llm_json(
		{
			"date": {"column": "d", "format": "%Y-%m-%d"},
			"amount": {"column": "a"},
			"skip": [{"column": "st", "in": ["CANCELED"]}],
		}
	)
	all_rows = [
		["d", "a", "st"],
		["2026-01-01", "1000", "SUCCESS"],
		["2026-01-02", "2000", "COMPLETED"],
		["2026-01-03", "3000", "CANCELED"],
	]
	result = apply_recipe(all_rows, 0, recipe)
	assert len(result.rows) == 2
	statuses = {r.amount for r in result.rows}
	assert Decimal("1000") in statuses
	assert Decimal("2000") in statuses
	assert Decimal("3000") not in statuses


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


from app.import_data import csv_normalizer as cn


def test_infer_recipe_parses_valid_json(monkeypatch):
	canned = (
		'{"source_label":"X","confidence":0.9,'
		'"date":{"column":"d"},"amount":{"column":"a"}}'
	)
	monkeypatch.setattr(cn, "text_complete", lambda *a, **k: canned)
	recipe = cn.infer_recipe(["d", "a"], [["2026-01-01", "100"]])
	assert recipe.date_column == "d"
	assert recipe.confidence == 0.9


def test_infer_recipe_retries_then_succeeds(monkeypatch):
	calls = {"n": 0}

	def fake(*a, **k):
		calls["n"] += 1
		if calls["n"] == 1:
			return "not json at all"
		return '{"date":{"column":"d"},"amount":{"column":"a"}}'

	monkeypatch.setattr(cn, "text_complete", fake)
	recipe = cn.infer_recipe(["d", "a"], [["2026-01-01", "100"]])
	assert recipe.amount_column == "a"
	assert calls["n"] == 2


def test_infer_recipe_raises_after_repeated_bad_json(monkeypatch):
	monkeypatch.setattr(cn, "text_complete", lambda *a, **k: "still not json")
	with pytest.raises(RecipeInferenceError):
		cn.infer_recipe(["d", "a"], [["2026-01-01", "100"]])


def _simple_rows():
	# date+amount alias-mappable so manual_csv fallback also works.
	return [
		["date", "amount", "merchant"],
		["2026-01-01", "-1000", "Gojek"],
		["2026-01-02", "5000", "Gaji"],
	]


def test_run_normalize_cache_hit_skips_llm(monkeypatch):
	def boom(*a, **k):
		raise AssertionError("LLM must not be called on cache hit")

	monkeypatch.setattr(cn, "infer_recipe", boom)
	cached = Recipe.from_llm_json(
		{"date": {"column": "date"}, "amount": {"column": "amount"}, "merchant": {"column": "merchant"}, "confidence": 0.9}
	)
	rows = _simple_rows()
	outcome = cn.run_normalize(b"unused", rows, 0, cached)
	assert outcome.used_fallback is False
	assert outcome.recipe_to_save is None  # cache hit → nothing new to save
	assert len(outcome.result.rows) == 2


def test_run_normalize_miss_infers_and_saves(monkeypatch):
	inferred = Recipe.from_llm_json(
		{"date": {"column": "date"}, "amount": {"column": "amount"}, "confidence": 0.9}
	)
	monkeypatch.setattr(cn, "infer_recipe", lambda *a, **k: inferred)
	outcome = cn.run_normalize(b"unused", _simple_rows(), 0, None)
	assert outcome.used_fallback is False
	assert outcome.recipe_to_save is inferred
	assert len(outcome.result.rows) == 2


def test_run_normalize_low_confidence_falls_back(monkeypatch):
	weak = Recipe.from_llm_json(
		{"date": {"column": "date"}, "amount": {"column": "amount"}, "confidence": 0.2}
	)
	monkeypatch.setattr(cn, "infer_recipe", lambda *a, **k: weak)
	csv_bytes = b"date,amount,merchant\n2026-01-01,-1000,Gojek\n2026-01-02,5000,Gaji\n"
	outcome = cn.run_normalize(csv_bytes, _simple_rows(), 0, None)
	assert outcome.used_fallback is True
	assert outcome.recipe_to_save is None
	assert len(outcome.result.rows) == 2  # manual_csv fallback parsed it


def test_run_normalize_inference_error_falls_back(monkeypatch):
	def fail(*a, **k):
		raise RecipeInferenceError("boom")

	monkeypatch.setattr(cn, "infer_recipe", fail)
	csv_bytes = b"date,amount,merchant\n2026-01-01,-1000,Gojek\n"
	outcome = cn.run_normalize(csv_bytes, _simple_rows(), 0, None)
	assert outcome.used_fallback is True
	assert len(outcome.result.rows) == 1


import os

from app.config import get_settings


@pytest.mark.skipif(
	os.getenv("VISION_TEST_LIVE") != "1" or not get_settings().GROQ_API_KEY,
	reason="VISION_TEST_LIVE=1 + GROQ_API_KEY required",
)
def test_live_infer_and_apply_pluang():
	"""Real Groq call: infer Pluang recipe, apply, expect IDR-converted rows."""
	from decimal import Decimal as D
	from pathlib import Path

	fixture = Path(__file__).parent / "fixtures/vision/invest/pluang-transaction-report.csv"
	all_rows, header_idx, _ = read_csv_rows(fixture.read_bytes())
	recipe = cn.infer_recipe(all_rows[header_idx], cn._sample_rows(all_rows, header_idx))
	result = apply_recipe(all_rows, header_idx, recipe)

	assert len(result.rows) >= 5
	# At least one originally-USD row converted to a sizable IDR amount.
	assert any(r.currency == "IDR" and abs(r.amount) > D("1000") for r in result.rows)
