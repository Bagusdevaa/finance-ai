"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/layout/Header";
import {
	listTransactions,
	createTransaction,
	updateTransaction,
	deleteTransaction,
	type ListTransactionsParams,
} from "@/lib/api/transactions";
import { listAccounts } from "@/lib/api/accounts";
import type {
	TransactionResponse,
	TransactionCreate,
	TransactionUpdate,
	AccountResponse,
} from "@/lib/api/types";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah } from "@/lib/formatRupiah";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

type TypeFilter = "all" | "in" | "out";

const ALL_CATEGORIES_LABEL = "Semua kategori";
// Saran kategori untuk modal "Tambah Manual". Filter dropdown sendiri di-derive
// dari data user yang sudah ada (lihat `availableCategories` di komponen).
const SUGGESTED_CATEGORIES = ["Pemasukan", "Makan & Minum", "Belanja", "Transportasi", "Tagihan", "Investasi", "Hiburan"];
const ALL_ACCOUNTS_LABEL = "Semua akun";

function toNumber(s: string | null | undefined): number {
	if (!s) return 0;
	const n = parseFloat(s);
	return Number.isFinite(n) ? n : 0;
}

export default function TransactionsPage() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [type, setType] = useState<TypeFilter>("all");
	const [category, setCategory] = useState(ALL_CATEGORIES_LABEL);
	const [accountLabel, setAccountLabel] = useState(ALL_ACCOUNTS_LABEL);
	const [openCat, setOpenCat] = useState(false);
	const [openAcc, setOpenAcc] = useState(false);
	const [selected, setSelected] = useState<TransactionResponse | null>(null);
	const [showFilters, setShowFilters] = useState(true);
	const [filterAnimating, setFilterAnimating] = useState(false);
	const [showAddModal, setShowAddModal] = useState(false);

	// Debounce search input → API param
	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
		return () => clearTimeout(t);
	}, [search]);

	const { data: accounts } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});

	const accountOptions = useMemo(
		() => [ALL_ACCOUNTS_LABEL, ...(accounts?.map((a) => a.name) ?? [])],
		[accounts],
	);
	const accountByName = useMemo(() => {
		const m = new Map<string, AccountResponse>();
		for (const a of accounts ?? []) m.set(a.name, a);
		return m;
	}, [accounts]);

	const filterParams = useMemo<ListTransactionsParams>(() => {
		const p: ListTransactionsParams = { limit: 50 };
		if (debouncedSearch) p.search = debouncedSearch;
		if (type !== "all") p.type = type;
		if (category !== ALL_CATEGORIES_LABEL) p.category = category;
		const acc = accountByName.get(accountLabel);
		if (acc) p.account_id = acc.id;
		return p;
	}, [debouncedSearch, type, category, accountLabel, accountByName]);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
		queryKey: ["transactions", filterParams],
		queryFn: ({ pageParam }) => listTransactions({ ...filterParams, cursor: pageParam }),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: (last) => last.next_cursor ?? undefined,
	});

	const transactions = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data]);

	// Kategori dropdown harus reflect data user yang ADA. Query terpisah tanpa
	// filter — kalau pakai `transactions` (yang sudah ke-filter), opsi hilang
	// begitu user mulai filter.
	const { data: catSampleData } = useQuery({
		queryKey: ["transactions-cat-sample"],
		queryFn: () => listTransactions({ limit: 200 }),
		staleTime: 60_000,
	});
	const categoryOptions = useMemo(() => {
		const fromData = (catSampleData?.items ?? [])
			.map((t) => t.category)
			.filter((c): c is string => !!c && c.trim().length > 0);
		const unique = Array.from(new Set(fromData)).sort((a, b) => a.localeCompare(b, "id"));
		return [ALL_CATEGORIES_LABEL, ...unique];
	}, [catSampleData]);

	const createMutation = useMutation({
		mutationFn: (payload: TransactionCreate) => createTransaction(payload),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			setShowAddModal(false);
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, data }: { id: string; data: TransactionUpdate }) => updateTransaction(id, data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			setSelected(null);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => deleteTransaction(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["transactions"] });
			setSelected(null);
		},
	});

	const handleExport = () => {
		const header = "Date,Merchant,Category,Account,Amount,Description";
		const rows = transactions.map((t) => {
			const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
			return [
				t.transaction_date,
				escapeCsv(t.merchant_name ?? ""),
				escapeCsv(t.category ?? ""),
				escapeCsv(t.account?.name ?? ""),
				t.amount,
				escapeCsv(t.description ?? ""),
			].join(",");
		});
		const csv = [header, ...rows].join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		const today = new Date().toISOString().slice(0, 10);
		a.href = url;
		a.download = `transaksi-export-${today}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	};

	return (
		<>
			<Header
				title="Transaksi"
				actions={
					<>
						<HeaderGhostBtn onClick={handleExport}>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
								<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
								<polyline points="7 10 12 15 17 10" />
								<line x1="12" y1="15" x2="12" y2="3" />
							</svg>
							<span className="hidden min-[375px]:inline">Export</span>
						</HeaderGhostBtn>
						<HeaderGhostBtn onClick={() => setShowFilters((v) => !v)}>
							<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
								<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
							</svg>
							<span className="hidden min-[375px]:inline">Filter</span>
						</HeaderGhostBtn>
					</>
				}
			/>

			<div className="px-4 pb-24 pt-6 md:px-8">
				{/* FILTER BAR */}
				<AnimatePresence initial={false}>
				{showFilters && (
				<motion.div
					initial={{ opacity: 0, height: 0 }}
					animate={{ opacity: 1, height: "auto" }}
					exit={{ opacity: 0, height: 0 }}
					transition={{ duration: 0.25, ease: easeDesignhub }}
					onAnimationStart={() => setFilterAnimating(true)}
					onAnimationComplete={() => setFilterAnimating(false)}
					className={filterAnimating ? "overflow-hidden" : "overflow-visible"}
				>
				<div className="flex flex-wrap items-center gap-2.5 border-b border-gray-200 pb-4">
					<div className="relative min-w-0 max-w-[380px] flex-1 basis-full min-[375px]:basis-auto min-[375px]:min-w-[200px] sm:min-w-[240px]">
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
						options={categoryOptions}
						onSelect={setCategory}
					/>
					<Dropdown
						label="Akun"
						value={accountLabel}
						open={openAcc}
						onOpenChange={(v) => {
							setOpenAcc(v);
							if (v) setOpenCat(false);
						}}
						options={accountOptions}
						onSelect={setAccountLabel}
					/>
					<TypeSegment value={type} onChange={setType} />
					<div className="ml-auto font-mono text-xs text-gray-400">
						{isLoading ? "Memuat..." : `${transactions.length} transaksi`}
					</div>
				</div>
				</motion.div>
				)}
				</AnimatePresence>

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
							{groupByDate(transactions).map(({ date, items }) => (
								<DateGroup key={date} date={date} items={items} onSelect={setSelected} />
							))}
							{!isLoading && transactions.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-500">
										Tidak ada transaksi yang cocok.
									</td>
								</tr>
							)}
							{isLoading && (
								<tr>
									<td colSpan={5} className="px-4 py-16 text-center text-sm text-gray-500">
										Memuat...
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* LOAD MORE */}
				<div className="flex flex-wrap items-center justify-between gap-2.5 py-5 font-mono text-xs text-gray-500">
					<div>
						Menampilkan <strong className="text-gray-950">{transactions.length}</strong> transaksi
					</div>
					{hasNextPage && (
						<button
							type="button"
							onClick={() => fetchNextPage()}
							disabled={isFetchingNextPage}
							className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-medium text-gray-700 transition-[border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{isFetchingNextPage ? "Memuat..." : "Muat lebih banyak"}
						</button>
					)}
				</div>
			</div>

			{/* FAB */}
			<button
				type="button"
				onClick={() => setShowAddModal(true)}
				className="fixed bottom-6 right-4 z-[6] inline-flex h-12 items-center gap-2 rounded-full bg-gray-950 px-5 text-[13px] font-medium text-white shadow-[0_14px_30px_-10px_rgba(0,0,0,0.35)] transition-[transform,background-color] duration-200 ease-designhub hover:-translate-y-0.5 hover:bg-black md:bottom-8 md:right-8"
			>
				<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M12 5v14" />
					<path d="M5 12h14" />
				</svg>
				Tambah Manual
			</button>

			{/* SIDE PANEL */}
			<TxSidePanel
				tx={selected}
				accounts={accounts ?? []}
				onClose={() => setSelected(null)}
				onSave={(id, data) => updateMutation.mutate({ id, data })}
				onDelete={(id) => deleteMutation.mutate(id)}
				saving={updateMutation.isPending}
				deleting={deleteMutation.isPending}
				error={
					updateMutation.error
						? getErrorMessage(updateMutation.error, "Gagal menyimpan")
						: deleteMutation.error
							? getErrorMessage(deleteMutation.error, "Gagal menghapus")
							: null
				}
			/>

			{/* ADD TRANSACTION MODAL */}
			<AddTransactionModal
				open={showAddModal}
				onClose={() => setShowAddModal(false)}
				accounts={accounts ?? []}
				onSubmit={(payload) => createMutation.mutate(payload)}
				submitting={createMutation.isPending}
				error={createMutation.error ? getErrorMessage(createMutation.error, "Gagal menyimpan") : null}
			/>
		</>
	);
}

// =============================================================================
// Helpers
// =============================================================================

function HeaderGhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 text-[13px] font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 ease-designhub hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950 min-[375px]:h-9 min-[375px]:px-3.5"
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

function groupByDate(items: TransactionResponse[]): { date: string; items: TransactionResponse[] }[] {
	const groups = new Map<string, TransactionResponse[]>();
	for (const t of items) {
		const key = t.transaction_date;
		if (!groups.has(key)) groups.set(key, []);
		groups.get(key)!.push(t);
	}
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
	items: TransactionResponse[];
	onSelect: (t: TransactionResponse) => void;
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

function TxRow({ t, onSelect }: { t: TransactionResponse; onSelect: (t: TransactionResponse) => void }) {
	const amt = toNumber(t.amount);
	const time = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(t.transaction_date));
	return (
		<tr
			onClick={() => onSelect(t)}
			className="cursor-pointer border-b border-gray-100 transition-colors duration-150 ease-designhub hover:bg-gray-50"
		>
			<td className="px-4 py-3.5 align-middle">
				<span className="whitespace-nowrap font-mono text-xs text-gray-700">{time}</span>
			</td>
			<td className="px-4 py-3.5 align-middle">
				<div className="font-medium text-gray-950">{t.merchant_name || t.description || "Tanpa nama"}</div>
				{t.description && t.merchant_name && (
					<div className="mt-0.5 font-mono text-[11px] text-gray-400">{t.description}</div>
				)}
			</td>
			<td className="px-4 py-3.5 align-middle">
				<button
					type="button"
					className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors duration-150 hover:bg-gray-200"
					onClick={(e) => e.stopPropagation()}
				>
					{t.category || "Lainnya"}
				</button>
			</td>
			<td className="px-4 py-3.5 align-middle">
				<span className="font-mono text-xs text-gray-500">{t.account?.name ?? "—"}</span>
			</td>
			<td className="px-4 py-3.5 text-right align-middle">
				<span
					className={cn(
						"font-mono text-[13px] font-medium tabular-nums",
						amt > 0 ? "text-gray-950" : "text-gray-700",
					)}
				>
					{amt > 0 ? "+ " : "− "}
					{formatRupiah(Math.abs(amt))}
				</span>
			</td>
		</tr>
	);
}

// =============================================================================
// Side panel
// =============================================================================

function TxSidePanel({
	tx,
	accounts,
	onClose,
	onSave,
	onDelete,
	saving,
	deleting,
	error,
}: {
	tx: TransactionResponse | null;
	accounts: AccountResponse[];
	onClose: () => void;
	onSave: (id: string, data: TransactionUpdate) => void;
	onDelete: (id: string) => void;
	saving: boolean;
	deleting: boolean;
	error: string | null;
}) {
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
				{tx && (
					<TxSidePanelInner
						tx={tx}
						accounts={accounts}
						onClose={onClose}
						onSave={onSave}
						onDelete={onDelete}
						saving={saving}
						deleting={deleting}
						error={error}
					/>
				)}
			</motion.aside>
		</>
	);
}

function TxSidePanelInner({
	tx,
	accounts,
	onClose,
	onSave,
	onDelete,
	saving,
	deleting,
	error,
}: {
	tx: TransactionResponse;
	accounts: AccountResponse[];
	onClose: () => void;
	onSave: (id: string, data: TransactionUpdate) => void;
	onDelete: (id: string) => void;
	saving: boolean;
	deleting: boolean;
	error: string | null;
}) {
	const amt = toNumber(tx.amount);
	const dateLabel = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(tx.transaction_date));
	const [note, setNote] = useState(tx.note ?? "");

	useEffect(() => {
		setNote(tx.note ?? "");
	}, [tx.id, tx.note]);

	return (
		<>
			<div className="flex justify-between gap-3 border-b border-gray-200 px-6 py-5">
				<div>
					<div className="font-serif text-[42px] font-light leading-none tracking-tight2 tabular-nums text-gray-950">
						{amt > 0 ? "+" : "−"}
						{formatRupiah(Math.abs(amt))}
					</div>
					<div className="mt-1.5 text-sm text-gray-700">{tx.merchant_name || tx.description || "Tanpa nama"}</div>
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
				<PRow label="Tanggal" value={dateLabel} />
				<PRow label="Akun" value={tx.account?.name ?? "—"} />
				<PRow
					label="Kategori"
					value={
						<span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
							{tx.category || "Lainnya"}
						</span>
					}
				/>
				<PRow label="Tipe" value={amt > 0 ? "Pemasukan" : "Pengeluaran"} />
				<PRow label="Sumber" value={<span className="text-xs">{tx.source}</span>} />
				<PRow label="Referensi" value={<span className="text-xs">{tx.id.slice(0, 8).toUpperCase()}</span>} />
				<h3 className="mb-2.5 mt-4 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
					Catatan
				</h3>
				<textarea
					value={note}
					onChange={(e) => setNote(e.target.value)}
					placeholder="Tambahkan catatan..."
					className="min-h-[60px] w-full resize-y border border-gray-200 p-2.5 text-[13px] outline-none transition-colors focus:border-gray-950"
				/>
				{error && (
					<div className="mt-3 border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-700">
						{error}
					</div>
				)}
			</div>
			<div className="flex gap-2 border-t border-gray-200 px-6 py-4">
				<button
					type="button"
					onClick={() => {
						if (confirm("Hapus transaksi ini?")) onDelete(tx.id);
					}}
					disabled={deleting || saving}
					className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:border-gray-950 hover:text-gray-950 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{deleting ? "Menghapus..." : "Hapus"}
				</button>
				<button
					type="button"
					onClick={() => onSave(tx.id, { note: note || null })}
					disabled={saving || deleting}
					className="flex-1 rounded-lg bg-gray-950 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
				>
					{saving ? "Menyimpan..." : "Simpan"}
				</button>
			</div>
			{/* keep accounts referenced to avoid unused-var error in case of future select */}
			<span hidden>{accounts.length}</span>
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

// =============================================================================
// Add Transaction Modal
// =============================================================================

const ADD_CATEGORIES = SUGGESTED_CATEGORIES;

function AddTransactionModal({
	open,
	onClose,
	accounts,
	onSubmit,
	submitting,
	error,
}: {
	open: boolean;
	onClose: () => void;
	accounts: AccountResponse[];
	onSubmit: (payload: TransactionCreate) => void;
	submitting: boolean;
	error: string | null;
}) {
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [merchant, setMerchant] = useState("");
	const [amountStr, setAmountStr] = useState("");
	const [isExpense, setIsExpense] = useState(true);
	const [cat, setCat] = useState(ADD_CATEGORIES[0]);
	const [accId, setAccId] = useState<string>("");
	const [desc, setDesc] = useState("");

	useEffect(() => {
		if (open) {
			setDate(new Date().toISOString().slice(0, 10));
			setMerchant("");
			setAmountStr("");
			setIsExpense(true);
			setCat(ADD_CATEGORIES[0]);
			setAccId(accounts[0]?.id ?? "");
			setDesc("");
		}
	}, [open, accounts]);

	useEffect(() => {
		if (!open) return;
		const handler = (e: globalThis.KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [open, onClose]);

	const handleSubmit = () => {
		const rawAmount = parseFloat(amountStr.replace(/\./g, "").replace(",", "."));
		if (!merchant.trim() || isNaN(rawAmount) || rawAmount <= 0) return;
		const signed = isExpense ? -rawAmount : rawAmount;
		const payload: TransactionCreate = {
			account_id: accId || null,
			amount: signed.toFixed(2),
			merchant_name: merchant.trim(),
			description: desc.trim() || null,
			category: cat,
			transaction_date: date,
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
						className="w-full max-w-[480px] border border-gray-200 bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.25)]"
						initial={{ opacity: 0, scale: 0.95, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 8 }}
						transition={{ duration: 0.25, ease: easeDesignhub }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
							<h2 className="text-[15px] font-medium text-gray-950">Tambah Transaksi</h2>
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
							<ModalField label="Tanggal">
								<input
									type="date"
									value={date}
									onChange={(e) => setDate(e.target.value)}
									className="h-9 w-full border border-gray-200 bg-gray-50 px-3 font-mono text-[13px] text-gray-950 outline-none transition-colors focus:border-gray-950 focus:bg-white"
								/>
							</ModalField>
							<ModalField label="Merchant">
								<input
									type="text"
									value={merchant}
									onChange={(e) => setMerchant(e.target.value)}
									placeholder="Nama merchant..."
									className="h-9 w-full border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 focus:bg-white"
									autoFocus
								/>
							</ModalField>
							<ModalField label="Jumlah">
								<div className="flex gap-2">
									<button
										type="button"
										onClick={() => setIsExpense((v) => !v)}
										className={cn(
											"grid h-9 w-9 shrink-0 place-items-center border text-sm font-medium transition-colors",
											isExpense
												? "border-gray-950 bg-gray-950 text-white"
												: "border-gray-200 bg-gray-50 text-gray-950",
										)}
									>
										{isExpense ? "−" : "+"}
									</button>
									<div className="relative flex-1">
										<span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-500">Rp</span>
										<input
											type="text"
											value={amountStr}
											onChange={(e) => setAmountStr(e.target.value)}
											placeholder="0"
											className="h-9 w-full border border-gray-200 bg-gray-50 pl-9 pr-3 font-mono text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 focus:bg-white"
										/>
									</div>
								</div>
							</ModalField>
							<div className="grid grid-cols-2 gap-3">
								<ModalField label="Kategori">
									<select
										value={cat}
										onChange={(e) => setCat(e.target.value)}
										className="h-9 w-full border border-gray-200 bg-gray-50 px-2 text-[13px] text-gray-950 outline-none transition-colors focus:border-gray-950 focus:bg-white"
									>
										{ADD_CATEGORIES.map((c) => (
											<option key={c} value={c}>{c}</option>
										))}
									</select>
								</ModalField>
								<ModalField label="Akun">
									<select
										value={accId}
										onChange={(e) => setAccId(e.target.value)}
										className="h-9 w-full border border-gray-200 bg-gray-50 px-2 text-[13px] text-gray-950 outline-none transition-colors focus:border-gray-950 focus:bg-white"
									>
										<option value="">— Pilih akun —</option>
										{accounts.map((a) => (
											<option key={a.id} value={a.id}>{a.name}</option>
										))}
									</select>
								</ModalField>
							</div>
							<ModalField label="Deskripsi (opsional)">
								<input
									type="text"
									value={desc}
									onChange={(e) => setDesc(e.target.value)}
									placeholder="Catatan singkat..."
									className="h-9 w-full border border-gray-200 bg-gray-50 px-3 text-[13px] text-gray-950 outline-none transition-colors placeholder:text-gray-400 focus:border-gray-950 focus:bg-white"
								/>
							</ModalField>
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
								disabled={!merchant.trim() || !amountStr.trim() || submitting}
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

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5">
			<label className="text-[11px] font-medium uppercase tracking-label text-gray-500">{label}</label>
			{children}
		</div>
	);
}
