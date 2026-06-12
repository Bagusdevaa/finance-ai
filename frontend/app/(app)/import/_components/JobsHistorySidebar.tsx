"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { listImportJobs } from "@/lib/api/import";
import type { ImportJobResponse, ImportJobStatus } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const STATUS_BADGE: Record<ImportJobStatus, { label: string; className: string }> = {
	pending: { label: "Proses", className: "bg-amber-100 text-amber-800" },
	processing: { label: "Proses", className: "bg-amber-100 text-amber-800" },
	review: { label: "Review", className: "bg-blue-100 text-blue-800" },
	confirmed: { label: "Done", className: "bg-green-100 text-green-800" },
	cancelled: { label: "Batal", className: "bg-gray-100 text-gray-600" },
	failed: { label: "Gagal", className: "bg-red-100 text-red-800" },
};

interface JobsHistorySidebarProps {
	activeJobId: string | null;
	onJobClick: (jobId: string) => void;
}

function timeAgo(iso: string): string {
	const date = new Date(iso);
	const diffMs = Date.now() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	if (diffMin < 1) return "baru saja";
	if (diffMin < 60) return `${diffMin} mnt lalu`;
	const diffHour = Math.floor(diffMin / 60);
	if (diffHour < 24) return `${diffHour} jam lalu`;
	const diffDay = Math.floor(diffHour / 24);
	if (diffDay < 7) return `${diffDay} hari lalu`;
	return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function isClickable(status: ImportJobStatus): boolean {
	return status === "review" || status === "confirmed" || status === "failed";
}

export function JobsHistorySidebar({ activeJobId, onJobClick }: JobsHistorySidebarProps) {
	const { data: jobs } = useQuery({
		queryKey: ["import-jobs"],
		queryFn: listImportJobs,
		refetchInterval: (query) => {
			const list = query.state.data as ImportJobResponse[] | undefined;
			if (!list) return 2000;
			const anyInProgress = list.some(
				(j) => j.status === "pending" || j.status === "processing",
			);
			return anyInProgress ? 2000 : false;
		},
	});

	const visibleJobs = (jobs ?? []).filter((j) => {
		// Hide confirmed/cancelled older than 7 days
		if (j.status === "confirmed" || j.status === "cancelled") {
			const ageMs = Date.now() - new Date(j.created_at).getTime();
			if (ageMs > 7 * 24 * 60 * 60 * 1000) return false;
		}
		return true;
	});

	return (
		<aside className="min-w-0">
			<h2 className="mb-3 text-[11px] font-medium uppercase tracking-label text-gray-500">
				Riwayat import {visibleJobs.length > 0 && <span className="text-gray-400">({visibleJobs.length})</span>}
			</h2>

			{visibleJobs.length === 0 ? (
				<div className="border border-dashed border-gray-200 px-4 py-7 text-center text-[12px] text-gray-400">
					Belum ada import. Drop file di sebelah kiri untuk mulai.
				</div>
			) : (
				<div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
					<div className="space-y-1.5">
						<AnimatePresence initial={false}>
							{visibleJobs.map((job) => {
							const badge = STATUS_BADGE[job.status];
							const clickable = isClickable(job.status);
							const isActive = activeJobId === job.id;
							return (
								<motion.button
									key={job.id}
									type="button"
									layout
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
									transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
									onClick={() => clickable && onJobClick(job.id)}
									disabled={!clickable}
									className={cn(
										"w-full border bg-white px-3 py-2.5 text-left transition-[border-color,background-color] duration-200",
										isActive
											? "border-gray-950 bg-gray-50"
											: "border-gray-200",
										clickable && !isActive && "hover:border-gray-700 hover:bg-gray-50",
										!clickable && "cursor-not-allowed",
									)}
								>
									<div className="flex items-center justify-between gap-2">
										<span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-950">
											{job.file_name}
										</span>
										<span className={cn(
											"shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.05em]",
											badge.className,
										)}>
											{badge.label}
										</span>
									</div>
									<div className="mt-1 font-mono text-[10px] text-gray-400">
										{job.rows_total > 0 ? `${job.rows_total} rows · ` : ""}
										{timeAgo(job.created_at)}
									</div>
									{(job.status === "pending" || job.status === "processing") && (
										<div className="mt-2 h-[2px] w-full overflow-hidden bg-gray-100">
											<div className="h-full w-1/2 animate-pulse bg-gray-950" />
										</div>
									)}
								</motion.button>
							);
						})}
						</AnimatePresence>
					</div>
				</div>
			)}
		</aside>
	);
}
