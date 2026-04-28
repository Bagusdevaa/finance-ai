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
