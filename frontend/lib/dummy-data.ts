// Dummy data buat dashboard sebelum API beneran nyambung.
// Semua angka rupiah sudah dalam satuan rupiah penuh (bukan ribuan).

export interface DashboardStats {
	netWorth: number;
	monthlyIncome: number;
	monthlyExpense: number;
	savingsRate: number; // persen
	deltaNetWorth: number; // persen vs bulan lalu
	deltaIncome: number;
	deltaExpense: number;
	deltaSavings: number;
}

export const dashboardStats: DashboardStats = {
	netWorth: 487_250_000,
	monthlyIncome: 32_500_000,
	monthlyExpense: 18_750_000,
	savingsRate: 42.3,
	deltaNetWorth: 4.2,
	deltaIncome: 2.8,
	deltaExpense: 5.1,
	deltaSavings: 1.6,
};

export interface DummyTransaction {
	id: string;
	merchant: string;
	category: string;
	account: string;
	date: string; // ISO
	amount: number; // negatif = pengeluaran
}

export const recentTransactions: DummyTransaction[] = [
	{
		id: "tx-1",
		merchant: "Gaji April",
		category: "Pemasukan",
		account: "BCA",
		date: "2026-04-25",
		amount: 32_500_000,
	},
	{
		id: "tx-2",
		merchant: "Kopi Kenangan",
		category: "Makan & Minum",
		account: "GoPay",
		date: "2026-04-27",
		amount: -28_000,
	},
	{
		id: "tx-3",
		merchant: "Tokopedia — Headphone",
		category: "Belanja",
		account: "BCA",
		date: "2026-04-26",
		amount: -1_249_000,
	},
	{
		id: "tx-4",
		merchant: "Pertamina",
		category: "Transportasi",
		account: "Mandiri",
		date: "2026-04-26",
		amount: -350_000,
	},
	{
		id: "tx-5",
		merchant: "Top-up Bibit",
		category: "Investasi",
		account: "Bibit",
		date: "2026-04-24",
		amount: -2_500_000,
	},
];

// Full transactions dataset buat halaman /transactions.
// Tambah: description, merchant_name terpisah, confidence_score (untuk hasil parse AI).
export interface DummyTransactionFull {
	id: string;
	date: string; // ISO
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
		weightedAvgPrice: 9_400,
		currentPrice: 10_200,
		value: 255_000_000,
		pnl: 20_000_000,
		pnlPercent: 8.51,
		accounts: [
			{ platform: "Stockbit", lot: 150, avgPrice: 9_200 },
			{ platform: "IPOT", lot: 100, avgPrice: 9_700 },
		],
	},
	{
		ticker: "BBRI",
		name: "Bank Rakyat Indonesia",
		totalLot: 180,
		weightedAvgPrice: 5_650,
		currentPrice: 5_400,
		value: 97_200_000,
		pnl: -4_500_000,
		pnlPercent: -4.42,
		accounts: [
			{ platform: "Stockbit", lot: 100, avgPrice: 5_500 },
			{ platform: "IPOT", lot: 80, avgPrice: 5_837 },
		],
	},
	{
		ticker: "TLKM",
		name: "Telkom Indonesia",
		totalLot: 120,
		weightedAvgPrice: 3_850,
		currentPrice: 4_100,
		value: 49_200_000,
		pnl: 3_000_000,
		pnlPercent: 6.49,
		accounts: [{ platform: "Stockbit", lot: 120, avgPrice: 3_850 }],
	},
	{
		ticker: "ASII",
		name: "Astra International",
		totalLot: 80,
		weightedAvgPrice: 5_200,
		currentPrice: 5_550,
		value: 44_400_000,
		pnl: 2_800_000,
		pnlPercent: 6.73,
		accounts: [
			{ platform: "Stockbit", lot: 50, avgPrice: 5_100 },
			{ platform: "IPOT", lot: 30, avgPrice: 5_367 },
		],
	},
	{
		ticker: "GOTO",
		name: "GoTo Gojek Tokopedia",
		totalLot: 500,
		weightedAvgPrice: 95,
		currentPrice: 78,
		value: 3_900_000,
		pnl: -850_000,
		pnlPercent: -17.89,
		accounts: [{ platform: "Stockbit", lot: 500, avgPrice: 95 }],
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
		name: "Sucorinvest Money Market Fund",
		type: "Pasar Uang",
		platform: "Bibit",
		units: 12_543.21,
		nav: 1_485,
		value: 18_626_667,
		pnl: 626_667,
		pnlPercent: 3.48,
	},
	{
		id: "mf-002",
		name: "Schroder Dana Prestasi Plus",
		type: "Saham",
		platform: "Bibit",
		units: 5_421.87,
		nav: 24_350,
		value: 132_022_535,
		pnl: 12_022_535,
		pnlPercent: 10.02,
	},
	{
		id: "mf-003",
		name: "Mandiri Investa Pasar Uang",
		type: "Pasar Uang",
		platform: "Bareksa",
		units: 8_120.55,
		nav: 1_402,
		value: 11_385_011,
		pnl: 385_011,
		pnlPercent: 3.50,
	},
	{
		id: "mf-004",
		name: "BNP Paribas Pesona Syariah",
		type: "Campuran",
		platform: "Bibit",
		units: 3_215.0,
		nav: 5_840,
		value: 18_775_600,
		pnl: -224_400,
		pnlPercent: -1.18,
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
	bank: number;
	investment: number;
	crypto: number;
	manual: number;
}

export const dummyNetWorth: NetWorthBreakdown = {
	total: 3_178_259_813,
	bank: 245_700_000,
	investment: 449_550_813,
	crypto: 15_509_000,
	manual: 2_467_500_000,
};

// =============================================================================
// Budget — kategori dengan limit + spent bulan ini
// =============================================================================

export interface DummyBudget {
	id: string;
	category: string;
	limit: number;
	spent: number;
	icon?: string; // emoji optional, dipakai sebagai placeholder visual
}

export const dummyBudgets: DummyBudget[] = [
	{
		id: "bg-001",
		category: "Makan & Minum",
		limit: 4_000_000,
		spent: 2_870_000,
	},
	{
		id: "bg-002",
		category: "Transportasi",
		limit: 1_500_000,
		spent: 1_420_000,
	},
	{
		id: "bg-003",
		category: "Belanja",
		limit: 3_000_000,
		spent: 3_490_000,
	},
	{
		id: "bg-004",
		category: "Hiburan",
		limit: 1_000_000,
		spent: 540_000,
	},
	{
		id: "bg-005",
		category: "Tagihan",
		limit: 2_500_000,
		spent: 2_215_000,
	},
	{
		id: "bg-006",
		category: "Kesehatan",
		limit: 1_200_000,
		spent: 550_000,
	},
	{
		id: "bg-007",
		category: "Pendidikan",
		limit: 800_000,
		spent: 345_000,
	},
	{
		id: "bg-008",
		category: "Cicilan",
		limit: 9_000_000,
		spent: 8_500_000,
	},
];

export interface BudgetSummary {
	totalBudget: number;
	totalSpent: number;
	remaining: number;
}

// Hitung sekali biar konsisten antar UI section.
export const dummyBudgetSummary: BudgetSummary = (() => {
	const totalBudget = dummyBudgets.reduce((acc, b) => acc + b.limit, 0);
	const totalSpent = dummyBudgets.reduce((acc, b) => acc + b.spent, 0);
	return {
		totalBudget,
		totalSpent,
		remaining: totalBudget - totalSpent,
	};
})();
