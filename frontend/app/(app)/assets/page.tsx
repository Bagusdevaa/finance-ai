"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import {
	dummyNetWorth,
	dummyStockHoldings,
	dummyMutualFunds,
	dummyManualAssets,
	type DummyStockHolding,
	type DummyMutualFund,
	type DummyManualAsset,
} from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeExpo = [0.16, 1, 0.3, 1] as const;

const containerVariants = {
	hidden: {},
	show: {
		transition: { staggerChildren: 0.05 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, y: 16 },
	show: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.3, ease: easeExpo },
	},
};

type StockViewMode = "aggregate" | "per-account";

export default function AssetsPage() {
	const [stockView, setStockView] = useState<StockViewMode>("aggregate");

	return (
		<>
			<Header
				title="Aset & Portofolio"
				subtitle="Net worth, saham, reksadana, dan aset manual"
				actions={
					<Button variant="secondary" size="sm">
						Refresh harga
					</Button>
				}
			/>

			<motion.div
				className="flex flex-col gap-10 px-8 py-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				<motion.section variants={itemVariants}>
					<NetWorthHero />
				</motion.section>

				<motion.section variants={itemVariants} className="flex flex-col gap-4">
					<SectionHeader
						label="Saham"
						title="Portofolio saham"
						action={
							<StockViewToggle value={stockView} onChange={setStockView} />
						}
					/>
					{stockView === "aggregate" ? (
						<StockAggregateTable />
					) : (
						<StockPerAccountTable />
					)}
				</motion.section>

				<motion.section variants={itemVariants} className="flex flex-col gap-4">
					<SectionHeader label="Reksadana" title="Mutual funds" />
					<MutualFundsTable />
				</motion.section>

				<motion.section variants={itemVariants} className="flex flex-col gap-4">
					<SectionHeader
						label="Manual Assets"
						title="Aset fisik & lainnya"
						action={
							<Button variant="secondary" size="sm">
								<Plus className="h-4 w-4" strokeWidth={1.5} />
								Tambah Aset
							</Button>
						}
					/>
					<ManualAssetsList />
				</motion.section>
			</motion.div>
		</>
	);
}

// =============================================================================
// Hero
// =============================================================================

function NetWorthHero() {
	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
			<StatCard
				label="Total Net Worth"
				value={dummyNetWorth.total}
				format="rupiah"
				delta={{ percent: 4.2, direction: "up" }}
				subtext="vs bulan lalu"
			/>
			<Card className="flex flex-col gap-5">
				<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
					Breakdown
				</span>
				<div className="grid grid-cols-[auto_1fr] items-center gap-6">
					<DonutPlaceholder breakdown={dummyNetWorth} />
					<div className="grid grid-cols-2 gap-3">
						<MiniStat label="Bank" value={dummyNetWorth.bank} />
						<MiniStat label="Investment" value={dummyNetWorth.investment} />
						<MiniStat label="Crypto" value={dummyNetWorth.crypto} />
						<MiniStat label="Manual" value={dummyNetWorth.manual} />
					</div>
				</div>
			</Card>
		</div>
	);
}

function MiniStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-[10px] font-medium uppercase tracking-label text-gray-500">
				{label}
			</span>
			<span className="font-mono text-sm text-black">{formatRupiah(value)}</span>
		</div>
	);
}

function DonutPlaceholder({
	breakdown,
}: {
	breakdown: { bank: number; investment: number; crypto: number; manual: number };
}) {
	// SVG donut sederhana — segments dalam grayscale, no warna.
	const total = breakdown.bank + breakdown.investment + breakdown.crypto + breakdown.manual;
	const segments = [
		{ value: breakdown.manual, fill: "#000000" },
		{ value: breakdown.investment, fill: "#525252" },
		{ value: breakdown.bank, fill: "#A3A3A3" },
		{ value: breakdown.crypto, fill: "#D4D4D4" },
	];

	const radius = 42;
	const circumference = 2 * Math.PI * radius;
	let offset = 0;

	return (
		<svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
			<circle cx="60" cy="60" r={radius} fill="none" stroke="#F5F5F5" strokeWidth="14" />
			{segments.map((seg, i) => {
				const fraction = total === 0 ? 0 : seg.value / total;
				const dash = fraction * circumference;
				const gap = circumference - dash;
				const segmentEl = (
					<circle
						key={i}
						cx="60"
						cy="60"
						r={radius}
						fill="none"
						stroke={seg.fill}
						strokeWidth="14"
						strokeDasharray={`${dash} ${gap}`}
						strokeDashoffset={-offset}
						transform="rotate(-90 60 60)"
					/>
				);
				offset += dash;
				return segmentEl;
			})}
		</svg>
	);
}

// =============================================================================
// Stocks — aggregate view
// =============================================================================

function StockAggregateTable() {
	const columns: DataTableColumn<DummyStockHolding>[] = [
		{
			key: "ticker",
			header: "Ticker",
			width: "100px",
			render: (row) => (
				<div className="flex items-center gap-2">
					<span className="font-mono text-sm font-medium text-black">{row.ticker}</span>
					{row.accounts.length > 1 && <Badge size="sm">multi</Badge>}
				</div>
			),
		},
		{
			key: "name",
			header: "Nama",
			render: (row) => <span className="text-sm text-gray-700">{row.name}</span>,
		},
		{
			key: "totalLot",
			header: "Lot",
			align: "right",
			width: "80px",
			render: (row) => (
				<span className="font-mono text-sm text-black">{row.totalLot}</span>
			),
		},
		{
			key: "weightedAvgPrice",
			header: "Avg Price",
			align: "right",
			width: "120px",
			render: (row) => (
				<span className="font-mono text-sm text-gray-700">
					{row.weightedAvgPrice.toLocaleString("id-ID")}
				</span>
			),
		},
		{
			key: "currentPrice",
			header: "Harga Kini",
			align: "right",
			width: "120px",
			render: (row) =>
				row.currentPrice === null ? (
					<span className="text-xs text-gray-400">—</span>
				) : (
					<span className="font-mono text-sm text-black">
						{row.currentPrice.toLocaleString("id-ID")}
					</span>
				),
		},
		{
			key: "value",
			header: "Nilai",
			align: "right",
			width: "160px",
			render: (row) => (
				<span className="font-mono text-sm font-medium text-black">
					{formatRupiah(row.value)}
				</span>
			),
		},
		{
			key: "pnl",
			header: "P&L",
			align: "right",
			width: "180px",
			render: (row) => <PnLCell pnl={row.pnl} pnlPercent={row.pnlPercent} />,
		},
	];

	return (
		<DataTable<DummyStockHolding>
			columns={columns}
			data={dummyStockHoldings}
			getRowKey={(row) => row.ticker}
		/>
	);
}

interface StockPerAccountRow {
	id: string;
	ticker: string;
	name: string;
	platform: string;
	lot: number;
	avgPrice: number;
}

function StockPerAccountTable() {
	const rows: StockPerAccountRow[] = dummyStockHoldings.flatMap((h) =>
		h.accounts.map((a) => ({
			id: `${h.ticker}-${a.platform}`,
			ticker: h.ticker,
			name: h.name,
			platform: a.platform,
			lot: a.lot,
			avgPrice: a.avgPrice,
		})),
	);

	const columns: DataTableColumn<StockPerAccountRow>[] = [
		{
			key: "ticker",
			header: "Ticker",
			width: "100px",
			render: (row) => (
				<span className="font-mono text-sm font-medium text-black">{row.ticker}</span>
			),
		},
		{
			key: "name",
			header: "Nama",
			render: (row) => <span className="text-sm text-gray-700">{row.name}</span>,
		},
		{
			key: "platform",
			header: "Akun",
			width: "120px",
			render: (row) => <Badge variant="outline">{row.platform}</Badge>,
		},
		{
			key: "lot",
			header: "Lot",
			align: "right",
			width: "80px",
			render: (row) => <span className="font-mono text-sm text-black">{row.lot}</span>,
		},
		{
			key: "avgPrice",
			header: "Avg Price",
			align: "right",
			width: "120px",
			render: (row) => (
				<span className="font-mono text-sm text-gray-700">
					{row.avgPrice.toLocaleString("id-ID")}
				</span>
			),
		},
		{
			key: "value",
			header: "Nilai",
			align: "right",
			width: "160px",
			render: (row) => (
				<span className="font-mono text-sm font-medium text-black">
					{formatRupiah(row.lot * row.avgPrice * 100)}
				</span>
			),
		},
	];

	return (
		<DataTable<StockPerAccountRow>
			columns={columns}
			data={rows}
			getRowKey={(row) => row.id}
		/>
	);
}

function StockViewToggle({
	value,
	onChange,
}: {
	value: StockViewMode;
	onChange: (next: StockViewMode) => void;
}) {
	return (
		<div
			role="tablist"
			aria-label="Stock view mode"
			className="inline-flex items-center rounded border border-gray-300 bg-white p-0.5"
		>
			<ToggleButton
				active={value === "aggregate"}
				onClick={() => onChange("aggregate")}
				label="Aggregate"
			/>
			<ToggleButton
				active={value === "per-account"}
				onClick={() => onChange("per-account")}
				label="Per Akun"
			/>
		</div>
	);
}

function ToggleButton({
	active,
	onClick,
	label,
}: {
	active: boolean;
	onClick: () => void;
	label: string;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={cn(
				"h-7 rounded-[2px] px-3 text-xs transition-colors duration-150 ease-out",
				active ? "bg-black text-white" : "text-gray-600 hover:text-black",
			)}
		>
			{label}
		</button>
	);
}

function PnLCell({ pnl, pnlPercent }: { pnl: number; pnlPercent: number }) {
	const isPositive = pnl > 0;
	const isNegative = pnl < 0;
	const arrow = isPositive ? "↑" : isNegative ? "↓" : "→";

	return (
		<div className="flex flex-col items-end gap-0.5">
			<span
				className={cn(
					"font-mono text-sm font-medium",
					isPositive && "text-emerald-700",
					isNegative && "text-red-700",
					!isPositive && !isNegative && "text-black",
				)}
			>
				{isPositive ? "+" : ""}
				{formatRupiah(pnl)}
			</span>
			<span
				className={cn(
					"font-mono text-[11px]",
					isPositive ? "text-emerald-700" : isNegative ? "text-red-700" : "text-gray-500",
				)}
			>
				{arrow} {Math.abs(pnlPercent).toFixed(2)}%
			</span>
		</div>
	);
}

// =============================================================================
// Mutual funds
// =============================================================================

function MutualFundsTable() {
	const columns: DataTableColumn<DummyMutualFund>[] = [
		{
			key: "name",
			header: "Reksadana",
			render: (row) => (
				<div className="flex flex-col gap-0.5">
					<span className="text-sm font-medium text-black">{row.name}</span>
					<span className="text-xs text-gray-500">
						{row.platform} · {row.type}
					</span>
				</div>
			),
		},
		{
			key: "units",
			header: "Unit",
			align: "right",
			width: "140px",
			render: (row) => (
				<span className="font-mono text-sm text-gray-700">
					{row.units.toLocaleString("id-ID", { maximumFractionDigits: 2 })}
				</span>
			),
		},
		{
			key: "nav",
			header: "NAV",
			align: "right",
			width: "120px",
			render: (row) => (
				<span className="font-mono text-sm text-gray-700">
					{row.nav.toLocaleString("id-ID")}
				</span>
			),
		},
		{
			key: "value",
			header: "Nilai",
			align: "right",
			width: "180px",
			render: (row) => (
				<span className="font-mono text-sm font-medium text-black">
					{formatRupiah(row.value)}
				</span>
			),
		},
		{
			key: "pnl",
			header: "P&L",
			align: "right",
			width: "180px",
			render: (row) => <PnLCell pnl={row.pnl} pnlPercent={row.pnlPercent} />,
		},
	];

	return (
		<DataTable<DummyMutualFund>
			columns={columns}
			data={dummyMutualFunds}
			getRowKey={(row) => row.id}
		/>
	);
}

// =============================================================================
// Manual assets
// =============================================================================

function ManualAssetsList() {
	return (
		<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
			{dummyManualAssets.map((asset) => (
				<ManualAssetCard key={asset.id} asset={asset} />
			))}
		</div>
	);
}

function ManualAssetCard({ asset }: { asset: DummyManualAsset }) {
	const updated = new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(asset.lastUpdated));

	return (
		<Card className="flex flex-col gap-4" hoverable>
			<div className="flex items-start justify-between gap-2">
				<div className="flex flex-col gap-1">
					<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
						{asset.category}
					</span>
					<span className="text-base font-medium text-black">{asset.name}</span>
				</div>
				<button
					type="button"
					aria-label="Edit asset"
					className="flex h-8 w-8 items-center justify-center rounded text-gray-400 transition-colors duration-150 ease-out hover:bg-gray-50 hover:text-black"
				>
					<Pencil className="h-4 w-4" strokeWidth={1.5} />
				</button>
			</div>
			<div className="font-mono text-2xl font-light text-black">{formatRupiah(asset.value)}</div>
			{asset.notes && <p className="text-xs text-gray-600">{asset.notes}</p>}
			<div className="border-t border-gray-100 pt-3 text-[11px] text-gray-400">
				Update terakhir {updated}
			</div>
		</Card>
	);
}

// =============================================================================
// Section header
// =============================================================================

function SectionHeader({
	label,
	title,
	action,
}: {
	label: string;
	title: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="flex items-end justify-between gap-4">
			<div className="flex flex-col gap-1">
				<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
					{label}
				</span>
				<h2 className="font-serif text-2xl leading-none text-black">{title}</h2>
			</div>
			{action}
		</div>
	);
}
