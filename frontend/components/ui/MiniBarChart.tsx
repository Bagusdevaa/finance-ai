"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

interface MiniBarChartProps {
	// Each bar has a label (e.g. "Sep") and a value 0..1 (relative height).
	bars: { label: string; value: number }[];
	// Bar fill color — default "white" (untuk hero hitam) — gunakan "black" di context lain.
	tone?: "white" | "black";
	maxHeight?: number;
	className?: string;
}

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

// Bar chart kecil dengan stagger reveal — dipakai di Aset hero (di atas banner hitam).
export function MiniBarChart({ bars, tone = "white", maxHeight = 100, className }: MiniBarChartProps) {
	return (
		<div
			className={cn("flex items-end gap-3", className)}
			style={{ height: maxHeight + 20 }}
		>
			{bars.map((b, i) => (
				<div key={`${b.label}-${i}`} className="flex w-[38px] flex-col items-center gap-2">
					<motion.div
						initial={{ height: 0 }}
						animate={{ height: b.value * maxHeight }}
						transition={{ duration: 0.8, ease: easeDesignhub, delay: 0.2 + i * 0.08 }}
						className={cn("w-6", tone === "white" ? "bg-white" : "bg-gray-950")}
					/>
					<span
						className={cn(
							"font-mono text-[10px] uppercase tracking-[0.06em]",
							tone === "white" ? "text-gray-500" : "text-gray-400",
						)}
					>
						{b.label}
					</span>
				</div>
			))}
		</div>
	);
}
