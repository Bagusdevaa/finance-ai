"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface HeaderProps {
	// Salah satu: title (plain serif italic mix) ATAU greeting (custom node).
	title?: ReactNode;
	subtitle?: ReactNode;
	greeting?: ReactNode;
	actions?: ReactNode;
	className?: string;
}

// Sticky header 64px tinggi, blur backdrop. Mengikuti design hub Dashboard/Aset.
// Title pakai serif 24px, italic accent untuk kata kedua via <em>.
export function Header({ title, subtitle, greeting, actions, className }: HeaderProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-gray-200 px-8",
				"bg-white/85 backdrop-blur-[14px] backdrop-saturate-[180%]",
				className,
			)}
		>
			<div className="flex min-w-0 flex-col gap-0.5">
				{greeting ?? (
					<h1 className="m-0 font-serif text-[24px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
						{title}
					</h1>
				)}
				{subtitle && (
					<div className="font-mono text-[13px] text-gray-400">{subtitle}</div>
				)}
			</div>
			{actions && <div className="flex items-center gap-2.5">{actions}</div>}
		</header>
	);
}

// Reusable icon button matching design hub `.icon-btn` (38x38, 8px radius, ghost border).
export function IconButton({
	children,
	ariaLabel,
	dot,
	onClick,
	className,
}: {
	children: ReactNode;
	ariaLabel: string;
	dot?: boolean;
	onClick?: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			onClick={onClick}
			className={cn(
				"relative grid h-[38px] w-[38px] place-items-center rounded-lg border border-gray-200 text-gray-600",
				"transition-[background-color,color,border-color] duration-200 ease-designhub",
				"hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950",
				className,
			)}
		>
			{children}
			{dot && (
				<span
					aria-hidden
					className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gray-950"
					style={{ boxShadow: "0 0 0 2px white" }}
				/>
			)}
		</button>
	);
}
