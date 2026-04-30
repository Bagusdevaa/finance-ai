"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { getBudgetSummary, createBudget } from "@/lib/api/budgets";
import type { BudgetCreate, BudgetResponse } from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

function toNumber(s: string | null | undefined): number {
	if (!s) return 0;
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
}

// "YYYY-MM" → human label "APR 2026"
function monthLabel(iso: string): string {
	const [y, m] = iso.split("-").map(Number);
	const d = new Date(y, m - 1, 1);
	return d.toLocaleDateString("id-ID", { month: "short", year: "numeric" }).toUpperCase();
}

function shiftMonth(iso: string, delta: number): string {
	const [y, m] = iso.split("-").map(Number);
	const d = new Date(y, m - 1 + delta, 1);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthIso(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysRemainingInMonth(iso: string): number {
	const [y, m] = iso.split("-").map(Number);
	const lastDay = new Date(y, m, 0).getDate();
	const now = new Date();
	const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
	if (!isCurrent) return lastDay;
	return Math.max(0, lastDay - now.getDate());
}

export default function BudgetPage() {
	const queryClient = useQueryClient();
	const [monthIso, setMonthIso] = useState<string>(() => currentMonthIso());
	const [showAddModal, setShowAddModal] = useState(false);

	const { data: summary, isLoading } = useQuery({
		queryKey: ["budget-summary", monthIso],
		queryFn: () => getBudgetSummary(monthIso),
	});

	const createMutation = useMutation({
		mutationFn: (payload: BudgetCreate) => createBudget(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["budget-summary", monthIso] });
			setShowAddModal(false);
		},
	});

	return (
		<>
			<Header
				title="Anggaran"
				actions={
					<div className="hidden sm:flex">
						<MonthSelector
							monthIso={monthIso}
							onChange={setMonthIso}
							onReset={() => setMonthIso(currentMonthIso())}
						/>
					</div>
				}
			/>

			<motion.div
				className="mx-auto max-w-[1200px] px-4 pb-20 pt-6 md:px-8"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45, ease: easeDesignhub }}
			>
				<div className="mb-4 sm:hidden">
					<MonthSelector
						monthIso={monthIso}
						onChange={setMonthIso}
						onReset={() => setMonthIso(currentMonthIso())}
					/>
				</div>
				<BudgetHero summary={summary} monthIso={monthIso} />

				<div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
					<h2 className="m-0 font-serif text-[24px] font-normal leading-tight tracking-tight2 text-gray-950">
						Anggaran <em className="font-normal italic text-gray-700">per Kategori</em>
					</h2>
					<div className="font-mono text-xs text-gray-500">
						{isLoading ? "Memuat..." : `${summary?.items.length ?? 0} kategori`}
					</div>
				</div>

				<BudgetGrid budgets={summary?.items ?? []} onAdd={() => setShowAddModal(true)} />
			</motion.div>

			<AddBudgetModal
				open={showAddModal}
				onClose={() => setShowAddModal(false)}
				monthIso={monthIso}
				onSubmit={(payload) => createMutation.mutate(payload)}
				submitting={createMutation.isPending}
				error={createMutation.error ? getErrorMessage(createMutation.error, "Gagal menyimpan") : null}
			/>
		</>
	);
}

// =============================================================================
// Month selector
// =============================================================================

function MonthSelector({
	monthIso,
	onChange,
	onReset,
}: {
	monthIso: string;
	onChange: (iso: string) => void;
	onReset: () => void;
}) {
	return (
		<div className="flex items-center gap-1.5 min-[375px]:gap-2.5">
			<div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-gray-300 text-[13px] font-medium text-gray-950">
				<button
					type="button"
					onClick={() => onChange(shiftMonth(monthIso, -1))}
					className="h-full px-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950 min-[375px]:px-2.5"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
				<span className="grid h-full min-w-[90px] place-items-center border-x border-gray-300 px-2 font-mono text-[10px] uppercase tracking-[0.04em] min-[375px]:min-w-[130px] min-[375px]:px-3.5 min-[375px]:text-xs">
					{monthLabel(monthIso)}
				</span>
				<button
					type="button"
					onClick={() => onChange(shiftMonth(monthIso, 1))}
					className="h-full px-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950 min-[375px]:px-2.5"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
			</div>
			<button
				type="button"
				onClick={onReset}
				className="inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg border border-gray-300 bg-white px-2.5 text-[11px] font-medium text-gray-700 transition-[border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950 min-[375px]:px-3.5 min-[375px]:text-[13px]"
			>
				Reset Bulan
			</button>
		</div>
	);
}

// =============================================================================
// Hero strip
// =============================================================================

function BudgetHero({
	summary,
	monthIso,
}: {
	summary: { total_budget: string; total_spent: string; remaining: string } | undefined;
	monthIso: string;
}) {
	const totalBudget = toNumber(summary?.total_budget);
	const totalSpent = toNumber(summary?.total_spent);
	const remaining = toNumber(summary?.remaining);
	const usagePct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;
	const daysRemaining = daysRemainingInMonth(monthIso);

	return (
		<div className="grid grid-cols-1 border border-gray-200 bg-white sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
			<HeroCell
				label={`Total Budget · ${monthLabel(monthIso)}`}
				value={formatRupiah(totalBudget)}
				font="serif"
				delta={`${usagePct}% terpakai · ${daysRemaining} hari tersisa`}
				progress={Math.min(100, usagePct)}
				className="border-b border-gray-200 sm:border-r lg:border-b-0"
			/>
			<HeroCell
				label="Terpakai"
				value={formatRupiah(totalSpent)}
				font="mono"
				delta={totalBudget > 0 ? `${usagePct}% dari total` : "Belum ada anggaran"}
				className="border-b border-gray-200 lg:border-b-0 lg:border-r"
			/>
			<HeroCell
				label="Sisa"
				value={formatRupiah(remaining)}
				font="mono"
				delta={daysRemaining > 0 ? `≈ ${formatRupiah(Math.round(remaining / Math.max(1, daysRemaining)))} / hari` : "Bulan berakhir"}
			/>
		</div>
	);
}

function HeroCell({
	label,
	value,
	delta,
	font,
	progress,
	valueClass,
	deltaClass,
	className,
}: {
	label: string;
	value: string;
	delta: string;
	font: "serif" | "mono";
	progress?: number;
	valueClass?: string;
	deltaClass?: string;
	className?: string;
}) {
	return (
		<div className={cn("p-6", className)}>
			<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">{label}</div>
			<div
				className={cn(
					"mt-2 leading-[1.05] tracking-tight2 tabular-nums text-gray-950",
					font === "serif" ? "font-serif text-[36px] font-light" : "font-mono text-[24px] font-medium",
					valueClass,
				)}
			>
				{value}
			</div>
			{typeof progress === "number" && (
				<div className="relative mt-3.5 h-1 w-full bg-gray-100">
					<motion.div
						className="absolute inset-y-0 left-0 bg-gray-950"
						initial={{ width: 0 }}
						animate={{ width: `${progress}%` }}
						transition={{ duration: 1, ease: easeDesignhub, delay: 0.2 }}
					/>
				</div>
			)}
			<div className={cn("mt-1.5 font-mono text-xs text-gray-500", deltaClass)}>{delta}</div>
		</div>
	);
}

// =============================================================================
// Budget grid
// =============================================================================

function BudgetGrid({ budgets, onAdd }: { budgets: BudgetResponse[]; onAdd: () => void }) {
	return (
		<div className="grid grid-cols-1 border border-gray-200 lg:grid-cols-2">
			{budgets.map((b, i) => (
				<BudgetCard key={b.id} b={b} idx={i} total={budgets.length} />
			))}
			<AddBudgetCard total={budgets.length} onAdd={onAdd} />
		</div>
	);
}

function BudgetCard({ b, idx, total }: { b: BudgetResponse; idx: number; total: number }) {
	const spent = toNumber(b.spent);
	const limit = toNumber(b.monthly_amount);
	const remaining = toNumber(b.remaining);
	const pct = Math.round(b.percent_used);
	const fillW = Math.min(100, pct);
	const over = spent > limit;

	const isRight = idx % 2 === 1;
	const isLastRow = idx >= total - (total % 2 === 0 ? 2 : 1);

	return (
		<div
			className={cn(
				"p-6 transition-colors duration-200 ease-designhub",
				"bg-white hover:bg-gray-50",
				!isRight && "lg:border-r border-gray-200",
				!isLastRow && "border-b border-gray-200",
			)}
		>
			<div className="mb-3.5 flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span
						className={cn(
							"grid h-9 w-9 flex-none place-items-center text-gray-700",
							over ? "bg-gray-950 text-white" : "bg-gray-100",
						)}
					>
						<CategoryIcon name={b.category} />
					</span>
					<div className="min-w-0">
						<div className="text-[15px] font-medium text-gray-950">{b.category}</div>
						{b.icon && (
							<div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-gray-400">
								{b.icon}
							</div>
						)}
					</div>
				</div>
				<div className={cn("font-mono text-[13px] font-medium tabular-nums", over ? "text-[#dc2626]" : "text-gray-950")}>
					{pct}%
				</div>
			</div>
			<div
				className={cn(
					"relative h-1.5 overflow-hidden",
					over ? "bg-[#fce8e8]" : "bg-gray-100",
				)}
			>
				<motion.div
					className="absolute inset-y-0 left-0 bg-gray-950"
					initial={{ width: 0 }}
					animate={{ width: `${fillW}%` }}
					transition={{ duration: 1.2, ease: easeDesignhub, delay: 0.15 }}
				/>
			</div>
			<div className="mt-2.5 flex items-baseline justify-between font-mono tabular-nums">
				<span className={cn("text-sm font-medium", over ? "text-[#dc2626]" : "text-gray-950")}>
					{formatRupiah(spent)}
				</span>
				<span className="text-[13px] text-gray-500">/ {formatRupiah(limit)}</span>
			</div>
			<div className={cn("mt-1.5 font-mono text-[11px]", over ? "text-[#dc2626]" : "text-gray-500")}>
				{over
					? `Lewat anggaran ${formatRupiah(Math.abs(remaining))}.`
					: spent === 0
						? "Belum ada pengeluaran"
						: `Sisa ${formatRupiah(remaining)}`}
			</div>
		</div>
	);
}

function AddBudgetCard({ total, onAdd }: { total: number; onAdd: () => void }) {
	const idx = total;
	const isRight = idx % 2 === 1;
	return (
		<button
			type="button"
			onClick={onAdd}
			className={cn(
				"flex flex-col items-center justify-center gap-1.5 bg-white p-6 text-center text-gray-500 transition-colors duration-200 ease-designhub hover:bg-gray-50 hover:text-gray-950",
				!isRight && "lg:border-r border-gray-200",
				"min-h-[200px]",
			)}
		>
			<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
				<path d="M12 5v14" />
				<path d="M5 12h14" />
			</svg>
			<div className="mt-1.5 text-sm font-medium">Tambah Anggaran Kategori</div>
			<div className="text-xs text-gray-400">Set target baru untuk kategori lain</div>
		</button>
	);
}

// =============================================================================
// Category icons
// =============================================================================

function CategoryIcon({ name }: { name: string }) {
	const common = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
	const lower = name.toLowerCase();
	if (lower.includes("makan") || lower.includes("food")) {
		return (
			<svg {...common}>
				<path d="M3 11h18l-2 9H5z" />
				<path d="M7 11V7a5 5 0 0 1 10 0v4" />
			</svg>
		);
	}
	if (lower.includes("transport")) {
		return (
			<svg {...common}>
				<circle cx="7" cy="17" r="2" />
				<circle cx="17" cy="17" r="2" />
				<path d="M3 17h2m4 0h6m4 0h2v-5l-3-4H6l-3 4z" />
			</svg>
		);
	}
	if (lower.includes("belanja") || lower.includes("shopping")) {
		return (
			<svg {...common}>
				<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
				<line x1="3" y1="6" x2="21" y2="6" />
				<path d="M16 10a4 4 0 0 1-8 0" />
			</svg>
		);
	}
	if (lower.includes("tagihan") || lower.includes("bill")) {
		return (
			<svg {...common}>
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="9" y1="13" x2="15" y2="13" />
				<line x1="9" y1="17" x2="15" y2="17" />
			</svg>
		);
	}
	if (lower.includes("hibur")) {
		return (
			<svg {...common}>
				<polygon points="23 7 16 12 23 17 23 7" />
				<rect x="1" y="5" width="15" height="14" rx="2" />
			</svg>
		);
	}
	if (lower.includes("sehat") || lower.includes("health")) {
		return (
			<svg {...common}>
				<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
			</svg>
		);
	}
	if (lower.includes("invest")) {
		return (
			<svg {...common}>
				<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
				<polyline points="17 6 23 6 23 12" />
			</svg>
		);
	}
	if (lower.includes("edukasi") || lower.includes("education")) {
		return (
			<svg {...common}>
				<path d="M22 10v6M2 10l10-5 10 5-10 5z" />
				<path d="M6 12v5c3 3 9 3 12 0v-5" />
			</svg>
		);
	}
	return (
		<svg {...common}>
			<rect x="4" y="4" width="16" height="16" rx="2" />
		</svg>
	);
}

// =============================================================================
// Add Budget Modal
// =============================================================================

function AddBudgetModal({
	open,
	onClose,
	monthIso,
	onSubmit,
	submitting,
	error,
}: {
	open: boolean;
	onClose: () => void;
	monthIso: string;
	onSubmit: (payload: BudgetCreate) => void;
	submitting: boolean;
	error: string | null;
}) {
	const [category, setCategory] = useState("");
	const [limitStr, setLimitStr] = useState("");
	const [icon, setIcon] = useState("");

	useEffect(() => {
		if (open) {
			setCategory("");
			setLimitStr("");
			setIcon("");
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const handler = (e: globalThis.KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open, onClose]);

	const monthLabelText = useMemo(() => monthLabel(monthIso), [monthIso]);

	const handleSubmit = () => {
		const limit = parseFloat(limitStr.replace(/\./g, "").replace(",", "."));
		if (!category.trim() || isNaN(limit) || limit <= 0) return;
		const payload: BudgetCreate = {
			category: category.trim(),
			monthly_amount: limit.toFixed(2),
			month: `${monthIso}-01`,
			icon: icon.trim() || null,
		};
		onSubmit(payload);
	};

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2 }}
					onClick={onClose}
				>
					<motion.div
						className="w-full max-w-[420px] border border-gray-200 bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.25)]"
						initial={{ opacity: 0, scale: 0.95, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 8 }}
						transition={{ duration: 0.25, ease: easeDesignhub }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
							<h2 className="text-[15px] font-medium text-gray-950">Tambah Anggaran · {monthLabelText}</h2>
							<button
								type="button"
								onClick={onClose}
								className="grid h-7 w-7 place-items-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
							>
								<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M6 6l12 12M18 6l-12 12" />
								</svg>
							</button>
						</div>
						<div className="flex flex-col gap-4 px-6 py-5">
							<div className="flex flex-col gap-1.5">
								<label className="text-[11px] font-medium uppercase tracking-label text-gray-500">Nama Kategori</label>
								<input
									type="text"
									value={category}
									onChange={(e) => setCategory(e.target.value)}
									placeholder="Contoh: Olahraga"
									className="h-9 w-full border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 focus:bg-white"
									autoFocus
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-[11px] font-medium uppercase tracking-label text-gray-500">Anggaran Bulanan</label>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-500">Rp</span>
									<input
										type="text"
										value={limitStr}
										onChange={(e) => setLimitStr(e.target.value)}
										placeholder="500.000"
										className="h-9 w-full border border-gray-200 bg-gray-50 pl-9 pr-3 font-mono text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 focus:bg-white"
									/>
								</div>
							</div>
							<div className="flex flex-col gap-1.5">
								<label className="text-[11px] font-medium uppercase tracking-label text-gray-500">Ikon (opsional)</label>
								<input
									type="text"
									value={icon}
									onChange={(e) => setIcon(e.target.value)}
									placeholder="Contoh: 🏋️"
									className="h-9 w-full border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 focus:bg-white"
								/>
							</div>
							{error && (
								<div className="border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
									{error}
								</div>
							)}
						</div>
						<div className="flex gap-2 border-t border-gray-200 px-6 py-4">
							<button
								type="button"
								onClick={onClose}
								className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2.5 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-950 hover:text-gray-950"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={handleSubmit}
								disabled={!category.trim() || !limitStr.trim() || submitting}
								className="flex-1 rounded-lg bg-gray-950 px-3.5 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
							>
								{submitting ? "Menyimpan..." : "Simpan"}
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
