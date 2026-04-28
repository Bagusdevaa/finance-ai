"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SectionHeaderProps {
	// First word + emphasized italic word (e.g. "Saham" + "IDX" → "Saham *IDX*").
	// Pass plain string title untuk single word.
	title: string;
	emphasis?: string;
	// Inline meta on the right (e.g. Total | Return | button).
	meta?: ReactNode;
	className?: string;
}

// Section header sesuai design hub: serif 24px, kata kedua italic gray-700.
// Ex: <SectionHeader title="Saham" emphasis="IDX" />
export function SectionHeader({ title, emphasis, meta, className }: SectionHeaderProps) {
	return (
		<div className={cn("mb-3.5 flex flex-wrap items-end justify-between gap-4", className)}>
			<h2 className="m-0 font-serif text-[24px] font-normal leading-tight tracking-tight2 text-gray-950">
				{title}
				{emphasis && (
					<>
						{" "}
						<em className="font-normal italic text-gray-700">{emphasis}</em>
					</>
				)}
			</h2>
			{meta && <div className="flex flex-wrap items-center gap-6 text-[13px]">{meta}</div>}
		</div>
	);
}

// Inline meta cell — label kecil + value mono.
export function SectionMeta({
	label,
	value,
	className,
}: {
	label: string;
	value: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn("flex items-baseline gap-1.5", className)}>
			<span className="text-[11px] font-medium uppercase tracking-label text-gray-400">
				{label}
			</span>
			<span className="font-mono font-medium text-gray-950 tabular-nums">{value}</span>
		</div>
	);
}
