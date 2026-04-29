"use client";

import { type ReactNode } from "react";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";

interface HeaderProps {
	// Salah satu: title (plain serif italic mix) ATAU greeting (custom node).
	title?: ReactNode;
	subtitle?: ReactNode;
	greeting?: ReactNode;
	actions?: ReactNode;
	className?: string;
}

function HamburgerButton() {
	const { setMobileOpen } = useSidebar();
	return (
		<button
			type="button"
			onClick={() => setMobileOpen(true)}
			aria-label="Buka menu"
			className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-950 md:hidden"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>
	);
}

// Sticky header 64px tinggi, blur backdrop. Mengikuti design hub Dashboard/Aset.
// Title pakai serif 24px, italic accent untuk kata kedua via <em>.
export function Header({ title, subtitle, greeting, actions, className }: HeaderProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-gray-200 px-4 md:px-8",
				"bg-white/85 backdrop-blur-[14px] backdrop-saturate-[180%]",
				className,
			)}
		>
			<div className="flex min-w-0 items-center">
				<HamburgerButton />
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
