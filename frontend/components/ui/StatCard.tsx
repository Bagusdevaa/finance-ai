"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useCountUp } from "@/hooks/useCountUp";
import { formatRupiah } from "@/lib/formatRupiah";
import { Card } from "./Card";

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
		percent: number;
		direction: DeltaDirection;
	};
	subtext?: string;
	className?: string;
}

// KPI card sesuai design language — label kecil di atas, angka besar Instrument Serif/Geist Mono di tengah.
export function StatCard({
	label,
	value,
	format = "rupiah",
	valueOverride,
	delta,
	subtext,
	className,
}: StatCardProps) {
	const { value: animated, ref } = useCountUp({ target: value });

	const formatted = formatValue(animated, format);
	// Angka rupiah dan generic number pakai Geist Mono biar kolom sejajar.
	// Angka percent pakai Instrument Serif buat hero feel.
	const valueFontClass =
		format === "percent" ? "font-serif text-5xl font-light" : "font-mono text-4xl font-light";

	return (
		<Card
			ref={ref as React.Ref<HTMLDivElement>}
			className={cn("flex flex-col gap-4", className)}
		>
			<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
				{label}
			</span>
			<div className={cn("text-black leading-none", valueFontClass)}>
				{valueOverride ?? formatted}
			</div>
			<div className="flex items-baseline gap-3">
				{delta && <DeltaBadge percent={delta.percent} direction={delta.direction} />}
				{subtext && <span className="text-xs text-gray-500">{subtext}</span>}
			</div>
		</Card>
	);
}

function formatValue(value: number, format: "rupiah" | "percent" | "number"): string {
	if (format === "rupiah") return formatRupiah(value);
	if (format === "percent") return `${value.toFixed(1)}%`;
	return value.toLocaleString("id-ID");
}

function DeltaBadge({ percent, direction }: { percent: number; direction: DeltaDirection }) {
	const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "→";
	const isUp = direction === "up";
	return (
		<span
			className={cn(
				"font-mono text-[13px]",
				isUp ? "font-medium text-black" : "text-gray-500",
			)}
		>
			{arrow} {Math.abs(percent).toFixed(1)}%
		</span>
	);
}
