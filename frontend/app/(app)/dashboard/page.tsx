"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Header, IconButton } from "@/components/layout/Header";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import {
	dashboardStats,
	recentTransactions,
	cashflowSeries,
	allocationSegments,
	aiInsights,
	type DummyTransaction,
	type AiInsight,
} from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

const containerVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const itemVariants = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeDesignhub } },
};

export default function DashboardPage() {
	return (
		<>
			<Header
				greeting={
					<h1 className="m-0 font-serif text-[24px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
						Selamat sore, <em className="font-normal italic text-gray-700">Bagus.</em>
					</h1>
				}
				subtitle={<TodayDate />}
				actions={
					<>
						<IconButton ariaLabel="Cari">
							<SearchSvg />
						</IconButton>
						<IconButton ariaLabel="Notifikasi" dot>
							<BellSvg />
						</IconButton>
						<button
							type="button"
							className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-[13px] font-medium text-gray-950 transition-[background-color,border-color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50"
						>
							<UploadSvg />
							<span>Import Data</span>
						</button>
					</>
				}
			/>

			<motion.div
				className="flex flex-col gap-5 px-8 pb-12 pt-7"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				{/* KPI Row */}
				<motion.section variants={itemVariants}>
					<StatGrid>
						<StatCard
							label="Total Kekayaan Bersih"
							value={dashboardStats.netWorth}
							format="rupiah"
							font="serif"
							delta={{ direction: "up", text: `${formatPercent(dashboardStats.deltaNetWorth)} bulan ini` }}
							subtext={`vs ${formatRupiah(dashboardStats.netWorthLast)} bulan lalu`}
							className="border-b border-gray-200 sm:border-r xl:border-b-0"
						/>
						<StatCard
							label="Pemasukan Bulan Ini"
							value={dashboardStats.monthlyIncome}
							format="rupiah"
							font="mono"
							delta={{ direction: "up", text: "Stabil" }}
							subtext="Gaji + bonus + dividen"
							className="border-b border-gray-200 xl:border-b-0 xl:border-r"
						/>
						<StatCard
							label="Pengeluaran Bulan Ini"
							value={dashboardStats.monthlyExpense}
							format="rupiah"
							font="mono"
							delta={{ direction: "down", text: "Turun 5% — Bagus!" }}
							subtext={`vs ${formatRupiah(dashboardStats.expenseLast)} bulan lalu`}
							className="border-b border-gray-200 sm:border-r xl:border-b-0"
						/>
						<StatCard
							label="Rate Tabungan"
							value={dashboardStats.savingsRate}
							format="percent"
							font="serif"
							delta={{ direction: "up", text: "Target 50% tercapai" }}
							progress={dashboardStats.savingsRate}
						/>
					</StatGrid>
				</motion.section>

				{/* Row 2: Chart + AI insight */}
				<motion.section variants={itemVariants} className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
					<CashflowPanel />
					<AiInsightPanel insights={aiInsights} />
				</motion.section>

				{/* Row 3: Donut + Transactions */}
				<motion.section variants={itemVariants} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
					<AllocationPanel />
					<RecentTransactionsPanel transactions={recentTransactions} />
				</motion.section>
			</motion.div>
		</>
	);
}

// =============================================================================
// Header bits
// =============================================================================

function TodayDate() {
	// Tanggal hari ini di id-ID. Client-side only biar SSR/CSR cocok.
	const [label] = useState(() =>
		new Intl.DateTimeFormat("id-ID", {
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
		}).format(new Date()),
	);
	return <span>{label}</span>;
}

function formatPercent(p: number): string {
	return `${p.toFixed(1).replace(".", ",")}%`;
}

// =============================================================================
// Cashflow panel — smooth-curve SVG line chart, 6 bulan
// =============================================================================

type CashflowMode = "both" | "income" | "expense";

function CashflowPanel() {
	const [mode, setMode] = useState<CashflowMode>("both");

	const modes: { id: CashflowMode; label: string }[] = [
		{ id: "both", label: "Keduanya" },
		{ id: "income", label: "Pemasukan" },
		{ id: "expense", label: "Pengeluaran" },
	];

	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 text-[15px] font-medium tracking-tight2 text-gray-950">
						Tren Keuangan 6 Bulan
					</h2>
					<div className="text-xs text-gray-400">
						{cashflowSeries[0].month} 2025 — {cashflowSeries[cashflowSeries.length - 1].month} 2026 · IDR
					</div>
				</div>
				<div className="relative inline-flex rounded-lg bg-gray-100 p-[3px] text-xs font-medium">
					{modes.map((m) => {
						const active = mode === m.id;
						return (
							<button
								key={m.id}
								type="button"
								onClick={() => setMode(m.id)}
								className={cn(
									"relative z-[1] rounded-md px-3 py-1.5 leading-none transition-colors duration-200 ease-designhub",
									active ? "bg-white text-gray-950 shadow-sm" : "text-gray-500 hover:text-gray-950",
								)}
							>
								{m.label}
							</button>
						);
					})}
				</div>
			</div>
			<div className="px-5 py-5">
				<CashflowChart mode={mode} />
				<div className="mt-3 flex items-center gap-5 text-xs text-gray-600">
					<span className="inline-flex items-center gap-2">
						<span aria-hidden className="inline-block h-px w-4 bg-gray-950" />
						<span>Pemasukan</span>
					</span>
					<span className="inline-flex items-center gap-2">
						<span aria-hidden className="inline-block h-0 w-4 border-t-2 border-dashed border-gray-700" />
						<span>Pengeluaran</span>
					</span>
				</div>
			</div>
		</div>
	);
}

function CashflowChart({ mode }: { mode: CashflowMode }) {
	// Geometry — viewBox 720x280 (mengikuti design hub).
	const X0 = 60;
	const X1 = 700;
	const Y0 = 30;
	const Y1 = 235;
	const yMax = 10_000_000;

	const xs = useMemo(
		() => cashflowSeries.map((_, i) => X0 + (X1 - X0) * (i / (cashflowSeries.length - 1))),
		[],
	);
	const ys = (v: number) => Y1 - (Y1 - Y0) * (v / yMax);

	const incomePts = cashflowSeries.map((d, i) => [xs[i], ys(d.income)] as const);
	const expensePts = cashflowSeries.map((d, i) => [xs[i], ys(d.expense)] as const);

	const incomePath = smoothPath(incomePts);
	const expensePath = smoothPath(expensePts);
	const incomeArea = `${incomePath} L ${xs[xs.length - 1]},${Y1} L ${xs[0]},${Y1} Z`;
	const expenseArea = `${expensePath} L ${xs[xs.length - 1]},${Y1} L ${xs[0]},${Y1} Z`;

	const showIncome = mode === "income" || mode === "both";
	const showExpense = mode === "expense" || mode === "both";

	return (
		<svg viewBox="0 0 720 280" preserveAspectRatio="none" className="block h-[280px] w-full">
			<defs>
				<linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor="#0a0a0a" stopOpacity="0.10" />
					<stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
				</linearGradient>
				<linearGradient id="expenseFill" x1="0" x2="0" y1="0" y2="1">
					<stop offset="0%" stopColor="#737373" stopOpacity="0.08" />
					<stop offset="100%" stopColor="#737373" stopOpacity="0" />
				</linearGradient>
			</defs>
			{/* gridlines */}
			<g stroke="#f4f4f4" strokeWidth="1">
				<line x1="40" y1="40" x2="720" y2="40" />
				<line x1="40" y1="100" x2="720" y2="100" />
				<line x1="40" y1="160" x2="720" y2="160" />
				<line x1="40" y1="220" x2="720" y2="220" />
			</g>
			{/* y labels */}
			<g fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#a3a3a3">
				<text x="36" y="44" textAnchor="end">10jt</text>
				<text x="36" y="104" textAnchor="end">7,5jt</text>
				<text x="36" y="164" textAnchor="end">5jt</text>
				<text x="36" y="224" textAnchor="end">2,5jt</text>
			</g>
			{/* areas */}
			<motion.path
				d={incomeArea}
				fill="url(#incomeFill)"
				initial={{ opacity: 0 }}
				animate={{ opacity: showIncome ? 1 : 0 }}
				transition={{ duration: 0.8, ease: easeDesignhub, delay: 0.4 }}
			/>
			<motion.path
				d={expenseArea}
				fill="url(#expenseFill)"
				initial={{ opacity: 0 }}
				animate={{ opacity: showExpense ? 1 : 0 }}
				transition={{ duration: 0.8, ease: easeDesignhub, delay: 0.5 }}
			/>
			{/* lines */}
			<motion.path
				d={incomePath}
				fill="none"
				stroke="#0a0a0a"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				pathLength={1}
				initial={{ pathLength: 0, opacity: 0.15 }}
				animate={{ pathLength: 1, opacity: showIncome ? 1 : 0.15 }}
				transition={{ duration: 1.1, ease: easeDesignhub }}
			/>
			<motion.path
				d={expensePath}
				fill="none"
				stroke="#404040"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeDasharray="6 5"
				initial={{ opacity: 0 }}
				animate={{ opacity: showExpense ? 1 : 0.15 }}
				transition={{ duration: 0.8, ease: easeDesignhub, delay: 0.2 }}
			/>
			{/* x labels */}
			<g fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#a3a3a3">
				{cashflowSeries.map((d, i) => (
					<text key={d.month} x={xs[i]} y={260} textAnchor="middle">
						{d.month}
					</text>
				))}
			</g>
		</svg>
	);
}

// Catmull-Rom-style smooth path. Translated dari design hub Dashboard.html script.
function smoothPath(points: ReadonlyArray<readonly [number, number]>): string {
	if (points.length < 2) return "";
	let d = `M ${points[0][0]},${points[0][1]}`;
	for (let i = 0; i < points.length - 1; i++) {
		const [x0, y0] = points[Math.max(0, i - 1)];
		const [x1, y1] = points[i];
		const [x2, y2] = points[i + 1];
		const [x3, y3] = points[Math.min(points.length - 1, i + 2)];
		const cp1x = x1 + (x2 - x0) / 6;
		const cp1y = y1 + (y2 - y0) / 6;
		const cp2x = x2 - (x3 - x1) / 6;
		const cp2y = y2 - (y3 - y1) / 6;
		d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
	}
	return d;
}

// =============================================================================
// AI Insight panel
// =============================================================================

function AiInsightPanel({ insights }: { insights: AiInsight[] }) {
	return (
		<div className="flex flex-col border border-gray-200 bg-white">
			<div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 inline-flex items-center gap-2 text-[15px] font-medium tracking-tight2 text-gray-950">
						<SparkleSvg />
						AI Insight
					</h2>
					<div className="text-xs text-gray-400">Berdasarkan data 30 hari terakhir</div>
				</div>
				<span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 px-2 py-1 font-mono text-[10px] uppercase tracking-label text-gray-400">
					<span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gray-950" style={{ boxShadow: "0 0 0 3px rgba(10,10,10,0.08)" }} />
					Diperbarui tadi malam
				</span>
			</div>
			<div className="flex flex-col">
				{insights.map((insight, i) => (
					<div
						key={i}
						className="flex gap-3 border-b border-gray-100 px-5 py-3.5 transition-colors duration-200 ease-designhub last:border-b-0 hover:bg-gray-50"
					>
						<div className="grid h-6 w-6 flex-none place-items-center font-serif text-base leading-none text-gray-700">
							{insight.icon === "up" ? "↑" : insight.icon === "down" ? "↓" : insight.icon === "info" ? <em className="not-italic font-normal italic">i</em> : "✓"}
						</div>
						<div className="text-[13px] leading-[1.6] text-gray-700">
							<InsightBody body={insight.body} />
						</div>
					</div>
				))}
			</div>
			<button
				type="button"
				className="flex h-12 w-full items-center justify-center gap-2 border-t border-gray-200 text-[13px] font-medium text-gray-950 transition-colors duration-200 ease-designhub hover:bg-gray-50"
			>
				Tanya AI
				<ArrowRightSvg />
			</button>
		</div>
	);
}

function InsightBody({ body }: { body: string }) {
	// Replace *word* dengan <strong>word</strong> tanpa pakai dangerouslySetInnerHTML.
	const parts = body.split(/(\*[^*]+\*)/g);
	return (
		<>
			{parts.map((p, i) => {
				if (p.startsWith("*") && p.endsWith("*")) {
					return (
						<strong key={i} className="font-medium text-gray-950">
							{p.slice(1, -1)}
						</strong>
					);
				}
				return <span key={i}>{p}</span>;
			})}
		</>
	);
}

// =============================================================================
// Allocation donut panel
// =============================================================================

function AllocationPanel() {
	const [hoverIdx, setHoverIdx] = useState<number | null>(null);
	const r = 72;
	const C = 2 * Math.PI * r;

	const dashData = useMemo(() => {
		let acc = 0;
		return allocationSegments.map((seg) => {
			const len = (seg.percent / 100) * C;
			const offset = -acc;
			acc += len;
			return { len, offset };
		});
	}, [C]);

	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 text-[15px] font-medium tracking-tight2 text-gray-950">Alokasi Aset</h2>
					<div className="text-xs text-gray-400">Total Rp 247,5 juta · 5 kategori</div>
				</div>
				<a
					href="/assets"
					className="inline-flex items-center gap-1 text-xs text-gray-500 transition-[color,gap] duration-200 ease-designhub hover:gap-2 hover:text-gray-950"
				>
					Lihat Semua →
				</a>
			</div>
			<div className="flex items-center gap-6 px-5 py-6">
				<div className="relative h-[200px] w-[200px] flex-none">
					<svg viewBox="0 0 200 200" className="h-[200px] w-[200px] -rotate-90">
						<circle cx="100" cy="100" r={r} fill="none" stroke="#f4f4f4" strokeWidth="18" />
						{allocationSegments.map((seg, i) => (
							<motion.circle
								key={seg.name}
								cx="100"
								cy="100"
								r={r}
								fill="none"
								stroke={seg.tone}
								strokeWidth="18"
								strokeDasharray={`${dashData[i].len} ${C - dashData[i].len}`}
								strokeDashoffset={dashData[i].offset}
								initial={{ opacity: 1, strokeDasharray: `0 ${C}` }}
								animate={{
									strokeDasharray: `${dashData[i].len} ${C - dashData[i].len}`,
									opacity: hoverIdx === null ? 1 : hoverIdx === i ? 1 : 0.35,
								}}
								transition={{
									strokeDasharray: { duration: 0.9, ease: easeDesignhub, delay: 0.4 + i * 0.12 },
									opacity: { duration: 0.2, ease: easeDesignhub },
								}}
							/>
						))}
					</svg>
					<div className="absolute inset-0 grid place-items-center text-center">
						<div>
							<div className="text-[10px] font-medium uppercase tracking-labelWide text-gray-400">
								Total Aset
							</div>
							<div className="mt-1.5 font-serif text-[26px] leading-none tracking-tight2 text-gray-950">
								Rp 247,5 jt
							</div>
							<div className="mt-1 font-mono text-[11px] text-gray-400">+ Rp 27,3 jt</div>
						</div>
					</div>
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					{allocationSegments.map((seg, i) => (
						<div
							key={seg.name}
							onMouseEnter={() => setHoverIdx(i)}
							onMouseLeave={() => setHoverIdx(null)}
							className="grid grid-cols-[14px_1fr_auto] items-center gap-2.5 border-b border-gray-100 py-2.5 text-[13px] transition-colors duration-200 ease-designhub last:border-b-0 hover:bg-gray-50"
						>
							<span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: seg.tone }} />
							<span className="font-medium text-gray-900">
								{seg.name}{" "}
								<span className="ml-1 font-mono text-xs font-normal text-gray-400">{seg.percent}%</span>
							</span>
							<span className="text-[13px] text-gray-700 tabular-nums">
								{formatRupiahShort(seg.value)}
							</span>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function formatRupiahShort(n: number): string {
	const jt = n / 1_000_000;
	return `Rp ${jt.toFixed(1).replace(".", ",")} jt`;
}

// =============================================================================
// Recent Transactions panel
// =============================================================================

function RecentTransactionsPanel({ transactions }: { transactions: DummyTransaction[] }) {
	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 text-[15px] font-medium tracking-tight2 text-gray-950">
						Transaksi Terbaru
					</h2>
					<div className="text-xs text-gray-400">5 transaksi terakhir · 27 Apr 2026</div>
				</div>
				<a
					href="/transactions"
					className="inline-flex items-center gap-1 text-xs text-gray-500 transition-[color,gap] duration-200 ease-designhub hover:gap-2 hover:text-gray-950"
				>
					Lihat Semua →
				</a>
			</div>
			<div className="py-1.5">
				{transactions.map((tx, i) => (
					<div
						key={tx.id}
						className={cn(
							"grid grid-cols-[36px_1fr_auto] items-center gap-3.5 px-5 py-3 transition-colors duration-200 ease-designhub hover:bg-gray-50",
							i > 0 && "border-t border-gray-100",
						)}
					>
						<div className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-gray-100 text-gray-700">
							<TxIcon kind={tx.icon ?? "shopping"} />
						</div>
						<div className="min-w-0">
							<div className="truncate text-[13px] font-medium leading-tight text-gray-950">
								{tx.merchant}
							</div>
							<div className="mt-0.5 text-[11px] text-gray-400">
								{tx.category} · {tx.time ?? formatShortDate(tx.date)} · {tx.account}
							</div>
						</div>
						<div
							className={cn(
								"whitespace-nowrap text-right font-mono text-[13px] tabular-nums",
								tx.amount > 0 ? "font-medium text-gray-950" : "text-gray-600",
							)}
						>
							{tx.amount > 0 ? "+ " : "− "}
							{formatRupiah(Math.abs(tx.amount))}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

function formatShortDate(iso: string): string {
	return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(iso));
}

// =============================================================================
// Inline icons (mengikuti SVG paths design hub)
// =============================================================================

function SearchSvg() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<circle cx="11" cy="11" r="7" />
			<path d="M21 21l-4.3-4.3" />
		</svg>
	);
}
function BellSvg() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
			<path d="M10 21a2 2 0 0 0 4 0" />
		</svg>
	);
}
function UploadSvg() {
	return (
		<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 4v12" />
			<path d="M7 9l5-5 5 5" />
			<path d="M5 20h14" />
		</svg>
	);
}
function SparkleSvg() {
	return (
		<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
			<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
			<path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15z" />
		</svg>
	);
}
function ArrowRightSvg() {
	return (
		<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
			<path d="M5 12h14" />
			<path d="M13 6l6 6-6 6" />
		</svg>
	);
}

function TxIcon({ kind }: { kind: NonNullable<DummyTransaction["icon"]> }) {
	const common = { viewBox: "0 0 24 24", width: 16, height: 16, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
	switch (kind) {
		case "food":
			return (
				<svg {...common}>
					<path d="M6 8h11a3 3 0 0 1 0 6h-1" />
					<path d="M6 8v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V8" />
					<path d="M9 4v2M12 4v2M15 4v2" />
				</svg>
			);
		case "income":
			return (
				<svg {...common}>
					<path d="M12 2v20" />
					<path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
				</svg>
			);
		case "transport":
			return (
				<svg {...common}>
					<circle cx="7" cy="17" r="2" />
					<circle cx="17" cy="17" r="2" />
					<path d="M5 17H3v-6l3-5h9l4 5h2v6h-2" />
					<path d="M9 17h6" />
				</svg>
			);
		case "entertainment":
			return (
				<svg {...common}>
					<rect x="3" y="5" width="18" height="14" rx="2" />
					<path d="M10 9l5 3-5 3z" />
				</svg>
			);
		case "investment":
			return (
				<svg {...common}>
					<path d="M3 17l6-6 4 4 7-7" />
					<path d="M14 8h6v6" />
				</svg>
			);
		case "bill":
			return (
				<svg {...common}>
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
					<path d="M14 2v6h6" />
				</svg>
			);
		case "shopping":
		default:
			return (
				<svg {...common}>
					<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
					<line x1="3" y1="6" x2="21" y2="6" />
					<path d="M16 10a4 4 0 0 1-8 0" />
				</svg>
			);
	}
}
