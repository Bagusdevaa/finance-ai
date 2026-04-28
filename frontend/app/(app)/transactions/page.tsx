"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { dummyTransactions, type DummyTransactionFull } from "@/lib/dummy-data";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

type TypeFilter = "all" | "in" | "out";

const CATEGORIES = ["Semua kategori", "Pemasukan", "Makan & Minum", "Belanja", "Transportasi", "Tagihan", "Investasi", "Hiburan"];
const ACCOUNTS = ["Semua akun", "BCA", "Mandiri", "GoPay", "OVO", "Stockbit", "Bibit"];

export default function TransactionsPage() {
	const [search, setSearch] = useState("");
	const [type, setType] = useState<TypeFilter>("all");
	const [category, setCategory] = useState(CATEGORIES[0]);
	const [account, setAccount] = useState(ACCOUNTS[0]);
	const [openCat, setOpenCat] = useState(false);
	const [openAcc, setOpenAcc] = useState(false);
	const [selected, setSelected] = useState<DummyTransactionFull | null>(null);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return dummyTransactions.filter((t) => {
			if (q && !`${t.merchant_name} ${t.description}`.toLowerCase().includes(q)) return false;
			if (type === "in" && t.amount < 0) return false;
			if (type === "out" && t.amount > 0) return false;
			if (category !== CATEGORIES[0] && t.category !== category) return false;
			if (account !== ACCOUNTS[0] && !t.account.startsWith(account)) return false;
			return true;
		});
	}, [search, type, category, account]);

	return (
		<>
			<Header
				title="Transaksi"
				actions={
					<>
						<HeaderGhostBtn>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
								<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
								<polyline points="7 10 12 15 17 10" />
								<line x1="12" y1="15" x2="12" y2="3" />
							</svg>
							Export
						</HeaderGhostBtn>
						<HeaderGhostBtn>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
								<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
							</svg>
							Filter
						</HeaderGhostBtn>
					</>
				}
			/>

			<div className="px-8 pb-24 pt-6">
				{/* FILTER BAR */}
				<div className="flex flex-wrap items-center gap-2.5 border-b border-gray-200 pb-4">
					<div className="relative min-w-[240px] max-w-[380px] flex-1">
						<svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="11" cy="11" r="8" />
							<path d="M21 21l-4.35-4.35" />
						</svg>
						<input
							type="search"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Cari merchant atau deskripsi..."
							className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-[13px] outline-none transition-[background-color,border-color] duration-200 ease-designhub focus:border-gray-950 focus:bg-white"
						/>
					</div>
					<Dropdown
						label="Kategori"
						value={category}
						open={openCat}
						onOpenChange={(v) => {
							setOpenCat(v);
							if (v) setOpenAcc(false);
						}}
						options={CATEGORIES}
						onSelect={setCategory}
					/>
					<Dropdown
						label="Akun"
						value={account}
						open={openAcc}
						onOpenChange={(v) => {
							setOpenAcc(v);
							if (v) setOpenCat(false);
						}}
						options={ACCOUNTS}
						onSelect={setAccount}
					/>
					<button
						type="button"
						className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-[13px] text-gray-700 transition-[border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:text-gray-950"
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
							<rect x="3" y="4" width="18" height="18" rx="2" />
							<line x1="16" y1="2" x2="16" y2="6" />
							<line x1="8" y1="2" x2="8" y2="6" />
							<line x1="3" y1="10" x2="21" y2="10" />
						</svg>
						<span className="font-medium text-gray-950">1 – 28 Apr 2026</span>
					</button>
					<TypeSegment value={type} onChange={setType} />
					<div className="ml-auto font-mono text-xs text-gray-400">
						{search ? `${filtered.length} ditemukan` : `${dummyTransactions.length} transaksi`}
					</div>
				</div>

				{/* TABLE */}
				<div className="overflow-x-auto">
					<table className="w-full border-collapse text-[13px]" style={{ minWidth: "880px" }}>
						<thead>
							<tr>
								<Th>Tanggal</Th>
								<Th>Merchant</Th>
								<Th>Kategori</Th>
								<Th>Akun</Th>
								<Th align="right">Jumlah</Th>
							</tr>
						</thead>
						<tbody>
							{groupByDate(filtered).map(({ date, items }) => (
								<DateGroup key={date} date={date} items={items} onSelect={setSelected} />
							))}
							{filtered.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-500">
										Tidak ada transaksi yang cocok.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* PAGINATION */}
				<div className="flex flex-wrap items-center justify-between gap-2.5 py-5 font-mono text-xs text-gray-500">
					<div>
						Menampilkan <strong className="text-gray-950">1–{filtered.length}</strong> dari{" "}
						<strong className="text-gray-950">{dummyTransactions.length}</strong> transaksi
					</div>
					<div className="flex items-center gap-1.5">
						<PgBtn disabled>
							<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<polyline points="15 18 9 12 15 6" />
							</svg>
						</PgBtn>
						<PgBtn active>1</PgBtn>
						<PgBtn>2</PgBtn>
						<PgBtn>3</PgBtn>
						<span className="px-1 text-gray-400">…</span>
						<PgBtn>9</PgBtn>
						<PgBtn>
							<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
								<polyline points="9 18 15 12 9 6" />
							</svg>
						</PgBtn>
					</div>
				</div>
			</div>

			{/* FAB */}
			<button
				type="button"
				className="fixed bottom-8 right-8 z-[6] inline-flex h-12 items-center gap-2 rounded-full bg-gray-950 px-5 text-[13px] font-medium text-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.35)] transition-[transform,background-color] duration-200 ease-designhub hover:-translate-y-0.5 hover:bg-black"
			>
				<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M12 5v14" />
					<path d="M5 12h14" />
				</svg>
				Tambah Manual
			</button>

			{/* SIDE PANEL */}
			<TxSidePanel tx={selected} onClose={() => setSelected(null)} />
		</>
	);
}

// =============================================================================
// Helpers
// =============================================================================

function HeaderGhostBtn({ children }: { children: React.ReactNode }) {
	return (
		<button
			type="button"
			className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
		>
			{children}
		</button>
	);
}

function Dropdown({
	label,
	value,
	options,
	open,
	onOpenChange,
	onSelect,
}: {
	label: string;
	value: string;
	options: string[];
	open: boolean;
	onOpenChange: (v: boolean) => void;
	onSelect: (v: string) => void;
}) {
	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => onOpenChange(!open)}
				className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-[13px] text-gray-700 transition-[border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:text-gray-950"
			>
				<span>{label}:</span>
				<span className="font-medium text-gray-950">{value}</span>
				<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
					<polyline points="6 9 12 15 18 9" />
				</svg>
			</button>
			{open && (
				<div className="absolute left-0 top-[calc(100%+4px)] z-[5] min-w-[200px] border border-gray-200 bg-white p-1.5 shadow-[0_10px_28px_-10px_rgba(0,0,0,0.12)]">
					{options.map((opt) => (
						<button
							key={opt}
							type="button"
							onClick={() => {
								onSelect(opt);
								onOpenChange(false);
							}}
							className={cn(
								"flex w-full items-center justify-between gap-2 rounded px-2.5 py-2 text-left text-[13px] text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-950",
								opt === value && "bg-gray-50 font-medium text-gray-950",
							)}
						>
							<span>{opt}</span>
							{opt === value && <span aria-hidden>✓</span>}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function TypeSegment({ value, onChange }: { value: TypeFilter; onChange: (v: TypeFilter) => void }) {
	const items: { id: TypeFilter; label: string }[] = [
		{ id: "all", label: "Semua" },
		{ id: "in", label: "Pemasukan" },
		{ id: "out", label: "Pengeluaran" },
	];
	return (
		<div className="inline-flex overflow-hidden rounded-lg border border-gray-300 text-[13px] font-medium">
			{items.map((it, i) => {
				const active = value === it.id;
				return (
					<button
						key={it.id}
						type="button"
						onClick={() => onChange(it.id)}
						className={cn(
							"px-3.5 py-2 transition-[background-color,color] duration-200 ease-designhub",
							i < items.length - 1 && "border-r border-gray-300",
							active ? "bg-gray-950 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-950",
						)}
					>
						{it.label}
					</button>
				);
			})}
		</div>
	);
}

function PgBtn({ children, active, disabled }: { children: React.ReactNode; active?: boolean; disabled?: boolean }) {
	return (
		<button
			type="button"
			disabled={disabled}
			className={cn(
				"grid h-[30px] w-[30px] place-items-center rounded-md border text-[12px] transition-[background-color,border-color,color] duration-200 ease-designhub",
				active
					? "border-gray-950 bg-gray-950 text-white"
					: "border-gray-200 bg-white text-gray-500 hover:border-gray-950 hover:text-gray-950",
				disabled && "cursor-not-allowed opacity-40",
			)}
		>
			{children}
		</button>
	);
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
	return (
		<th
			className={cn(
				"whitespace-nowrap border-b border-gray-200 bg-white px-4 py-3.5 text-[10px] font-medium uppercase tracking-label text-gray-400",
				align === "right" ? "text-right" : "text-left",
			)}
		>
			{children}
		</th>
	);
}

function groupByDate(items: DummyTransactionFull[]): { date: string; items: DummyTransactionFull[] }[] {
	const groups = new Map<string, DummyTransactionFull[]>();
	for (const t of items) {
		if (!groups.has(t.date)) groups.set(t.date, []);
		groups.get(t.date)!.push(t);
	}
	// Sort dates desc
	return Array.from(groups.entries())
		.sort(([a], [b]) => (a < b ? 1 : -1))
		.map(([date, items]) => ({ date, items }));
}

function DateGroup({
	date,
	items,
	onSelect,
}: {
	date: string;
	items: DummyTransactionFull[];
	onSelect: (t: DummyTransactionFull) => void;
}) {
	const formatted = new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "long",
		year: "numeric",
	}).format(new Date(date));

	return (
		<>
			<tr>
				<td colSpan={5} className="bg-gray-50 px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-label text-gray-500">
					<span className="text-gray-950">{formatted}</span>
				</td>
			</tr>
			{items.map((t) => (
				<TxRow key={t.id} t={t} onSelect={onSelect} />
			))}
		</>
	);
}

function TxRow({ t, onSelect }: { t: DummyTransactionFull; onSelect: (t: DummyTransactionFull) => void }) {
	const time = t.time ?? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(t.date));
	return (
		<tr
			onClick={() => onSelect(t)}
			className="cursor-pointer border-b border-gray-100 transition-colors duration-150 ease-designhub hover:bg-gray-50"
		>
			<td className="px-4 py-3.5 align-middle">
				<span className="whitespace-nowrap font-mono text-xs text-gray-700">{time}</span>
			</td>
			<td className="px-4 py-3.5 align-middle">
				<div className="font-medium text-gray-950">{t.merchant_name}</div>
				<div className="mt-0.5 font-mono text-[11px] text-gray-400">{t.description}</div>
			</td>
			<td className="px-4 py-3.5 align-middle">
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-200"
					onClick={(e) => e.stopPropagation()}
				>
					{t.category}
				</button>
			</td>
			<td className="px-4 py-3.5 align-middle">
				<span className="font-mono text-xs text-gray-500">{t.account}</span>
			</td>
			<td className="px-4 py-3.5 text-right align-middle">
				<span
					className={cn(
						"font-mono text-[13px] font-medium tabular-nums",
						t.amount > 0 ? "text-gray-950" : "text-gray-700",
					)}
				>
					{t.amount > 0 ? "+ " : "− "}
					{formatRupiah(Math.abs(t.amount))}
				</span>
			</td>
		</tr>
	);
}

// =============================================================================
// Side panel
// =============================================================================

function TxSidePanel({ tx, onClose }: { tx: DummyTransactionFull | null; onClose: () => void }) {
	const open = Boolean(tx);
	return (
		<>
			<AnimatePresence>
				{open && (
					<motion.div
						key="scrim"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.25, ease: easeDesignhub }}
						onClick={onClose}
						className="fixed inset-0 z-[30] bg-gray-950/[0.18]"
					/>
				)}
			</AnimatePresence>
			<motion.aside
				initial={false}
				animate={{ x: open ? 0 : "100%" }}
				transition={{ duration: 0.35, ease: easeDesignhub }}
				className="fixed right-0 top-0 z-[40] flex h-screen w-[440px] max-w-[92vw] flex-col border-l border-gray-200 bg-white shadow-[-20px_0_60px_-20px_rgba(0,0,0,0.2)]"
			>
				{tx && <TxSidePanelInner tx={tx} onClose={onClose} />}
			</motion.aside>
		</>
	);
}

function TxSidePanelInner({ tx, onClose }: { tx: DummyTransactionFull; onClose: () => void }) {
	const dateLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(tx.date));
	const time = tx.time ?? "—";

	return (
		<>
			<div className="flex justify-between gap-3 border-b border-gray-200 px-6 py-5">
				<div>
					<div className="font-serif text-[42px] font-light leading-none tracking-tight2 tabular-nums text-gray-950">
						{tx.amount > 0 ? "+" : "−"}
						{formatRupiah(Math.abs(tx.amount))}
					</div>
					<div className="mt-1.5 text-sm text-gray-700">{tx.merchant_name}</div>
				</div>
				<button
					type="button"
					onClick={onClose}
					aria-label="Tutup"
					className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-950"
				>
					<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M6 6l12 12M18 6l-12 12" />
					</svg>
				</button>
			</div>
			<div className="flex-1 overflow-y-auto px-6 py-5">
				<PRow label="Tanggal" value={`${dateLabel} · ${time}`} />
				<PRow label="Akun" value={tx.account} />
				<PRow
					label="Kategori"
					value={
						<span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
							{tx.category}
						</span>
					}
				/>
				<PRow label="Tipe" value={tx.amount > 0 ? "Pemasukan" : "Pengeluaran"} />
				<PRow label="Referensi" value={<span className="text-xs">{tx.id.toUpperCase()}</span>} />
				<h3 className="mb-2.5 mt-4 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
					Catatan
				</h3>
				<textarea
					placeholder="Tambahkan catatan..."
					className="min-h-[60px] w-full resize-y border border-gray-200 p-2.5 text-[13px] outline-none transition-colors focus:border-gray-950"
				/>
				<h3 className="mb-2.5 mt-4 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
					Riwayat di merchant ini
				</h3>
				<PRow label="21 Apr · Indomaret" value="−Rp 64.000" mono />
				<PRow label="14 Apr · Indomaret" value="−Rp 122.500" mono />
				<PRow label="Total bulan ini" value="−Rp 319.000 · 4×" mono noBorder />
			</div>
			<div className="flex gap-2 border-t border-gray-200 px-6 py-4">
				<button className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-950 hover:text-gray-950">
					Hapus
				</button>
				<button className="flex-1 rounded-lg bg-gray-950 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black">
					Simpan
				</button>
			</div>
		</>
	);
}

function PRow({
	label,
	value,
	mono = false,
	noBorder = false,
}: {
	label: string;
	value: React.ReactNode;
	mono?: boolean;
	noBorder?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between py-3 text-[13px]",
				!noBorder && "border-b border-gray-100",
			)}
		>
			<span className="text-gray-500">{label}</span>
			<span className={cn("font-medium text-gray-950", mono && "font-mono tabular-nums")}>{value}</span>
		</div>
	);
}
