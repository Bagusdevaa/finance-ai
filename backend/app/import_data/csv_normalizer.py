"""AI Import Normalizer — recipe model, fingerprint, CSV reading.

Resep = pemetaan kolom + aturan yang di-infer LLM SEKALI per format, lalu
di-cache. apply_recipe (file lain di modul ini) menerapkannya deterministik.
Angka & FATX dihitung Python — LLM tidak pernah transkrip angka.
"""

import csv
import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.import_data.parsers.base import ParsedRow, ParseResult
from app.import_data.parsers.manual_csv import (
	_detect_delimiter,
	_detect_header_row_index,
	_parse_amount,
	_parse_date,
)


# Naikkan kalau struktur resep berubah → resep cache versi lama di-infer ulang.
RECIPE_SCHEMA_VERSION = 1

# Di bawah ini → resep dianggap tidak bisa dipercaya, jatuh ke manual_csv.
CONFIDENCE_FLOOR = 0.5


class RecipeInferenceError(Exception):
	"""Recipe JSON tidak valid / tidak punya field wajib."""


@dataclass
class Recipe:
	source_label: str
	confidence: float
	date_column: str
	date_format: str | None
	amount_column: str
	currency_mode: str  # "column" | "fixed"
	currency_column: str | None
	currency_fixed: str
	fx_rate_column: str | None
	sign_column: str | None
	sign_out_values: list[str]
	sign_in_values: list[str]
	sign_default: str  # "as_is" | "negative" | "positive"
	description_template: str
	merchant_column: str | None
	category_rules: list[dict] = field(default_factory=list)
	skip_rules: list[dict] = field(default_factory=list)
	schema_version: int = RECIPE_SCHEMA_VERSION

	@classmethod
	def from_llm_json(cls, d: dict) -> "Recipe":
		if not isinstance(d, dict):
			raise RecipeInferenceError("recipe is not an object")
		date = d.get("date") or {}
		amount = d.get("amount") or {}
		date_col = (date.get("column") or "").strip()
		amount_col = (amount.get("column") or "").strip()
		if not date_col or not amount_col:
			raise RecipeInferenceError("recipe missing date.column or amount.column")

		currency = d.get("currency") or {}
		sign = d.get("sign") or {}
		merchant = d.get("merchant") or {}
		try:
			conf = float(d["confidence"]) if d.get("confidence") is not None else 0.7
		except (TypeError, ValueError):
			conf = 0.7

		return cls(
			source_label=str(d.get("source_label") or ""),
			confidence=conf,
			date_column=date_col,
			date_format=(date.get("format") or None),
			amount_column=amount_col,
			currency_mode=(currency.get("mode") or "fixed"),
			currency_column=(currency.get("column") or None),
			currency_fixed=(currency.get("fixed") or "IDR"),
			fx_rate_column=(d.get("fx_rate_column") or None),
			sign_column=(sign.get("column") or None),
			sign_out_values=list(sign.get("out_values") or []),
			sign_in_values=list(sign.get("in_values") or []),
			sign_default=(sign.get("default") or "as_is"),
			description_template=(d.get("description_template") or ""),
			merchant_column=(merchant.get("column") or None),
			category_rules=list(d.get("category_rules") or []),
			skip_rules=list(d.get("skip") or []),
		)

	@classmethod
	def from_cache(cls, d: dict, schema_version: int) -> "Recipe":
		r = cls.from_llm_json(d)
		r.schema_version = schema_version
		return r

	def to_json(self) -> dict:
		return {
			"source_label": self.source_label,
			"confidence": self.confidence,
			"date": {"column": self.date_column, "format": self.date_format},
			"amount": {"column": self.amount_column},
			"currency": {
				"mode": self.currency_mode,
				"column": self.currency_column,
				"fixed": self.currency_fixed,
			},
			"fx_rate_column": self.fx_rate_column,
			"sign": {
				"column": self.sign_column,
				"out_values": self.sign_out_values,
				"in_values": self.sign_in_values,
				"default": self.sign_default,
			},
			"description_template": self.description_template,
			"merchant": {"column": self.merchant_column},
			"category_rules": self.category_rules,
			"skip": self.skip_rules,
		}


def compute_fingerprint(header_cols: list[str], delimiter: str) -> str:
	"""SHA-256 dari kolom header (lowercase, trim, urut asli) + delimiter."""
	normalized = "|".join((c or "").strip().lower() for c in header_cols)
	return hashlib.sha256(f"{delimiter}::{normalized}".encode("utf-8")).hexdigest()


def read_csv_rows(file_bytes: bytes) -> tuple[list[list[str]], int, str]:
	"""Decode + parse CSV ke baris×kolom; deteksi baris header (reuse Phase 5)."""
	text = file_bytes.decode("utf-8-sig", errors="replace")
	text = text.replace("\r\n", "\n").replace("\r", "\n")
	delimiter = _detect_delimiter(text)
	all_rows = list(csv.reader(io.StringIO(text), delimiter=delimiter))
	header_idx = _detect_header_row_index(all_rows) if all_rows else 0
	return all_rows, header_idx, delimiter


_TWO_DP = Decimal("0.01")


def _parse_date_with(date_str: str, fmt: str | None) -> date | None:
	if fmt:
		try:
			return datetime.strptime(date_str, fmt).date()
		except ValueError:
			pass
	try:
		return _parse_date(date_str)
	except ValueError:
		return None


def _fill_template(template: str, row: dict) -> str:
	def repl(m: "re.Match[str]") -> str:
		return (row.get(m.group(1)) or "").strip()

	out = re.sub(r"\{([^}]+)\}", repl, template or "")
	return " ".join(out.split())  # collapse whitespace from missing fields


def _match_category(row: dict, recipe: Recipe) -> str | None:
	for rule in recipe.category_rules:
		col = rule.get("column")
		if not col:
			continue
		val = (row.get(col) or "").strip().lower()
		allowed = {str(x).strip().lower() for x in rule.get("in", [])}
		if val and val in allowed:
			return rule.get("category")
	return None


def _should_skip(row: dict, recipe: Recipe) -> bool:
	for rule in recipe.skip_rules:
		col = rule.get("column")
		if not col:
			continue
		val = (row.get(col) or "").strip().lower()
		if "not_in" in rule:
			allowed = {str(x).strip().lower() for x in rule["not_in"]}
			if val not in allowed:
				return True
		if "in" in rule:
			blocked = {str(x).strip().lower() for x in rule["in"]}
			if val in blocked:
				return True
	return False


def _apply_sign(amount: Decimal, row: dict, recipe: Recipe) -> Decimal:
	if not recipe.sign_column:
		return amount
	val = (row.get(recipe.sign_column) or "").strip().lower()
	if val in {v.strip().lower() for v in recipe.sign_out_values}:
		return -abs(amount)
	if val in {v.strip().lower() for v in recipe.sign_in_values}:
		return abs(amount)
	if recipe.sign_default == "negative":
		return -abs(amount)
	if recipe.sign_default == "positive":
		return abs(amount)
	return amount


def _apply_row(row: dict, recipe: Recipe, line_no: int) -> ParsedRow | None:
	if _should_skip(row, recipe):
		return None

	date_str = (row.get(recipe.date_column) or "").strip()
	if not date_str:
		return None
	tx_date = _parse_date_with(date_str, recipe.date_format)
	if tx_date is None:
		return None

	amount_str = (row.get(recipe.amount_column) or "").strip()
	if not amount_str:
		return None
	try:
		amount = _parse_amount(amount_str)
	except (InvalidOperation, ValueError):
		return None

	confidence = Decimal(str(recipe.confidence)).quantize(_TWO_DP)

	# Currency.
	if recipe.currency_mode == "column" and recipe.currency_column:
		currency = (row.get(recipe.currency_column) or "").strip().upper() or recipe.currency_fixed
	else:
		currency = recipe.currency_fixed

	# FX conversion — Python does the math, never the LLM.
	native_note = ""
	if currency != "IDR":
		rate = None
		if recipe.fx_rate_column:
			rate_str = (row.get(recipe.fx_rate_column) or "").strip()
			if rate_str:
				try:
					rate = _parse_amount(rate_str)
				except (InvalidOperation, ValueError):
					rate = None
		if rate is not None and rate > 0:
			native_note = f"{currency} {amount} @{rate}"
			amount = amount * rate
			currency = "IDR"
		else:
			# Cannot convert → keep native, flag for review.
			confidence = min(confidence, Decimal("0.70"))

	amount = _apply_sign(amount, row, recipe).quantize(_TWO_DP)

	description = _fill_template(recipe.description_template, row) or None

	merchant = None
	if recipe.merchant_column:
		merchant = (row.get(recipe.merchant_column) or "").strip() or None

	category = _match_category(row, recipe)
	if category is None:
		confidence = min(confidence, Decimal("0.70"))

	raw = ", ".join(f"{k}={v}" for k, v in row.items() if k)
	if native_note:
		raw = f"[native: {native_note}] {raw}"

	return ParsedRow(
		line_no=line_no,
		transaction_date=tx_date,
		amount=amount,
		currency=currency,
		merchant_name=merchant,
		description=description,
		category=category,
		confidence_score=confidence,
		raw_text=raw,
	)


def apply_recipe(
	all_rows: list[list[str]], header_idx: int, recipe: Recipe
) -> ParseResult:
	"""Terapkan resep ke semua baris data. Murni & deterministik."""
	if not all_rows or header_idx >= len(all_rows):
		return ParseResult()
	fieldnames = [c.strip() for c in all_rows[header_idx]]
	rows: list[ParsedRow] = []
	for i, raw_cells in enumerate(all_rows[header_idx + 1 :], start=header_idx + 2):
		row = dict(zip(fieldnames, raw_cells))
		parsed = _apply_row(row, recipe, i)
		if parsed is not None:
			rows.append(parsed)
	content_type = "statement" if rows else "unknown"
	return ParseResult(rows=rows, content_type=content_type)
