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
  "default_category": "<catch-all category for any row not matched by category_rules, e.g. Investasi, or null>",
  "category_rules": [
    {{ "column": "<header>", "in": ["<values>"], "category": "<category name, e.g. Investasi>" }}
  ],
  "skip": [
    {{ "column": "<status header>", "in": ["<known-failed status values to DROP>"] }}
  ]
}}

Rules:
- date.column and amount.column are REQUIRED. If you cannot find them, still output them as best guess but set confidence low.

SKIP RULE — BLOCKLIST, NOT ALLOWLIST:
- The skip rule must use "in" (blocklist): list only the known-FAILED statuses to drop (e.g. CANCELED, CANCELLED, FAILED, PENDING, EXPIRED, REJECTED, GAGAL, DIBATALKAN).
- Every other status (SUCCESS, COMPLETED, SELESAI, or any unknown status) is KEPT by default.
- NEVER use "not_in" for status filtering — that silently drops valid rows whose success status was not anticipated (e.g. COMPLETED alongside SUCCESS).

CURRENCY / FOREX:
- Treat an amount as foreign currency ONLY when a per-row conversion-rate column provides a real numeric rate for that row (e.g. a "USD-IDR Rate" column with a number like 16420).
- For currency-exchange or forex transaction rows (e.g. Transaction Type "IDR USD", "USD IDR", "Forex"), the Total Amount is the rupiah leg — it is IDR. Do NOT mark it foreign just because a currency column says "USD". Only set currency mode to "column" and fx_rate_column if there is a genuine per-row rate column.
- If no per-row rate column exists, set currency to fixed IDR.

CATEGORIZATION (investment/brokerage exports):
- For investment/brokerage exports, set default_category to "Investasi" so any uncovered transaction type still gets categorized.
- Add explicit category_rules to split out non-investment movements: top-ups → "Top Up", cash withdrawals/out transfers → "Transfer".
- Every distinct value in the category-driving column should map to a rule where possible. Anything not covered falls through to default_category.
- Cover ALL investment transaction types visible in the sample: stocks, crypto, gold, forex/currency exchange, bundles/pockets/auto-invest, etc. — these should all map to "Investasi".
- For brokers: BUY / TOP UP / converting to foreign cash → out_values; SELL / cash withdrawal → in_values.

Return ONLY the JSON object."""
