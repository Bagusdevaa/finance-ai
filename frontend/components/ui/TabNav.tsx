"use client";

import { cn } from "@/lib/cn";

export interface TabItem {
	id: string;
	label: string;
}

interface TabNavProps {
	tabs: TabItem[];
	activeId: string;
	onChange: (id: string) => void;
	// Sticky bawah header (top-16). Default true.
	sticky?: boolean;
	className?: string;
}

// Horizontal tab bar — underline 2px hitam saat active, sesuai design hub Aset Portofolio.
// Cocok untuk "Semua / Saham / Reksa Dana / ..." dst.
export function TabNav({ tabs, activeId, onChange, sticky = true, className }: TabNavProps) {
	return (
		<div
			className={cn(
				"flex items-center gap-0 overflow-x-auto border-b border-gray-200 bg-white px-8",
				sticky && "sticky top-16 z-[8]",
				className,
			)}
		>
			{tabs.map((tab) => {
				const active = tab.id === activeId;
				return (
					<button
						key={tab.id}
						type="button"
						onClick={() => onChange(tab.id)}
						className={cn(
							"-mb-px whitespace-nowrap border-b-2 px-5 py-4 text-sm font-medium",
							"transition-[color,border-color] duration-200 ease-designhub",
							active
								? "border-gray-950 text-gray-950"
								: "border-transparent text-gray-500 hover:text-gray-950",
						)}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
