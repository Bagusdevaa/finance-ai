"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/cn";

type ProgressHeight = "sm" | "md" | "lg";

interface ProgressBarProps {
	// Persen 0–100. Boleh > 100 (over-budget); fill di-clip ke 100% tapi state visual berubah.
	value: number;
	max?: number;
	height?: ProgressHeight;
	// Aktifkan visual over-budget (border + fill style berbeda) saat value > max.
	overBudget?: boolean;
	className?: string;
	"aria-label"?: string;
}

const heightClasses: Record<ProgressHeight, string> = {
	sm: "h-0.5",
	md: "h-1",
	lg: "h-2",
};

const easeExpo = [0.16, 1, 0.3, 1] as const;

// Horizontal progress bar — sharp corners, monochrome.
// Animate fill saat masuk viewport. Over-budget state pakai pattern bukan warna fill solid.
export function ProgressBar({
	value,
	max = 100,
	height = "md",
	overBudget,
	className,
	"aria-label": ariaLabel,
}: ProgressBarProps) {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });

	const percent = max === 0 ? 0 : (value / max) * 100;
	const clamped = Math.min(Math.max(percent, 0), 100);
	const isOver = overBudget ?? value > max;

	return (
		<div
			ref={ref}
			role="progressbar"
			aria-valuenow={Math.round(percent)}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={ariaLabel}
			className={cn(
				"relative w-full overflow-hidden rounded-none bg-gray-100",
				heightClasses[height],
				isOver && "bg-gray-200",
				className,
			)}
		>
			<motion.div
				className={cn(
					"h-full rounded-none",
					isOver
						? "bg-[repeating-linear-gradient(45deg,#000_0,#000_4px,#404040_4px,#404040_8px)]"
						: "bg-black",
				)}
				initial={{ width: 0 }}
				animate={{ width: inView ? `${clamped}%` : 0 }}
				transition={{ duration: 0.6, ease: easeExpo }}
			/>
		</div>
	);
}
