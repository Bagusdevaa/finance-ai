"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useCountUp } from "@/hooks/useCountUp";
import { formatRupiah } from "@/lib/formatRupiah";

type DeltaDirection = "up" | "down" | "neutral";

interface StatCardProps {
	label: string;
	// Nilai numerik akan di-count-up. Untuk teks bebas, gunakan `valueOverride`.
	value: number;
	// Format helper: 'rupiah' | 'percent' | 'number'.
	format?: "rupiah" | "percent" | "number";
	// Render override kalau butuh format custom (misal: "Rp 1,2M").
	valueOverride?: ReactNode;
	delta?: {
		percent?: number;
		direction: DeltaDirection;
		// Free-form text override (mis. "Stabil", "Turun 5% — Bagus!", dll).
		text?: string;
	};
	subtext?: string;
	// "serif" = Instrument Serif 40px (rupiah hero feel).
	// "mono" = Geist Mono 30px (rupiah angka biasa).
	// "percent" = Instrument Serif 40px tapi nilai persen.
	font?: "serif" | "mono" | "percent";
	// Optional: progress bar bawah card (utk "Rate Tabungan").
	progress?: number; // 0..100
	className?: string;
}

// Cell dlm KPI grid (border-less per cell, container yg punya border).
// Untuk visual full bordered card pakai <Card> wrapper.
export function StatCard({
	label,
	value,
	format = "rupiah",
	valueOverride,
	delta,
	subtext,
	font = "mono",
	progress,
	className,
}: StatCardProps) {
	const { value: animated, ref } = useCountUp({ target: value });
	const formatted = formatValue(animated, format);

	const valueClass =
		font === "mono"
			? "font-mono text-[30px] font-medium tracking-display"
			: "font-serif text-[40px] font-light tracking-display";

	return (
		<div
			ref={ref as React.RefObject<HTMLDivElement>}
			className={cn(
				"relative bg-white p-6 transition-colors duration-[250ms] ease-designhub hover:bg-gray-50",
				className,
			)}
		>
			<div className="text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
				{label}
			</div>
			<div className={cn("my-3.5 leading-none text-gray-950 tabular-nums", valueClass)}>
				{valueOverride ?? formatted}
			</div>
			{delta && (
				<div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-950">
					<span aria-hidden className="font-serif text-sm leading-none">
						{delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→"}
					</span>
					<span>
						{delta.text ??
							(typeof delta.percent === "number"
								? `${delta.percent.toFixed(1).replace(".", ",")}% bulan ini`
								: "")}
					</span>
				</div>
			)}
			{subtext && <div className="mt-1.5 text-xs text-gray-400">{subtext}</div>}
			{typeof progress === "number" && (
				<div className="mt-3.5 h-0.5 w-full overflow-hidden bg-gray-100">
					<div
						className="h-full bg-gray-950 transition-[width] duration-[1000ms] ease-designhub"
						style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
					/>
				</div>
			)}
		</div>
	);
}

function formatValue(value: number, format: "rupiah" | "percent" | "number"): string {
	if (format === "rupiah") return formatRupiah(value);
	if (format === "percent") return `${Math.round(value)}%`;
	return value.toLocaleString("id-ID");
}

// Bordered KPI grid wrapper. Setiap StatCard child sudah punya border-r/border-b
// custom by index (mengikuti design hub responsive collapse). Wrapper cuma kasih
// outline border + grid-cols breakpoints.
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<div
			className={cn(
				"grid grid-cols-1 border border-gray-200 sm:grid-cols-2 xl:grid-cols-4",
				className,
			)}
		>
			{children}
		</div>
	);
}
