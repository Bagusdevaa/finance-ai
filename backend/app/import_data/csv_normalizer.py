"""AI Import Normalizer — recipe model, fingerprint, CSV reading.

Resep = pemetaan kolom + aturan yang di-infer LLM SEKALI per format, lalu
di-cache. apply_recipe (file lain di modul ini) menerapkannya deterministik.
Angka & FX dihitung Python — LLM tidak pernah transkrip angka.
"""

import csv
import hashlib
import io
import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from app.ai.groq_client import text_complete
from app.ai.recipe_prompts import RECIPE_SYSTEM_PROMPT, build_recipe_user_prompt

from app.import_data.parsers.base import ParsedRow, ParseResult
from app.import_data.parsers.manual_csv import (
	ManualCsvParser,
	_detect_delimiter,
	_detect_header_row_index,
	_parse_amount,
	_parse_date,
)


# Naikkan kalau struktur resep berubah → resep cache versi lama di-infer ulang.
RECIPE_SCHEMA_VERSION = 3

# Di bawah ini → resep dianggap tidak bisa dipercaya, jatuh ke manual_csv.
CONFIDENCE_FLOOR = 0.5

_KNOWN_CURRENCIES = {"IDR", "USD", "EUR", "SGD", "GBP", "JPY", "AUD", "HKD", "CNY", "MYR", "CHF", "CAD"}
_FAILED_STATUSES = ["CANCELED", "CANCELLED", "FAILED", "PENDING", "EXPIRED", "REJECTED", "GAGAL", "DIBATALKAN", "VOID", "DECLINED"]
_RATE_HEADER_HINTS = ("rate", "conversion", "kurs", "exchange")
_STATUS_HEADER_HINTS = ("status", "state")


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
	default_category: str | None = None
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
			default_category=(d.get("default_category") or None),
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
			"default_category": self.default_category,
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
	return recipe.default_category


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
			# Cannot convert → treat amount as IDR (home currency), flag for review.
			currency = "IDR"
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


_SAMPLE_HEAD = 12
_SAMPLE_TAIL = 3


def _sample_rows(all_rows: list[list[str]], header_idx: int) -> list[list[str]]:
	"""Ambil sampel baris data: 12 awal + 3 akhir (ragam jenis transaksi)."""
	data = all_rows[header_idx + 1 :]
	if len(data) <= _SAMPLE_HEAD + _SAMPLE_TAIL:
		return data
	return data[:_SAMPLE_HEAD] + data[-_SAMPLE_TAIL:]


def _parse_json(raw: str) -> dict | None:
	if not raw:
		return None
	try:
		obj = json.loads(raw)
	except json.JSONDecodeError:
		return None
	return obj if isinstance(obj, dict) else None


def _reconcile_recipe(
	recipe: Recipe, header_cols: list[str], sample_rows: list[list[str]]
) -> Recipe:
	"""Deterministically lock the high-stakes mappings (currency + FX rate +
	status skip) by inspecting the data, overriding the LLM where the data is
	unambiguous. LLM inference is nondeterministic; these fields are too costly
	to get wrong (a missed currency = a 17000x error), so we detect them from
	the columns instead of trusting the model. The LLM still owns description,
	category, and sign.
	"""
	cols = [(c or "").strip() for c in header_cols]

	def col_values(j: int) -> list[str]:
		out = []
		for r in sample_rows:
			if j < len(r):
				v = (r[j] or "").strip()
				if v:
					out.append(v)
		return out

	# Currency column: values are predominantly known currency codes.
	for j, name in enumerate(cols):
		vals = col_values(j)
		if not vals:
			continue
		hits = [v.upper() for v in vals if v.upper() in _KNOWN_CURRENCIES]
		if len(hits) >= max(1, int(len(vals) * 0.6)):
			# Only switch to per-row currency when real foreign exposure exists.
			if set(hits) - {"IDR"}:
				recipe.currency_mode = "column"
				recipe.currency_column = name
				recipe.currency_fixed = "IDR"
				for k, h in enumerate(cols):
					if any(hint in h.lower() for hint in _RATE_HEADER_HINTS):
						recipe.fx_rate_column = cols[k]
						break
			break

	# Status skip: force a canonical failure blocklist on the status column.
	for name in cols:
		if any(hint in name.lower() for hint in _STATUS_HEADER_HINTS):
			recipe.skip_rules = [{"column": name, "in": list(_FAILED_STATUSES)}]
			break

	return recipe


def infer_recipe(header_cols: list[str], sample_rows: list[list[str]]) -> Recipe:
	"""Panggil LLM untuk infer resep dari header + sampel. Retry 1× bad JSON."""
	user_prompt = build_recipe_user_prompt(header_cols, sample_rows)
	raw = text_complete(RECIPE_SYSTEM_PROMPT, user_prompt)
	obj = _parse_json(raw)
	if obj is None:
		retry = "Your previous reply was not valid JSON. Output STRICT JSON only.\n\n" + user_prompt
		raw = text_complete(RECIPE_SYSTEM_PROMPT, retry)
		obj = _parse_json(raw)
	if obj is None:
		raise RecipeInferenceError("LLM did not return valid JSON")
	recipe = Recipe.from_llm_json(obj)
	return _reconcile_recipe(recipe, header_cols, sample_rows)


@dataclass
class NormalizeOutcome:
	result: ParseResult
	recipe_to_save: Recipe | None
	used_fallback: bool


def _fallback(file_bytes: bytes) -> ParseResult:
	return ManualCsvParser().parse(file_bytes)


def run_normalize(
	file_bytes: bytes,
	all_rows: list[list[str]],
	header_idx: int,
	cached: Recipe | None,
) -> NormalizeOutcome:
	"""Decide recipe source & apply. Pure except for infer_recipe (LLM) and the
	manual_csv fallback — both deterministic enough to unit-test with mocks."""
	if not all_rows:
		return NormalizeOutcome(ParseResult(), None, True)

	# 1. Usable cached recipe → apply, no LLM.
	if cached is not None and cached.schema_version == RECIPE_SCHEMA_VERSION:
		result = apply_recipe(all_rows, header_idx, cached)
		if result.rows:
			return NormalizeOutcome(result, None, False)
		# 0 rows → self-heal by re-inferring below.

	# 2. Infer a fresh recipe.
	header_cols = all_rows[header_idx]
	try:
		recipe = infer_recipe(header_cols, _sample_rows(all_rows, header_idx))
	except RecipeInferenceError:
		return NormalizeOutcome(_fallback(file_bytes), None, True)

	if recipe.confidence < CONFIDENCE_FLOOR:
		return NormalizeOutcome(_fallback(file_bytes), None, True)

	result = apply_recipe(all_rows, header_idx, recipe)
	if not result.rows:
		return NormalizeOutcome(_fallback(file_bytes), None, True)

	return NormalizeOutcome(result, recipe, False)
