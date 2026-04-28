// Dummy data buat dashboard sebelum API beneran nyambung.
// Semua angka rupiah sudah dalam satuan rupiah penuh (bukan ribuan).
// Dataset di-tune mendekati design hub mockup biar UI terlihat akurat.

export interface DashboardStats {
	netWorth: number;
	netWorthLast: number;
	monthlyIncome: number;
	monthlyExpense: number;
	expenseLast: number;
	savingsRate: number; // persen
	deltaNetWorth: number; // persen vs bulan lalu
}

export const dashboardStats: DashboardStats = {
	netWorth: 247_500_000,
	netWorthLast: 220_200_000,
	monthlyIncome: 8_500_000,
	monthlyExpense: 3_640_000,
	expenseLast: 3_832_000,
	savingsRate: 57,
	deltaNetWorth: 12.4,
};

// 6 bulan cashflow trend (Sep 2025 → Feb 2026 versi design hub).
// Disesuaikan ke konteks user "April 2026" → pakai Nov '25 → Apr '26.
export interface CashflowPoint {
	month: string; // 3-letter id-ID
	income: number;
	expense: number;
}

export const cashflowSeries: CashflowPoint[] = [
	{ month: "Nov", income: 7_800_000, expense: 4_100_000 },
	{ month: "Des", income: 8_200_000, expense: 3_950_000 },
	{ month: "Jan", income: 8_200_000, expense: 4_250_000 },
	{ month: "Feb", income: 9_100_000, expense: 4_500_000 },
	{ month: "Mar", income: 8_500_000, expense: 3_832_000 },
	{ month: "Apr", income: 8_500_000, expense: 3_640_000 },
];

// Donut chart "Alokasi Aset" — 5 segmen dlm grayscale.
export interface AllocationSegment {
	name: string;
	value: number;
	percent: number; // 0..100
	tone: string; // hex grayscale
}

export const allocationSegments: AllocationSegment[] = [
	{ name: "Saham IDX", value: 86_625_000, percent: 35, tone: "#0a0a0a" },
	{ name: "Reksa Dana", value: 69_300_000, percent: 28, tone: "#525252" },
	{ name: "Tabungan", value: 54_450_000, percent: 22, tone: "#a3a3a3" },
	{ name: "Emas", value: 24_750_000, percent: 10, tone: "#d4d4d4" },
	{ name: "Lainnya", value: 12_375_000, percent: 5, tone: "#e8e8e8" },
];

// AI Insight dummy untuk dashboard.
export interface AiInsight {
	icon: "up" | "down" | "info" | "check";
	body: string; // markup-lite: kata yg dibungkus *...* akan di-bold
}

export const aiInsights: AiInsight[] = [
	{
		icon: "up",
		body: "Pengeluaran *makan* naik 34% vs bulan lalu. Tercatat *18 transaksi* ke restoran & cafe.",
	},
	{
		icon: "info",
		body: "Kalau kamu kurangi *langganan* 30%, bisa tambah *Rp 195.000/bulan* untuk investasi.",
	},
	{
		icon: "check",
		body: "Rate tabungan kamu *57%* — masuk top *15%* pengguna FinanceAI.",
	},
];

export interface DummyTransaction {
	id: string;
	merchant: string;
	category: string;
	account: string;
	date: string; // ISO
	time?: string; // "HH:MM" optional
	amount: number; // negatif = pengeluaran
	icon?: "food" | "income" | "transport" | "entertainment" | "investment" | "shopping" | "bill";
}

export const recentTransactions: DummyTransaction[] = [
	{
		id: "tx-1",
		merchant: "Kopi Kenangan",
		category: "Makanan",
		account: "BCA",
		date: "2026-04-27",
		time: "14:22",
		amount: -38_000,
		icon: "food",
	},
	{
		id: "tx-2",
		merchant: "Gaji April",
		category: "Pemasukan",
		account: "BCA",
		date: "2026-04-25",
		amount: 8_500_000,
		icon: "income",
	},
	{
		id: "tx-3",
		merchant: "Grab",
		category: "Transportasi",
		account: "GoPay",
		date: "2026-04-26",
		time: "13:08",
		amount: -24_000,
		icon: "transport",
	},
	{
		id: "tx-4",
		merchant: "Netflix",
		category: "Hiburan",
		account: "Langganan",
		date: "2026-04-12",
		amount: -65_000,
		icon: "entertainment",
	},
	{
		id: "tx-5",
		merchant: "BBCA — 10 lot",
		category: "Investasi",
		account: "IPOT",
		date: "2026-04-11",
		amount: -9_150_000,
		icon: "investment",
	},
];

// Full transactions dataset buat halaman /transactions.
// Mengikuti shape design hub: tanggal/jam mono, merchant + sub, kategori tag, akun mono.
export interface DummyTransactionFull {
	id: string;
	date: string; // ISO
	time?: string; // HH:MM
	description: string;
	merchant_name: string;
	account: string;
	category: string;
	amount: number; // negatif = pengeluaran
	confidence_score: number; // 0–1, < 1.0 berarti hasil AI parse
}

export const dummyTransactions: DummyTransactionFull[] = [
	{
		id: "txn-001",
		date: "2026-04-27",
		description: "Transfer masuk dari klien",
		merchant_name: "PT Konstruksi Jaya",
		account: "BCA",
		category: "Pemasukan",
		amount: 45_000_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-002",
		date: "2026-04-27",
		description: "Pembayaran QR — kopi pagi",
		merchant_name: "Kopi Kenangan Sudirman",
		account: "GoPay",
		category: "Makan & Minum",
		amount: -32_000,
		confidence_score: 0.92,
	},
	{
		id: "txn-003",
		date: "2026-04-26",
		description: "Belanja online elektronik",
		merchant_name: "Tokopedia",
		account: "BCA",
		category: "Belanja",
		amount: -1_249_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-004",
		date: "2026-04-26",
		description: "SPBU — bensin mobil",
		merchant_name: "Pertamina Cikini",
		account: "Mandiri",
		category: "Transportasi",
		amount: -350_000,
		confidence_score: 0.88,
	},
	{
		id: "txn-005",
		date: "2026-04-25",
		description: "Gaji April 2026",
		merchant_name: "ConstructLand Payroll",
		account: "BCA",
		category: "Pemasukan",
		amount: 32_500_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-006",
		date: "2026-04-25",
		description: "Top-up reksadana",
		merchant_name: "Bibit",
		account: "Bibit",
		category: "Investasi",
		amount: -2_500_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-007",
		date: "2026-04-24",
		description: "Bayar tagihan listrik",
		merchant_name: "PLN",
		account: "BCA",
		category: "Tagihan",
		amount: -875_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-008",
		date: "2026-04-24",
		description: "Makan siang tim",
		merchant_name: "Sate Khas Senayan",
		account: "GoPay",
		category: "Makan & Minum",
		amount: -425_000,
		confidence_score: 0.76,
	},
	{
		id: "txn-009",
		date: "2026-04-23",
		description: "Beli saham BBCA",
		merchant_name: "Stockbit",
		account: "Stockbit",
		category: "Investasi",
		amount: -10_500_000,
		confidence_score: 0.95,
	},
	{
		id: "txn-010",
		date: "2026-04-23",
		description: "Subscription bulanan",
		merchant_name: "Spotify Premium",
		account: "BCA",
		category: "Hiburan",
		amount: -54_990,
		confidence_score: 1.0,
	},
	{
		id: "txn-011",
		date: "2026-04-22",
		description: "Beli buku",
		merchant_name: "Gramedia Matraman",
		account: "Mandiri",
		category: "Pendidikan",
		amount: -345_000,
		confidence_score: 0.82,
	},
	{
		id: "txn-012",
		date: "2026-04-21",
		description: "Grab car ke kantor",
		merchant_name: "Grab",
		account: "OVO",
		category: "Transportasi",
		amount: -68_000,
		confidence_score: 0.94,
	},
	{
		id: "txn-013",
		date: "2026-04-20",
		description: "Cicilan KPR",
		merchant_name: "BCA Mortgage",
		account: "BCA",
		category: "Cicilan",
		amount: -8_500_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-014",
		date: "2026-04-19",
		description: "Belanja groceries mingguan",
		merchant_name: "Ranch Market",
		account: "BCA",
		category: "Belanja",
		amount: -1_120_000,
		confidence_score: 0.89,
	},
	{
		id: "txn-015",
		date: "2026-04-18",
		description: "Bayar internet rumah",
		merchant_name: "Indihome",
		account: "Mandiri",
		category: "Tagihan",
		amount: -465_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-016",
		date: "2026-04-17",
		description: "Dividen saham TLKM",
		merchant_name: "KSEI",
		account: "Stockbit",
		category: "Pemasukan",
		amount: 1_240_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-017",
		date: "2026-04-16",
		description: "Nonton bioskop",
		merchant_name: "CGV Grand Indonesia",
		account: "GoPay",
		category: "Hiburan",
		amount: -180_000,
		confidence_score: 0.71,
	},
	{
		id: "txn-018",
		date: "2026-04-15",
		description: "Iuran fitness",
		merchant_name: "Celebrity Fitness",
		account: "BCA",
		category: "Kesehatan",
		amount: -550_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-019",
		date: "2026-04-14",
		description: "Top-up GoPay",
		merchant_name: "GoPay",
		account: "BCA",
		category: "Transfer",
		amount: -500_000,
		confidence_score: 1.0,
	},
	{
		id: "txn-020",
		date: "2026-04-13",
		description: "Beli kopi di café",
		merchant_name: "Filosofi Kopi",
		account: "OVO",
		category: "Makan & Minum",
		amount: -85_000,
		confidence_score: 0.65,
	},
];

// =============================================================================
// Stocks (saham) — multi-account aggregate view
// =============================================================================

export interface DummyStockHoldingAccount {
	platform: string;
	lot: number;
	avgPrice: number;
}

export interface DummyStockHolding {
	ticker: string;
	name: string;
	totalLot: number;
	weightedAvgPrice: number;
	currentPrice: number | null; // null = belum fetched
	value: number;
	pnl: number;
	pnlPercent: number;
	accounts: DummyStockHoldingAccount[];
}

export const dummyStockHoldings: DummyStockHolding[] = [
	{
		ticker: "BBCA",
		name: "Bank Central Asia",
		totalLot: 250,
		weightedAvgPrice: 9_218,
		currentPrice: 9_850,
		value: 24_625_000,
		pnl: 1_580_000,
		pnlPercent: 6.9,
		accounts: [
			{ platform: "Stockbit", lot: 150, avgPrice: 9_180 },
			{ platform: "IPOT", lot: 100, avgPrice: 9_275 },
		],
	},
	{
		ticker: "TLKM",
		name: "Telkom Indonesia",
		totalLot: 300,
		weightedAvgPrice: 3_120,
		currentPrice: 3_280,
		value: 9_840_000,
		pnl: 480_000,
		pnlPercent: 5.1,
		accounts: [{ platform: "Stockbit", lot: 300, avgPrice: 3_120 }],
	},
	{
		ticker: "BMRI",
		name: "Bank Mandiri",
		totalLot: 150,
		weightedAvgPrice: 6_450,
		currentPrice: 6_200,
		value: 9_300_000,
		pnl: -375_000,
		pnlPercent: -3.9,
		accounts: [
			{ platform: "Stockbit", lot: 100, avgPrice: 6_500 },
			{ platform: "IPOT", lot: 50, avgPrice: 6_350 },
		],
	},
	{
		ticker: "ASII",
		name: "Astra International",
		totalLot: 200,
		weightedAvgPrice: 5_150,
		currentPrice: 5_475,
		value: 10_950_000,
		pnl: 650_000,
		pnlPercent: 6.3,
		accounts: [{ platform: "Stockbit", lot: 200, avgPrice: 5_150 }],
	},
	{
		ticker: "UNVR",
		name: "Unilever Indonesia",
		totalLot: 120,
		weightedAvgPrice: 2_480,
		currentPrice: 2_610,
		value: 3_132_000,
		pnl: 156_000,
		pnlPercent: 5.2,
		accounts: [{ platform: "Stockbit", lot: 120, avgPrice: 2_480 }],
	},
];

// =============================================================================
// Reksa dana
// =============================================================================

export interface DummyMutualFund {
	id: string;
	name: string;
	type: "Pasar Uang" | "Pendapatan Tetap" | "Saham" | "Campuran";
	platform: string;
	units: number;
	nav: number; // Net asset value per unit
	value: number;
	pnl: number;
	pnlPercent: number;
}

export const dummyMutualFunds: DummyMutualFund[] = [
	{
		id: "mf-001",
		name: "Schroder Dana Prestasi",
		type: "Saham",
		platform: "Bibit",
		units: 3_421.2,
		nav: 18_920,
		value: 64_700_000,
		pnl: 6_900_000,
		pnlPercent: 12.1,
	},
	{
		id: "mf-002",
		name: "Manulife Dana Saham",
		type: "Saham",
		platform: "Bareksa",
		units: 892.5,
		nav: 5_130,
		value: 4_580_000,
		pnl: 330_000,
		pnlPercent: 7.8,
	},
	{
		id: "mf-003",
		name: "Sucorinvest Money Market",
		type: "Pasar Uang",
		platform: "Bibit",
		units: 12_480.8,
		nav: 1_612,
		value: 20_110_000,
		pnl: 1_030_000,
		pnlPercent: 5.4,
	},
];

// =============================================================================
// Manual assets (rumah, kendaraan, dll)
// =============================================================================

export interface DummyManualAsset {
	id: string;
	name: string;
	category: "Properti" | "Kendaraan" | "Emas" | "Lainnya";
	value: number;
	notes?: string;
	lastUpdated: string; // ISO date
}

export const dummyManualAssets: DummyManualAsset[] = [
	{
		id: "ma-001",
		name: "Rumah Bintaro",
		category: "Properti",
		value: 1_850_000_000,
		notes: "Sertifikat SHM, LB 120m²",
		lastUpdated: "2026-03-15",
	},
	{
		id: "ma-002",
		name: "Toyota Innova Zenix 2024",
		category: "Kendaraan",
		value: 485_000_000,
		notes: "Plat B, KM 18.000",
		lastUpdated: "2026-04-01",
	},
	{
		id: "ma-003",
		name: "Logam Mulia Antam 100g",
		category: "Emas",
		value: 132_500_000,
		notes: "Disimpan di safe deposit",
		lastUpdated: "2026-04-20",
	},
];

// =============================================================================
// Net worth aggregate (utk Assets page hero)
// =============================================================================

export interface NetWorthBreakdown {
	total: number;
	deltaValue: number; // rupiah delta
	deltaPercent: number; // 0..100
	accountsActive: number;
	updatedAgo: string;
	chartBars: { label: string; value: number }[]; // value 0..1
}

// Disesuaikan ke design hub Aset Portofolio: net worth Rp 247.500.000.
export const dummyNetWorth: NetWorthBreakdown = {
	total: 247_500_000,
	deltaValue: 27_300_000,
	deltaPercent: 12.4,
	accountsActive: 8,
	updatedAgo: "5 menit lalu",
	chartBars: [
		{ label: "Nov", value: 0.62 },
		{ label: "Des", value: 0.68 },
		{ label: "Jan", value: 0.74 },
		{ label: "Feb", value: 0.82 },
		{ label: "Mar", value: 0.91 },
		{ label: "Apr", value: 1.0 },
	],
};

// =============================================================================
// Cash & e-wallet accounts (Aset Portofolio "Tabungan & Cash" section)
// =============================================================================

export interface DummyCashAccount {
	id: string;
	name: string;
	masked: string; // e.g. "****7823" atau "+62 812 ****"
	balance: number;
	logoLetter: string;
	updatedAgo: string;
}

export const dummyCashAccounts: DummyCashAccount[] = [
	{ id: "cash-bca", name: "BCA Tahapan", masked: "****7823", balance: 24_500_000, logoLetter: "B", updatedAgo: "Diperbarui 3 menit lalu" },
	{ id: "cash-mandiri", name: "Mandiri Tabungan", masked: "****2211", balance: 12_800_000, logoLetter: "M", updatedAgo: "Diperbarui 8 menit lalu" },
	{ id: "cash-gopay", name: "GoPay", masked: "+62 812 ****", balance: 2_150_000, logoLetter: "G", updatedAgo: "Diperbarui 12 menit lalu" },
	{ id: "cash-ovo", name: "OVO", masked: "+62 813 ****", balance: 800_000, logoLetter: "O", updatedAgo: "Diperbarui 1 jam lalu" },
];

// =============================================================================
// Gold / Crypto holdings (Aset Portofolio "Emas & Kripto" section)
// =============================================================================

export interface DummyCommodity {
	id: string;
	ticker: string;
	name: string;
	platform: string;
	amount: string; // formatted (e.g. "15,4 gr", "0,0028 BTC")
	priceLabel: string; // e.g. "1.358.000 / gr"
	value: number;
	pnlPercent: number;
}

export const dummyCommodities: DummyCommodity[] = [
	{ id: "xau", ticker: "XAU", name: "Emas Antam", platform: "Pluang", amount: "15,4 gr", priceLabel: "1.358.000 / gr", value: 20_913_000, pnlPercent: 16.2 },
	{ id: "btc", ticker: "BTC", name: "Bitcoin", platform: "Pintu", amount: "0,0028 BTC", priceLabel: "1.387M / BTC", value: 3_887_000, pnlPercent: 9.8 },
];

// =============================================================================
// Budget — kategori dengan limit + spent bulan ini
// =============================================================================

export interface BudgetTx {
	merchant: string;
	when: string; // e.g. "26 Apr · 12:30"
	amount: number;
}

export interface DummyBudget {
	id: string;
	category: string;
	subtitle: string;
	limit: number;
	spent: number;
	transactions: BudgetTx[];
}

export const dummyBudgets: DummyBudget[] = [
	{
		id: "bg-001",
		category: "Makanan",
		subtitle: "F&B · Delivery",
		limit: 1_500_000,
		spent: 1_485_000,
		transactions: [
			{ merchant: "Starbucks Senopati", when: "26 Apr · 12:30", amount: -72_000 },
			{ merchant: "Grab Food · Bakmi GM", when: "25 Apr · 20:11", amount: -58_000 },
			{ merchant: "McDonald's", when: "20 Apr · 12:00", amount: -65_000 },
			{ merchant: "Bakso Boedjangan", when: "16 Apr · 13:00", amount: -48_000 },
		],
	},
	{
		id: "bg-002",
		category: "Transportasi",
		subtitle: "Gojek · Grab",
		limit: 800_000,
		spent: 624_000,
		transactions: [
			{ merchant: "Gojek Ride", when: "27 Apr", amount: -32_000 },
			{ merchant: "Gojek Ride", when: "22 Apr", amount: -28_000 },
			{ merchant: "Grab Car", when: "17 Apr", amount: -45_000 },
		],
	},
	{
		id: "bg-003",
		category: "Belanja",
		subtitle: "Online · Offline",
		limit: 600_000,
		spent: 768_000,
		transactions: [
			{ merchant: "Tokopedia", when: "26 Apr", amount: -345_000 },
			{ merchant: "Pasaraya QR-COMM", when: "18 Apr", amount: -156_000 },
			{ merchant: "Tokopedia", when: "22 Apr", amount: -128_000 },
			{ merchant: "Indomaret", when: "27 Apr", amount: -87_500 },
		],
	},
	{
		id: "bg-004",
		category: "Tagihan",
		subtitle: "PLN · Internet · Air",
		limit: 500_000,
		spent: 451_000,
		transactions: [
			{ merchant: "PLN Pasca Bayar", when: "24 Apr", amount: -285_000 },
			{ merchant: "IndiHome", when: "10 Apr", amount: -166_000 },
		],
	},
	{
		id: "bg-005",
		category: "Hiburan",
		subtitle: "Subscription · Outing",
		limit: 200_000,
		spent: 240_990,
		transactions: [
			{ merchant: "Netflix", when: "23 Apr", amount: -186_000 },
			{ merchant: "Spotify Premium", when: "19 Apr", amount: -54_990 },
		],
	},
	{
		id: "bg-006",
		category: "Kesehatan",
		subtitle: "Apotek · Klinik",
		limit: 400_000,
		spent: 180_000,
		transactions: [{ merchant: "Apotek K-24", when: "12 Apr", amount: -180_000 }],
	},
	{
		id: "bg-007",
		category: "Investasi",
		subtitle: "Reksa Dana · Saham",
		limit: 2_000_000,
		spent: 1_500_000,
		transactions: [
			{ merchant: "Bibit · DCA Schroder", when: "15 Apr", amount: -1_000_000 },
			{ merchant: "Stockbit · BBCA", when: "14 Apr", amount: -500_000 },
		],
	},
	{
		id: "bg-008",
		category: "Edukasi",
		subtitle: "Buku · Kursus",
		limit: 300_000,
		spent: 0,
		transactions: [],
	},
];

export interface BudgetSummary {
	totalBudget: number;
	totalSpent: number;
	remaining: number;
	projectedOverspend: number; // negatif kalau over (sesuai design hub)
	transactionCount: number;
	daysRemaining: number;
}

// Hitung sekali biar konsisten antar UI section.
export const dummyBudgetSummary: BudgetSummary = (() => {
	// Design hub Anggaran: Total Budget Rp 5.000.000, Terpakai Rp 3.640.000.
	// Overall percent shown = 73%, jadi pakai angka summary mengikuti hero design.
	const totalBudget = 5_000_000;
	const totalSpent = 3_640_000;
	return {
		totalBudget,
		totalSpent,
		remaining: totalBudget - totalSpent,
		projectedOverspend: -280_000,
		transactionCount: dummyBudgets.reduce((acc, b) => acc + b.transactions.length, 0),
		daysRemaining: 12,
	};
})();
