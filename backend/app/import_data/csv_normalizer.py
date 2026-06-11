"""AI Import Normalizer — recipe model, fingerprint, CSV reading.

Resep = pemetaan kolom + aturan yang di-infer LLM SEKALI per format, lalu
di-cache. apply_recipe (file lain di modul ini) menerapkannya deterministik.
Angka & FATX dihitung Python — LLM tidak pernah transkrip angka.
"""

import csv
import hashlib
import io
from dataclasses import dataclass, field

from app.import_data.parsers.manual_csv import (
	_detect_delimiter,
	_detect_header_row_index,
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
