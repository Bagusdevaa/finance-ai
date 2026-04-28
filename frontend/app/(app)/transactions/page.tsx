"use client";

import { motion } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { dummyTransactions, type DummyTransactionFull } from "@/lib/dummy-data";
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

// Filter pills — UI only (logic belum di scope phase ini).
const accountFilters = ["Semua Akun", "BCA", "Mandiri", "GoPay", "OVO", "Stockbit", "Bibit"];
const categoryFilters = [
	"Semua Kategori",
	"Pemasukan",
	"Makan & Minum",
	"Belanja",
	"Transportasi",
	"Tagihan",
	"Investasi",
	"Hiburan",
];
const dateRanges = ["April 2026", "Maret 2026", "30 hari terakhir", "Custom"];

export default function TransactionsPage() {
	const columns: DataTableColumn<DummyTransactionFull>[] = [
		{
			key: "date",
			header: "Tanggal",
			width: "120px",
			render: (row) => <DateCell date={row.date} />,
		},
		{
			key: "description",
			header: "Deskripsi",
			render: (row) => (
				<div className="flex flex-col gap-0.5">
					<span className="text-sm font-medium text-black">{row.description}</span>
					<span className="text-xs text-gray-500">{row.merchant_name}</span>
				</div>
			),
		},
		{
			key: "account",
			header: "Akun",
			width: "120px",
			render: (row) => (
				<span className="text-xs text-gray-600">{row.account}</span>
			),
		},
		{
			key: "category",
			header: "Kategori",
			width: "160px",
			render: (row) => <Badge variant="default">{row.category}</Badge>,
		},
		{
			key: "confidence",
			header: "Keyakinan",
			width: "120px",
			render: (row) => <ConfidenceCell score={row.confidence_score} />,
		},
		{
			key: "amount",
			header: "Jumlah",
			align: "right",
			width: "180px",
			render: (row) => <AmountCell amount={row.amount} />,
		},
	];

	return (
		<>
			<Header
				title="Transaksi"
				subtitle="Semua aktivitas keuangan, dari semua akun"
				actions={
					<Button
						variant="primary"
						size="sm"
						onClick={() => {
							/* TODO: open add-transaction modal */
						}}
					>
						<Plus className="h-4 w-4" strokeWidth={1.5} />
						Tambah Transaksi
					</Button>
				}
			/>

			<motion.div
				className="flex flex-col gap-6 px-8 py-8"
				variants={containerVariants}
				initial="hidden"
				animate="show"
			>
				<motion.section variants={itemVariants} className="flex flex-col gap-4">
					<SearchBar />
					<FilterBar />
				</motion.section>

				<motion.section variants={itemVariants}>
					<DataTable<DummyTransactionFull>
						columns={columns}
						data={dummyTransactions}
						getRowKey={(row) => row.id}
						emptyState={<TransactionsEmptyState />}
					/>
				</motion.section>

				<motion.section
					variants={itemVariants}
					className="flex items-center justify-between text-xs text-gray-500"
				>
					<span>
						Menampilkan{" "}
						<span className="font-mono text-black">{dummyTransactions.length}</span> transaksi
					</span>
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm" disabled>
							← Sebelumnya
						</Button>
						<Button variant="ghost" size="sm" disabled>
							Selanjutnya →
						</Button>
					</div>
				</motion.section>
			</motion.div>
		</>
	);
}

function SearchBar() {
	return (
		<label className="relative flex h-10 w-full max-w-md items-center">
			<Search
				className="pointer-events-none absolute left-3 h-4 w-4 text-gray-400"
				strokeWidth={1.5}
			/>
			<input
				type="search"
				placeholder="Cari merchant, deskripsi, atau jumlah..."
				className={cn(
					"h-10 w-full rounded border border-gray-300 bg-white pl-9 pr-3 text-sm text-black",
					"placeholder:text-gray-400",
					"transition-colors duration-150 ease-out",
					"focus:border-black focus:outline-none",
				)}
			/>
		</label>
	);
}

function FilterBar() {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<FilterPillGroup label="Akun" options={accountFilters} />
			<span aria-hidden="true" className="h-5 w-px bg-gray-200" />
			<FilterPillGroup label="Kategori" options={categoryFilters} />
			<span aria-hidden="true" className="h-5 w-px bg-gray-200" />
			<FilterPillGroup label="Periode" options={dateRanges} />
		</div>
	);
}

function FilterPillGroup({ label, options }: { label: string; options: string[] }) {
	// Default ke option pertama (UI only — nggak ada state management).
	const active = options[0];
	return (
		<div className="flex items-center gap-1.5">
			<span className="text-[11px] font-medium uppercase tracking-label text-gray-500">
				{label}:
			</span>
			<button
				type="button"
				className={cn(
					"flex h-7 items-center gap-1.5 rounded border border-gray-300 bg-white px-2.5",
					"text-xs text-black",
					"transition-colors duration-150 ease-out hover:border-black",
				)}
			>
				<span>{active}</span>
				<span aria-hidden="true" className="text-gray-400">
					▾
				</span>
			</button>
		</div>
	);
}

function DateCell({ date }: { date: string }) {
	const formatted = new Intl.DateTimeFormat("id-ID", {
		day: "numeric",
		month: "short",
		year: "2-digit",
	}).format(new Date(date));
	return <span className="font-mono text-xs text-gray-600">{formatted}</span>;
}

function AmountCell({ amount }: { amount: number }) {
	const isPositive = amount > 0;
	const isNegative = amount < 0;
	return (
		<span
			className={cn(
				"font-mono text-sm font-medium",
				isPositive && "text-emerald-700",
				isNegative && "text-red-700",
				!isPositive && !isNegative && "text-black",
			)}
		>
			{isPositive ? "+" : ""}
			{formatRupiah(amount)}
		</span>
	);
}

function ConfidenceCell({ score }: { score: number }) {
	if (score >= 1.0) {
		return <span className="text-xs text-gray-400">—</span>;
	}

	const variant = score >= 0.8 ? "success" : score >= 0.5 ? "warning" : "danger";
	const percent = Math.round(score * 100);

	return (
		<Badge size="sm" variant={variant}>
			{percent}%
		</Badge>
	);
}

function TransactionsEmptyState() {
	return (
		<div className="flex flex-col items-center gap-3 py-8">
			<span className="font-serif text-3xl text-gray-300">—</span>
			<div className="flex flex-col items-center gap-1">
				<span className="text-sm font-medium text-black">Tidak ada transaksi</span>
				<span className="text-xs text-gray-500">
					Coba ubah filter atau import data dari rekening kamu.
				</span>
			</div>
			<Button variant="secondary" size="sm">
				Import Data
			</Button>
		</div>
	);
}
