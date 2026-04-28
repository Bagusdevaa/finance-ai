"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "danger";
type BadgeSize = "sm" | "md";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	variant?: BadgeVariant;
	size?: BadgeSize;
	// Optional dot/icon prefix — buat status semantics tanpa fill warna.
	icon?: ReactNode;
	children?: ReactNode;
}

// Monochrome by default. Status variants pakai gray scale + dot kecil sebagai semantic cue,
// bukan fill warna penuh. Status text tetap hitam — accent disampaikan via dot.
const variantClasses: Record<BadgeVariant, string> = {
	default: "bg-gray-100 text-gray-700 border border-transparent",
	secondary: "bg-black text-white border border-transparent",
	outline: "bg-transparent text-black border border-gray-300",
	success: "bg-gray-100 text-black border border-transparent",
	warning: "bg-gray-100 text-gray-700 border border-transparent",
	danger: "bg-gray-100 text-gray-700 border border-transparent",
};

// Dot color buat status — green/red sebagai cue minimal, sisanya tetap monochrome.
const statusDotClasses: Partial<Record<BadgeVariant, string>> = {
	success: "bg-emerald-600",
	warning: "bg-gray-500",
	danger: "bg-red-600",
};

const sizeClasses: Record<BadgeSize, string> = {
	sm: "h-5 px-1.5 text-[10px] gap-1",
	md: "h-6 px-2 text-[11px] gap-1.5",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
	{ variant = "default", size = "md", icon, className, children, ...props },
	ref,
) {
	const dotClass = statusDotClasses[variant];

	return (
		<span
			ref={ref}
			className={cn(
				"inline-flex items-center rounded-[2px] font-medium uppercase tracking-label leading-none",
				"whitespace-nowrap",
				variantClasses[variant],
				sizeClasses[size],
				className,
			)}
			{...props}
		>
			{dotClass && (
				<span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
			)}
			{icon && (
				<span aria-hidden="true" className="inline-flex">
					{icon}
				</span>
			)}
			<span>{children}</span>
		</span>
	);
});
