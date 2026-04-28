"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type SkeletonVariant = "text" | "card" | "circle";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
	variant?: SkeletonVariant;
	// Override width — default kontekstual per varian.
	width?: string | number;
	// Override height — default kontekstual per varian.
	height?: string | number;
}

// Subtle pulse — gray-100 → gray-50 → gray-100 sesuai design language.
// Shape mengikuti varian biar nggak generic.
const variantClasses: Record<SkeletonVariant, string> = {
	text: "h-4 w-full rounded-none",
	card: "h-32 w-full rounded-none",
	circle: "h-10 w-10 rounded-full",
};

export function Skeleton({
	variant = "text",
	width,
	height,
	className,
	style,
	...props
}: SkeletonProps) {
	const inlineStyle = {
		...(width !== undefined ? { width } : null),
		...(height !== undefined ? { height } : null),
		...style,
	};

	return (
		<div
			aria-hidden="true"
			className={cn(
				"animate-pulse bg-gray-100",
				"motion-safe:bg-gradient-to-r motion-safe:from-gray-100 motion-safe:via-gray-50 motion-safe:to-gray-100",
				"motion-safe:bg-[length:200%_100%]",
				variantClasses[variant],
				className,
			)}
			style={inlineStyle}
			{...props}
		/>
	);
}
