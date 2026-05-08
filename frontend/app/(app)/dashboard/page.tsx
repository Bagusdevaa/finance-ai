"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header, IconButton } from "@/components/layout/Header";
import { StatCard, StatGrid } from "@/components/ui/StatCard";
import { listTransactions } from "@/lib/api/transactions";
import { listAccounts } from "@/lib/api/accounts";
import type { TransactionResponse } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth-store";
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

interface CashflowPoint {
	month: string;
	monthIso: string;
	income: number;
	expense: number;
}

interface AllocationSegment {
	name: string;
	value: number;
	percent: number;
	tone: string;
}

const ALLOC_TONES = ["#0a0a0a", "#404040", "#737373", "#a3a3a3", "#d4d4d4", "#e8e8e8"];

const ID_MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function toNumber(s: string | null | undefined): number {
	if (!s) return 0;
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
}

function getGreetingPrefix(): string {
	const h = new Date().getHours();
	if (h < 11) return "Selamat pagi";
	if (h < 15) return "Selamat siang";
	if (h < 19) return "Selamat sore";
	return "Selamat malam";
}

export default function DashboardPage() {
	const [showSearch, setShowSearch] = useState(false);
	const [showNotif, setShowNotif] = useState(false);
	const notifRef = useRef<HTMLDivElement>(null);
	const user = useAuthStore((s) => s.user);

	const { data: txData } = useQuery({
		queryKey: ["transactions", { limit: 200 }],
		queryFn: () => listTransactions({ limit: 200 }),
	});
	const { data: accountsData } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});

	const transactions = useMemo(() => txData?.items ?? [], [txData]);
	const firstName = user?.name?.split(" ")[0] ?? "";

	useEffect(() => {
		if (!showNotif) return;
		const handler = (e: MouseEvent) => {
			if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
				setShowNotif(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [showNotif]);

	const stats = useMemo(() => computeStats(transactions), [transactions]);
	const cashflow = useMemo(() => computeCashflow(transactions), [transactions]);
	const allocation = useMemo(() => computeAllocation(transactions), [transactions]);
	const recent = useMemo(() => transactions.slice(0, 5), [transactions]);

	return (
		<>
			<Header
				greeting={
					<h1 className="m-0 whitespace-nowrap font-serif text-[18px] font-normal leading-[1.1] tracking-tight2 text-gray-950 sm:text-[24px]">
						{getGreetingPrefix()}
						{firstName ? (
							<>
								, <em className="font-normal italic text-gray-700">{firstName}.</em>
							</>
						) : (
							"."
						)}
					</h1>
				}
				subtitle={<span className="hidden sm:inline"><TodayDate /></span>}
				actions={
					<>
						<IconButton ariaLabel="Cari" onClick={() => setShowSearch(true)}>
							<SearchSvg />
						</IconButton>
						<div className="relative" ref={notifRef}>
							<IconButton ariaLabel="Notifikasi" dot onClick={() => setShowNotif((v) => !v)}>
								<BellSvg />
							</IconButton>
							<AnimatePresence>
								{showNotif && <NotificationDropdown onClose={() => setShowNotif(false)} />}
							</AnimatePresence>
						</div>
						<Link
							href="/import"
							className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 text-[13px] font-medium text-gray-950 transition-[background-color,border-color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 min-[375px]:h-[38px] min-[375px]:px-4"
						>
							<UploadSvg />
							<span className="hidden sm:inline">Import Data</span>
						</Link>
					</>
				}
			/>

			<SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />

			<motion.div
				className="flex flex-col gap-5 px-4 pb-12 pt-7 md:px-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				<motion.section variants={itemVariants}>
					<StatGrid>
						<StatCard
							label="Total Kekayaan Bersih"
							value={stats.netWorth}
							format="rupiah"
							font="serif"
							delta={{ direction: stats.netWorth >= 0 ? "up" : "down", text: `${accountsData?.length ?? 0} akun aktif` }}
							subtext="Akumulasi semua transaksi"
							className="border-b border-gray-200 sm:border-r xl:border-b-0"
						/>
						<StatCard
							label="Pemasukan Bulan Ini"
							value={stats.monthlyIncome}
							format="rupiah"
							font="mono"
							delta={{ direction: "up", text: stats.monthlyIncome > 0 ? "Tercatat" : "Belum ada" }}
							subtext="Total pemasukan bulan berjalan"
							className="border-b border-gray-200 xl:border-b-0 xl:border-r"
						/>
						<StatCard
							label="Pengeluaran Bulan Ini"
							value={stats.monthlyExpense}
							format="rupiah"
							font="mono"
							delta={{ direction: stats.expenseDeltaPct < 0 ? "down" : "up", text: stats.expenseDeltaText }}
							subtext={stats.expenseLast > 0 ? `vs ${formatRupiah(stats.expenseLast)} bulan lalu` : "Tidak ada data bulan lalu"}
							className="border-b border-gray-200 sm:border-r xl:border-b-0"
						/>
						<StatCard
							label="Rate Tabungan"
							value={Math.max(0, Math.round(stats.savingsRate))}
							format="percent"
							font="serif"
							delta={{ direction: stats.savingsRate >= 50 ? "up" : "down", text: stats.savingsRate >= 50 ? "Target 50% tercapai" : "Di bawah target 50%" }}
							progress={Math.max(0, Math.min(100, stats.savingsRate))}
						/>
					</StatGrid>
				</motion.section>

				<motion.section variants={itemVariants} className="grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr]">
					<CashflowPanel series={cashflow} />
					<AiInsightPanel />
				</motion.section>

				<motion.section variants={itemVariants} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
					<AllocationPanel segments={allocation} />
					<RecentTransactionsPanel transactions={recent} />
				</motion.section>
			</motion.div>
		</>
	);
}

// =============================================================================
// Computation helpers
// =============================================================================

function computeStats(transactions: TransactionResponse[]) {
	const now = new Date();
	const curMonth = now.getMonth();
	const curYear = now.getFullYear();
	const lastMonthDate = new Date(curYear, curMonth - 1, 1);
	const lastMonth = lastMonthDate.getMonth();
	const lastYear = lastMonthDate.getFullYear();

	let netWorth = 0;
	let monthlyIncome = 0;
	let monthlyExpense = 0;
	let lastIncome = 0;
	let lastExpense = 0;

	for (const t of transactions) {
		const amt = toNumber(t.amount);
		netWorth += amt;
		const d = new Date(t.transaction_date);
		if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
			if (amt >= 0) monthlyIncome += amt;
			else monthlyExpense += Math.abs(amt);
		} else if (d.getMonth() === lastMonth && d.getFullYear() === lastYear) {
			if (amt >= 0) lastIncome += amt;
			else lastExpense += Math.abs(amt);
		}
	}

	const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100 : 0;
	const expenseDeltaPct = lastExpense > 0 ? ((monthlyExpense - lastExpense) / lastExpense) * 100 : 0;
	const expenseDeltaText = lastExpense > 0
		? `${expenseDeltaPct >= 0 ? "Naik" : "Turun"} ${Math.abs(expenseDeltaPct).toFixed(0)}%`
		: "Belum ada baseline";

	return {
		netWorth,
		monthlyIncome,
		monthlyExpense,
		expenseLast: lastExpense,
		incomeLast: lastIncome,
		savingsRate,
		expenseDeltaPct,
		expenseDeltaText,
	};
}

function computeCashflow(transactions: TransactionResponse[]): CashflowPoint[] {
	const now = new Date();
	const buckets: CashflowPoint[] = [];
	for (let i = 5; i >= 0; i--) {
		const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		buckets.push({
			month: ID_MONTH_SHORT[d.getMonth()],
			monthIso: key,
			income: 0,
			expense: 0,
		});
	}
	const idxMap = new Map(buckets.map((b, i) => [b.monthIso, i]));
	for (const t of transactions) {
		const d = new Date(t.transaction_date);
		const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
		const i = idxMap.get(key);
		if (i === undefined) continue;
		const amt = toNumber(t.amount);
		if (amt >= 0) buckets[i].income += amt;
		else buckets[i].expense += Math.abs(amt);
	}
	return buckets;
}

function computeAllocation(transactions: TransactionResponse[]): AllocationSegment[] {
	// Group expenses by category for current month.
	const now = new Date();
	const curMonth = now.getMonth();
	const curYear = now.getFullYear();
	const totals = new Map<string, number>();
	for (const t of transactions) {
		const amt = toNumber(t.amount);
		if (amt >= 0) continue;
		const d = new Date(t.transaction_date);
		if (d.getMonth() !== curMonth || d.getFullYear() !== curYear) continue;
		const cat = t.category || "Lainnya";
		totals.set(cat, (totals.get(cat) ?? 0) + Math.abs(amt));
	}
	const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
	const grandTotal = entries.reduce((a, b) => a + b[1], 0);
	if (grandTotal === 0) return [];
	return entries.slice(0, 6).map(([name, value], i) => ({
		name,
		value,
		percent: Math.round((value / grandTotal) * 100),
		tone: ALLOC_TONES[i] ?? "#e8e8e8",
	}));
}

// =============================================================================
// Header bits
// =============================================================================

function TodayDate() {
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

// =============================================================================
// Cashflow panel
// =============================================================================

type CashflowMode = "both" | "income" | "expense";

function CashflowPanel({ series }: { series: CashflowPoint[] }) {
	const [mode, setMode] = useState<CashflowMode>("both");

	const modes: { id: CashflowMode; label: string }[] = [
		{ id: "both", label: "Keduanya" },
		{ id: "income", label: "Pemasukan" },
		{ id: "expense", label: "Pengeluaran" },
	];

	const yMax = useMemo(() => {
		const max = Math.max(...series.flatMap((s) => [s.income, s.expense]), 1);
		// round up to nice step
		const pow = Math.pow(10, Math.floor(Math.log10(max)));
		return Math.ceil(max / pow) * pow;
	}, [series]);

	if (series.length === 0) {
		return (
			<div className="border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
				Belum ada data cashflow.
			</div>
		);
	}

	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 text-[15px] font-medium tracking-tight2 text-gray-950">
						Tren Keuangan 6 Bulan
					</h2>
					<div className="text-xs text-gray-400">
						{series[0].month} — {series[series.length - 1].month} · IDR
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
				<CashflowChart mode={mode} series={series} yMax={yMax} />
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

function CashflowChart({ mode, series, yMax }: { mode: CashflowMode; series: CashflowPoint[]; yMax: number }) {
	const X0 = 60;
	const X1 = 700;
	const Y0 = 30;
	const Y1 = 235;

	const xs = useMemo(
		() => series.map((_, i) => X0 + (X1 - X0) * (i / Math.max(1, series.length - 1))),
		[series],
	);
	const ys = (v: number) => Y1 - (Y1 - Y0) * (v / yMax);

	const incomePts = series.map((d, i) => [xs[i], ys(d.income)] as const);
	const expensePts = series.map((d, i) => [xs[i], ys(d.expense)] as const);

	const incomePath = smoothPath(incomePts);
	const expensePath = smoothPath(expensePts);
	const incomeArea = `${incomePath} L ${xs[xs.length - 1]},${Y1} L ${xs[0]},${Y1} Z`;
	const expenseArea = `${expensePath} L ${xs[xs.length - 1]},${Y1} L ${xs[0]},${Y1} Z`;

	const showIncome = mode === "income" || mode === "both";
	const showExpense = mode === "expense" || mode === "both";

	function shortLabel(n: number): string {
		if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}jt`;
		if (n >= 1_000) return `${(n / 1_000).toFixed(0)}rb`;
		return n.toString();
	}

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
			<g stroke="#f4f4f4" strokeWidth="1">
				<line x1="40" y1="40" x2="720" y2="40" />
				<line x1="40" y1="100" x2="720" y2="100" />
				<line x1="40" y1="160" x2="720" y2="160" />
				<line x1="40" y1="220" x2="720" y2="220" />
			</g>
			<g fontFamily="var(--font-geist-mono), monospace" fontSize="10" fill="#a3a3a3">
				<text x="36" y="44" textAnchor="end">{shortLabel(yMax)}</text>
				<text x="36" y="104" textAnchor="end">{shortLabel(yMax * 0.75)}</text>
				<text x="36" y="164" textAnchor="end">{shortLabel(yMax * 0.5)}</text>
				<text x="36" y="224" textAnchor="end">{shortLabel(yMax * 0.25)}</text>
			</g>
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
			<g fontFamily="var(--font-geist-mono), monospace" fontSize="11" fill="#a3a3a3">
				{series.map((d, i) => (
					<text key={d.monthIso} x={xs[i]} y={260} textAnchor="middle">
						{d.month}
					</text>
				))}
			</g>
		</svg>
	);
}

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
// AI Insight panel — placeholder until insights endpoint is wired
// TODO: replace with real AI insights endpoint when available
// =============================================================================

function AiInsightPanel() {
	return (
		<div className="flex flex-col border border-gray-200 bg-white">
			<div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 inline-flex items-center gap-2 text-[15px] font-medium tracking-tight2 text-gray-950">
						<SparkleSvg />
						AI Insight
					</h2>
					<div className="text-xs text-gray-400">Akan diperbarui secara berkala</div>
				</div>
			</div>
			<div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-gray-500">
				Insight personal akan muncul di sini setelah cukup data transaksi terkumpul.
			</div>
			<Link
				href="/chat"
				className="flex h-12 w-full items-center justify-center gap-2 border-t border-gray-200 text-[13px] font-medium text-gray-950 transition-colors duration-200 ease-designhub hover:bg-gray-50"
			>
				Tanya AI
				<ArrowRightSvg />
			</Link>
		</div>
	);
}

// =============================================================================
// Allocation donut panel
// =============================================================================

function AllocationPanel({ segments }: { segments: AllocationSegment[] }) {
	const [hoverIdx, setHoverIdx] = useState<number | null>(null);
	const r = 72;
	const C = 2 * Math.PI * r;

	const dashData = useMemo(() => {
		let acc = 0;
		return segments.map((seg) => {
			const len = (seg.percent / 100) * C;
			const offset = -acc;
			acc += len;
			return { len, offset };
		});
	}, [C, segments]);

	const total = segments.reduce((a, s) => a + s.value, 0);

	if (segments.length === 0) {
		return (
			<div className="border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
				Belum ada pengeluaran bulan ini.
			</div>
		);
	}

	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 text-[15px] font-medium tracking-tight2 text-gray-950">Alokasi Pengeluaran</h2>
					<div className="text-xs text-gray-400">{formatRupiah(total)} · {segments.length} kategori</div>
				</div>
				<a
					href="/transactions"
					className="inline-flex items-center gap-1 text-xs text-gray-500 transition-[color,gap] duration-200 ease-designhub hover:gap-2 hover:text-gray-950"
				>
					Lihat Semua →
				</a>
			</div>
			<div className="flex flex-col items-center gap-6 px-5 py-6 sm:flex-row sm:items-center">
				<div className="relative h-[200px] w-[200px] flex-none">
					<svg viewBox="0 0 200 200" className="h-[200px] w-[200px] -rotate-90">
						<circle cx="100" cy="100" r={r} fill="none" stroke="#f4f4f4" strokeWidth="18" />
						{segments.map((seg, i) => (
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
								Total Bulan Ini
							</div>
							<div className="mt-1.5 font-serif text-[22px] leading-none tracking-tight2 text-gray-950">
								{formatRupiahShort(total)}
							</div>
						</div>
					</div>
				</div>
				<div className="flex min-w-0 flex-1 flex-col">
					{segments.map((seg, i) => (
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
	if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace(".", ",")} jt`;
	if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`;
	return `Rp ${n.toLocaleString("id-ID")}`;
}

// =============================================================================
// Recent Transactions panel
// =============================================================================

function RecentTransactionsPanel({ transactions }: { transactions: TransactionResponse[] }) {
	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
				<div className="flex min-w-0 flex-col gap-0.5">
					<h2 className="m-0 text-[15px] font-medium tracking-tight2 text-gray-950">
						Transaksi Terbaru
					</h2>
					<div className="text-xs text-gray-400">{transactions.length} transaksi terakhir</div>
				</div>
				<a
					href="/transactions"
					className="inline-flex items-center gap-1 text-xs text-gray-500 transition-[color,gap] duration-200 ease-designhub hover:gap-2 hover:text-gray-950"
				>
					Lihat Semua →
				</a>
			</div>
			<div className="py-1.5">
				{transactions.length === 0 ? (
					<div className="px-5 py-8 text-center text-sm text-gray-500">
						Belum ada transaksi. <Link href="/import" className="text-gray-950 underline">Import data</Link> untuk mulai.
					</div>
				) : (
					transactions.map((tx, i) => {
						const amt = toNumber(tx.amount);
						return (
							<div
								key={tx.id}
								className={cn(
									"grid grid-cols-[36px_1fr_auto] items-center gap-3.5 px-5 py-3 transition-colors duration-200 ease-designhub hover:bg-gray-50",
									i > 0 && "border-t border-gray-100",
								)}
							>
								<div className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-gray-100 text-gray-700">
									<TxIcon kind={inferIcon(tx)} />
								</div>
								<div className="min-w-0">
									<div className="truncate text-[13px] font-medium leading-tight text-gray-950">
										{tx.merchant_name || tx.description || "Tanpa nama"}
									</div>
									<div className="mt-0.5 text-[11px] text-gray-400">
										{(tx.category || "Lainnya")} · {formatShortDate(tx.transaction_date)} · {tx.account?.name ?? "—"}
									</div>
								</div>
								<div
									className={cn(
										"whitespace-nowrap text-right font-mono text-[13px] tabular-nums",
										amt > 0 ? "font-medium text-gray-950" : "text-gray-600",
									)}
								>
									{amt > 0 ? "+ " : "− "}
									{formatRupiah(Math.abs(amt))}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

type IconKind = "food" | "income" | "transport" | "entertainment" | "investment" | "shopping" | "bill";

function inferIcon(tx: TransactionResponse): IconKind {
	const amt = toNumber(tx.amount);
	if (amt > 0) return "income";
	const cat = (tx.category ?? "").toLowerCase();
	if (cat.includes("makan") || cat.includes("food") || cat.includes("kopi")) return "food";
	if (cat.includes("transport") || cat.includes("grab") || cat.includes("gojek")) return "transport";
	if (cat.includes("hibur") || cat.includes("netflix") || cat.includes("spotify")) return "entertainment";
	if (cat.includes("invest") || cat.includes("saham") || cat.includes("reksa")) return "investment";
	if (cat.includes("tagihan") || cat.includes("listrik") || cat.includes("internet")) return "bill";
	return "shopping";
}

function formatShortDate(iso: string): string {
	return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(iso));
}

// =============================================================================
// Inline icons
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

// =============================================================================
// Search overlay
// =============================================================================

function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const [debounced, setDebounced] = useState("");

	useEffect(() => {
		if (!open) return;
		const handler = (e: globalThis.KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open, onClose]);

	useEffect(() => {
		if (open) {
			setQuery("");
			setDebounced("");
			setTimeout(() => inputRef.current?.focus(), 50);
		}
	}, [open]);

	useEffect(() => {
		const t = setTimeout(() => setDebounced(query.trim()), 300);
		return () => clearTimeout(t);
	}, [query]);

	const { data, isFetching } = useQuery({
		queryKey: ["transactions-search", debounced],
		queryFn: () => listTransactions({ search: debounced, limit: 8 }),
		enabled: open && debounced.length > 0,
	});

	const results = data?.items ?? [];

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[12vh]"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.2, ease: easeDesignhub }}
					onClick={onClose}
				>
					<motion.div
						className="w-full max-w-[560px] border border-gray-200 bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.25)]"
						initial={{ opacity: 0, scale: 0.96, y: -8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: -8 }}
						transition={{ duration: 0.25, ease: easeDesignhub }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center gap-3 border-b border-gray-200 px-5 py-3.5">
							<SearchSvg />
							<input
								ref={inputRef}
								type="text"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Cari transaksi..."
								className="flex-1 bg-transparent text-sm text-gray-950 outline-none placeholder:text-gray-400"
							/>
							<button
								type="button"
								onClick={onClose}
								className="rounded border border-gray-200 px-2 py-0.5 font-mono text-[10px] text-gray-500 transition-colors hover:border-gray-400 hover:text-gray-950"
							>
								ESC
							</button>
						</div>
						{debounced && (
							<div className="max-h-[340px] overflow-y-auto py-2">
								{isFetching ? (
									<div className="px-5 py-8 text-center text-sm text-gray-500">Mencari...</div>
								) : results.length === 0 ? (
									<div className="px-5 py-8 text-center text-sm text-gray-500">
										Tidak ditemukan hasil untuk &ldquo;{debounced}&rdquo;
									</div>
								) : (
									results.map((r) => {
										const amt = toNumber(r.amount);
										return (
											<div
												key={r.id}
												className="flex items-center justify-between gap-3 px-5 py-3 transition-colors duration-150 hover:bg-gray-50"
											>
												<div className="min-w-0">
													<div className="truncate text-[13px] font-medium text-gray-950">
														{r.merchant_name || r.description || "Tanpa nama"}
													</div>
													<div className="mt-0.5 text-[11px] text-gray-400">
														{(r.category || "Lainnya")} · {r.account?.name ?? "—"}
													</div>
												</div>
												<span className={cn(
													"shrink-0 font-mono text-[13px] tabular-nums",
													amt > 0 ? "font-medium text-gray-950" : "text-gray-600",
												)}>
													{amt > 0 ? "+ " : "− "}
													{formatRupiah(Math.abs(amt))}
												</span>
											</div>
										);
									})
								)}
							</div>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

// =============================================================================
// Notification dropdown — TODO: wire to real notifications endpoint when available
// =============================================================================

const NOTIFICATIONS: { id: number; text: string; time: string }[] = [];

function NotificationDropdown({ onClose }: { onClose: () => void }) {
	return (
		<motion.div
			initial={{ opacity: 0, y: -4 }}
			animate={{ opacity: 1, y: 0 }}
			exit={{ opacity: 0, y: -4 }}
			transition={{ duration: 0.2, ease: easeDesignhub }}
			className="fixed right-3 top-[70px] z-20 w-[calc(100vw-24px)] max-w-[340px] border border-gray-200 bg-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.15)] sm:absolute sm:right-0 sm:top-[calc(100%+6px)] sm:w-[320px]"
		>
			<div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
				<span className="text-[13px] font-medium text-gray-950">Notifikasi</span>
				<span className="font-mono text-[10px] text-gray-400">{NOTIFICATIONS.length} baru</span>
			</div>
			<div className="py-1">
				{NOTIFICATIONS.length === 0 ? (
					<div className="px-4 py-6 text-center text-[13px] text-gray-500">Tidak ada notifikasi.</div>
				) : (
					NOTIFICATIONS.map((n) => (
						<button
							key={n.id}
							type="button"
							onClick={onClose}
							className="flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-gray-50"
						>
							<span className="text-[13px] leading-snug text-gray-700">{n.text}</span>
							<span className="font-mono text-[10px] text-gray-400">{n.time}</span>
						</button>
					))
				)}
			</div>
		</motion.div>
	);
}

function TxIcon({ kind }: { kind: IconKind }) {
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
