"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { SectionHeader, SectionMeta } from "@/components/ui/SectionHeader";
import { TabNav, type TabItem } from "@/components/ui/TabNav";
import { MiniBarChart } from "@/components/ui/MiniBarChart";
import { useCountUp } from "@/hooks/useCountUp";
import {
	dummyNetWorth,
	dummyStockHoldings,
	dummyMutualFunds,
	dummyCashAccounts,
	dummyCommodities,
	type DummyStockHolding,
	type DummyCashAccount,
	type DummyCommodity,
	type DummyMutualFund,
} from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

const containerVariants = {
	hidden: {},
	show: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
	hidden: { opacity: 0, y: 12 },
	show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: easeDesignhub } },
};

type CatId = "all" | "saham" | "reksa" | "cash" | "emas" | "prop" | "utang";
type ViewMode = "aggregate" | "account";

const CAT_TABS: TabItem[] = [
	{ id: "all", label: "Semua" },
	{ id: "saham", label: "Saham" },
	{ id: "reksa", label: "Reksa Dana" },
	{ id: "cash", label: "Tabungan & Cash" },
	{ id: "emas", label: "Emas & Kripto" },
	{ id: "prop", label: "Properti" },
	{ id: "utang", label: "Utang" },
];

export default function AssetsPage() {
	const [view, setView] = useState<ViewMode>("aggregate");
	const [cat, setCat] = useState<CatId>("all");

	return (
		<>
			<Header
				title={
					<span className="truncate">
						Aset & <em className="font-normal italic text-gray-700">Portofolio</em>
					</span>
				}
				actions={<ViewToggle value={view} onChange={setView} />}
			/>

			{/* HERO BANNER (full-width, black) */}
			<NetWorthHero />

			{/* CATEGORY TABS */}
			<TabNav tabs={CAT_TABS} activeId={cat} onChange={(id) => setCat(id as CatId)} />

			<motion.div
				className="flex flex-col gap-8 px-4 py-8 md:px-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
				key={view} // re-trigger stagger on view switch
			>
				{view === "aggregate" ? (
					<AggregateView cat={cat} />
				) : (
					<AccountView />
				)}
			</motion.div>
		</>
	);
}

// =============================================================================
// View toggle (Aggregate / Per Akun)
// =============================================================================

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
	return (
		<div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-gray-300 text-[11px] font-medium min-[375px]:text-[13px]">
			{(["aggregate", "account"] as const).map((id, i) => {
				const active = value === id;
				return (
					<button
						key={id}
						type="button"
						onClick={() => onChange(id)}
						className={cn(
							"whitespace-nowrap px-2.5 py-2 transition-[background-color,color] duration-200 ease-designhub min-[375px]:px-3.5",
							i === 0 && "border-r border-gray-300",
							active ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-950",
						)}
					>
						{id === "aggregate" ? "Aggregate" : "Per Akun"}
					</button>
				);
			})}
		</div>
	);
}

// =============================================================================
// Hero banner (black bg, big serif net worth, mini bar chart)
// =============================================================================

function NetWorthHero() {
	const { value, ref } = useCountUp({
		target: dummyNetWorth.total,
		spring: { duration: 1.2, bounce: 0 },
	});

	return (
		<section
			ref={ref as React.RefObject<HTMLElement>}
			className="grid grid-cols-1 items-center gap-10 border-b border-gray-200 bg-black px-4 py-8 text-white md:px-8 md:py-12 lg:grid-cols-[1fr_auto]"
		>
			<div>
				<div className="inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-labelExtra text-gray-500">
					<span aria-hidden className="inline-block h-px w-6 bg-gray-700" />
					Total Kekayaan Bersih
				</div>
				<div className="mb-3.5 mt-4 font-serif text-[clamp(48px,7vw,78px)] font-extralight leading-none tracking-display tabular-nums text-white">
					{formatRupiah(value)}
				</div>
				<div className="mb-4 text-[14px] text-gray-500">
					Dari{" "}
					<strong className="font-medium text-gray-300">
						{dummyNetWorth.accountsActive} akun aktif
					</strong>{" "}
					· Diperbarui {dummyNetWorth.updatedAgo}
				</div>
				<div className="inline-flex items-center gap-2 text-[16px] font-medium text-white">
					<span aria-hidden className="font-serif text-[18px]">↑</span>
					{formatRupiah(dummyNetWorth.deltaValue)} (
					{dummyNetWorth.deltaPercent.toString().replace(".", ",")}%) bulan ini
				</div>
			</div>
			<MiniBarChart bars={dummyNetWorth.chartBars} tone="white" maxHeight={100} />
		</section>
	);
}

// =============================================================================
// Aggregate view: Saham, Reksa Dana, Cash, Emas
// =============================================================================

function AggregateView({ cat }: { cat: CatId }) {
	const showSaham = cat === "all" || cat === "saham";
	const showReksa = cat === "all" || cat === "reksa";
	const showCash = cat === "all" || cat === "cash";
	const showEmas = cat === "all" || cat === "emas";

	return (
		<>
			{showSaham && (
				<motion.section variants={itemVariants}>
					<SahamSection />
				</motion.section>
			)}
			{showReksa && (
				<motion.section variants={itemVariants}>
					<ReksaSection />
				</motion.section>
			)}
			{showCash && (
				<motion.section variants={itemVariants}>
					<CashSection />
				</motion.section>
			)}
			{showEmas && (
				<motion.section variants={itemVariants}>
					<EmasSection />
				</motion.section>
			)}
			{cat === "prop" && <EmptyCategory label="Properti" />}
			{cat === "utang" && <EmptyCategory label="Utang" />}
		</>
	);
}

function EmptyCategory({ label }: { label: string }) {
	return (
		<motion.div
			variants={itemVariants}
			className="flex flex-col items-center gap-2 border border-dashed border-gray-300 bg-white px-6 py-16 text-center"
		>
			<span className="font-serif text-3xl text-gray-300">—</span>
			<span className="text-sm font-medium text-gray-950">Belum ada {label.toLowerCase()}</span>
			<span className="text-xs text-gray-500">Tambah aset {label.toLowerCase()} kamu di sini.</span>
		</motion.div>
	);
}

// =============================================================================
// Saham IDX section
// =============================================================================

function SahamSection() {
	const totalValue = dummyStockHoldings.reduce((a, h) => a + h.value, 0);
	const totalPnL = dummyStockHoldings.reduce((a, h) => a + h.pnl, 0);
	const totalLot = dummyStockHoldings.reduce((a, h) => a + h.totalLot, 0);
	const avgPnLPercent = (totalPnL / Math.max(1, totalValue - totalPnL)) * 100;

	return (
		<section>
			<SectionHeader
				title="Saham"
				emphasis="IDX"
				meta={
					<>
						<SectionMeta label="Total" value={formatRupiah(totalValue)} />
						<SectionMeta
							label="Return"
							value={
								<span className="inline-flex items-center gap-1">
									<span aria-hidden>↑</span>
									{`+${avgPnLPercent.toFixed(1).replace(".", ",")}%`}
								</span>
							}
						/>
						<button
							type="button"
							className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 text-[13px] text-gray-700 transition-[background-color,border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
						>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
								<path d="M21 12a9 9 0 1 1-3.4-7" />
								<path d="M21 4v5h-5" />
							</svg>
							Sinkron data saham
						</button>
					</>
				}
			/>
			<StockTable holdings={dummyStockHoldings} totalLot={totalLot} totalValue={totalValue} totalPnL={totalPnL} avgPnLPercent={avgPnLPercent} />
		</section>
	);
}

function StockTable({
	holdings,
	totalLot,
	totalValue,
	totalPnL,
	avgPnLPercent,
}: {
	holdings: DummyStockHolding[];
	totalLot: number;
	totalValue: number;
	totalPnL: number;
	avgPnLPercent: number;
}) {
	return (
		<div className="overflow-x-auto border border-gray-200 bg-white">
			<table className="w-full border-collapse text-[13px]" style={{ minWidth: "780px" }}>
				<thead className="bg-gray-50">
					<tr className="border-b border-gray-200">
						<Th>Kode</Th>
						<Th>Nama</Th>
						<Th align="right">Lot</Th>
						<Th align="right">Harga Avg</Th>
						<Th align="right">Harga Saat Ini</Th>
						<Th align="right">Nilai</Th>
						<Th align="right">P&L</Th>
						<Th align="right">P&L%</Th>
					</tr>
				</thead>
				<tbody>
					{holdings.map((h, i) => (
						<motion.tr
							key={h.ticker}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.35, ease: easeDesignhub, delay: 0.03 + i * 0.03 }}
							className="cursor-pointer border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50"
						>
							<Td>
								<span className="font-mono text-[13px] font-medium text-gray-950">{h.ticker}</span>
							</Td>
							<Td>
								<span className="text-[13px] text-gray-700">{h.name}</span>
							</Td>
							<Td align="right" mono>
								<div>{h.totalLot} lot</div>
								{h.accounts.length > 1 && (
									<div className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-gray-400">
										Dari {h.accounts.length} akun (
										{h.accounts.map((a) => `${a.platform} ${a.lot}`).join(" + ")})
									</div>
								)}
							</Td>
							<Td align="right" mono>
								{h.weightedAvgPrice.toLocaleString("id-ID")}
							</Td>
							<Td align="right" mono>
								{h.currentPrice?.toLocaleString("id-ID") ?? "—"}
							</Td>
							<Td align="right" mono>
								{h.value.toLocaleString("id-ID")}
							</Td>
							<Td align="right" mono className={pnlClass(h.pnl)}>
								{h.pnl >= 0 ? "+" : "−"}
								{Math.abs(h.pnl).toLocaleString("id-ID")}
							</Td>
							<Td align="right" mono className={pnlClass(h.pnl)}>
								{h.pnlPercent >= 0 ? "+" : "−"}
								{Math.abs(h.pnlPercent).toFixed(1).replace(".", ",")}%
							</Td>
						</motion.tr>
					))}
				</tbody>
				<tfoot>
					<tr className="border-t border-gray-200 bg-gray-50 text-[13px] font-medium text-gray-950">
						<TFoot colSpan={5}>{`Total saham · ${holdings.length} ticker · ${totalLot.toLocaleString("id-ID")} lot`}</TFoot>
						<TFoot align="right" mono>
							{formatRupiah(totalValue)}
						</TFoot>
						<TFoot align="right" mono>
							{totalPnL >= 0 ? "+" : "−"}
							Rp {Math.abs(totalPnL).toLocaleString("id-ID")}
						</TFoot>
						<TFoot align="right" mono>
							{avgPnLPercent >= 0 ? "↑ +" : "↓ −"}
							{Math.abs(avgPnLPercent).toFixed(1).replace(".", ",")}%
						</TFoot>
					</tr>
				</tfoot>
			</table>
		</div>
	);
}

function pnlClass(pnl: number): string {
	// Strict monochrome — sesuai design hub: positif weight 500 dark, negatif gray-500.
	return pnl >= 0 ? "font-medium text-gray-950" : "text-gray-500";
}

// =============================================================================
// Reksa Dana
// =============================================================================

function ReksaSection() {
	const total = dummyMutualFunds.reduce((a, m) => a + m.value, 0);
	const avgReturn = (dummyMutualFunds.reduce((a, m) => a + m.pnlPercent, 0) / dummyMutualFunds.length).toFixed(1).replace(".", ",");

	return (
		<section>
			<SectionHeader
				title="Reksa"
				emphasis="Dana"
				meta={
					<>
						<SectionMeta label="Total" value={formatRupiah(total)} />
						<SectionMeta label="Return" value={`↑ +${avgReturn}%`} />
						<button
							type="button"
							className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 text-[13px] text-gray-700 transition-[background-color,border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
						>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
								<path d="M12 5v14" />
								<path d="M5 12h14" />
							</svg>
							Tambah produk
						</button>
					</>
				}
			/>
			<MutualFundTable funds={dummyMutualFunds} total={total} />
		</section>
	);
}

function MutualFundTable({ funds, total }: { funds: DummyMutualFund[]; total: number }) {
	const avg = (funds.reduce((a, m) => a + m.pnlPercent, 0) / funds.length).toFixed(1).replace(".", ",");
	return (
		<div className="overflow-x-auto border border-gray-200 bg-white">
			<table className="w-full border-collapse text-[13px]" style={{ minWidth: "720px" }}>
				<thead className="bg-gray-50">
					<tr className="border-b border-gray-200">
						<Th>Nama Produk</Th>
						<Th>Platform</Th>
						<Th align="right">Unit</Th>
						<Th align="right">NAB / Unit</Th>
						<Th align="right">Nilai</Th>
						<Th align="right">Return</Th>
					</tr>
				</thead>
				<tbody>
					{funds.map((f, i) => (
						<motion.tr
							key={f.id}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.35, ease: easeDesignhub, delay: 0.03 + i * 0.03 }}
							className="border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50"
						>
							<Td>
								<div className="font-medium text-gray-950">{f.name}</div>
								<div className="mt-0.5 text-[11px] text-gray-400">{f.type}</div>
							</Td>
							<Td>
								<span className="text-gray-700">{f.platform}</span>
							</Td>
							<Td align="right" mono>
								{f.units.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
							</Td>
							<Td align="right" mono>
								{f.nav.toLocaleString("id-ID")}
							</Td>
							<Td align="right" mono>
								{f.value.toLocaleString("id-ID")}
							</Td>
							<Td align="right" mono className={pnlClass(f.pnl)}>
								↑ +{Math.abs(f.pnlPercent).toFixed(1).replace(".", ",")}%
							</Td>
						</motion.tr>
					))}
				</tbody>
				<tfoot>
					<tr className="border-t border-gray-200 bg-gray-50 text-[13px] font-medium text-gray-950">
						<TFoot colSpan={4}>{`Total reksa dana · ${funds.length} produk`}</TFoot>
						<TFoot align="right" mono>
							{formatRupiah(total)}
						</TFoot>
						<TFoot align="right" mono>
							{`↑ +${avg}% rata-rata`}
						</TFoot>
					</tr>
				</tfoot>
			</table>
		</div>
	);
}

// =============================================================================
// Cash & e-wallet
// =============================================================================

function CashSection() {
	const total = dummyCashAccounts.reduce((a, c) => a + c.balance, 0);
	return (
		<section>
			<SectionHeader
				title="Tabungan &"
				emphasis="Cash"
				meta={
					<>
						<SectionMeta label="Total" value={formatRupiah(total)} />
						<SectionMeta label="Akun" value={`${dummyCashAccounts.length} aktif`} />
					</>
				}
			/>
			<div className="grid grid-cols-1 border border-gray-200 sm:grid-cols-2 lg:grid-cols-4">
				{dummyCashAccounts.map((acc, i) => (
					<CashCard key={acc.id} acc={acc} idx={i} />
				))}
			</div>
		</section>
	);
}

function CashCard({ acc, idx }: { acc: DummyCashAccount; idx: number }) {
	return (
		<div
			className={cn(
				"cursor-pointer bg-white p-5 transition-colors duration-200 ease-designhub hover:bg-gray-50",
				// border-r kecuali col terakhir per breakpoint
				idx % 4 !== 3 && "lg:border-r border-gray-200",
				idx % 2 !== 1 && "sm:border-r border-gray-200",
				idx < dummyCashAccounts.length - 1 && "border-b border-gray-200 sm:border-b-0",
				idx < dummyCashAccounts.length - 2 && "sm:border-b lg:border-b-0",
			)}
		>
			<div className="mb-3.5 flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<span className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-gray-100 font-serif text-[15px] text-gray-800">
						{acc.logoLetter}
					</span>
					<div>
						<div className="text-[13px] font-medium leading-tight text-gray-950">{acc.name}</div>
						<div className="mt-0.5 font-mono text-[11px] text-gray-400">{acc.masked}</div>
					</div>
				</div>
			</div>
			<div className="font-mono text-[22px] font-medium leading-none tracking-tight2 tabular-nums text-gray-950">
				{formatRupiah(acc.balance)}
			</div>
			<div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-400">
				<span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-gray-700" />
				{acc.updatedAgo}
			</div>
		</div>
	);
}

// =============================================================================
// Emas & Kripto
// =============================================================================

function EmasSection() {
	const total = dummyCommodities.reduce((a, c) => a + c.value, 0);
	const avgReturn = (dummyCommodities.reduce((a, c) => a + c.pnlPercent, 0) / dummyCommodities.length).toFixed(1).replace(".", ",");
	return (
		<section>
			<SectionHeader
				title="Emas &"
				emphasis="Kripto"
				meta={
					<>
						<SectionMeta label="Total" value={formatRupiah(total)} />
						<SectionMeta label="Return" value={`↑ +${avgReturn}%`} />
					</>
				}
			/>
			<CommodityTable commodities={dummyCommodities} />
		</section>
	);
}

function CommodityTable({ commodities }: { commodities: DummyCommodity[] }) {
	return (
		<div className="overflow-x-auto border border-gray-200 bg-white">
			<table className="w-full border-collapse text-[13px]" style={{ minWidth: "640px" }}>
				<thead className="bg-gray-50">
					<tr className="border-b border-gray-200">
						<Th>Aset</Th>
						<Th>Platform</Th>
						<Th align="right">Jumlah</Th>
						<Th align="right">Harga Saat Ini</Th>
						<Th align="right">Nilai</Th>
						<Th align="right">Return</Th>
					</tr>
				</thead>
				<tbody>
					{commodities.map((c, i) => (
						<motion.tr
							key={c.id}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.35, ease: easeDesignhub, delay: 0.03 + i * 0.03 }}
							className="border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50"
						>
							<Td>
								<span className="font-mono text-[13px] font-medium text-gray-950">{c.ticker}</span>
								<span className="ml-2 text-[11px] text-gray-400">{c.name}</span>
							</Td>
							<Td>
								<span className="text-gray-700">{c.platform}</span>
							</Td>
							<Td align="right" mono>
								{c.amount}
							</Td>
							<Td align="right" mono>
								{c.priceLabel}
							</Td>
							<Td align="right" mono>
								{c.value.toLocaleString("id-ID")}
							</Td>
							<Td align="right" mono className="font-medium text-gray-950">
								↑ +{c.pnlPercent.toFixed(1).replace(".", ",")}%
							</Td>
						</motion.tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

// =============================================================================
// Per-account view: group by platform
// =============================================================================

function AccountView() {
	// Group stock holdings by platform.
	const groupsMap = new Map<string, { ticker: string; name: string; lot: number; avgPrice: number; currentPrice: number | null; pnlPercent: number }[]>();
	for (const h of dummyStockHoldings) {
		for (const a of h.accounts) {
			if (!groupsMap.has(a.platform)) groupsMap.set(a.platform, []);
			const value = a.lot * 100 * (h.currentPrice ?? a.avgPrice);
			const cost = a.lot * 100 * a.avgPrice;
			const pnlPercent = ((value - cost) / Math.max(1, cost)) * 100;
			groupsMap.get(a.platform)!.push({
				ticker: h.ticker,
				name: h.name,
				lot: a.lot,
				avgPrice: a.avgPrice,
				currentPrice: h.currentPrice,
				pnlPercent,
			});
		}
	}
	const groups = Array.from(groupsMap.entries());

	// Plus mutual fund Bibit/Bareksa group
	const reksaByPlatform = new Map<string, DummyMutualFund[]>();
	for (const f of dummyMutualFunds) {
		if (!reksaByPlatform.has(f.platform)) reksaByPlatform.set(f.platform, []);
		reksaByPlatform.get(f.platform)!.push(f);
	}

	return (
		<>
			{groups.map(([platform, rows]) => {
				const total = rows.reduce((a, r) => a + r.lot * 100 * (r.currentPrice ?? r.avgPrice), 0);
				const cost = rows.reduce((a, r) => a + r.lot * 100 * r.avgPrice, 0);
				const ret = ((total - cost) / Math.max(1, cost)) * 100;
				return (
					<motion.section variants={itemVariants} key={platform}>
						<AccountGroup
							platform={platform}
							subtitle={`Broker · ${rows.length} saham`}
							totalLabel={formatRupiah(total)}
							returnLabel={`${ret >= 0 ? "↑ +" : "↓ −"}${Math.abs(ret).toFixed(1).replace(".", ",")}%`}
						>
							<table className="w-full border-collapse text-[13px]" style={{ minWidth: "720px" }}>
								<thead>
									<tr className="border-b border-gray-200">
										<Th>Kode</Th>
										<Th>Nama</Th>
										<Th align="right">Lot</Th>
										<Th align="right">Avg</Th>
										<Th align="right">Saat Ini</Th>
										<Th align="right">Nilai</Th>
										<Th align="right">P&L%</Th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r) => {
										const value = r.lot * 100 * (r.currentPrice ?? r.avgPrice);
										return (
											<tr key={`${platform}-${r.ticker}`} className="border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50">
												<Td>
													<span className="font-mono font-medium text-gray-950">{r.ticker}</span>
												</Td>
												<Td>
													<span className="text-gray-700">{r.name}</span>
												</Td>
												<Td align="right" mono>{r.lot} lot</Td>
												<Td align="right" mono>{r.avgPrice.toLocaleString("id-ID")}</Td>
												<Td align="right" mono>{r.currentPrice?.toLocaleString("id-ID") ?? "—"}</Td>
												<Td align="right" mono>{value.toLocaleString("id-ID")}</Td>
												<Td align="right" mono className={pnlClass(r.pnlPercent)}>
													{r.pnlPercent >= 0 ? "+" : "−"}
													{Math.abs(r.pnlPercent).toFixed(1).replace(".", ",")}%
												</Td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</AccountGroup>
					</motion.section>
				);
			})}

			{Array.from(reksaByPlatform.entries()).map(([platform, funds]) => {
				const total = funds.reduce((a, f) => a + f.value, 0);
				const ret = (funds.reduce((a, f) => a + f.pnlPercent, 0) / funds.length).toFixed(1).replace(".", ",");
				return (
					<motion.section variants={itemVariants} key={`reksa-${platform}`}>
						<AccountGroup
							platform={platform}
							subtitle={`Reksa Dana · ${funds.length} produk`}
							totalLabel={formatRupiah(total)}
							returnLabel={`↑ +${ret}%`}
						>
							<table className="w-full border-collapse text-[13px]" style={{ minWidth: "640px" }}>
								<thead>
									<tr className="border-b border-gray-200">
										<Th>Produk</Th>
										<Th>Jenis</Th>
										<Th align="right">Unit</Th>
										<Th align="right">NAB</Th>
										<Th align="right">Nilai</Th>
										<Th align="right">Return</Th>
									</tr>
								</thead>
								<tbody>
									{funds.map((f) => (
										<tr key={f.id} className="border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50">
											<Td>
												<span className="font-medium text-gray-950">{f.name}</span>
											</Td>
											<Td>
												<span className="text-gray-700">{f.type}</span>
											</Td>
											<Td align="right" mono>
												{f.units.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
											</Td>
											<Td align="right" mono>
												{f.nav.toLocaleString("id-ID")}
											</Td>
											<Td align="right" mono>
												{f.value.toLocaleString("id-ID")}
											</Td>
											<Td align="right" mono className="font-medium text-gray-950">
												↑ +{f.pnlPercent.toFixed(1).replace(".", ",")}%
											</Td>
										</tr>
									))}
								</tbody>
							</table>
						</AccountGroup>
					</motion.section>
				);
			})}
		</>
	);
}

function AccountGroup({
	platform,
	subtitle,
	totalLabel,
	returnLabel,
	children,
}: {
	platform: string;
	subtitle: string;
	totalLabel: string;
	returnLabel: string;
	children: React.ReactNode;
}) {
	return (
		<div className="border border-gray-200 bg-white">
			<div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4">
				<div className="flex items-center gap-3.5">
					<span className="grid h-10 w-10 place-items-center rounded-[10px] bg-gray-950 font-serif text-[18px] text-white">
						{platform.charAt(0)}
					</span>
					<div>
						<div className="text-[16px] font-medium text-gray-950">{platform}</div>
						<div className="mt-0.5 font-mono text-xs text-gray-500">{subtitle}</div>
					</div>
				</div>
				<div className="flex items-center gap-6 font-mono text-[13px] tabular-nums">
					<SectionMeta label="Total" value={totalLabel} />
					<SectionMeta label="Return" value={returnLabel} />
				</div>
			</div>
			<div className="overflow-x-auto">{children}</div>
		</div>
	);
}

// =============================================================================
// Reusable cell helpers
// =============================================================================

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
	return (
		<th
			className={cn(
				"whitespace-nowrap px-4 py-3.5 text-[11px] font-medium uppercase tracking-label text-gray-400",
				align === "right" ? "text-right" : "text-left",
			)}
		>
			{children}
		</th>
	);
}

function Td({
	children,
	align = "left",
	mono = false,
	className,
}: {
	children: React.ReactNode;
	align?: "left" | "right";
	mono?: boolean;
	className?: string;
}) {
	return (
		<td
			className={cn(
				"px-4 py-3.5 align-middle text-[13px] text-gray-950",
				align === "right" ? "text-right" : "text-left",
				mono && "font-mono tabular-nums",
				className,
			)}
		>
			{children}
		</td>
	);
}

function TFoot({
	children,
	colSpan,
	align = "left",
	mono = false,
}: {
	children: React.ReactNode;
	colSpan?: number;
	align?: "left" | "right";
	mono?: boolean;
}) {
	return (
		<td
			colSpan={colSpan}
			className={cn(
				"px-4 py-3.5 text-[13px] font-medium text-gray-950",
				align === "right" ? "text-right" : "text-left",
				mono && "font-mono tabular-nums",
			)}
		>
			{children}
		</td>
	);
}
