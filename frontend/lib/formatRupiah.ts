// Format angka jadi `Rp X.XXX.XXX` ala konvensi finansial Indonesia.
// Negatif di-prefix dengan tanda minus sebelum `Rp` (cth: `-Rp 250.000`).
export function formatRupiah(value: number, options?: { withSign?: boolean }): string {
	if (!Number.isFinite(value)) return "Rp 0";

	const negative = value < 0;
	const absValue = Math.abs(value);
	const rounded = Math.round(absValue);

	// Pisah ribuan pakai titik (locale id-ID).
	const formatted = rounded.toLocaleString("id-ID");

	if (negative) return `-Rp ${formatted}`;
	if (options?.withSign) return `+Rp ${formatted}`;
	return `Rp ${formatted}`;
}

// Currency-aware amount format. USD → `$` (selalu 2 desimal), lainnya → `Rp `.
// withSign: selalu tampilkan +/− di depan (untuk kolom mutasi). Null → "—".
export function formatAmount(
	value: number | string | null | undefined,
	currency: string = "IDR",
	options?: { withSign?: boolean },
): string {
	if (value === null || value === undefined) return "—";
	const n = typeof value === "string" ? parseFloat(value) : value;
	if (!Number.isFinite(n)) return "—";
	const abs = Math.abs(n);

	let formatted: string;
	let prefix: string;
	if (currency === "USD") {
		formatted = abs.toLocaleString("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
		prefix = "$";
	} else {
		formatted = Math.round(abs).toLocaleString("id-ID");
		prefix = "Rp ";
	}

	if (options?.withSign) {
		return (n >= 0 ? "+" : "−") + prefix + formatted;
	}
	return (n < 0 ? "−" : "") + prefix + formatted;
}
