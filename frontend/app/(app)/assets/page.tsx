"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import { SectionHeader, SectionMeta } from "@/components/ui/SectionHeader";
import { TabNav, type TabItem } from "@/components/ui/TabNav";
import { listHoldings } from "@/lib/api/holdings";
import { listAccounts } from "@/lib/api/accounts";
import type { AggregateHolding, HoldingResponse } from "@/lib/api/types";
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
type ViewMode = "aggregate" | "per_account";

const CAT_TABS: TabItem[] = [
	{ id: "all", label: "Semua" },
	{ id: "saham", label: "Saham" },
	{ id: "reksa", label: "Reksa Dana" },
	{ id: "cash", label: "Tabungan & Cash" },
	{ id: "emas", label: "Emas & Kripto" },
	{ id: "prop", label: "Properti" },
	{ id: "utang", label: "Utang" },
];

function toNumber(s: string | null | undefined): number {
	if (!s) return 0;
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
}

function isAggregate(h: AggregateHolding | HoldingResponse): h is AggregateHolding {
	return (h as AggregateHolding).total_lot !== undefined;
}

export default function AssetsPage() {
	const [view, setView] = useState<ViewMode>("aggregate");
	const [cat, setCat] = useState<CatId>("all");

	const { data: holdingsData, isLoading } = useQuery({
		queryKey: ["holdings", view],
		queryFn: () => listHoldings(view),
	});
	const { data: accounts } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});

	const holdings = useMemo(() => holdingsData?.items ?? [], [holdingsData]);

	// Compute net-worth (saham only for now)
	const netWorth = useMemo(() => {
		let total = 0;
		for (const h of holdings) {
			if (isAggregate(h)) {
				total += h.total_lot * 100 * toNumber(h.weighted_avg_price);
			} else {
				total += h.lot * 100 * toNumber(h.avg_price);
			}
		}
		return total;
	}, [holdings]);

	return (
		<>
			<Header
				title={
					<>
						Aset & <em className="font-normal italic text-gray-700">Portofolio</em>
					</>
				}
				actions={<div className="hidden min-[480px]:flex"><ViewToggle value={view} onChange={setView} /></div>}
			/>

			<div className="flex items-center justify-between px-4 pt-3 min-[480px]:hidden md:px-8">
				<ViewToggle value={view} onChange={setView} />
			</div>

			<NetWorthHero total={netWorth} accountsCount={accounts?.length ?? 0} />

			<TabNav tabs={CAT_TABS} activeId={cat} onChange={(id) => setCat(id as CatId)} />

			<motion.div
				className="flex flex-col gap-8 px-4 py-8 md:px-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
				key={view}
			>
				{view === "aggregate" ? (
					<AggregateView cat={cat} holdings={holdings} loading={isLoading} />
				) : (
					<PerAccountView cat={cat} holdings={holdings} loading={isLoading} />
				)}
			</motion.div>
		</>
	);
}

// =============================================================================
// View toggle
// =============================================================================

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
	return (
		<div className="inline-flex shrink-0 overflow-hidden rounded-lg border border-gray-300 text-[11px] font-medium min-[375px]:text-[13px]">
			{(["aggregate", "per_account"] as const).map((id, i) => {
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
// Hero banner — saham-only net worth for now
// =============================================================================

function NetWorthHero({ total, accountsCount }: { total: number; accountsCount: number }) {
	return (
		<section className="grid grid-cols-1 items-center gap-10 border-b border-gray-200 bg-black px-4 py-8 text-white md:px-8 md:py-12 lg:grid-cols-[1fr_auto]">
			<div>
				<div className="inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-labelExtra text-gray-500">
					<span aria-hidden className="inline-block h-px w-6 bg-gray-700" />
					Total Portofolio Saham
				</div>
				<div className="mb-3.5 mt-4 font-serif text-[clamp(48px,7vw,78px)] font-extralight leading-none tracking-display tabular-nums text-white">
					{total > 0 ? formatRupiah(total) : "—"}
				</div>
				<div className="mb-4 text-[14px] text-gray-500">
					{accountsCount > 0 ? (
						<>Dari <strong className="font-medium text-gray-300">{accountsCount} akun aktif</strong></>
					) : (
						"Belum ada akun"
					)}
					{" · "}
					Dihitung dari saham saja untuk sekarang
				</div>
			</div>
		</section>
	);
}

// =============================================================================
// Aggregate view
// =============================================================================

function AggregateView({
	cat,
	holdings,
	loading,
}: {
	cat: CatId;
	holdings: (AggregateHolding | HoldingResponse)[];
	loading: boolean;
}) {
	const showSaham = cat === "all" || cat === "saham";
	const showReksa = cat === "all" || cat === "reksa";
	const showCash = cat === "all" || cat === "cash";
	const showEmas = cat === "all" || cat === "emas";
	const showProp = cat === "all" || cat === "prop";
	const showUtang = cat === "all" || cat === "utang";

	// Coerce to AggregateHolding for display in aggregate view.
	const aggHoldings = holdings.filter(isAggregate);

	return (
		<>
			{showSaham && (
				<motion.section variants={itemVariants}>
					<SahamSection holdings={aggHoldings} loading={loading} />
				</motion.section>
			)}
			{showReksa && (
				<motion.section variants={itemVariants}>
					<ComingSoonSection title="Reksa" emphasis="Dana" />
				</motion.section>
			)}
			{showCash && (
				<motion.section variants={itemVariants}>
					<ComingSoonSection title="Tabungan &" emphasis="Cash" />
				</motion.section>
			)}
			{showEmas && (
				<motion.section variants={itemVariants}>
					<ComingSoonSection title="Emas &" emphasis="Kripto" />
				</motion.section>
			)}
			{showProp && cat === "prop" && (
				<motion.section variants={itemVariants}>
					<ComingSoonSection title="" emphasis="Properti" />
				</motion.section>
			)}
			{showUtang && cat === "utang" && (
				<motion.section variants={itemVariants}>
					<ComingSoonSection title="" emphasis="Utang" />
				</motion.section>
			)}
		</>
	);
}

function ComingSoonSection({ title, emphasis }: { title: string; emphasis: string }) {
	return (
		<section>
			<SectionHeader title={title} emphasis={emphasis} meta={null} />
			<div className="flex flex-col items-center gap-2 border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
				<span className="font-serif text-3xl text-gray-300">—</span>
				<span className="text-sm font-medium text-gray-950">Coming soon</span>
				<span className="text-xs text-gray-500">Fitur ini sedang dalam pengembangan.</span>
			</div>
		</section>
	);
}

// =============================================================================
// Saham section
// =============================================================================

function SahamSection({ holdings, loading }: { holdings: AggregateHolding[]; loading: boolean }) {
	const totalLot = holdings.reduce((a, h) => a + h.total_lot, 0);
	const totalValue = holdings.reduce(
		(a, h) => a + h.total_lot * 100 * toNumber(h.weighted_avg_price),
		0,
	);

	return (
		<section>
			<SectionHeader
				title="Saham"
				emphasis="IDX"
				meta={
					<>
						<SectionMeta label="Total" value={formatRupiah(totalValue)} />
						<SectionMeta label="Lot" value={`${totalLot.toLocaleString("id-ID")}`} />
					</>
				}
			/>
			{loading ? (
				<div className="border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Memuat...</div>
			) : holdings.length === 0 ? (
				<div className="flex flex-col items-center gap-2 border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
					<span className="font-serif text-3xl text-gray-300">—</span>
					<span className="text-sm font-medium text-gray-950">Belum ada saham</span>
					<span className="text-xs text-gray-500">Tambah saham via import broker atau manual.</span>
				</div>
			) : (
				<AggregateStockTable holdings={holdings} totalLot={totalLot} totalValue={totalValue} />
			)}
		</section>
	);
}

function AggregateStockTable({
	holdings,
	totalLot,
	totalValue,
}: {
	holdings: AggregateHolding[];
	totalLot: number;
	totalValue: number;
}) {
	return (
		<div className="overflow-x-auto border border-gray-200 bg-white">
			<table className="w-full border-collapse text-[13px]" style={{ minWidth: "640px" }}>
				<thead className="bg-gray-50">
					<tr className="border-b border-gray-200">
						<Th>Kode</Th>
						<Th align="right">Lot</Th>
						<Th align="right">Harga Avg (Weighted)</Th>
						<Th align="right">Nilai (cost basis)</Th>
						<Th>Akun</Th>
					</tr>
				</thead>
				<tbody>
					{holdings.map((h, i) => {
						const avg = toNumber(h.weighted_avg_price);
						const value = h.total_lot * 100 * avg;
						return (
							<motion.tr
								key={h.ticker}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.35, ease: easeDesignhub, delay: 0.03 + i * 0.03 }}
								className="border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50"
							>
								<Td>
									<span className="font-mono text-[13px] font-medium text-gray-950">{h.ticker}</span>
								</Td>
								<Td align="right" mono>
									<div>{h.total_lot} lot</div>
									{h.breakdown.length > 1 && (
										<div className="mt-0.5 text-[11px] font-normal normal-case tracking-normal text-gray-400">
											Dari {h.breakdown.length} akun
										</div>
									)}
								</Td>
								<Td align="right" mono>{avg.toLocaleString("id-ID")}</Td>
								<Td align="right" mono>{value.toLocaleString("id-ID")}</Td>
								<Td>
									<span className="text-[12px] text-gray-700">
										{h.breakdown.map((b) => `${b.account_name} ${b.lot}`).join(" · ")}
									</span>
								</Td>
							</motion.tr>
						);
					})}
				</tbody>
				<tfoot>
					<tr className="border-t border-gray-200 bg-gray-50 text-[13px] font-medium text-gray-950">
						<TFoot colSpan={1}>{`${holdings.length} ticker`}</TFoot>
						<TFoot align="right" mono>{`${totalLot.toLocaleString("id-ID")} lot`}</TFoot>
						<TFoot />
						<TFoot align="right" mono>{formatRupiah(totalValue)}</TFoot>
						<TFoot />
					</tr>
				</tfoot>
			</table>
		</div>
	);
}

// =============================================================================
// Per-account view
// =============================================================================

function PerAccountView({
	cat,
	holdings,
	loading,
}: {
	cat: CatId;
	holdings: (AggregateHolding | HoldingResponse)[];
	loading: boolean;
}) {
	const showSaham = cat === "all" || cat === "saham";

	// Group HoldingResponse rows by account_name.
	const perAccount = holdings.filter((h): h is HoldingResponse => !isAggregate(h));
	const groups = useMemo(() => {
		const m = new Map<string, HoldingResponse[]>();
		for (const h of perAccount) {
			if (!m.has(h.account_name)) m.set(h.account_name, []);
			m.get(h.account_name)!.push(h);
		}
		return Array.from(m.entries());
	}, [perAccount]);

	if (loading) {
		return <div className="border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">Memuat...</div>;
	}

	return (
		<>
			{showSaham && groups.length === 0 && (
				<div className="flex flex-col items-center gap-2 border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
					<span className="font-serif text-3xl text-gray-300">—</span>
					<span className="text-sm font-medium text-gray-950">Belum ada saham</span>
					<span className="text-xs text-gray-500">Tambah saham via import broker atau manual.</span>
				</div>
			)}
			{showSaham && groups.map(([accountName, rows]) => {
				const total = rows.reduce((a, r) => a + r.lot * 100 * toNumber(r.avg_price), 0);
				const totalLot = rows.reduce((a, r) => a + r.lot, 0);
				return (
					<motion.section variants={itemVariants} key={accountName}>
						<AccountGroup
							platform={accountName}
							subtitle={`Broker · ${rows.length} saham`}
							totalLabel={formatRupiah(total)}
							lotLabel={`${totalLot.toLocaleString("id-ID")} lot`}
						>
							<table className="w-full border-collapse text-[13px]" style={{ minWidth: "560px" }}>
								<thead>
									<tr className="border-b border-gray-200">
										<Th>Kode</Th>
										<Th align="right">Lot</Th>
										<Th align="right">Avg</Th>
										<Th align="right">Nilai</Th>
									</tr>
								</thead>
								<tbody>
									{rows.map((r) => {
										const avg = toNumber(r.avg_price);
										const value = r.lot * 100 * avg;
										return (
											<tr key={r.id} className="border-b border-gray-100 transition-colors duration-150 ease-designhub last:border-b-0 hover:bg-gray-50">
												<Td>
													<span className="font-mono font-medium text-gray-950">{r.ticker}</span>
												</Td>
												<Td align="right" mono>{r.lot} lot</Td>
												<Td align="right" mono>{avg.toLocaleString("id-ID")}</Td>
												<Td align="right" mono>{value.toLocaleString("id-ID")}</Td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</AccountGroup>
					</motion.section>
				);
			})}
			{(cat === "reksa" || cat === "cash" || cat === "emas" || cat === "prop" || cat === "utang") && (
				<div className="flex flex-col items-center gap-2 border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
					<span className="font-serif text-3xl text-gray-300">—</span>
					<span className="text-sm font-medium text-gray-950">Coming soon</span>
					<span className="text-xs text-gray-500">Fitur ini sedang dalam pengembangan.</span>
				</div>
			)}
		</>
	);
}

function AccountGroup({
	platform,
	subtitle,
	totalLabel,
	lotLabel,
	children,
}: {
	platform: string;
	subtitle: string;
	totalLabel: string;
	lotLabel: string;
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
					<SectionMeta label="Lot" value={lotLabel} />
				</div>
			</div>
			<div className="overflow-x-auto">{children}</div>
		</div>
	);
}

// =============================================================================
// Cell helpers
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
	children?: React.ReactNode;
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
