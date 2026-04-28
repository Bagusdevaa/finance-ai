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
