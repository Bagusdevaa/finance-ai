"use client";

import { Bell, Search } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface HeaderProps {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	className?: string;
}

export function Header({ title, subtitle, actions, className }: HeaderProps) {
	return (
		<header
			className={cn(
				"sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8",
				className,
			)}
		>
			<div className="flex flex-col gap-0.5">
				<h1 className="font-serif text-2xl leading-none text-black">{title}</h1>
				{subtitle && <p className="text-[13px] text-gray-400">{subtitle}</p>}
			</div>
			<div className="flex items-center gap-2">
				{actions}
				<HeaderIconButton ariaLabel="Cari">
					<Search className="h-[18px] w-[18px]" strokeWidth={1.5} />
				</HeaderIconButton>
				<HeaderIconButton ariaLabel="Notifikasi">
					<Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
				</HeaderIconButton>
			</div>
		</header>
	);
}

function HeaderIconButton({
	children,
	ariaLabel,
}: {
	children: ReactNode;
	ariaLabel: string;
}) {
	return (
		<button
			type="button"
			aria-label={ariaLabel}
			className="flex h-9 w-9 items-center justify-center rounded text-gray-500 transition-colors duration-150 ease-out hover:bg-gray-50 hover:text-black"
		>
			{children}
		</button>
	);
}
