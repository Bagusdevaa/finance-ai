"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

interface SourceInstructions {
	title: string;
	steps: string[];
}

interface ReviewRow {
	date: string;
	merchant: string;
	cat: string;
	amt: number;
	conf: "ok" | "warn" | "err";
}

interface SourceGroupItem {
	id: string;
	name: string;
	logo: string;
	fmt: string;
	group: string;
	disabled?: boolean;
}

const SOURCE_GROUPS: { label: string; items: SourceGroupItem[]; addLabel?: string }[] = [
	{
		label: "Rekening Bank",
		items: [
			{ id: "bca", name: "BCA", logo: "B", fmt: "PDF", group: "bank" },
			{ id: "mandiri", name: "Mandiri", logo: "M", fmt: "PDF·CSV", group: "bank" },
			{ id: "bri", name: "BRI", logo: "R", fmt: "PDF", group: "bank" },
			{ id: "bni", name: "BNI", logo: "N", fmt: "PDF", group: "bank" },
		],
		addLabel: "Tambah Bank Lain",
	},
	{
		label: "E-Wallet",
		items: [
			{ id: "gopay", name: "GoPay", logo: "G", fmt: "PDF·IMG", group: "ewallet" },
			{ id: "ovo", name: "OVO", logo: "O", fmt: "IMG", group: "ewallet" },
			{ id: "dana", name: "Dana", logo: "D", fmt: "IMG", group: "ewallet" },
			{ id: "shopeepay", name: "ShopeePay", logo: "S", fmt: "", group: "ewallet", disabled: true },
		],
	},
	{
		label: "Investasi",
		items: [
			{ id: "bibit", name: "Bibit", logo: "b", fmt: "IMG·CSV", group: "invest" },
			{ id: "stockbit", name: "Stockbit", logo: "S", fmt: "IMG", group: "invest" },
			{ id: "ipot", name: "IPOT", logo: "I", fmt: "CSV", group: "invest" },
			{ id: "pluang", name: "Pluang", logo: "P", fmt: "IMG", group: "invest" },
		],
		addLabel: "Tambah Platform",
	},
	{
		label: "Lainnya",
		items: [
			{ id: "manual", name: "Input Manual", logo: "+", fmt: "", group: "other" },
			{ id: "csv", name: "Upload CSV", logo: "C", fmt: "CSV", group: "other" },
		],
	},
];

const SOURCE_INSTRUCTIONS: Record<string, SourceInstructions> = {
	bca: { title: "BCA", steps: ["Buka aplikasi BCA mobile dan masuk ke menu Info Saldo & Mutasi.", "Pilih rentang tanggal yang ingin di-import (maksimal 3 bulan terakhir).", "Tap Kirim ke Email, pilih format PDF.", "Buka email kamu, unduh attachment-nya, lalu upload di bawah ini."] },
	mandiri: { title: "Mandiri", steps: ["Login ke Livin' by Mandiri.", "Buka e-Statement, pilih bulan yang ingin di-import.", "Download PDF / CSV, lalu upload di bawah."] },
	bri: { title: "BRI", steps: ["Buka BRImo, masuk ke Mutasi, pilih periode, kirim ke email PDF.", "Upload file PDF di bawah."] },
	bni: { title: "BNI", steps: ["Buka wondr by BNI, menu Mutasi Rekening, ekspor PDF.", "Upload file PDF di bawah."] },
	gopay: { title: "GoPay", steps: ["Buka aplikasi Gojek, ke GoPay, tap Riwayat.", "Tap Unduh Riwayat, pilih periode, format PDF.", "Upload PDF, atau jika tidak bisa, screenshot riwayatnya."] },
	ovo: { title: "OVO", steps: ["Buka OVO, menu History.", "Screenshot tampilan riwayat (multiple OK).", "Upload screenshot di bawah — AI akan baca semuanya."] },
	dana: { title: "Dana", steps: ["Buka DANA, menu History.", "Screenshot tampilan riwayat.", "Upload screenshot di bawah."] },
	bibit: { title: "Bibit", steps: ["Buka Bibit, menu Portofolio.", "Screenshot atau export CSV transaksi (Pengaturan → Export Data).", "Upload file di bawah."] },
	stockbit: { title: "Stockbit", steps: ["Buka Stockbit, masuk ke tab Portfolio.", "Screenshot tampilan holdings (1 layar = 1 file).", "Upload semua screenshot di bawah."] },
	ipot: { title: "IPOT", steps: ["Login IPOT (web), menu Portfolio → Export.", "Pilih format CSV.", "Upload CSV di bawah."] },
	pluang: { title: "Pluang", steps: ["Buka Pluang, menu Portofolio.", "Screenshot tampilan emas / kripto kamu.", "Upload screenshot di bawah."] },
	manual: { title: "Input Manual", steps: ["Tidak perlu upload — kamu akan diarahkan ke form input transaksi setelah klik Lanjutkan.", "Cocok untuk transaksi cash atau yang tidak ada di platform mana pun."] },
	csv: { title: "CSV Custom", steps: ["Format CSV harus berisi minimal kolom: tanggal, deskripsi, jumlah.", "Tanggal: format YYYY-MM-DD. Jumlah: angka, negatif untuk pengeluaran.", "Upload CSV-nya di bawah — AI akan otomatis kategorikan."] },
};

const CATEGORIES = ["Makanan", "Transportasi", "Belanja", "Tagihan", "Hiburan", "Transfer", "Pendapatan", "Investasi", "Kesehatan", "Lainnya"];

const REVIEW_DATA: ReviewRow[] = [
	{ date: "28 Feb", merchant: "Gaji Februari", cat: "Pendapatan", amt: 12500000, conf: "ok" },
	{ date: "27 Feb", merchant: "Indomaret Cipete", cat: "Belanja", amt: -87500, conf: "ok" },
	{ date: "26 Feb", merchant: "Gojek (Ride)", cat: "Transportasi", amt: -32000, conf: "ok" },
	{ date: "25 Feb", merchant: "Starbucks Senopati", cat: "Makanan", amt: -72000, conf: "ok" },
	{ date: "24 Feb", merchant: "Tokopedia", cat: "Belanja", amt: -345000, conf: "ok" },
	{ date: "23 Feb", merchant: "PLN Pasca Bayar", cat: "Tagihan", amt: -285000, conf: "ok" },
	{ date: "21 Feb", merchant: "TRSF 000123 (?)", cat: "Transfer", amt: -1200000, conf: "warn" },
	{ date: "20 Feb", merchant: "Grab Food", cat: "Makanan", amt: -58000, conf: "ok" },
	{ date: "18 Feb", merchant: "QR-COMM Pasaraya", cat: "Belanja", amt: -156000, conf: "warn" },
	{ date: "15 Feb", merchant: "Netflix", cat: "Hiburan", amt: -186000, conf: "ok" },
	{ date: "12 Feb", merchant: "Spotify Premium", cat: "Hiburan", amt: -54990, conf: "ok" },
	{ date: "09 Feb", merchant: "DEBIT ATM (?)", cat: "Transfer", amt: -200000, conf: "err" },
];

const BANK_PILLS = ["BCA", "Mandiri", "BRI", "BNI", "CIMB Niaga", "Permata", "Jago"];

const STEPS = ["Upload", "Proses", "Review", "Selesai"];

const PROC_STAGES = [
	"Membaca dokumen…",
	"Mengidentifikasi transaksi…",
	"Mengklasifikasi dengan AI…",
	"Memeriksa duplikat…",
];

function fmtRp(n: number): string {
	const abs = Math.abs(n).toLocaleString("id-ID");
	return (n >= 0 ? "+Rp " : "−Rp ") + abs;
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
	const [activeSource, setActiveSource] = useState("bca");
	const [searchQuery, setSearchQuery] = useState("");
	const [mobileShowContent, setMobileShowContent] = useState(false);
	const [currentStep, setCurrentStep] = useState(1);
	const [activePill, setActivePill] = useState("BCA");
	const [dragOver, setDragOver] = useState(false);
	const [fileName, setFileName] = useState("eStatement_BCA_Feb2026.pdf");
	const [fileSize, setFileSize] = useState("2,4 MB · 14 halaman");
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [procProgress, setProcProgress] = useState<number[]>([0, 0, 0, 0]);
	const [procActive, setProcActive] = useState(-1);
	const [procFound, setProcFound] = useState(0);
	const procTimers = useRef<number[]>([]);

	const [reviewFilter, setReviewFilter] = useState<"all" | "ok" | "warn" | "err">("all");
	const [alertOpen, setAlertOpen] = useState(false);
	const [editingCell, setEditingCell] = useState<{ row: number; field: "merchant" | "cat" } | null>(null);
	const [reviewData, setReviewData] = useState<ReviewRow[]>(REVIEW_DATA);

	const stopProcessing = useCallback(() => {
		procTimers.current.forEach((t) => clearInterval(t));
		procTimers.current = [];
	}, []);

	const goStep = useCallback((n: number) => {
		setCurrentStep(n);
		if (n !== 2) stopProcessing();
	}, [stopProcessing]);

	useEffect(() => {
		if (currentStep !== 2) return;
		stopProcessing();
		setProcProgress([0, 0, 0, 0]);
		setProcActive(-1);
		setProcFound(0);

		const TARGET = 127;
		const durations = [2400, 3000, 3800, 1400];
		let stageIdx = 0;

		function runStage(idx: number) {
			if (idx >= 4) {
				setProcFound(TARGET);
				const t = window.setTimeout(() => goStep(3), 700);
				procTimers.current.push(t);
				return;
			}
			setProcActive(idx);
			let pct = 0;
			const tick = 60;
			const inc = 100 / (durations[idx] / tick);
			const timer = window.setInterval(() => {
				pct += inc + Math.random() * 1.4;
				if (pct >= 100) {
					pct = 100;
					clearInterval(timer);
					setProcProgress((prev) => { const n = [...prev]; n[idx] = 100; return n; });
					setProcActive(-1);
					stageIdx++;
					runStage(stageIdx);
				} else {
					setProcProgress((prev) => { const n = [...prev]; n[idx] = pct; return n; });
				}
				const found = Math.min(TARGET, Math.floor(((idx + pct / 100) / 4) * TARGET));
				setProcFound(found);
			}, tick);
			procTimers.current.push(timer);
		}

		runStage(0);
		return stopProcessing;
	}, [currentStep, goStep, stopProcessing]);

	const handleFile = (file: File) => {
		setFileName(file.name || "eStatement_BCA_Feb2026.pdf");
		const sizeMB = file.size ? (file.size / 1024 / 1024).toFixed(1) + " MB" : "2,4 MB";
		setFileSize(sizeMB + " · estimasi 14 halaman");
		goStep(2);
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
		goStep(1);
	};

	const handlePillClick = (bank: string) => {
		setActivePill(bank);
		const allItems = SOURCE_GROUPS.flatMap((g) => g.items);
		const found = allItems.find((i) => i.name.toLowerCase().includes(bank.toLowerCase()));
		if (found && !found.disabled) {
			setActiveSource(found.id);
		}
	};

	const instructions = SOURCE_INSTRUCTIONS[activeSource];

	const filteredReview = reviewFilter === "all" ? reviewData : reviewData.filter((r) => r.conf === reviewFilter);
	const okCount = reviewData.filter((r) => r.conf === "ok").length;
	const warnCount = reviewData.filter((r) => r.conf === "warn").length;
	const errCount = reviewData.filter((r) => r.conf === "err").length;

	const handleCellEdit = (rowIndex: number, field: "merchant" | "cat", value: string) => {
		setReviewData((prev) => {
			const next = [...prev];
			const origIdx = reviewFilter === "all"
				? rowIndex
				: prev.indexOf(filteredReview[rowIndex]);
			next[origIdx] = { ...next[origIdx], [field]: value };
			return next;
		});
		setEditingCell(null);
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
					{/* Mobile back button */}
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
											<ol className="m-0 list-none space-y-0 p-0" style={{ counterReset: "s" }}>
												{instructions.steps.map((step, i) => (
													<li key={i} className="flex gap-3.5 py-2 text-[13px] leading-relaxed text-gray-700" style={{ counterIncrement: "s" }}>
														<span className="min-w-[24px] font-mono text-[11px] font-medium tracking-[0.04em] text-gray-400">
															{String(i + 1).padStart(2, "0")}
														</span>
														{step}
													</li>
												))}
											</ol>
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
										<div className="font-mono text-xs tracking-[0.04em] text-gray-400">PDF &middot; PNG &middot; JPG &mdash; maks 10MB</div>
										<div className="my-1 inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-labelWide text-gray-400">
											<span className="h-px w-6 bg-gray-200" />atau<span className="h-px w-6 bg-gray-200" />
										</div>
										<button
											type="button"
											onClick={(e) => e.stopPropagation()}
											className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-gray-300 px-[18px] text-[13px] text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-white hover:text-gray-950"
										>
											<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
											Ambil Foto
										</button>
										<input ref={fileInputRef} type="file" hidden accept=".pdf,image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
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
											PDF
											<span className="absolute right-0 top-0 border-[6px] border-white" style={{ borderBottomColor: "#d4d4d4", borderLeftColor: "#d4d4d4" }} />
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium text-gray-950">{fileName}</div>
											<div className="mt-0.5 font-mono text-xs text-gray-400">{fileSize}</div>
										</div>
										<button
											type="button"
											onClick={() => goStep(1)}
											className="grid h-[30px] w-[30px] place-items-center rounded-md text-gray-400 transition-[background-color,color] duration-200 hover:bg-gray-100 hover:text-gray-950"
											aria-label="Batal"
										>
											<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6l-12 12" /></svg>
										</button>
									</div>

									{/* Processing stages */}
									<div className="flex flex-col gap-[18px] border border-gray-200 p-6">
										{PROC_STAGES.map((label, i) => {
											const pct = procProgress[i];
											const isOn = procActive === i;
											const isDone = pct >= 100;
											return (
												<div key={i} className={cn("flex flex-col gap-2 transition-opacity duration-[350ms] ease-designhub", isOn ? "opacity-100" : isDone ? "opacity-60" : "opacity-40")}>
													<div className="flex items-center justify-between text-[13px] text-gray-700">
														<div className="flex items-center gap-2.5">
															{isOn && (
																<span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-950" />
															)}
															{isDone && (
																<span className="inline-block text-xs font-semibold text-gray-950">&check;</span>
															)}
															{label}
														</div>
														<span className="font-mono text-xs tabular-nums text-gray-500">{Math.floor(pct)}%</span>
													</div>
													<div className="h-[3px] w-full overflow-hidden bg-gray-100">
														<div className="h-full bg-gray-950 transition-[width] duration-[250ms] ease-linear" style={{ width: `${pct}%` }} />
													</div>
												</div>
											);
										})}

										<div className="mt-[18px] flex flex-wrap items-center justify-between gap-3 text-[13px] text-gray-500">
											<div>Menemukan <strong className="font-medium text-gray-950">{procFound}</strong> transaksi sejauh ini&hellip;</div>
											<div className="font-mono text-xs text-gray-400">
												{procFound >= 127 ? "Selesai · membuka review…" : "Selesai dalam ~15 detik"}
											</div>
										</div>
									</div>
								</motion.div>
							)}

							{/* Step 3: Review */}
							{currentStep === 3 && (
								<motion.div key="step3" variants={fadeVariants} initial="hidden" animate="show" exit="exit">
									<h2 className="mb-1.5 font-serif text-[32px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
										Periksa hasil <em className="italic text-gray-700">ekstraksi</em>
									</h2>
									<p className="mb-7 max-w-[580px] text-sm text-gray-500">
										AI berhasil membaca <strong className="text-gray-950">127 transaksi</strong>. Verifikasi data di bawah sebelum menyimpan. Klik cell mana pun untuk mengedit.
									</p>

									{/* Summary cards */}
									<div className="mb-6 grid grid-cols-3 border border-gray-200 max-[1100px]:grid-cols-1">
										<div className="border-r border-gray-200 px-[22px] py-5 max-[1100px]:border-b max-[1100px]:border-r-0">
											<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">Transaksi</div>
											<div className="mt-1.5 font-serif text-[32px] font-light leading-[1.1] tracking-tight2 text-gray-950">127</div>
											<div className="mt-1 text-xs text-gray-500">14 halaman dokumen</div>
										</div>
										<div className="border-r border-gray-200 px-[22px] py-5 max-[1100px]:border-b max-[1100px]:border-r-0">
											<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">Pemasukan</div>
											<div className="mt-1.5 font-mono text-2xl font-medium tabular-nums tracking-tight2 text-gray-950">Rp 8.450.000</div>
											<div className="mt-1 text-xs text-gray-500">23 transaksi</div>
										</div>
										<div className="px-[22px] py-5">
											<div className="text-[11px] font-medium uppercase tracking-label text-gray-400">Pengeluaran</div>
											<div className="mt-1.5 font-mono text-2xl font-medium tabular-nums tracking-tight2 text-gray-950">Rp 3.640.000</div>
											<div className="mt-1 text-xs text-gray-500">104 transaksi</div>
										</div>
									</div>

									{/* Alert bar */}
									<button
										type="button"
										onClick={() => setAlertOpen(!alertOpen)}
										className="mb-[18px] flex w-full items-center gap-3 border border-gray-300 bg-gray-50 px-4 py-3"
									>
										<svg className="h-4 w-4 shrink-0 text-[#d97706]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
										<div className="flex-1 text-left text-[13px] font-medium text-gray-900">3 field perlu perhatian kamu</div>
										<div className="font-mono text-xs text-gray-500">2 ragu &middot; 1 error</div>
										<svg className={cn("h-3.5 w-3.5 text-gray-400 transition-transform duration-[250ms] ease-designhub", alertOpen && "rotate-180")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
									</button>
									{alertOpen && (
										<div className="-mt-[18px] mb-[18px] border border-t-0 border-gray-300 bg-gray-50 px-4 pb-3.5 text-[13px] leading-relaxed text-gray-600">
											<ul className="mt-2 space-y-1 pl-5">
												<li><strong className="text-gray-950">21 Feb &middot; TRSF 000123</strong> &mdash; Merchant tidak dikenali. AI menebak &quot;Transfer ke teman&quot;.</li>
												<li><strong className="text-gray-950">18 Feb &middot; QR-COMM</strong> &mdash; Kategori ambigu, bisa &quot;Makanan&quot; atau &quot;Belanja&quot;.</li>
												<li><strong className="text-gray-950">09 Feb &middot; DEBIT ATM</strong> &mdash; Jumlah tidak terbaca dengan jelas (kemungkinan Rp 200.000 atau Rp 700.000).</li>
											</ul>
										</div>
									)}

									{/* Filter buttons */}
									<div className="mb-2 flex flex-wrap items-center justify-between gap-3">
										<div className="flex gap-1.5">
											{([["all", "Semua", "127", ""] as const, ["ok", "Tinggi", String(okCount), "#16a34a"] as const, ["warn", "Ragu", String(warnCount), "#d97706"] as const, ["err", "Error", String(errCount), "#dc2626"] as const]).map(([key, label, count, color]) => (
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
											Menampilkan {filteredReview.length} dari 127 &middot; klik cell untuk edit
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
												{filteredReview.map((row, i) => {
													const confLabel = row.conf === "ok" ? "Tinggi" : row.conf === "warn" ? "Ragu" : "Error";
													const confColor = row.conf === "ok" ? "#16a34a" : row.conf === "warn" ? "#d97706" : "#dc2626";
													return (
														<tr
															key={`${row.date}-${row.merchant}-${i}`}
															className={cn(
																"border-b border-gray-100 last:border-b-0",
																row.conf === "warn" && "bg-[#fcfaf6]",
																row.conf === "err" && "bg-[#fdf6f6]",
															)}
														>
															<td className="px-3.5 py-2.5">
																<span className="font-mono text-xs text-gray-700 whitespace-nowrap">{row.date}</span>
															</td>
															<td className="px-3.5 py-2.5">
																{editingCell?.row === i && editingCell.field === "merchant" ? (
																	<input
																		type="text"
																		defaultValue={row.merchant}
																		autoFocus
																		className="w-full rounded border border-gray-950 bg-white px-2 py-1 text-[13px] text-gray-950 outline-none"
																		onBlur={(e) => handleCellEdit(i, "merchant", e.target.value)}
																		onKeyDown={(e) => {
																			if (e.key === "Enter") handleCellEdit(i, "merchant", (e.target as HTMLInputElement).value);
																			if (e.key === "Escape") setEditingCell(null);
																		}}
																	/>
																) : (
																	<span
																		className="inline-flex w-full cursor-text items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-[background-color] duration-150 hover:bg-gray-100"
																		onClick={() => setEditingCell({ row: i, field: "merchant" })}
																	>
																		{row.merchant}
																	</span>
																)}
															</td>
															<td className="px-3.5 py-2.5">
																{editingCell?.row === i && editingCell.field === "cat" ? (
																	<select
																		defaultValue={row.cat}
																		autoFocus
																		className="rounded border border-gray-950 bg-white px-2 py-1 text-[13px] text-gray-950 outline-none"
																		onChange={(e) => handleCellEdit(i, "cat", e.target.value)}
																		onBlur={(e) => handleCellEdit(i, "cat", e.target.value)}
																	>
																		{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
																	</select>
																) : (
																	<span
																		className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium capitalize text-gray-700 transition-[background-color] duration-150 hover:bg-gray-200"
																		onClick={() => setEditingCell({ row: i, field: "cat" })}
																	>
																		{row.cat}
																	</span>
																)}
															</td>
															<td className="px-3.5 py-2.5 text-right">
																<span className={cn("font-mono tabular-nums", row.amt >= 0 ? "font-medium text-gray-950" : "text-gray-700")}>
																	{fmtRp(row.amt)}
																</span>
															</td>
															<td className="px-3.5 py-2.5">
																<span className={cn("inline-flex items-center gap-2 font-mono text-[11px]", row.conf === "ok" ? "text-gray-700" : row.conf === "warn" ? "text-[#d97706]" : "text-[#dc2626]")}>
																	<span className="inline-block h-2 w-2 rounded-full" style={{ background: confColor }} />
																	{confLabel}
																</span>
															</td>
															<td className="px-3.5 py-2.5 text-right">
																<div className="flex justify-end gap-1">
																	<button type="button" className="grid h-[26px] w-[26px] place-items-center rounded-[5px] text-gray-400 transition-[background-color,color] duration-200 hover:bg-gray-100 hover:text-gray-950" title="Setujui">
																		<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
																	</button>
																	<button type="button" className="grid h-[26px] w-[26px] place-items-center rounded-[5px] text-gray-400 transition-[background-color,color] duration-200 hover:bg-gray-100 hover:text-gray-950" title="Hapus">
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
											<span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-gray-950 text-[11px] text-white">&check;</span>
											<strong className="font-medium text-gray-950">Semua terlihat benar</strong>
											<span className="text-gray-400">&middot;</span>
											<span>127 transaksi siap disimpan</span>
										</div>
										<div className="flex gap-2">
											<button type="button" onClick={() => goStep(1)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 px-[18px] text-sm font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950">
												Hapus semua
											</button>
											<button type="button" onClick={() => goStep(4)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-gray-950 px-[18px] text-sm font-medium text-white transition-[background-color] duration-200 hover:bg-black">
												Simpan 127 Transaksi
												<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
											</button>
										</div>
									</div>
								</motion.div>
							)}

							{/* Step 4: Done */}
							{currentStep === 4 && (
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
											127 transaksi berhasil <em className="italic">disimpan!</em>
										</h2>
										<p className="mb-8 text-[15px] text-gray-500">
											Net worth kamu telah diperbarui. Periode <strong className="text-gray-700">1 Feb &ndash; 28 Feb 2026</strong> dari rekening BCA Tahapan.
										</p>

										<div className="grid grid-cols-3 border border-gray-200 text-left max-[1100px]:grid-cols-1">
											<a href="/dashboard" className="border-r border-gray-200 px-[22px] py-[22px] transition-[background-color] duration-200 ease-designhub hover:bg-gray-50 max-[1100px]:border-b max-[1100px]:border-r-0">
												<div className="mb-3.5 text-gray-700">
													<svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
												</div>
												<div className="mb-1 text-sm font-medium text-gray-950">Lihat Dashboard</div>
												<div className="text-xs leading-relaxed text-gray-500">Net worth, cash flow, dan portofolio kamu yang sudah update</div>
											</a>
											<button type="button" onClick={() => goStep(1)} className="border-r border-gray-200 px-[22px] py-[22px] text-left transition-[background-color] duration-200 ease-designhub hover:bg-gray-50 max-[1100px]:border-b max-[1100px]:border-r-0">
												<div className="mb-3.5 text-gray-700">
													<svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12" /><path d="M7 9l5-5 5 5" /><path d="M5 20h14" /></svg>
												</div>
												<div className="mb-1 text-sm font-medium text-gray-950">Import Lagi</div>
												<div className="text-xs leading-relaxed text-gray-500">Import dari rekening lain, e-wallet, atau platform investasi</div>
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
