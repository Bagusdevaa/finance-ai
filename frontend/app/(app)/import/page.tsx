"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useSidebar } from "@/components/layout/Sidebar";
import { getErrorMessage } from "@/lib/api";
import { uploadImport } from "@/lib/api/import";
import { listAccounts } from "@/lib/api/accounts";
import { AccountSelect } from "./_components/AccountSelect";
import { Dropzone } from "./_components/Dropzone";
import { ExportTips } from "./_components/ExportTips";
import { JobsHistorySidebar } from "./_components/JobsHistorySidebar";
import { JobReviewPanel } from "./_components/JobReviewPanel";

function MobileMenuButton() {
	const { setMobileOpen } = useSidebar();
	return (
		<button
			type="button"
			onClick={() => setMobileOpen(true)}
			aria-label="Buka menu"
			className="mr-2 grid h-9 w-9 place-items-center rounded-lg text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-950 md:hidden"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>
	);
}

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;
const fadeVariants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeDesignhub } },
	exit: { opacity: 0, transition: { duration: 0.15 } },
};

export default function ImportPage() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const searchParams = useSearchParams();

	const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
	const [activeJobId, setActiveJobIdState] = useState<string | null>(null);
	const [uploadErrors, setUploadErrors] = useState<{ name: string; reason: string }[]>([]);
	const [confirmedToast, setConfirmedToast] = useState<{ created: number; existed: number } | null>(null);

	// Sync activeJobId with URL ?job= param
	useEffect(() => {
		const jobParam = searchParams.get("job");
		setActiveJobIdState(jobParam || null);
	}, [searchParams]);

	const setActiveJobId = (id: string | null) => {
		const url = new URL(window.location.href);
		if (id) {
			url.searchParams.set("job", id);
		} else {
			url.searchParams.delete("job");
		}
		router.replace(url.pathname + url.search);
	};

	// Fetch accounts to resolve selected account name for tips
	const { data: accounts } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});
	const selectedAccountName = useMemo(() => {
		if (!selectedAccountId) return null;
		return accounts?.find((a) => a.id === selectedAccountId)?.name ?? null;
	}, [accounts, selectedAccountId]);

	const uploadMutation = useMutation({
		mutationFn: uploadImport,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
		},
		onError: (err) => {
			setUploadErrors((prev) => [...prev, { name: "Upload", reason: getErrorMessage(err, "Upload gagal.") }]);
		},
	});

	const handleFilesAccepted = (files: File[]) => {
		setUploadErrors([]);
		for (const file of files) {
			uploadMutation.mutate({
				file,
				source_type: "manual_csv", // sentinel — backend dispatcher ignores
				account_id: selectedAccountId ?? undefined,
			});
		}
	};

	const handleRejection = (rejections: { name: string; reason: string }[]) => {
		setUploadErrors((prev) => [...prev, ...rejections]);
	};

	const handleJobConfirmed = (result: { created: number; existed: number }) => {
		setConfirmedToast(result);
		setActiveJobId(null);
		// Auto-dismiss toast after 4s
		setTimeout(() => setConfirmedToast(null), 4000);
	};

	return (
		<>
			{/* Header */}
			<header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white/85 px-4 backdrop-blur-[14px] md:px-8">
				<div className="flex items-center">
					<MobileMenuButton />
					<h1 className="m-0 font-serif text-[24px] font-normal tracking-tight2 text-gray-950">
						Import <em className="italic text-gray-700">Data</em>
					</h1>
				</div>
				<a
					href="https://github.com/anthropics/claude-code/issues"
					target="_blank"
					rel="noopener"
					className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-gray-300 px-3.5 text-[13px] text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
				>
					<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
					Bantuan
				</a>
			</header>

			{/* Toast: confirmed result */}
			<AnimatePresence>
				{confirmedToast && (
					<motion.div
						initial={{ opacity: 0, y: -10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-md border border-green-500 bg-green-50 px-5 py-3 text-[13px] text-green-900 shadow-sm"
					>
						{confirmedToast.created} transaksi baru disimpan
						{confirmedToast.existed > 0 && ` · ${confirmedToast.existed} duplikat dilewati`}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Main grid */}
			<div className="max-w-[1100px] grid grid-cols-1 gap-8 p-4 md:p-8 md:grid-cols-[1fr_280px]">
				{/* Left main column */}
				<section className="min-w-0">
					<AnimatePresence mode="wait">
						{activeJobId ? (
							<motion.div key="review" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
								<JobReviewPanel
									jobId={activeJobId}
									onClose={() => setActiveJobId(null)}
									onConfirmed={handleJobConfirmed}
								/>
							</motion.div>
						) : (
							<motion.div key="dropzone" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
								<h2 className="mb-1.5 font-serif text-[28px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
									Drop file <em className="italic text-gray-700">apapun</em>
								</h2>
								<p className="mb-6 max-w-[580px] text-sm text-gray-500">
									Backend auto-detect format & route. PDF mutasi, screenshot e-wallet, CSV export — semua langsung jalan.
								</p>

								<div className="mb-5">
									<AccountSelect value={selectedAccountId} onChange={setSelectedAccountId} />
								</div>

								<Dropzone
									onFilesAccepted={handleFilesAccepted}
									onRejection={handleRejection}
								/>

								{uploadErrors.length > 0 && (
									<div className="mt-3 space-y-1.5">
										{uploadErrors.map((err, i) => (
											<div key={i} className="border border-[#dc2626] bg-[#fdf6f6] px-3 py-2 text-[12px] text-[#dc2626]">
												<strong className="font-medium">{err.name}:</strong> {err.reason}
											</div>
										))}
									</div>
								)}

								<div className="mt-6">
									<ExportTips accountName={selectedAccountName} />
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</section>

				{/* Right sidebar */}
				<div className="md:sticky md:top-20 md:self-start">
					<JobsHistorySidebar
						activeJobId={activeJobId}
						onJobClick={setActiveJobId}
					/>
				</div>
			</div>
		</>
	);
}
