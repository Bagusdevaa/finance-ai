"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/api";
import {
	uploadImport,
	getImportJob,
	updateImportRow,
	excludeImportRow,
	confirmImportJob,
} from "@/lib/api/import";
import type {
	ImportJobDetailResponse,
	ImportRowResponse,
	ImportSourceType,
} from "@/lib/api/types";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

interface SourceInstructions {
	title: string;
	steps: string[];
}

interface SourceGroupItem {
	id: string;
	name: string;
	logo: string;
	fmt: string;
	group: string;
	disabled?: boolean;
	sourceType: ImportSourceType;
}

// Maps the visual source list to backend source_type. Most are real parsers
// that may still raise NotImplementedError on the backend; manual_csv is the
// one currently fully supported.
const SOURCE_GROUPS: { label: string; items: SourceGroupItem[]; addLabel?: string }[] = [
	{
		label: "Rekening Bank",
		items: [
			{ id: "bca", name: "BCA", logo: "B", fmt: "PDF", group: "bank", sourceType: "pdf_bca" },
			{ id: "mandiri", name: "Mandiri", logo: "M", fmt: "PDF", group: "bank", sourceType: "pdf_mandiri" },
			{ id: "bri", name: "BRI", logo: "R", fmt: "PDF", group: "bank", sourceType: "pdf_bri" },
			{ id: "bni", name: "BNI", logo: "N", fmt: "PDF", group: "bank", sourceType: "pdf_bca", disabled: true },
		],
		addLabel: "Tambah Bank Lain",
	},
	{
		label: "E-Wallet",
		items: [
			{ id: "gopay", name: "GoPay", logo: "G", fmt: "IMG", group: "ewallet", sourceType: "image_vision" },
			{ id: "ovo", name: "OVO", logo: "O", fmt: "IMG", group: "ewallet", sourceType: "image_vision" },
			{ id: "dana", name: "Dana", logo: "D", fmt: "IMG", group: "ewallet", sourceType: "image_vision" },
			{ id: "shopeepay", name: "ShopeePay", logo: "S", fmt: "", group: "ewallet", disabled: true, sourceType: "image_vision" },
		],
	},
	{
		label: "Investasi",
		items: [
			{ id: "bibit", name: "Bibit", logo: "b", fmt: "CSV", group: "invest", sourceType: "csv_bibit" },
			{ id: "stockbit", name: "Stockbit", logo: "S", fmt: "IMG", group: "invest", sourceType: "image_vision" },
			{ id: "ipot", name: "IPOT", logo: "I", fmt: "CSV", group: "invest", sourceType: "csv_ipot" },
			{ id: "pluang", name: "Pluang", logo: "P", fmt: "IMG", group: "invest", sourceType: "image_vision" },
		],
		addLabel: "Tambah Platform",
	},
	{
		label: "Lainnya",
		items: [
			{ id: "csv", name: "Upload CSV", logo: "C", fmt: "CSV", group: "other", sourceType: "manual_csv" },
		],
	},
];

const SOURCE_INSTRUCTIONS: Record<string, SourceInstructions> = {
	bca: { title: "BCA", steps: ["Buka aplikasi BCA mobile dan masuk ke menu Info Saldo & Mutasi.", "Pilih rentang tanggal yang ingin di-import (maksimal 3 bulan terakhir).", "Tap Kirim ke Email, pilih format PDF.", "Buka email kamu, unduh attachment-nya, lalu upload di bawah ini."] },
	mandiri: { title: "Mandiri", steps: ["Login ke Livin' by Mandiri.", "Buka e-Statement, pilih bulan yang ingin di-import.", "Download PDF, lalu upload di bawah."] },
	bri: { title: "BRI", steps: ["Buka BRImo, masuk ke Mutasi, pilih periode, kirim ke email PDF.", "Upload file PDF di bawah."] },
	bni: { title: "BNI", steps: ["Buka wondr by BNI, menu Mutasi Rekening, ekspor PDF.", "Upload file PDF di bawah."] },
	gopay: { title: "GoPay", steps: ["Buka aplikasi Gojek, ke GoPay, tap Riwayat.", "Screenshot riwayat transaksi (multi-page OK).", "Upload screenshot di bawah — AI akan baca semuanya."] },
	ovo: { title: "OVO", steps: ["Buka OVO, menu History.", "Screenshot tampilan riwayat (multiple OK).", "Upload screenshot di bawah — AI akan baca semuanya."] },
	dana: { title: "Dana", steps: ["Buka DANA, menu History.", "Screenshot tampilan riwayat.", "Upload screenshot di bawah."] },
	bibit: { title: "Bibit", steps: ["Buka Bibit, menu Portofolio.", "Export CSV transaksi (Pengaturan → Export Data).", "Upload file CSV di bawah."] },
	stockbit: { title: "Stockbit", steps: ["Buka Stockbit, masuk ke tab Portfolio.", "Screenshot tampilan holdings (1 layar = 1 file).", "Upload semua screenshot di bawah."] },
	ipot: { title: "IPOT", steps: ["Login IPOT (web), menu Portfolio → Export.", "Pilih format CSV.", "Upload CSV di bawah."] },
	pluang: { title: "Pluang", steps: ["Buka Pluang, menu Portofolio.", "Screenshot tampilan emas / kripto kamu.", "Upload screenshot di bawah."] },
	csv: { title: "CSV Custom", steps: ["Format CSV harus berisi minimal kolom: tanggal, deskripsi, jumlah.", "Tanggal: format YYYY-MM-DD. Jumlah: angka, negatif untuk pengeluaran.", "Upload CSV-nya di bawah — AI akan otomatis kategorikan."] },
};

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

const BANK_PILLS = ["BCA", "Mandiri", "BRI"];

const STEPS = ["Upload", "Proses", "Review", "Selesai"];

function fmtRp(amountStr: string): string {
	const n = parseFloat(amountStr) || 0;
	const abs = Math.abs(n).toLocaleString("id-ID");
	return (n >= 0 ? "+Rp " : "−Rp ") + abs;
}

function formatShortDate(iso: string): string {
	try {
		return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(
			new Date(iso),
		);
	} catch {
		return iso;
	}
}

type ConfBucket = "ok" | "warn" | "err";

function bucketConfidence(score: string | number | null | undefined): ConfBucket {
	const n = typeof score === "string" ? parseFloat(score) : (score ?? 0);
	if (!Number.isFinite(n)) return "err";
	if (n >= 0.8) return "ok";
	if (n >= 0.5) return "warn";
	return "err";
}

const fadeVariants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeDesignhub } },
	exit: { opacity: 0, transition: { duration: 0.15 } },
};

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

export default function ImportPage() {
	const router = useRouter();
	const queryClient = useQueryClient();

	const [activeSource, setActiveSource] = useState("bca");
	const [searchQuery, setSearchQuery] = useState("");
	const [mobileShowContent, setMobileShowContent] = useState(false);
	const [currentStep, setCurrentStep] = useState(1);
	const [activePill, setActivePill] = useState("BCA");
	const [dragOver, setDragOver] = useState(false);
	const [pendingFile, setPendingFile] = useState<File | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [activeJobId, setActiveJobId] = useState<string | null>(null);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const [confirmResult, setConfirmResult] = useState<{ created: number; existed: number } | null>(null);

	const [reviewFilter, setReviewFilter] = useState<"all" | ConfBucket>("all");
	const [editingCell, setEditingCell] = useState<{ rowId: string; field: "merchant_name" | "category" } | null>(null);

	const allSourceItems = useMemo(() => SOURCE_GROUPS.flatMap((g) => g.items), []);

	const goStep = useCallback((n: number) => {
		setCurrentStep(n);
	}, []);

	// Poll job until processing finishes.
	const { data: job } = useQuery<ImportJobDetailResponse>({
		queryKey: ["import-job", activeJobId],
		queryFn: () => getImportJob(activeJobId!),
		enabled: !!activeJobId,
		refetchInterval: (q) => {
			const status = q.state.data?.status;
			if (status === "review" || status === "failed" || status === "confirmed" || status === "cancelled") {
				return false;
			}
			return 1500;
		},
	});

	// Auto-advance from processing → review when backend finishes.
	useEffect(() => {
		if (job && currentStep === 2 && job.status === "review") {
			setCurrentStep(3);
		}
	}, [job, currentStep]);

	const uploadMutation = useMutation({
		mutationFn: uploadImport,
		onSuccess: (j) => {
			setActiveJobId(j.id);
			setUploadError(null);
			goStep(2);
		},
		onError: (err) => {
			setUploadError(getErrorMessage(err, "Upload gagal."));
		},
	});

	const updateRowMutation = useMutation({
		mutationFn: (args: { rowId: string; data: Parameters<typeof updateImportRow>[2] }) =>
			updateImportRow(activeJobId!, args.rowId, args.data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-job", activeJobId] });
		},
	});

	const excludeRowMutation = useMutation({
		mutationFn: (rowId: string) => excludeImportRow(activeJobId!, rowId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-job", activeJobId] });
		},
	});

	const confirmMutation = useMutation({
		mutationFn: () => confirmImportJob(activeJobId!),
		onSuccess: (r) => {
			setConfirmResult({ created: r.transactions_created, existed: r.already_existed });
			goStep(4);
		},
	});

	const handleFile = (file: File) => {
		const item = allSourceItems.find((i) => i.id === activeSource);
		if (!item) return;
		setPendingFile(file);
		setUploadError(null);
		uploadMutation.mutate({ file, source_type: item.sourceType });
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setDragOver(false);
		const f = e.dataTransfer.files[0];
		if (f) handleFile(f);
	};

	const handleSourceClick = (id: string) => {
		setActiveSource(id);
		setMobileShowContent(true);
		// Reset wizard state when switching sources from the start.
		setActiveJobId(null);
		setPendingFile(null);
		setConfirmResult(null);
		setUploadError(null);
		goStep(1);
	};

	const handlePillClick = (bank: string) => {
		setActivePill(bank);
		const found = allSourceItems.find((i) => i.name.toLowerCase().includes(bank.toLowerCase()));
		if (found && !found.disabled) {
			setActiveSource(found.id);
		}
	};

	const restartWizard = () => {
		setActiveJobId(null);
		setPendingFile(null);
		setConfirmResult(null);
		setUploadError(null);
		goStep(1);
	};

	const instructions = SOURCE_INSTRUCTIONS[activeSource];
	const items = job?.items ?? [];
	const filteredRows = reviewFilter === "all"
		? items
		: items.filter((r) => bucketConfidence(r.confidence_score) === reviewFilter);

	const okCount = job?.rows_ok ?? 0;
	const warnCount = job?.rows_warn ?? 0;
	const errCount = job?.rows_err ?? 0;
	const totalRows = job?.rows_total ?? 0;
	const includedRows = items.filter((r) => !r.is_excluded).length;

	const fileName = pendingFile?.name ?? job?.file_name ?? "(file)";
	const fileSize = pendingFile
		? `${(pendingFile.size / 1024 / 1024).toFixed(1)} MB`
		: "";

	const handleCellEdit = (row: ImportRowResponse, field: "merchant_name" | "category", value: string) => {
		updateRowMutation.mutate({
			rowId: row.id,
			data: { [field]: value },
		});
		setEditingCell(null);
	};

	const processingStageLabel = (() => {
		if (!job) return "Mengunggah file...";
		if (job.status === "pending") return "Menunggu antrian...";
		if (job.status === "processing") return "Memproses & klasifikasi AI...";
		if (job.status === "failed") return "Gagal memproses.";
		return "Memproses...";
	})();

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
				<button
					type="button"
					className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-gray-300 px-3.5 text-[13px] text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
				>
					<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
					Bantuan
				</button>
			</header>

			<div className="grid flex-1 grid-cols-[260px_1fr] max-[1100px]:grid-cols-[220px_1fr] max-[880px]:grid-cols-[1fr]">
				{/* Source selector */}
				<aside className={cn(
					"sticky top-16 h-[calc(100vh-64px)] overflow-y-auto border-r border-gray-200 bg-white max-[880px]:static max-[880px]:h-auto max-[880px]:border-b max-[880px]:border-r-0",
					mobileShowContent && "max-[880px]:hidden",
				)}>
					<div className="px-5 pb-1.5 pt-[18px]">
						<h2 className="text-[11px] font-medium uppercase tracking-labelWide text-gray-500">Sumber Data</h2>
					</div>
					<div className="mx-5 mb-3 mt-2 relative">
						<svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
						<input
							type="text"
							placeholder="Cari sumber..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="h-[34px] w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-[13px] text-gray-900 outline-none transition-[border-color,background-color] duration-200 focus:border-gray-950 focus:bg-white"
						/>
					</div>

					{SOURCE_GROUPS.map((group) => {
						const visibleItems = group.items.filter(
							(item) => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()),
						);
						if (visibleItems.length === 0 && searchQuery) return null;
						return (
							<div key={group.label} className="px-3 pb-3.5 pt-1.5">
								<h3 className="mx-2 mb-1.5 mt-2 font-mono text-[10px] font-medium uppercase tracking-labelWide text-gray-400">{group.label}</h3>
								{visibleItems.map((item) => (
									<button
										key={item.id}
										type="button"
										disabled={item.disabled}
										onClick={() => !item.disabled && handleSourceClick(item.id)}
										className={cn(
											"flex w-full items-center gap-2.5 border-l-2 border-transparent py-2 pl-2.5 pr-2.5 text-left text-[13px] leading-tight text-gray-700 transition-[background-color,border-color,color] duration-150",
											"rounded-r-md",
											activeSource === item.id && !item.disabled && "border-l-gray-950 bg-gray-50 font-medium text-gray-950",
											!item.disabled && activeSource !== item.id && "hover:bg-gray-50 hover:text-gray-950",
											item.disabled && "cursor-not-allowed opacity-70",
										)}
									>
										<span className={cn(
											"grid h-6 w-6 shrink-0 place-items-center rounded-md font-serif text-[13px]",
											activeSource === item.id && !item.disabled ? "bg-gray-950 text-white" : "bg-gray-100 text-gray-800",
										)}>
											{item.logo}
										</span>
										<span className="min-w-0 flex-1 truncate">{item.name}</span>
										{item.disabled ? (
											<span className="rounded-sm bg-gray-100 px-1.5 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-gray-400">Soon</span>
										) : item.fmt ? (
											<span className="font-mono text-[10px] text-gray-400">{item.fmt}</span>
										) : null}
									</button>
								))}
								{group.addLabel && (
									<button
										type="button"
										className="mt-1.5 flex w-full items-center gap-2 rounded-md border border-dashed border-gray-200 py-2 pl-2.5 pr-2.5 text-xs text-gray-500 hover:border-gray-700 hover:bg-gray-50 hover:text-gray-950"
									>
										<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
										{group.addLabel}
									</button>
								)}
							</div>
						);
					})}
				</aside>

				{/* Right pane */}
				<section className={cn("min-w-0 overflow-x-hidden", !mobileShowContent && "max-[880px]:hidden")}>
					<button
						type="button"
						onClick={() => setMobileShowContent(false)}
						className="hidden max-[880px]:flex items-center gap-2 px-4 pt-4 text-[13px] font-medium text-gray-700 hover:text-gray-950"
					>
						<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
						Pilih sumber lain
					</button>

					{/* Stepper */}
					<div className="flex flex-wrap items-center gap-2 px-4 pt-6 md:px-8 max-[880px]:px-5">
						{STEPS.map((label, i) => {
							const stepNum = i + 1;
							const isDone = stepNum < currentStep;
							const isActive = stepNum === currentStep;
							return (
								<div key={label} className="contents">
									<button
										type="button"
										onClick={() => isDone && goStep(stepNum)}
										className={cn(
											"flex items-center gap-2.5 text-[13px] font-medium transition-colors duration-[250ms] ease-designhub",
											isActive ? "text-gray-950" : isDone ? "cursor-pointer text-gray-950" : "text-gray-300",
										)}
									>
										<span className={cn(
											"grid h-6 w-6 place-items-center rounded-full border font-mono text-[11px] font-medium transition-[background-color,color,border-color] duration-[250ms] ease-designhub",
											isActive || isDone ? "border-gray-950 bg-gray-950 text-white" : "border-current",
										)}>
											{isDone ? "✓" : stepNum}
										</span>
										<span className="max-[880px]:hidden">{label}</span>
									</button>
									{i < STEPS.length - 1 && (
										<div className={cn("mx-1 h-px w-9 max-[880px]:w-4", isDone ? "bg-gray-950" : "bg-gray-200")} />
									)}
								</div>
							);
						})}
					</div>

					<div className="max-w-[1100px] p-4 md:p-8 max-[880px]:p-5">
						<AnimatePresence mode="wait">
							{/* Step 1: Upload */}
							{currentStep === 1 && (
								<motion.div key="step1" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
									<h2 className="mb-1.5 font-serif text-[32px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
										Upload <em className="italic text-gray-700">{instructions?.title || activeSource}</em>
									</h2>
									<p className="mb-7 max-w-[580px] text-sm text-gray-500">
										Data kamu diproses lokal di server kami yang terenkripsi.
									</p>

									{instructions && (
										<div className="mb-6 border border-gray-200 bg-gray-50 px-[22px] py-5">
											<h3 className="mb-3 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
												Cara import dari {instructions.title}
											</h3>
											<ol className="m-0 list-none space-y-0 p-0">
												{instructions.steps.map((step, i) => (
													<li key={i} className="flex gap-3.5 py-2 text-[13px] leading-relaxed text-gray-700">
														<span className="min-w-[24px] font-mono text-[11px] font-medium tracking-[0.04em] text-gray-400">
															{String(i + 1).padStart(2, "0")}
														</span>
														{step}
													</li>
												))}
											</ol>
										</div>
									)}

									{uploadError && (
										<div className="mb-4 border border-[#dc2626] bg-[#fdf6f6] px-4 py-3 text-[13px] text-[#dc2626]">
											{uploadError}
										</div>
									)}

									{/* Dropzone */}
									<div
										role="button"
										tabIndex={0}
										onClick={() => fileInputRef.current?.click()}
										onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInputRef.current?.click(); } }}
										onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
										onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
										onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
										onDrop={handleDrop}
										className={cn(
											"relative flex cursor-pointer flex-col items-center gap-3.5 border border-dashed border-gray-300 bg-white px-10 py-14 text-center transition-[border-color,background-color] duration-[250ms]",
											"hover:border-gray-700 hover:bg-gray-50",
											dragOver && "border-solid border-gray-950 bg-gray-50 animate-[importPulse_1.2s_cubic-bezier(0.2,0.7,0.2,1)_infinite]",
										)}
									>
										<svg className="h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
										<div className="text-base font-medium text-gray-950">Seret file ke sini, atau klik untuk pilih</div>
										<div className="font-mono text-xs tracking-[0.04em] text-gray-400">PDF · CSV · PNG · JPG — maks 10MB</div>
										<input
											ref={fileInputRef}
											type="file"
											hidden
											accept=".pdf,.csv,image/*"
											onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
										/>
									</div>

									{/* Bank pills */}
									<div className="mt-6 flex flex-wrap gap-2">
										<div className="w-full text-[11px] font-medium uppercase tracking-label text-gray-400 mb-1">Atau pilih bank lain</div>
										{BANK_PILLS.map((bank) => (
											<button
												key={bank}
												type="button"
												onClick={() => handlePillClick(bank)}
												className={cn(
													"h-8 rounded-full border px-3.5 text-[13px] transition-[background-color,border-color,color] duration-200",
													activePill === bank
														? "border-gray-950 bg-gray-950 text-white"
														: "border-gray-300 text-gray-700 hover:border-gray-950 hover:text-gray-950",
												)}
											>
												{bank}
											</button>
										))}
									</div>
								</motion.div>
							)}

							{/* Step 2: Processing */}
							{currentStep === 2 && (
								<motion.div key="step2" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
									<h2 className="mb-1.5 font-serif text-[32px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
										Memproses <em className="italic text-gray-700">file kamu</em>
									</h2>
									<p className="mb-7 max-w-[580px] text-sm text-gray-500">
										AI sedang membaca dan mengekstrak transaksi dari dokumen kamu. Jangan tutup tab ini.
									</p>

									{/* File card */}
									<div className="mb-6 flex items-center gap-3.5 border border-gray-200 bg-white px-[18px] py-4">
										<div className="relative grid h-12 w-10 place-items-center bg-gray-100 font-mono text-[11px] font-medium text-gray-700">
											FILE
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium text-gray-950">{fileName}</div>
											{fileSize && <div className="mt-0.5 font-mono text-xs text-gray-400">{fileSize}</div>}
										</div>
										<button
											type="button"
											onClick={restartWizard}
											className="grid h-[30px] w-[30px] place-items-center rounded-md text-gray-400 transition-[background-color,color] duration-200 hover:bg-gray-100 hover:text-gray-950"
											aria-label="Batal"
										>
											<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6l-12 12" /></svg>
										</button>
									</div>

									{job?.status === "failed" ? (
										<div className="border border-[#dc2626] bg-[#fdf6f6] p-6">
											<div className="mb-2 text-[13px] font-medium text-[#dc2626]">Gagal memproses file</div>
											<div className="text-[13px] text-gray-700">
												{job.error_message || "Parser belum tersedia untuk sumber ini, atau format file tidak didukung."}
											</div>
											<button
												type="button"
												onClick={restartWizard}
												className="mt-4 inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
											>
												Coba lagi
											</button>
										</div>
									) : (
										<div className="border border-gray-200 p-6">
											<div className="flex items-center gap-3 text-[13px] text-gray-700">
												<span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-950" />
												{processingStageLabel}
											</div>
											<div className="mt-4 font-mono text-xs text-gray-400">
												Status: {job?.status ?? "uploading"}
											</div>
										</div>
									)}
								</motion.div>
							)}

							{/* Step 3: Review */}
							{currentStep === 3 && job && (
								<motion.div key="step3" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
									<h2 className="mb-1.5 font-serif text-[32px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
										Periksa hasil <em className="italic text-gray-700">ekstraksi</em>
									</h2>
									<p className="mb-7 max-w-[580px] text-sm text-gray-500">
										AI berhasil membaca <strong className="text-gray-950">{totalRows} transaksi</strong>. Verifikasi data di bawah sebelum menyimpan. Klik cell untuk mengedit.
									</p>

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

									{/* Filter buttons */}
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
													const confLabel = conf === "ok" ? "Tinggi" : conf === "warn" ? "Ragu" : "Error";
													const confColor = conf === "ok" ? "#16a34a" : conf === "warn" ? "#d97706" : "#dc2626";
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
																<span className="font-mono text-xs text-gray-700 whitespace-nowrap">{formatShortDate(row.transaction_date)}</span>
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
																		className="inline-flex w-full cursor-text items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-[background-color] duration-150 hover:bg-gray-100"
																		onClick={() => setEditingCell({ rowId: row.id, field: "merchant_name" })}
																	>
																		{row.merchant_name || row.description || <span className="italic text-gray-400">tanpa nama</span>}
																	</span>
																)}
															</td>
															<td className="px-3.5 py-2.5">
																{editingCell?.rowId === row.id && editingCell.field === "category" ? (
																	<select
																		defaultValue={row.category ?? "Lainnya"}
																		autoFocus
																		className="rounded border border-gray-950 bg-white px-2 py-1 text-[13px] text-gray-950 outline-none"
																		onChange={(e) => handleCellEdit(row, "category", e.target.value)}
																		onBlur={(e) => handleCellEdit(row, "category", e.target.value)}
																	>
																		{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
																	</select>
																) : (
																	<span
																		className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-gray-700 transition-[background-color] duration-150 hover:bg-gray-200"
																		onClick={() => setEditingCell({ rowId: row.id, field: "category" })}
																	>
																		{row.category || "Lainnya"}
																	</span>
																)}
															</td>
															<td className="px-3.5 py-2.5 text-right">
																<span className={cn("font-mono tabular-nums", parseFloat(row.amount) >= 0 ? "font-medium text-gray-950" : "text-gray-700")}>
																	{fmtRp(row.amount)}
																</span>
															</td>
															<td className="px-3.5 py-2.5">
																<span className={cn("inline-flex items-center gap-2 font-mono text-[11px]", conf === "ok" ? "text-gray-700" : conf === "warn" ? "text-[#d97706]" : "text-[#dc2626]")}>
																	<span className="inline-block h-2 w-2 rounded-full" style={{ background: confColor }} />
																	{confLabel}
																</span>
															</td>
															<td className="px-3.5 py-2.5 text-right">
																<div className="flex justify-end gap-1">
																	<button
																		type="button"
																		onClick={() => excludeRowMutation.mutate(row.id)}
																		disabled={excludeRowMutation.isPending}
																		className="grid h-[26px] w-[26px] place-items-center rounded-[5px] text-gray-400 transition-[background-color,color] duration-200 hover:bg-gray-100 hover:text-gray-950"
																		title="Hapus dari import"
																	>
																		<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-2 14a2 2 0 01-2 2H9a2 2 0 01-2-2L5 6" /></svg>
																	</button>
																</div>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>

									{/* Bulk action bar */}
									<div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 border border-gray-200 bg-white px-5 py-4 shadow-[0_8px_30px_-16px_rgba(0,0,0,0.1)]">
										<div className="flex flex-wrap items-center gap-3.5 text-[13px] text-gray-700">
											<span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-gray-950 text-[11px] text-white">✓</span>
											<strong className="font-medium text-gray-950">{includedRows} transaksi siap disimpan</strong>
											{(items.length - includedRows) > 0 && (
												<>
													<span className="text-gray-400">·</span>
													<span>{items.length - includedRows} dikecualikan</span>
												</>
											)}
										</div>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={restartWizard}
												className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-[18px] text-sm font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
											>
												Batalkan
											</button>
											<button
												type="button"
												onClick={() => confirmMutation.mutate()}
												disabled={confirmMutation.isPending || includedRows === 0}
												className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-[18px] text-sm font-medium text-white transition-[background-color] duration-200 hover:bg-black disabled:opacity-50"
											>
												{confirmMutation.isPending ? "Menyimpan..." : `Simpan ${includedRows} Transaksi`}
												<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
											</button>
										</div>
									</div>
									{confirmMutation.isError && (
										<div className="mt-3 border border-[#dc2626] bg-[#fdf6f6] px-4 py-2 text-[13px] text-[#dc2626]">
											{getErrorMessage(confirmMutation.error, "Gagal konfirmasi.")}
										</div>
									)}
								</motion.div>
							)}

							{/* Step 4: Done */}
							{currentStep === 4 && confirmResult && (
								<motion.div key="step4" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
									<div className="mx-auto mt-10 max-w-[560px] text-center">
										<motion.div
											initial={{ scale: 0.6, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{ duration: 0.5, ease: easeDesignhub }}
											className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-full bg-gray-950"
										>
											<svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
												<motion.path
													d="M5 12.5l4.5 4.5L19 7.5"
													initial={{ pathLength: 0 }}
													animate={{ pathLength: 1 }}
													transition={{ duration: 0.55, ease: easeDesignhub, delay: 0.25 }}
												/>
											</svg>
										</motion.div>
										<h2 className="mb-2.5 font-serif text-4xl font-light leading-[1.1] tracking-tight2 text-gray-950">
											{confirmResult.created} transaksi berhasil <em className="italic">disimpan!</em>
										</h2>
										<p className="mb-8 text-[15px] text-gray-500">
											{confirmResult.existed > 0
												? `${confirmResult.existed} transaksi duplikat dilewati. Net worth kamu telah diperbarui.`
												: "Net worth kamu telah diperbarui."}
										</p>

										<div className="grid grid-cols-3 border border-gray-200 text-left max-[1100px]:grid-cols-1">
											<button
												type="button"
												onClick={() => router.push("/transactions")}
												className="border-r border-gray-200 px-[22px] py-[22px] text-left transition-[background-color] duration-200 ease-designhub hover:bg-gray-50 max-[1100px]:border-b max-[1100px]:border-r-0"
											>
												<div className="mb-3.5 text-gray-700">
													<svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
												</div>
												<div className="mb-1 text-sm font-medium text-gray-950">Lihat Transaksi</div>
												<div className="text-xs leading-relaxed text-gray-500">Cek transaksi yang baru saja diimport</div>
											</button>
											<button
												type="button"
												onClick={restartWizard}
												className="border-r border-gray-200 px-[22px] py-[22px] text-left transition-[background-color] duration-200 ease-designhub hover:bg-gray-50 max-[1100px]:border-b max-[1100px]:border-r-0"
											>
												<div className="mb-3.5 text-gray-700">
													<svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></svg>
												</div>
												<div className="mb-1 text-sm font-medium text-gray-950">Import Lagi</div>
												<div className="text-xs leading-relaxed text-gray-500">Import dari rekening lain atau platform investasi</div>
											</button>
											<a href="/chat" className="px-[22px] py-[22px] transition-[background-color] duration-200 ease-designhub hover:bg-gray-50">
												<div className="mb-3.5 text-gray-700">
													<svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 1 1-3.4-6.8L21 4l-1 3.5A8.5 8.5 0 0 1 21 11.5z" /></svg>
												</div>
												<div className="mb-1 text-sm font-medium text-gray-950">Tanya AI</div>
												<div className="text-xs leading-relaxed text-gray-500">&quot;Ke mana paling banyak uangku habis bulan ini?&quot;</div>
											</a>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</section>
			</div>

			<style jsx global>{`
				@keyframes importPulse {
					0%, 100% { border-color: #0a0a0a; }
					50% { border-color: #737373; }
				}
			`}</style>
		</>
	);
}
