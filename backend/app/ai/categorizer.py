"""Hybrid categorizer.

Rule-based first (deterministic, instant, free) — cover ~80% transaksi
khas user Indonesia. LLM fallback dipakai sparingly untuk batch ops
yang miss rule-based.

Rules berbasis observasi pola merchant Indonesia (BNI/BCA/Mandiri export).
Tighten beberapa keyword yang berisiko over-match (e.g. "biaya" generic).
"""

# Keyword → kategori. Substring match (case-insensitive) di
# merchant_name + description. ORDER MATTERS — yang lebih spesifik di atas.
_RULES: list[tuple[set[str], str]] = [
	# 1. BIAYA BANK — admin, fee transfer, pajak bunga.
	(
		{
			"admin kartu",
			"transfer bi-fast",
			"transfer antarbank",
			"biaya admin",
			"biaya transfer",
			"pajak bunga",
		},
		"Biaya Bank",
	),
	# 2. INVESTASI — reksa dana, emas digital.
	(
		{
			"pluang emas",
			"reksa dana",
			"eastspring",
			"rdm smmf",
			"rdm abf",
			"trim s25",
			"bibit",
			"ipot",
			"stockbit",
			"ajaib",
		},
		"Investasi",
	),
	# 3. PEMASUKAN — bunga tabungan, reversal, gaji.
	(
		{
			"bunga tabungan",
			"bunga giro",
			"transaksi reversal",
			"espay debit indonesia",
			"gaji",
			"salary",
			"payroll",
			"bonus",
			"thr",
			"dividen",
			"dividend",
		},
		"Pemasukan",
	),
	# 4. TOP UP — e-wallet & pulsa.
	(
		{
			"top up gopay",
			"top up dana",
			"top up shopeepay",
			"top up ovo",
			"topupnolimit",
		},
		"Top Up",
	),
	# 5. TAGIHAN — cicilan, internet, pulsa, pajak kendaraan, gym, RS, kursus.
	(
		{
			"spaylater",
			"comfin",
			"midtrans",
			"globalxtreme",
			"ioh - ",
			"indosat ooredoo",
			"limehub",
			"kk-rk tabanan",
			"kk.tab.rktbnbli",
			"trijaya pay",
			"fitness plus",
			"rumah sakit",
			"kodingup",
			"hevbusiness",
			"xdt-",
			"pln",
			"pdam",
			"indihome",
			"biznet",
			"myrepublic",
			"telkomsel",
			"by.u",
			"smartfren",
			"first media",
		},
		"Tagihan",
	),
	# 6. MAKAN & MINUM.
	(
		{
			"kopi kribo",
			"sekopi ho",
			"moto kopi",
			"kopi kenangan",
			"mondoc coffee",
			"linier coffe",
			"hexagon backyard",
			"point coffee",
			"go by ur sunshine",
			"nitnit cook",
			"ayam bakar giyarti",
			"nasi goreng canggu",
			"yamien",
			"gogo fried chicken",
			"gogo hayam",
			"warung bu ghofur",
			"wr. miedas",
			"mixue",
			"bangjeff",
			"rumah lawas",
			"ck villa srikandi",
			"moto kopi toast",
			"gofood",
			"grabfood",
			"shopeefood",
			"starbucks",
			"chatime",
			"j.co",
			"mcd",
			"kfc",
			"burger king",
			"pizza hut",
			"warung",
			"resto",
		},
		"Makan & Minum",
	),
	# 7. BELANJA — toko online, minimarket, fashion, gaming.
	(
		{
			"airpay international",
			"shopee-bagusd",
			"rierbux",
			"afkstore",
			"sades store",
			"andrea shop",
			"arj 88 dalung",
			"idm tjai",
			"idm tboc",
			"toko davika",
			"sunset eyewear",
			"indomaret",
			"alfamart",
			"alfamidi",
			"circle k",
			"lawson",
			"mm cg66",
			"algo q859",
			"kidikz",
			"apresiasi karya",
			"vape shop",
			"nyali vape",
			"tokopedia",
			"shopee",
			"lazada",
			"bukalapak",
			"blibli",
			"amazon",
		},
		"Belanja",
	),
	# 8. HIBURAN — streaming, bioskop.
	(
		{
			"netflix",
			"spotify",
			"youtube premium",
			"disney",
			"iflix",
			"cinema",
			"bioskop",
			"cgv",
			"xxi",
		},
		"Hiburan",
	),
	# 9. TRANSPORTASI — ride-hailing, parkir, BBM.
	(
		{
			"gojek",
			"grab ",
			"maxim",
			"bluebird",
			"indriver",
			"transjakarta",
			"krl",
			"mrt",
			"parkir",
			"tol ",
			"pertamina",
			"spbu",
		},
		"Transportasi",
	),
	# 10. TRANSFER — fallback untuk pattern bank-to-bank.
	# Note: "MANDIRI -" exact match (gaji) di-handle di special case sebelum rules.
	(
		{
			"bca - ",
			"bni - ",
			"btpn - ",
			"mandiri - ",
			"jago - ",
			"seabank - ",
			"dana - ",
			"bri - ",
			"bpd ",
			"bca digital - ",
			"atm spbu",
		},
		"Transfer",
	),
]


def categorize_rule_based(
	merchant: str | None, description: str | None
) -> str | None:
	"""Return kategori kalau ada keyword match, else None."""
	# Special case: "MANDIRI -" persis (tanpa nama setelahnya) = gaji bulanan
	# di akun BNI user ini. Kalau ada nama → transfer biasa.
	desc_clean = (description or "").strip()
	merch_clean = (merchant or "").strip()
	for s in (desc_clean, merch_clean):
		if s.upper() == "MANDIRI -":
			return "Pemasukan"

	haystack = f"{merch_clean} {desc_clean}".lower()
	if not haystack.strip():
		return None
	for keywords, category in _RULES:
		if any(k in haystack for k in keywords):
			return category
	return None
