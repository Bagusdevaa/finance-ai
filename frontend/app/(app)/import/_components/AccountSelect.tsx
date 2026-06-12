"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "@/lib/api/accounts";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "financeai:import:lastAccountId";

interface AccountSelectProps {
	value: string | null;
	onChange: (accountId: string | null) => void;
}

export function AccountSelect({ value, onChange }: AccountSelectProps) {
	const { data: accounts } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});

	// Restore last selected on mount, if not already set by parent.
	// AccountResponse has no `deleted_at` field — backend already hides soft-deleted accounts.
	useEffect(() => {
		if (value !== null) return;
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return;
		// Only restore if account still exists and is active
		if (accounts?.some((a) => a.id === saved && a.is_active)) {
			onChange(saved);
		}
	}, [accounts, value, onChange]);

	// Persist on change
	useEffect(() => {
		if (value) {
			localStorage.setItem(STORAGE_KEY, value);
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	}, [value]);

	const activeAccounts = (accounts ?? []).filter((a) => a.is_active);

	return (
		<div className="flex flex-wrap items-center gap-3">
			<label htmlFor="import-account-select" className="text-[11px] font-medium uppercase tracking-label text-gray-500">
				Akun tujuan
			</label>
			<div className="relative">
				<select
					id="import-account-select"
					value={value ?? ""}
					onChange={(e) => onChange(e.target.value || null)}
					className={cn(
						"h-9 appearance-none rounded-md border bg-white pl-3 pr-8 text-[13px] text-gray-900 outline-none transition-[border-color] duration-200",
						"focus:border-gray-950",
						value ? "border-gray-950" : "border-gray-300",
					)}
					style={{
						backgroundImage:
							"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>\")",
						backgroundPosition: "right 8px center",
						backgroundRepeat: "no-repeat",
					}}
				>
					<option value="">— Tanpa akun (opsional) —</option>
					{activeAccounts.map((a) => (
						<option key={a.id} value={a.id}>
							{a.name}
							{a.last4 ? ` (••• ${a.last4})` : ""}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
