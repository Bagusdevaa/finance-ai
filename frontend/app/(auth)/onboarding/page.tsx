"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

const ease = [0.2, 0.7, 0.2, 1] as const;

const goals = [
	{
		id: "save",
		num: "01",
		name: "Tabung lebih banyak setiap bulan",
		desc: "Bangun dana darurat dan habit nabung yang konsisten.",
	},
	{
		id: "track",
		num: "02",
		name: "Track semua aset dan investasi",
		desc: "Lihat net worth real-time dari semua platform yang kamu punya.",
	},
	{
		id: "debt",
		num: "03",
		name: "Kelola utang dan cicilan",
		desc: "Pantau KPR, cicilan kartu kredit, dan rencana lunasnya.",
	},
	{
		id: "retire",
		num: "04",
		name: "Rencanakan pensiun dini",
		desc: "Set target FIRE dan track progress kamu setiap bulan.",
	},
];

const banks = [
	{ id: "BCA", letter: "B", name: "BCA", type: "Bank" },
	{ id: "Mandiri", letter: "M", name: "Mandiri", type: "Bank" },
	{ id: "BRI", letter: "B", name: "BRI", type: "Bank" },
	{ id: "BNI", letter: "N", name: "BNI", type: "Bank" },
	{ id: "GoPay", letter: "G", name: "GoPay", type: "E-wallet" },
	{ id: "OVO", letter: "O", name: "OVO", type: "E-wallet" },
];

const importOptions = [
	{
		id: "pdf",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="w-5 h-5"
			>
				<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
				<path d="M14 3v5h5" />
				<path d="M9 13h6M9 17h4" />
			</svg>
		),
		title: "Upload PDF Mutasi",
		badge: "Direkomendasikan",
		desc: "Export dari m-banking kamu, upload di sini. AI mengekstrak transaksi, kategori, dan saldo.",
	},
	{
		id: "screenshot",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="w-5 h-5"
			>
				<rect x="3" y="5" width="18" height="14" rx="2" />
				<circle cx="12" cy="12" r="3.2" />
				<path d="M8 5l1.5-2h5L16 5" />
			</svg>
		),
		title: "Foto Screenshot",
		badge: null,
		desc: "Screenshot dashboard investasi kamu — Bibit, IPOT, Stockbit, Pluang. AI baca semuanya.",
	},
	{
		id: "manual",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="w-5 h-5"
			>
				<path d="M3 17l4-4 4 4 7-7" />
				<path d="M14 6h6v6" />
			</svg>
		),
		title: "Input Manual",
		badge: null,
		desc: "Masukkan transaksi satu per satu. Cocok kalau kamu suka kontrol penuh.",
	},
	{
		id: "skip",
		icon: (
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
				className="w-5 h-5"
			>
				<path d="M9 6l6 6-6 6" />
			</svg>
		),
		title: "Lewati dulu",
		badge: null,
		desc: "Saya akan setup nanti. Bawa saya ke dashboard.",
		isSkip: true,
	},
];

function CheckSvg({ className }: { className?: string }) {
	return (
		<svg viewBox="0 0 12 12" fill="none" className={className}>
			<path
				d="M2.5 6.5l2.4 2.4L9.5 4"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

const stepVariants = {
	enterRight: { opacity: 0, x: 24 },
	leaveLeft: { opacity: 0, x: -24 },
	center: { opacity: 1, x: 0 },
};

export default function OnboardingPage() {
	const router = useRouter();
	const [step, setStep] = useState(1);
	const [direction, setDirection] = useState<"forward" | "back">("forward");
	const [showDone, setShowDone] = useState(false);

	const [nickname, setNickname] = useState("");
	const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
	const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
		new Set(),
	);
	const [balance, setBalance] = useState("");
	const [importMethod, setImportMethod] = useState<string | null>(null);

	const canContinue = useCallback(() => {
		if (step === 1) return nickname.trim().length >= 2 && selectedGoal !== null;
		if (step === 2) return selectedAccounts.size > 0;
		if (step === 3) return importMethod !== null;
		return false;
	}, [step, nickname, selectedGoal, selectedAccounts, importMethod]);

	const goNext = () => {
		if (step < 3) {
			setDirection("forward");
			setStep(step + 1);
		} else {
			setShowDone(true);
			setTimeout(() => router.push("/dashboard"), 1800);
		}
	};

	const goBack = () => {
		if (step > 1) {
			setDirection("back");
			setStep(step - 1);
		}
	};

	const toggleAccount = (id: string) => {
		setSelectedAccounts((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const raw = e.target.value.replace(/\D+/g, "");
		if (!raw) {
			setBalance("");
			return;
		}
		setBalance(Number(raw).toLocaleString("id-ID"));
	};

	return (
		<div className="min-h-screen flex flex-col">
			<header className="h-[72px] max-[720px]:h-16 flex items-center px-10 max-[720px]:px-5 border-b border-gray-100 sticky top-0 bg-white/85 backdrop-saturate-[180%] backdrop-blur-[14px] z-10">
				<div className="w-full max-w-[920px] mx-auto grid grid-cols-[1fr_auto_1fr] max-[720px]:grid-cols-[auto_1fr_auto] items-center gap-6 max-[720px]:gap-4">
					<div>
						{step > 1 ? (
							<button
								onClick={goBack}
								className="inline-flex items-center gap-2 h-9 px-[14px] text-[13px] text-gray-600 rounded-full transition-all duration-200 ease-designhub hover:bg-gray-100 hover:text-gray-950"
							>
								<span className="font-serif text-[18px] leading-none">
									&larr;
								</span>
								Kembali
							</button>
						) : (
							<div />
						)}
					</div>

					<div
						className="flex items-center gap-[14px] justify-self-center"
						aria-label="Progress onboarding"
					>
						<div className="flex gap-[6px]">
							{[1, 2, 3].map((s) => (
								<span
									key={s}
									className="w-9 max-[720px]:w-6 h-[3px] bg-gray-200 rounded-sm overflow-hidden relative"
								>
									<motion.span
										className="absolute inset-0 bg-gray-950 origin-left"
										initial={{ scaleX: 0 }}
										animate={{
											scaleX: s < step ? 1 : s === step ? 1 : 0,
										}}
										transition={{ duration: 0.55, ease }}
									/>
								</span>
							))}
						</div>
						<div className="font-mono text-[13px] text-gray-400 tracking-[0.02em] tabular-nums">
							<strong className="text-gray-950 font-medium">{step}</strong> / 3
						</div>
					</div>

					<div className="justify-self-end">
						<Link
							href="/login"
							className="inline-flex items-center gap-2 h-9 px-[14px] text-[13px] text-gray-600 rounded-full transition-all duration-200 ease-designhub hover:bg-gray-100 hover:text-gray-950"
						>
							Keluar
						</Link>
					</div>
				</div>
			</header>

			<main className="flex-1 flex items-start justify-center px-8 max-[720px]:px-5 pt-[72px] max-[720px]:pt-12 pb-24 max-[720px]:pb-16 relative">
				<div className="w-full max-w-[560px] relative">
					<AnimatePresence mode="wait" initial={false}>
						{step === 1 && (
							<motion.section
								key="step1"
								variants={stepVariants}
								initial={
									direction === "forward" ? "enterRight" : "leaveLeft"
								}
								animate="center"
								exit={
									direction === "forward" ? "leaveLeft" : "enterRight"
								}
								transition={{ duration: 0.25, ease }}
							>
								<div className="font-mono text-[11px] uppercase tracking-[0.16em] text-gray-400 mb-[18px] inline-flex items-center gap-[10px]">
									<span className="inline-block w-6 h-px bg-gray-300" />
									Profil &amp; tujuan
								</div>
								<h1 className="font-serif font-normal text-[clamp(32px,4.4vw,44px)] max-[720px]:text-[30px] leading-[1.05] tracking-display text-gray-950 mb-3">
									Hai! Kita mulai{" "}
									<em className="italic text-gray-700 font-normal">
										dari kamu.
									</em>
								</h1>
								<p className="text-[16px] max-[720px]:text-[15px] leading-[1.6] text-gray-500 mb-10 max-[720px]:mb-8 max-w-[46ch]">
									Ini membantu kami personalisasi insight untuk kondisi
									keuangan kamu.
								</p>

								<div className="mb-8">
									<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium block mb-[10px]">
										Nama panggilan
									</label>
									<input
										type="text"
										className="w-full h-12 px-4 text-[15px] text-gray-950 bg-white border border-gray-300 rounded-lg outline-none transition-all duration-150 ease-designhub hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]"
										placeholder="Misal: Rizky"
										autoComplete="given-name"
										value={nickname}
										onChange={(e) => setNickname(e.target.value)}
									/>
								</div>

								<div className="mb-8">
									<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium block mb-[10px]">
										Tujuan keuangan utama
									</label>
									<div className="flex flex-col border-t border-gray-200">
										{goals.map((g) => (
											<button
												key={g.id}
												type="button"
												onClick={() => setSelectedGoal(g.id)}
												className={cn(
													"flex items-center gap-[18px] py-[18px] px-5 pl-6 border-b border-l-2 text-left transition-all duration-200 ease-designhub select-none",
													selectedGoal === g.id
														? "border-l-gray-950 border-b-gray-950 bg-white"
														: "border-l-transparent border-b-gray-200 hover:bg-gray-50",
												)}
											>
												<span
													className={cn(
														"font-serif text-[22px] w-[22px] text-center leading-none tabular-nums transition-colors duration-250 ease-designhub",
														selectedGoal === g.id
															? "text-gray-950"
															: "text-gray-300",
													)}
												>
													{g.num}
												</span>
												<div className="flex-1 min-w-0">
													<div className="text-[15px] font-medium text-gray-950 leading-[1.3]">
														{g.name}
													</div>
													<div className="text-[13px] text-gray-500 mt-[2px] leading-[1.4]">
														{g.desc}
													</div>
												</div>
												<span
													className={cn(
														"w-5 h-5 rounded-full border grid place-items-center flex-shrink-0 transition-all duration-200 ease-designhub",
														selectedGoal === g.id
															? "bg-gray-950 border-gray-950"
															: "border-gray-300",
													)}
												>
													<CheckSvg
														className={cn(
															"w-[10px] h-[10px] text-white transition-all duration-200 ease-designhub",
															selectedGoal === g.id
																? "opacity-100 scale-100"
																: "opacity-0 scale-50",
														)}
													/>
												</span>
											</button>
										))}
									</div>
								</div>

								<div className="mt-2">
									<button
										disabled={!canContinue()}
										onClick={goNext}
										className={cn(
											"group w-full h-[52px] rounded-full text-[14px] font-medium inline-flex items-center justify-center gap-[10px] transition-all duration-200 ease-designhub relative overflow-hidden",
											canContinue()
												? "bg-gray-950 text-white hover:translate-y-[-1px] hover:bg-black"
												: "bg-gray-200 text-gray-500 cursor-not-allowed",
										)}
									>
										Lanjut{" "}
										<span className="inline-block font-serif text-[18px] leading-none transition-transform duration-250 ease-designhub group-not-disabled:group-hover:translate-x-1">
											&rarr;
										</span>
									</button>
								</div>
							</motion.section>
						)}

						{step === 2 && (
							<motion.section
								key="step2"
								variants={stepVariants}
								initial={
									direction === "forward" ? "enterRight" : "leaveLeft"
								}
								animate="center"
								exit={
									direction === "forward" ? "leaveLeft" : "enterRight"
								}
								transition={{ duration: 0.25, ease }}
							>
								<div className="font-mono text-[11px] uppercase tracking-[0.16em] text-gray-400 mb-[18px] inline-flex items-center gap-[10px]">
									<span className="inline-block w-6 h-px bg-gray-300" />
									Rekening pertama
								</div>
								<h1 className="font-serif font-normal text-[clamp(32px,4.4vw,44px)] max-[720px]:text-[30px] leading-[1.05] tracking-display text-gray-950 mb-3">
									Rekening mana yang paling sering{" "}
									<em className="italic text-gray-700 font-normal">
										kamu pakai?
									</em>
								</h1>
								<p className="text-[16px] max-[720px]:text-[15px] leading-[1.6] text-gray-500 mb-10 max-[720px]:mb-8 max-w-[46ch]">
									Kamu bisa tambah lebih banyak nanti. Pilih satu atau
									beberapa untuk mulai.
								</p>

								<div className="mb-8">
									<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium block mb-[10px]">
										Bank &amp; e-wallet
									</label>
									<div className="grid grid-cols-3 max-[720px]:grid-cols-2 gap-[10px] mb-7">
										{banks.map((b) => (
											<button
												key={b.id}
												type="button"
												onClick={() => toggleAccount(b.id)}
												className={cn(
													"border rounded-[10px] p-[18px_14px] flex flex-col items-start gap-[10px] bg-white relative min-h-[96px] transition-all duration-250 ease-designhub select-none",
													selectedAccounts.has(b.id)
														? "border-gray-950 shadow-[inset_0_0_0_1px_#0a0a0a]"
														: "border-gray-200 hover:border-gray-400",
												)}
											>
												<span
													className={cn(
														"w-8 h-8 rounded-lg grid place-items-center font-serif text-[15px] leading-none font-medium transition-all duration-200 ease-designhub",
														selectedAccounts.has(b.id)
															? "bg-gray-950 text-white"
															: "bg-gray-100 text-gray-800",
													)}
												>
													{b.letter}
												</span>
												<div>
													<div className="text-[14px] font-medium text-gray-950">
														{b.name}
													</div>
													<div className="text-[11px] text-gray-400 uppercase tracking-[0.08em]">
														{b.type}
													</div>
												</div>
												<span
													className={cn(
														"absolute top-3 right-3 w-[18px] h-[18px] rounded-full bg-gray-950 grid place-items-center transition-transform duration-250 ease-designhub",
														selectedAccounts.has(b.id)
															? "scale-100"
															: "scale-0",
													)}
												>
													<CheckSvg className="w-[10px] h-[10px] text-white" />
												</span>
											</button>
										))}
									</div>

									<button
										type="button"
										onClick={() => toggleAccount("_other")}
										className={cn(
											"w-full border border-dashed rounded-[10px] p-[14px] flex flex-row items-center justify-center gap-2 text-gray-500 transition-all duration-250 ease-designhub select-none",
											selectedAccounts.has("_other")
												? "border-gray-950 shadow-[inset_0_0_0_1px_#0a0a0a]"
												: "border-gray-200 hover:border-gray-400",
										)}
									>
										<span className="font-serif text-[22px] text-gray-500 leading-none">
											+
										</span>
										<span className="text-[13px] text-gray-600">
											Lainnya &mdash; Jenius, Permata, Stockbit, &hellip;
										</span>
									</button>
								</div>

								<div className="mb-8">
									<label className="text-[11px] uppercase tracking-labelWide text-gray-500 font-medium block mb-[10px]">
										Saldo saat ini (estimasi)
									</label>
									<div className="relative">
										<span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-gray-500 font-medium pointer-events-none">
											Rp
										</span>
										<input
											type="text"
											inputMode="numeric"
											className="w-full h-12 pl-10 pr-4 text-[15px] text-gray-950 bg-white border border-gray-300 rounded-lg outline-none transition-all duration-150 ease-designhub tabular-nums hover:border-gray-400 focus:border-gray-950 focus:shadow-[0_0_0_3px_rgba(10,10,10,0.06)]"
											placeholder="0"
											value={balance}
											onChange={handleBalanceChange}
										/>
									</div>
									<div className="text-[12px] text-gray-400 mt-2">
										Tidak perlu presisi &mdash; bisa kamu update kapan saja.
									</div>
								</div>

								<div className="mt-2">
									<button
										disabled={!canContinue()}
										onClick={goNext}
										className={cn(
											"group w-full h-[52px] rounded-full text-[14px] font-medium inline-flex items-center justify-center gap-[10px] transition-all duration-200 ease-designhub relative overflow-hidden",
											canContinue()
												? "bg-gray-950 text-white hover:translate-y-[-1px] hover:bg-black"
												: "bg-gray-200 text-gray-500 cursor-not-allowed",
										)}
									>
										Lanjut{" "}
										<span className="inline-block font-serif text-[18px] leading-none transition-transform duration-250 ease-designhub group-not-disabled:group-hover:translate-x-1">
											&rarr;
										</span>
									</button>
								</div>
							</motion.section>
						)}

						{step === 3 && (
							<motion.section
								key="step3"
								variants={stepVariants}
								initial={
									direction === "forward" ? "enterRight" : "leaveLeft"
								}
								animate="center"
								exit={
									direction === "forward" ? "leaveLeft" : "enterRight"
								}
								transition={{ duration: 0.25, ease }}
							>
								<div className="font-mono text-[11px] uppercase tracking-[0.16em] text-gray-400 mb-[18px] inline-flex items-center gap-[10px]">
									<span className="inline-block w-6 h-px bg-gray-300" />
									Cara import data
								</div>
								<h1 className="font-serif font-normal text-[clamp(32px,4.4vw,44px)] max-[720px]:text-[30px] leading-[1.05] tracking-display text-gray-950 mb-3">
									Pilih cara import data{" "}
									<em className="italic text-gray-700 font-normal">
										pertama kamu.
									</em>
								</h1>
								<p className="text-[16px] max-[720px]:text-[15px] leading-[1.6] text-gray-500 mb-10 max-[720px]:mb-8 max-w-[46ch]">
									Pilih yang paling mudah untuk kamu sekarang. Kamu bisa
									coba metode lain nanti.
								</p>

								<div className="flex flex-col gap-[10px] mb-8">
									{importOptions.map((opt) => (
										<button
											key={opt.id}
											type="button"
											onClick={() => setImportMethod(opt.id)}
											className={cn(
												"flex items-center gap-[18px] p-[20px_22px] border rounded-[10px] bg-white text-left transition-all duration-250 ease-designhub select-none",
												opt.isSkip && "bg-gray-50 border-dashed",
												importMethod === opt.id
													? "border-gray-950 shadow-[inset_0_0_0_1px_#0a0a0a]"
													: "border-gray-200 hover:border-gray-400",
											)}
										>
											<div
												className={cn(
													"w-11 h-11 rounded-[10px] grid place-items-center flex-shrink-0 transition-all duration-200 ease-designhub",
													opt.isSkip && importMethod !== opt.id
														? "bg-transparent text-gray-400"
														: importMethod === opt.id
															? "bg-gray-950 text-white"
															: "bg-gray-100 text-gray-700",
												)}
											>
												{opt.icon}
											</div>
											<div className="flex-1 min-w-0">
												<div
													className={cn(
														"text-[15px] font-medium leading-[1.3] flex items-center gap-[10px]",
														opt.isSkip
															? "text-gray-600 font-normal"
															: "text-gray-950",
													)}
												>
													{opt.title}
													{opt.badge && (
														<span className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-[3px] bg-gray-950 text-white rounded-full font-medium">
															{opt.badge}
														</span>
													)}
												</div>
												<div className="text-[13px] text-gray-500 mt-[2px] leading-[1.45]">
													{opt.desc}
												</div>
											</div>
											<span
												className={cn(
													"w-[18px] h-[18px] rounded-full border flex-shrink-0 grid place-items-center transition-all duration-200 ease-designhub",
													importMethod === opt.id
														? "border-gray-950"
														: "border-gray-300",
												)}
											>
												<span
													className={cn(
														"w-2 h-2 rounded-full bg-gray-950 transition-transform duration-200 ease-designhub",
														importMethod === opt.id
															? "scale-100"
															: "scale-0",
													)}
												/>
											</span>
										</button>
									))}
								</div>

								<div className="mt-2">
									<button
										disabled={!canContinue()}
										onClick={goNext}
										className={cn(
											"group w-full h-[52px] rounded-full text-[14px] font-medium inline-flex items-center justify-center gap-[10px] transition-all duration-200 ease-designhub relative overflow-hidden",
											canContinue()
												? "bg-gray-950 text-white hover:translate-y-[-1px] hover:bg-black"
												: "bg-gray-200 text-gray-500 cursor-not-allowed",
										)}
									>
										Mulai{" "}
										<span className="inline-block font-serif text-[18px] leading-none transition-transform duration-250 ease-designhub group-not-disabled:group-hover:translate-x-1">
											&rarr;
										</span>
									</button>
								</div>

								<div className="mt-[18px] text-[12px] text-gray-400 text-center flex items-center justify-center gap-[6px]">
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="1.8"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="w-3 h-3"
									>
										<rect x="4" y="11" width="16" height="9" rx="2" />
										<path d="M8 11V8a4 4 0 0 1 8 0v3" />
									</svg>
									Semua data kamu terenkripsi end-to-end dan aman.
								</div>
							</motion.section>
						)}
					</AnimatePresence>
				</div>
			</main>

			<AnimatePresence>
				{showDone && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.35, ease }}
						className="fixed inset-0 bg-white flex flex-col items-center justify-center text-center p-10 z-50"
					>
						<motion.div
							initial={{ scale: 0.7, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ duration: 0.45, ease, delay: 0.1 }}
							className="w-20 h-20 rounded-full bg-gray-950 grid place-items-center mb-6"
						>
							<svg
								viewBox="0 0 24 24"
								fill="none"
								className="w-9 h-9 text-white"
							>
								<motion.path
									d="M5 12.5l4.5 4.5L19 7.5"
									stroke="currentColor"
									strokeWidth="2.4"
									strokeLinecap="round"
									strokeLinejoin="round"
									initial={{ pathLength: 0 }}
									animate={{ pathLength: 1 }}
									transition={{ duration: 0.55, ease, delay: 0.35 }}
								/>
							</svg>
						</motion.div>
						<h2 className="font-serif font-normal text-[36px] tracking-tight2 text-gray-950 mb-2">
							Setup <em className="italic text-gray-600 font-normal">selesai.</em>
						</h2>
						<p className="text-[15px] text-gray-500 max-w-[38ch]">
							Mengarahkan kamu ke dashboard FinanceAI...
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
