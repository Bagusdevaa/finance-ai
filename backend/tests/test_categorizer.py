"""Unit tests untuk rule-based categorizer."""

from app.ai.categorizer import categorize_rule_based


def test_gojek_transportasi():
	assert categorize_rule_based("Gojek", None) == "Transportasi"
	assert categorize_rule_based("GOJEK Indonesia", "perjalanan") == "Transportasi"


def test_grab_transportasi():
	assert categorize_rule_based("Grab", "ride") == "Transportasi"


def test_gofood_makan_minum():
	# "gofood" lebih spesifik daripada "gojek" — harusnya match makan dulu
	# karena rule "Makan & Minum" sebelum "Transportasi" di iteration order.
	assert categorize_rule_based("GoFood Sudirman", None) == "Makan & Minum"


def test_tokopedia_belanja():
	assert categorize_rule_based("Tokopedia", None) == "Belanja"


def test_shopee_belanja():
	assert categorize_rule_based("Shopee Mall", "checkout") == "Belanja"


def test_indomaret_belanja():
	assert categorize_rule_based("Indomaret Sudirman", None) == "Belanja"


def test_netflix_hiburan():
	assert categorize_rule_based("Netflix", "monthly") == "Hiburan"


def test_pln_tagihan():
	assert categorize_rule_based("PLN Prepaid", None) == "Tagihan"


def test_telkomsel_tagihan():
	assert categorize_rule_based("Telkomsel", "isi pulsa") == "Tagihan"


def test_gaji_pemasukan():
	assert categorize_rule_based("PT ABC", "Gaji April") == "Pemasukan"
	assert categorize_rule_based(None, "Salary deposit") == "Pemasukan"


def test_dividen_pemasukan():
	assert categorize_rule_based("Mandiri Sekuritas", "Dividen TLKM") == "Pemasukan"


def test_bibit_investasi():
	assert categorize_rule_based("Bibit", "topup reksadana") == "Investasi"


def test_no_match_returns_none():
	assert categorize_rule_based("Random Vendor X", "no keywords") is None


def test_empty_inputs_return_none():
	assert categorize_rule_based(None, None) is None
	assert categorize_rule_based("", "") is None


def test_case_insensitive():
	assert categorize_rule_based("TOKOPEDIA", None) == "Belanja"
	assert categorize_rule_based("tokopedia", None) == "Belanja"
	assert categorize_rule_based("ToKoPeDiA", None) == "Belanja"
