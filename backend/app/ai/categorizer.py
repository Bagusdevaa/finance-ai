"""Hybrid categorizer.

Rule-based first (deterministic, instant, free) — cover ~80% transaksi
khas user Indonesia. LLM fallback dipakai sparingly untuk batch ops
yang miss rule-based.
"""

# Keyword → kategori. Substring match (case-insensitive) di
# merchant_name + description.
_RULES: list[tuple[set[str], str]] = [
	(
		{
			"gojek",
			"grab",
			"bluebird",
			"uber",
			"indriver",
			"transjakarta",
			"krl",
			"mrt",
		},
		"Transportasi",
	),
	(
		{
			"gofood",
			"grabfood",
			"shopeefood",
			"starbucks",
			"kopi",
			"warung",
			"resto",
			"pizza",
			"mcd",
			"kfc",
			"chatime",
		},
		"Makan & Minum",
	),
	(
		{
			"tokopedia",
			"shopee",
			"lazada",
			"bukalapak",
			"blibli",
			"amazon",
		},
		"Belanja",
	),
	(
		{"netflix", "spotify", "youtube premium", "disney", "iflix"},
		"Hiburan",
	),
	(
		{
			"pln",
			"pdam",
			"indihome",
			"biznet",
			"myrepublic",
			"telkomsel",
			"xl",
			"indosat",
			"tri",
		},
		"Tagihan",
	),
	(
		{"alfamart", "indomaret", "alfamidi", "lawson", "circle k"},
		"Belanja",
	),
	(
		{"gaji", "salary", "payroll", "bonus", "thr"},
		"Pemasukan",
	),
	(
		{"dividen", "dividend", "bunga", "interest"},
		"Pemasukan",
	),
	(
		{"bibit", "ipot", "stockbit", "ajaib"},
		"Investasi",
	),
]


def categorize_rule_based(
	merchant: str | None, description: str | None
) -> str | None:
	"""Return kategori kalau ada keyword match, else None."""
	haystack = f"{merchant or ''} {description or ''}".lower()
	if not haystack.strip():
		return None
	for keywords, category in _RULES:
		if any(k in haystack for k in keywords):
			return category
	return None
