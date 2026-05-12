/**
 * Heuristic substring match of account name → bank/platform export instructions.
 *
 * Account model only has `name` (free text), not an explicit `bank` field.
 * User account named "BCA Tahapan Xpresi" → contains "bca" → returns BCA tips.
 * Account "Tabunganku" → no match → returns null → caller hides tips panel.
 */

export interface Tips {
	title: string;
	steps: string[];
}

const TIPS_REGISTRY: { match: string[]; tips: Tips }[] = [
	{
		match: ["bca"],
		tips: {
			title: "BCA",
			steps: [
				"Buka aplikasi BCA mobile dan masuk ke menu Info Saldo & Mutasi.",
				"Pilih rentang tanggal yang ingin di-import (maksimal 3 bulan terakhir).",
				"Tap Kirim ke Email, pilih format PDF.",
				"Buka email kamu, unduh attachment-nya, lalu drop di sini.",
			],
		},
	},
	{
		match: ["mandiri"],
		tips: {
			title: "Mandiri",
			steps: [
				"Login ke Livin' by Mandiri.",
				"Buka e-Statement, pilih bulan yang ingin di-import.",
				"Download PDF, lalu drop di sini.",
			],
		},
	},
	{
		match: ["bri"],
		tips: {
			title: "BRI",
			steps: [
				"Buka BRImo, masuk ke Mutasi, pilih periode, kirim ke email PDF.",
				"Drop file PDF di sini.",
			],
		},
	},
	{
		match: ["bni", "wondr"],
		tips: {
			title: "BNI",
			steps: [
				"Buka wondr by BNI, menu Mutasi Rekening, ekspor PDF.",
				"Drop file PDF di sini.",
			],
		},
	},
	{
		match: ["permata"],
		tips: {
			title: "Permata",
			steps: [
				"Login PermataNet atau PermataMobile X.",
				"Menu Rekening Koran, pilih periode, download PDF.",
				"Drop file di sini.",
			],
		},
	},
	{
		match: ["gopay", "gojek"],
		tips: {
			title: "GoPay",
			steps: [
				"Buka aplikasi Gojek, ke GoPay, tap Riwayat.",
				"Screenshot riwayat transaksi (multi-page OK).",
				"Drop screenshot di sini — AI akan baca semuanya.",
			],
		},
	},
	{
		match: ["ovo"],
		tips: {
			title: "OVO",
			steps: [
				"Buka OVO, menu History. Screenshot tampilan riwayat.",
				"Drop screenshot di sini.",
			],
		},
	},
	{
		match: ["dana"],
		tips: {
			title: "Dana",
			steps: [
				"Buka DANA, menu History. Screenshot tampilan riwayat.",
				"Drop screenshot di sini.",
			],
		},
	},
	{
		match: ["shopeepay", "shopee"],
		tips: {
			title: "ShopeePay",
			steps: [
				"Buka ShopeePay, menu Riwayat Transaksi.",
				"Screenshot tampilan list. Drop di sini.",
			],
		},
	},
	{
		match: ["bibit"],
		tips: {
			title: "Bibit",
			steps: [
				"Buka Bibit, menu Portofolio → Pengaturan → Export Data.",
				"Pilih CSV. Drop file di sini.",
			],
		},
	},
	{
		match: ["stockbit"],
		tips: {
			title: "Stockbit",
			steps: [
				"Buka Stockbit, tab Portfolio.",
				"Screenshot tampilan holdings (1 layar = 1 file).",
				"Drop semua screenshot di sini.",
			],
		},
	},
	{
		match: ["ipot"],
		tips: {
			title: "IPOT",
			steps: [
				"Login IPOT (web), menu Portfolio → Export.",
				"Pilih format CSV. Drop file di sini.",
			],
		},
	},
	{
		match: ["pluang"],
		tips: {
			title: "Pluang",
			steps: [
				"Buka Pluang, menu Portofolio. Screenshot tampilan emas / kripto.",
				"Drop screenshot di sini.",
			],
		},
	},
];

export function lookupTips(accountName: string | null | undefined): Tips | null {
	if (!accountName) return null;
	const lower = accountName.toLowerCase();
	for (const entry of TIPS_REGISTRY) {
		if (entry.match.some((kw) => lower.includes(kw))) {
			return entry.tips;
		}
	}
	return null;
}
