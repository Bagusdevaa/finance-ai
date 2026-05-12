"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
	getImportJob,
	updateImportRow,
	excludeImportRow,
	confirmImportJob,
	cancelImportJob,
} from "@/lib/api/import";
import type { ImportJobDetailResponse, ImportRowResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const CATEGORIES = [
	"Makanan",
	"Transportasi",
	"Belanja",
	"Tagihan",
	"Hiburan",
	"Transfer",
	"Pendapatan",
	"Investasi",
	"Kesehatan",
	"Lainnya",
];

type ConfBucket = "ok" | "warn" | "err";

function bucketConfidence(score: string | number | null | undefined): ConfBucket {
	const n = typeof score === "string" ? parseFloat(score) : (score ?? 0);
	if (!Number.isFinite(n)) return "err";
	if (n >= 0.8) return "ok";
	if (n >= 0.5) return "warn";
	return "err";
}

function fmtRp(amountStr: string): string {
	const n = parseFloat(amountStr) || 0;
	const abs = Math.abs(n).toLocaleString("id-ID");
	return (n >= 0 ? "+Rp " : "−Rp ") + abs;
}

function formatShortDate(iso: string): string {
	try {
		return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(iso));
	} catch {
		return iso;
	}
}

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;
const fadeVariants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeDesignhub } },
	exit: { opacity: 0, transition: { duration: 0.15 } },
};

interface JobReviewPanelProps {
	jobId: string;
	onClose: () => void;
	onConfirmed: (result: { created: number; existed: number }) => void;
}

export function JobReviewPanel({ jobId, onClose, onConfirmed }: JobReviewPanelProps) {
	const queryClient = useQueryClient();
	const [reviewFilter, setReviewFilter] = useState<"all" | ConfBucket>("all");
	const [editingCell, setEditingCell] = useState<
		{ rowId: string; field: "merchant_name" | "category" } | null
	>(null);

	const { data: job } = useQuery<ImportJobDetailResponse>({
		queryKey: ["import-job", jobId],
		queryFn: () => getImportJob(jobId),
		refetchInterval: (q) => {
			const status = q.state.data?.status;
			if (
				status === "review" ||
				status === "confirmed" ||
				status === "failed" ||
				status === "cancelled"
			) {
				return false;
			}
			return 1500;
		},
	});

	const updateRowMutation = useMutation({
		mutationFn: (args: { rowId: string; data: Parameters<typeof updateImportRow>[2] }) =>
			updateImportRow(jobId, args.rowId, args.data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
		},
	});

	const excludeRowMutation = useMutation({
		mutationFn: (rowId: string) => excludeImportRow(jobId, rowId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
		},
	});

	const confirmMutation = useMutation({
		mutationFn: () => confirmImportJob(jobId),
		onSuccess: (r) => {
			queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
			onConfirmed({ created: r.transactions_created, existed: r.already_existed });
		},
	});

	const cancelMutation = useMutation({
		mutationFn: () => cancelImportJob(jobId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
			onClose();
		},
	});

	const handleCellEdit = (
		row: ImportRowResponse,
		field: "merchant_name" | "category",
		value: string,
	) => {
		updateRowMutation.mutate({ rowId: row.id, data: { [field]: value } });
		setEditingCell(null);
	};

	if (!job) {
		return (
			<div className="py-10 text-center text-[13px] text-gray-400">Memuat job...</div>
		);
	}

	const items = job.items ?? [];
	const filteredRows =
		reviewFilter === "all"
			? items
			: items.filter((r) => bucketConfidence(r.confidence_score) === reviewFilter);

	const okCount = job.rows_ok ?? 0;
	const warnCount = job.rows_warn ?? 0;
	const errCount = job.rows_err ?? 0;
	const totalRows = job.rows_total ?? 0;
	const includedRows = items.filter((r) => !r.is_excluded).length;

	const isProcessing = job.status === "pending" || job.status === "processing";
	const isFailed = job.status === "failed";
	const isReview = job.status === "review";
	const isDone = job.status === "confirmed";

	return (
		<motion.div variants={fadeVariants} initial="hidden" animate="show" exit="exit">
			<button
				type="button"
				onClick={onClose}
				className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-950"
			>
				<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="15 18 9 12 15 6" />
				</svg>
				Kembali ke dropzone
			</button>

			<h2 className="mb-1.5 font-serif text-[28px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
				Review <em className="italic text-gray-700">{job.file_name}</em>
			</h2>
			<p className="mb-7 max-w-[580px] text-sm text-gray-500">
				{isProcessing && "AI sedang membaca file kamu..."}
				{isFailed && (job.error_message || "Gagal memproses file.")}
				{isReview && (
					<>
						AI menemukan <strong className="text-gray-950">{totalRows} transaksi</strong>. Verifikasi sebelum simpan. Klik cell untuk edit.
					</>
				)}
				{isDone && (
					<>Job sudah dikonfirmasi. Lihat hasilnya di <a href="/transactions" className="underline">Transactions</a>.</>
				)}
			</p>

			{isProcessing && (
				<div className="border border-gray-200 p-6">
					<div className="flex items-center gap-3 text-[13px] text-gray-700">
						<span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-950" />
						{job.status === "pending" ? "Menunggu antrian..." : "Memproses & klasifikasi AI..."}
					</div>
				</div>
			)}

			{isFailed && (
				<div className="border border-[#dc2626] bg-[#fdf6f6] p-6">
					<div className="mb-2 text-[13px] font-medium text-[#dc2626]">Gagal memproses</div>
					<div className="text-[13px] text-gray-700">
						{job.error_message || "Format file tidak dikenali atau parser error."}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="mt-4 inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
					>
						Tutup
					</button>
				</div>
			)}

			{(isReview || isDone) && (
				<>
					{/* Summary cards */}
					<div className="mb-6 grid grid-cols-3 border border-gray-200 max-[1100px]:grid-cols-1">
						<div className="border-r border-gray-200 px-[22px] py-5 max-[1100px]:border-b max-[1100px]:border-r-0">
							<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">Transaksi</div>
							<div className="mt-1.5 font-serif text-[32px] font-light leading-[1.1] tracking-tight2 text-gray-950">{totalRows}</div>
							<div className="mt-1 text-xs text-gray-500">{includedRows} disertakan</div>
						</div>
						<div className="border-r border-gray-200 px-[22px] py-5 max-[1100px]:border-b max-[1100px]:border-r-0">
							<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">Confidence Tinggi</div>
							<div className="mt-1.5 font-mono text-2xl font-medium tabular-nums tracking-tight2 text-gray-950">{okCount}</div>
							<div className="mt-1 text-xs text-gray-500">≥ 80% akurat</div>
						</div>
						<div className="px-[22px] py-5">
							<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">Perlu Perhatian</div>
							<div className="mt-1.5 font-mono text-2xl font-medium tabular-nums tracking-tight2 text-gray-950">{warnCount + errCount}</div>
							<div className="mt-1 text-xs text-gray-500">{warnCount} ragu · {errCount} error</div>
						</div>
					</div>

					{/* Filter pills */}
					<div className="mb-2 flex flex-wrap items-center justify-between gap-3">
						<div className="flex gap-1.5">
							{([
								["all", "Semua", String(totalRows), ""] as const,
								["ok", "Tinggi", String(okCount), "#16a34a"] as const,
								["warn", "Ragu", String(warnCount), "#d97706"] as const,
								["err", "Error", String(errCount), "#dc2626"] as const,
							]).map(([key, label, count, color]) => (
								<button
									key={key}
									type="button"
									onClick={() => setReviewFilter(key)}
									className={cn(
										"inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-[border-color,color,background-color] duration-200",
										reviewFilter === key
											? "border-gray-950 bg-gray-950 text-white"
											: "border-gray-200 text-gray-600 hover:border-gray-950 hover:text-gray-950",
									)}
								>
									{color && <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
									{label} <span className="font-mono text-[11px]">{count}</span>
								</button>
							))}
						</div>
						<div className="font-mono text-xs text-gray-400">
							Menampilkan {filteredRows.length} dari {totalRows}
						</div>
					</div>

					{/* Review table */}
					<div className="max-h-[520px] overflow-auto border border-gray-200 bg-white">
						<table className="w-full min-w-[840px] border-collapse text-[13px]">
							<thead>
								<tr>
									<th className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Tanggal</th>
									<th className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Merchant</th>
									<th className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Kategori</th>
									<th className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-right text-[10px] font-medium uppercase tracking-label text-gray-400">Jumlah</th>
									<th className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-left text-[10px] font-medium uppercase tracking-label text-gray-400">Confidence</th>
									<th className="sticky top-0 z-[1] border-b border-gray-200 bg-gray-50 px-3.5 py-3 text-right text-[10px] font-medium uppercase tracking-label text-gray-400"></th>
								</tr>
							</thead>
							<tbody>
								{filteredRows.map((row) => {
									const conf = bucketConfidence(row.confidence_score);
									return (
										<tr
											key={row.id}
											className={cn(
												"border-b border-gray-100 last:border-b-0",
												conf === "warn" && "bg-[#fcfaf6]",
												conf === "err" && "bg-[#fdf6f6]",
												row.is_excluded && "opacity-40",
											)}
										>
											<td className="px-3.5 py-2.5">
												<span className="whitespace-nowrap font-mono text-xs text-gray-700">{formatShortDate(row.transaction_date)}</span>
											</td>
											<td className="px-3.5 py-2.5">
												{editingCell?.rowId === row.id && editingCell.field === "merchant_name" ? (
													<input
														type="text"
														defaultValue={row.merchant_name ?? ""}
														autoFocus
														className="w-full rounded border border-gray-950 bg-white px-2 py-1 text-[13px] text-gray-950 outline-none"
														onBlur={(e) => handleCellEdit(row, "merchant_name", e.target.value)}
														onKeyDown={(e) => {
															if (e.key === "Enter") handleCellEdit(row, "merchant_name", (e.target as HTMLInputElement).value);
															if (e.key === "Escape") setEditingCell(null);
														}}
													/>
												) : (
													<span
														onClick={() => !isDone && setEditingCell({ rowId: row.id, field: "merchant_name" })}
														className={cn("text-gray-950", !isDone && "cursor-text hover:bg-gray-50")}
													>
														{row.merchant_name || <span className="text-gray-400">(kosong)</span>}
													</span>
												)}
											</td>
											<td className="px-3.5 py-2.5">
												{editingCell?.rowId === row.id && editingCell.field === "category" ? (
													<select
														defaultValue={row.category ?? ""}
														autoFocus
														className="w-full rounded border border-gray-950 bg-white px-2 py-1 text-[13px] text-gray-950 outline-none"
														onBlur={(e) => handleCellEdit(row, "category", e.target.value)}
														onChange={(e) => handleCellEdit(row, "category", e.target.value)}
													>
														<option value="">— Pilih —</option>
														{CATEGORIES.map((c) => (
															<option key={c} value={c}>{c}</option>
														))}
													</select>
												) : (
													<span
														onClick={() => !isDone && setEditingCell({ rowId: row.id, field: "category" })}
														className={cn("text-gray-700", !isDone && "cursor-text hover:bg-gray-50")}
													>
														{row.category || <span className="text-gray-400">(kosong)</span>}
													</span>
												)}
											</td>
											<td className="px-3.5 py-2.5 text-right">
												<span className="font-mono tabular-nums text-gray-950">{fmtRp(row.amount)}</span>
											</td>
											<td className="px-3.5 py-2.5">
												<span className="font-mono text-[11px] text-gray-500">{Number(row.confidence_score).toFixed(2)}</span>
											</td>
											<td className="px-3.5 py-2.5 text-right">
												{!isDone && (
													<button
														type="button"
														onClick={() => excludeRowMutation.mutate(row.id)}
														className="text-[11px] text-gray-400 hover:text-gray-950"
														disabled={excludeRowMutation.isPending}
													>
														{row.is_excluded ? "Aktifkan" : "Kecualikan"}
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{isReview && (
						<div className="mt-5 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => confirmMutation.mutate()}
								disabled={confirmMutation.isPending || includedRows === 0}
								className="inline-flex h-10 items-center rounded-md bg-gray-950 px-5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{confirmMutation.isPending ? "Menyimpan..." : `Konfirmasi & Simpan ${includedRows} transaksi`}
							</button>
							<button
								type="button"
								onClick={() => cancelMutation.mutate()}
								disabled={cancelMutation.isPending}
								className="inline-flex h-10 items-center rounded-md border border-gray-300 px-5 text-[13px] font-medium text-gray-700 transition-colors duration-200 hover:border-gray-950 hover:text-gray-950"
							>
								Batal
							</button>
						</div>
					)}
				</>
			)}
		</motion.div>
	);
}
