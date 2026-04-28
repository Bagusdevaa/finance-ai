"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import {
	dummyBudgets,
	dummyBudgetSummary,
	type DummyBudget,
} from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

const MONTHS = ["MAR 2026", "APR 2026", "MEI 2026"];

// Catatan: design hub Anggaran pakai warna --err: #dc2626 hanya untuk overspent
// (proyeksi negatif & teks "Lewat anggaran"). Itu satu-satunya non-monochrome
// di seluruh page. Sesuai instruksi: kalau design hub eksplisit pakai warna,
// pertahankan. Selain itu strict monochrome.
export default function BudgetPage() {
	const [monthIdx, setMonthIdx] = useState(1);

	return (
		<>
			<Header
				title="Anggaran"
				actions={<MonthSelector idx={monthIdx} onChange={setMonthIdx} />}
			/>

			<motion.div
				className="mx-auto max-w-[1200px] px-8 pb-20 pt-6"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.45, ease: easeDesignhub }}
			>
				<BudgetHero />

				<div className="mb-4 mt-8 flex flex-wrap items-end justify-between gap-3">
					<h2 className="m-0 font-serif text-[24px] font-normal leading-tight tracking-tight2 text-gray-950">
						Anggaran <em className="font-normal italic text-gray-700">per Kategori</em>
					</h2>
					<div className="font-mono text-xs text-gray-500">
						Klik kartu untuk lihat transaksi
					</div>
				</div>

				<BudgetGrid />
			</motion.div>
		</>
	);
}

// =============================================================================
// Month selector
// =============================================================================

function MonthSelector({ idx, onChange }: { idx: number; onChange: (n: number) => void }) {
	return (
		<div className="flex items-center gap-2.5">
			<div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-gray-300 text-[13px] font-medium text-gray-950">
				<button
					type="button"
					onClick={() => onChange(Math.max(0, idx - 1))}
					className="h-full px-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="15 18 9 12 15 6" />
					</svg>
				</button>
				<span className="grid h-full min-w-[130px] place-items-center border-x border-gray-300 px-3.5 font-mono text-xs uppercase tracking-[0.04em]">
					{MONTHS[idx]}
				</span>
				<button
					type="button"
					onClick={() => onChange(Math.min(MONTHS.length - 1, idx + 1))}
					className="h-full px-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-950"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<polyline points="9 18 15 12 9 6" />
					</svg>
				</button>
			</div>
			<button
				type="button"
				onClick={() => onChange(1)}
				className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-medium text-gray-700 transition-[border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
			>
				Reset Bulan
			</button>
		</div>
	);
}

// =============================================================================
// Hero strip — 4 cells (Total, Terpakai, Sisa, Proyeksi)
// =============================================================================

function BudgetHero() {
	const { totalBudget, totalSpent, remaining, projectedOverspend, transactionCount, daysRemaining } = dummyBudgetSummary;
	const usagePct = Math.round((totalSpent / totalBudget) * 100);

	return (
		<div className="grid grid-cols-1 border border-gray-200 bg-white sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
			<HeroCell
				label="Total Budget · April"
				value={formatRupiah(totalBudget)}
				font="serif"
				delta={`${usagePct}% terpakai · ${daysRemaining} hari tersisa`}
				progress={usagePct}
				className="border-b border-gray-200 sm:border-r lg:border-b-0"
			/>
			<HeroCell
				label="Terpakai"
				value={formatRupiah(totalSpent)}
				font="mono"
				delta={`${transactionCount} transaksi`}
				className="border-b border-gray-200 lg:border-b-0 lg:border-r"
			/>
			<HeroCell
				label="Sisa"
				value={formatRupiah(remaining)}
				font="mono"
				delta={`≈ ${formatRupiah(Math.round(remaining / Math.max(1, daysRemaining)))} / hari`}
				className="border-b border-gray-200 sm:border-r lg:border-b-0"
			/>
			<HeroCell
				label="Proyeksi"
				value={formatRupiah(projectedOverspend)}
				font="mono"
				valueClass="text-[#dc2626]"
				delta="overspend di akhir bulan"
				deltaClass="text-[#dc2626]"
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

function BudgetGrid() {
	return (
		<div className="grid grid-cols-1 border border-gray-200 lg:grid-cols-2">
			{dummyBudgets.map((b, i) => (
				<BudgetCard key={b.id} b={b} idx={i} total={dummyBudgets.length} />
			))}
			<AddBudgetCard total={dummyBudgets.length} />
		</div>
	);
}

function BudgetCard({ b, idx, total }: { b: DummyBudget; idx: number; total: number }) {
	const [expanded, setExpanded] = useState(false);
	const pct = Math.round((b.spent / b.limit) * 100);
	const fillW = Math.min(100, pct);
	const over = b.spent > b.limit;
	const rem = b.limit - b.spent;

	// Border layout: kiri kolom punya border-r di lg, semua punya border-b kecuali baris terakhir
	const isRight = idx % 2 === 1;
	const isLastRow = idx >= total - (total % 2 === 0 ? 2 : 1);

	return (
		<div
			onClick={() => setExpanded((v) => !v)}
			className={cn(
				"cursor-pointer p-6 transition-colors duration-200 ease-designhub",
				expanded ? "bg-gray-50" : "bg-white hover:bg-gray-50",
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
						<div className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.04em] text-gray-400">
							{b.subtitle}
						</div>
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
					{formatRupiah(b.spent)}
				</span>
				<span className="text-[13px] text-gray-500">/ {formatRupiah(b.limit)}</span>
			</div>
			<div className={cn("mt-1.5 font-mono text-[11px]", over ? "text-[#dc2626]" : "text-gray-500")}>
				{over
					? `Lewat anggaran ${formatRupiah(Math.abs(rem))}.`
					: rem === b.limit
						? "Belum ada pengeluaran"
						: `Sisa ${formatRupiah(rem)}`}
				{" · "}
				{b.transactions.length} transaksi
			</div>

			<AnimatePresence initial={false}>
				{expanded && (
					<motion.div
						key="detail"
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: "auto" }}
						exit={{ opacity: 0, height: 0 }}
						transition={{ duration: 0.25, ease: easeDesignhub }}
						className="overflow-hidden"
					>
						<div className="mt-4 border-t border-gray-200 pt-4">
							{b.transactions.length > 0 ? (
								b.transactions.map((t, i) => (
									<div
										key={`${t.merchant}-${i}`}
										className="flex items-start justify-between border-b border-gray-100 py-2 text-[12.5px] last:border-b-0"
									>
										<div className="text-gray-700">
											{t.merchant}
											<span className="mt-0.5 block font-mono text-[10px] text-gray-400">{t.when}</span>
										</div>
										<div className="font-mono font-medium tabular-nums text-gray-950">
											−{formatRupiah(Math.abs(t.amount))}
										</div>
									</div>
								))
							) : (
								<div className="py-3 text-center text-[13px] text-gray-500">Belum ada transaksi bulan ini.</div>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function AddBudgetCard({ total }: { total: number }) {
	// "+" card always last → di kolom kanan kalau total even, atau kiri kalau ganjil.
	// Kasih border-r-none kalau di col kanan.
	const idx = total; // setelah semua budget
	const isRight = idx % 2 === 1;
	return (
		<button
			type="button"
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
// Category icons (mengikuti SVG dari Anggaran.html)
// =============================================================================

function CategoryIcon({ name }: { name: string }) {
	const common = { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
	switch (name) {
		case "Makanan":
			return (
				<svg {...common}>
					<path d="M3 11h18l-2 9H5z" />
					<path d="M7 11V7a5 5 0 0 1 10 0v4" />
				</svg>
			);
		case "Transportasi":
			return (
				<svg {...common}>
					<circle cx="7" cy="17" r="2" />
					<circle cx="17" cy="17" r="2" />
					<path d="M3 17h2m4 0h6m4 0h2v-5l-3-4H6l-3 4z" />
				</svg>
			);
		case "Belanja":
			return (
				<svg {...common}>
					<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
					<line x1="3" y1="6" x2="21" y2="6" />
					<path d="M16 10a4 4 0 0 1-8 0" />
				</svg>
			);
		case "Tagihan":
			return (
				<svg {...common}>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<polyline points="14 2 14 8 20 8" />
					<line x1="9" y1="13" x2="15" y2="13" />
					<line x1="9" y1="17" x2="15" y2="17" />
				</svg>
			);
		case "Hiburan":
			return (
				<svg {...common}>
					<polygon points="23 7 16 12 23 17 23 7" />
					<rect x="1" y="5" width="15" height="14" rx="2" />
				</svg>
			);
		case "Kesehatan":
			return (
				<svg {...common}>
					<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
				</svg>
			);
		case "Investasi":
			return (
				<svg {...common}>
					<polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
					<polyline points="17 6 23 6 23 12" />
				</svg>
			);
		case "Edukasi":
			return (
				<svg {...common}>
					<path d="M22 10v6M2 10l10-5 10 5-10 5z" />
					<path d="M6 12v5c3 3 9 3 12 0v-5" />
				</svg>
			);
		default:
			return (
				<svg {...common}>
					<rect x="4" y="4" width="16" height="16" rx="2" />
				</svg>
			);
	}
}
