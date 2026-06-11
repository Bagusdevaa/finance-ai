"""Prompt templates untuk recipe inference (csv_normalizer.infer_recipe).

Dipisah dari logic biar bisa di-tune tanpa nyentuh parsing. LLM diminta
MEMETAKAN kolom + aturan, BUKAN menyalin angka tiap baris.
"""

import json

RECIPE_SYSTEM_PROMPT = """You are a data-mapping assistant for Indonesian financial CSV exports (banks, e-wallets, brokers like Pluang/Bibit/IPOT, Google Sheets).

Your ONLY job: look at the header columns and a few sample rows, then output a JSON "recipe" describing WHICH column maps to what and the rules. You do NOT transcribe row values. You do NOT compute numbers. Code applies your recipe to every row.

Output STRICT JSON only — no prose, no markdown fences."""


def build_recipe_user_prompt(header_cols: list[str], sample_rows: list[list[str]]) -> str:
	header_json = json.dumps(header_cols, ensure_ascii=False)
	rows_json = json.dumps(sample_rows, ensure_ascii=False)
	return f"""Header columns:
{header_json}

Sample data rows (each is an array aligned to the header columns):
{rows_json}

Output a recipe JSON with EXACTLY this shape (use null when a field does not apply):

{{
  "source_label": "<short name of the source, e.g. Pluang>",
  "confidence": <0.0-1.0, your confidence this mapping is correct>,
  "date": {{ "column": "<header for transaction date>", "format": "<python strptime format, or null to auto-detect>" }},
  "amount": {{ "column": "<header for the transaction amount/total>" }},
  "currency": {{ "mode": "column"|"fixed", "column": "<currency header or null>", "fixed": "IDR" }},
  "fx_rate_column": "<header holding the to-IDR conversion rate, or null>",
  "sign": {{
    "column": "<header indicating direction, or null>",
    "out_values": ["<values meaning money OUT/expense, e.g. BUY, TOP UP>"],
    "in_values": ["<values meaning money IN/income, e.g. SELL>"],
    "default": "as_is"
  }},
  "description_template": "<template using {{Column Name}} placeholders, e.g. {{Transaction Type}} {{Product Name}}>",
  "merchant": {{ "column": "<header for merchant/asset name, or null>" }},
  "category_rules": [
    {{ "column": "<header>", "in": ["<values>"], "category": "<category name, e.g. Investasi>" }}
  ],
  "skip": [
    {{ "column": "<header>", "not_in": ["<values to KEEP, e.g. SUCCESS>"] }}
  ]
}}

Rules:
- date.column and amount.column are REQUIRED. If you cannot find them, still output them as best guess but set confidence low.
- Investment/broker rows (buy/sell stock/crypto/gold/forex) → category "Investasi". Top-ups → "Top Up".
- For brokers: BUY / TOP UP / converting to foreign cash → out_values; SELL → in_values.
- If a currency column exists with a per-row to-IDR rate column, set both so code can convert to IDR.
- Skip non-successful rows (status not SUCCESS/Selesai/Completed) via the skip rule.

Return ONLY the JSON object."""
