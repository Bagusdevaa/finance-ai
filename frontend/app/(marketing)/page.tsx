"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/cn";

const ease = [0.2, 0.7, 0.2, 1] as const;

const marqueeItems = [
	"BCA",
	"Mandiri",
	"BRI",
	"BNI",
	"Bibit",
	"IPOT",
	"Stockbit",
	"Pluang",
	"GoPay",
	"OVO",
	"DANA",
	"Jenius",
];

const features = [
	{
		num: "01",
		name: "Import Otomatis",
		desc: "Upload PDF mutasi atau foto screenshot — AI mengekstrak setiap transaksi, kategori, dan saldonya.",
	},
	{
		num: "02",
		name: "Net Worth Real-time",
		desc: "Total aset dari semua platform dirangkum jadi satu angka. Berubah tiap kali pasar buka.",
	},
	{
		num: "03",
		name: "AI Financial Advisor",
		desc: "Tanya apa saja tentang kondisi keuanganmu. Mulai dari rasio tabungan sampai diversifikasi portofolio.",
	},
	{
		num: "04",
		name: "Multi-akun Saham",
		desc: "Agregasi portofolio dari beberapa broker secara otomatis — IPOT, Stockbit, Mirae, BNI Sekuritas.",
	},
	{
		num: "05",
		name: "Budget Tracker",
		desc: "Set target per kategori, dan dapatkan alert lembut saat pengeluaran kamu melampaui rencana.",
	},
	{
		num: "06",
		name: "Laporan Bulanan",
		desc: "Ringkasan otomatis dikirim ke email setiap awal bulan — pencapaian, anomali, dan rekomendasi.",
	},
];

const steps = [
	{
		target: 1,
		title: "Daftar & setup akun",
		desc: "Masukkan nama, tujuan keuangan, dan rekening pertamamu. Setup tidak sampai 90 detik.",
	},
	{
		target: 2,
		title: "Import data kamu",
		desc: "Upload PDF mutasi, foto screenshot portofolio, atau input manual. Semua format kami terima.",
	},
	{
		target: 3,
		title: "Biarkan AI bekerja",
		desc: "Tanya apa saja. Dapatkan insight yang tidak pernah kamu sadari sebelumnya tentang uangmu.",
	},
];

const footerLinks = {
	Produk: ["Fitur", "Harga", "Integrasi", "Changelog"],
	Perusahaan: ["Tentang", "Blog", "Karir", "Kontak"],
	Legal: ["Syarat & Ketentuan", "Kebijakan Privasi", "Keamanan", "OJK"],
};

function LogoMark({ dark = false }: { dark?: boolean }) {
	return (
		<span
			className={cn(
				"relative inline-block w-[22px] h-[22px] rounded-full",
				dark ? "bg-white" : "bg-gray-950",
			)}
		>
			<span
				className={cn(
					"absolute inset-[6px] rounded-full",
					dark ? "bg-black" : "bg-white",
				)}
			/>
		</span>
	);
}

function RevealSection({
	children,
	className,
	delay = 0,
}: {
	children: React.ReactNode;
	className?: string;
	delay?: number;
}) {
	const ref = useRef(null);
	const isInView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 20 }}
			animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
			transition={{ duration: 0.7, ease, delay }}
			className={className}
		>
			{children}
		</motion.div>
	);
}

function CountUpNumber({ target, inView }: { target: number; inView: boolean }) {
	const [value, setValue] = useState(0);
	const hasAnimated = useRef(false);

	useEffect(() => {
		if (!inView || hasAnimated.current) return;
		hasAnimated.current = true;
		const duration = 900;
		const start = performance.now();
		function tick(now: number) {
			const t = Math.min(1, (now - start) / duration);
			const eased = 1 - Math.pow(1 - t, 3);
			setValue(Math.round(eased * target));
			if (t < 1) requestAnimationFrame(tick);
			else setValue(target);
		}
		requestAnimationFrame(tick);
	}, [inView, target]);

	return <>{String(value).padStart(2, "0")}</>;
}

function HiwStep({
	s,
	index,
}: {
	s: (typeof steps)[number];
	index: number;
}) {
	const ref = useRef(null);
	const isInView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 20 }}
			animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
			transition={{ duration: 0.7, ease, delay: index * 0.06 }}
			className="py-14 px-10 max-[880px]:py-12 max-[880px]:px-6 border-r border-gray-800 last:border-r-0 max-[880px]:border-r-0 max-[880px]:border-b max-[880px]:border-gray-800 max-[880px]:last:border-b-0 relative group"
		>
			<div className="font-serif font-light text-[128px] max-[880px]:text-[96px] leading-none text-gray-700 tracking-[-0.04em] mb-12 max-[880px]:mb-8 tabular-nums transition-colors duration-[400ms] ease-designhub group-hover:text-gray-500">
				<CountUpNumber target={s.target} inView={isInView} />
			</div>
			<h3 className="text-[22px] font-medium text-white tracking-tight2 mb-[14px]">
				{s.title}
			</h3>
			<p className="text-[15px] leading-[1.7] text-gray-400 max-w-[38ch]">
				{s.desc}
			</p>
		</motion.div>
	);
}

export default function LandingPage() {
	const [scrolled, setScrolled] = useState(false);
	const heroTextRef = useRef(null);
	const heroInView = useInView(heroTextRef, { once: true });
	const dashRef = useRef(null);
	const dashInView = useInView(dashRef, { once: true });

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 60);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	return (
		<>
			{/* NAV */}
			<nav
				className={cn(
					"fixed inset-x-0 top-0 z-50 h-[72px] flex items-center transition-all duration-350 ease-designhub border-b",
					scrolled
						? "bg-white/[0.78] backdrop-saturate-[180%] backdrop-blur-[16px] border-gray-200"
						: "border-transparent",
				)}
			>
				<div className="w-full max-w-[1200px] mx-auto px-8 max-[880px]:px-5 flex items-center justify-between gap-6">
					<Link
						href="/"
						className="font-serif text-[22px] font-normal tracking-tight2 leading-none flex items-center gap-2"
					>
						<LogoMark />
						FinanceAI
					</Link>
					<div className="hidden min-[880px]:flex gap-9 items-center text-[14px] text-gray-600">
						<a
							href="#fitur"
							className="relative transition-colors duration-200 ease-designhub hover:text-gray-950 group"
						>
							Fitur
							<span className="absolute left-0 right-0 -bottom-[6px] h-px bg-gray-950 scale-x-0 origin-left transition-transform duration-300 ease-designhub group-hover:scale-x-100" />
						</a>
						<a
							href="#cara-kerja"
							className="relative transition-colors duration-200 ease-designhub hover:text-gray-950 group"
						>
							Cara Kerja
							<span className="absolute left-0 right-0 -bottom-[6px] h-px bg-gray-950 scale-x-0 origin-left transition-transform duration-300 ease-designhub group-hover:scale-x-100" />
						</a>
						<a
							href="#harga"
							className="relative transition-colors duration-200 ease-designhub hover:text-gray-950 group"
						>
							Harga
							<span className="absolute left-0 right-0 -bottom-[6px] h-px bg-gray-950 scale-x-0 origin-left transition-transform duration-300 ease-designhub group-hover:scale-x-100" />
						</a>
					</div>
					<Link
						href="/login#register"
						className="inline-flex items-center gap-2 h-10 px-[18px] text-[14px] font-medium rounded-full bg-gray-950 text-white transition-all duration-200 ease-designhub hover:bg-black hover:translate-y-[-1px] whitespace-nowrap leading-none"
					>
						Mulai Gratis
					</Link>
				</div>
			</nav>

			{/* HERO */}
			<section className="min-h-screen max-[880px]:min-h-0 pt-[120px] max-[880px]:pt-[110px] pb-20 max-[880px]:pb-[60px] flex items-center relative overflow-hidden">
				<div
					className="absolute inset-0 pointer-events-none"
					style={{
						background:
							"radial-gradient(800px 400px at 80% 30%, rgba(0,0,0,0.02), transparent 60%), radial-gradient(600px 400px at 10% 80%, rgba(0,0,0,0.025), transparent 60%)",
					}}
				/>
				<div className="w-full max-w-[1200px] mx-auto px-8 max-[880px]:px-5 relative">
					<div className="grid grid-cols-[55fr_45fr] max-[880px]:grid-cols-1 gap-16 max-[880px]:gap-[60px] items-center">
						<div ref={heroTextRef}>
							{[
								<div
									key="eyebrow"
									className="text-[11px] uppercase tracking-labelExtra text-gray-500 font-medium inline-flex items-center gap-[10px]"
								>
									<span className="inline-block w-6 h-px bg-gray-400" />
									Personal Finance Platform
								</div>,
								<h1
									key="heading"
									className="font-serif font-normal text-[clamp(40px,6.2vw,72px)] leading-[1.0] tracking-display mt-6 mb-6 text-gray-950"
								>
									Semua keuangan&nbsp;kamu,
									<br />
									<em className="italic font-normal text-gray-700">
										dalam satu tempat.
									</em>
								</h1>,
								<p
									key="sub"
									className="text-[18px] leading-[1.6] text-gray-600 max-w-[480px] mb-9"
								>
									Hubungkan rekening bank, investasi saham, reksa dana,
									dan e-wallet. AI kami akan menganalisis pola keuangan
									kamu &mdash; tanpa spreadsheet, tanpa tebakan.
								</p>,
								<div
									key="cta"
									className="flex items-center gap-6 flex-wrap mb-8"
								>
									<Link
										href="/login#register"
										className="inline-flex items-center gap-2 h-10 px-[18px] text-[14px] font-medium rounded-full bg-gray-950 text-white transition-all duration-200 ease-designhub hover:bg-black hover:translate-y-[-1px] leading-none max-[480px]:flex-1 max-[480px]:justify-center"
									>
										Mulai Gratis
									</Link>
									<Link
										href="/login"
										className="group text-[14px] text-gray-600 inline-flex items-center gap-[6px] transition-all duration-200 ease-designhub hover:text-gray-950 hover:gap-[10px]"
									>
										Sudah punya akun? Masuk &rarr;
									</Link>
								</div>,
								<div
									key="social"
									className="flex items-center gap-3 text-[12px] text-gray-400"
								>
									<div className="flex" aria-hidden="true">
										{[
											"bg-[#3a3a3a]",
											"bg-[#5e5e5e] -ml-[6px]",
											"bg-[#8a8a8a] -ml-[6px]",
											"bg-[#b5b5b5] -ml-[6px]",
										].map((cls, i) => (
											<span
												key={i}
												className={cn(
													"w-[22px] h-[22px] rounded-full border-[1.5px] border-white inline-block",
													cls,
													i === 0 && "ml-0",
												)}
											/>
										))}
									</div>
									Dipercaya 2.400+ pengguna di Indonesia
								</div>,
							].map((child, i) => (
								<motion.div
									key={i}
									initial={{ opacity: 0, y: 18 }}
									animate={
										heroInView
											? { opacity: 1, y: 0 }
											: { opacity: 0, y: 18 }
									}
									transition={{
										duration: 0.8,
										ease,
										delay: 0.05 + i * 0.1,
									}}
								>
									{child}
								</motion.div>
							))}
						</div>

						<motion.div
							ref={dashRef}
							initial={{ opacity: 0, x: 40 }}
							animate={
								dashInView
									? { opacity: 1, x: 0 }
									: { opacity: 0, x: 40 }
							}
							transition={{ duration: 1, ease, delay: 0.3 }}
							className="relative max-[880px]:transform-none"
							style={{ perspective: 1200 }}
							aria-hidden="true"
						>
							<div
								className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden"
								style={{
									boxShadow:
										"0 1px 0 rgba(255,255,255,.7) inset, 0 30px 60px -20px rgba(0,0,0,.18), 0 12px 24px -8px rgba(0,0,0,.10), 0 2px 6px rgba(0,0,0,.04)",
									animation: "float 7s ease-in-out infinite",
								}}
							>
								<div className="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-100">
									<div className="flex gap-[6px]">
										<i className="w-[9px] h-[9px] rounded-full bg-gray-200 inline-block" />
										<i className="w-[9px] h-[9px] rounded-full bg-gray-200 inline-block" />
										<i className="w-[9px] h-[9px] rounded-full bg-gray-200 inline-block" />
									</div>
									<div className="text-[11px] text-gray-400 tracking-[0.06em] uppercase font-medium">
										Overview &middot; April 2026
									</div>
									<div className="text-[11px] text-gray-400">
										&#8984;K
									</div>
								</div>

								<div className="px-[26px] pt-6 pb-[22px]">
									<div className="text-[11px] tracking-labelWide uppercase text-gray-400 font-medium">
										Total Net Worth
									</div>
									<div className="font-serif font-normal text-[54px] max-[480px]:text-[42px] leading-none tracking-display text-gray-950 mt-2 mb-[6px] flex items-baseline gap-2">
										Rp 487.620.450
										<small className="font-sans text-[13px] text-gray-400 font-medium tracking-[0.04em]">
											IDR
										</small>
									</div>
									<div className="inline-flex items-center gap-[6px] text-[12px] text-gray-700 font-medium">
										<span className="inline-block w-0 h-0 border-[4px] border-transparent border-b-gray-700 mb-[2px]" />
										+ Rp 12,4 jt &nbsp;&middot;&nbsp; 2,6% bulan ini
									</div>

									<svg
										className="mt-[18px] mb-5 h-[88px] w-full"
										viewBox="0 0 320 88"
										preserveAspectRatio="none"
									>
										<defs>
											<linearGradient
												id="g1"
												x1="0"
												x2="0"
												y1="0"
												y2="1"
											>
												<stop
													offset="0%"
													stopColor="#0a0a0a"
													stopOpacity=".12"
												/>
												<stop
													offset="100%"
													stopColor="#0a0a0a"
													stopOpacity="0"
												/>
											</linearGradient>
										</defs>
										<path
											d="M0,72 C20,65 35,68 55,55 C80,40 100,52 120,46 C140,40 160,28 180,32 C200,36 220,18 245,22 C265,25 285,10 320,8 L320,88 L0,88 Z"
											fill="url(#g1)"
										/>
										<path
											d="M0,72 C20,65 35,68 55,55 C80,40 100,52 120,46 C140,40 160,28 180,32 C200,36 220,18 245,22 C265,25 285,10 320,8"
											fill="none"
											stroke="#0a0a0a"
											strokeWidth="1.6"
											strokeLinecap="round"
										/>
										<g
											stroke="#e8e8e8"
											strokeWidth="1"
											strokeDasharray="2 4"
										>
											<line x1="0" y1="22" x2="320" y2="22" />
											<line x1="0" y1="55" x2="320" y2="55" />
										</g>
										<circle cx="245" cy="22" r="3.5" fill="#0a0a0a" />
										<circle
											cx="245"
											cy="22"
											r="7"
											fill="#0a0a0a"
											fillOpacity=".12"
										/>
									</svg>

									<div className="flex gap-2 mb-5">
										{[
											{ name: "BCA", muted: false },
											{ name: "Bibit", muted: false },
											{ name: "IPOT", muted: false },
											{ name: "+ 4 lainnya", muted: true },
										].map((pill) => (
											<span
												key={pill.name}
												className={cn(
													"text-[11px] py-[6px] px-[10px] border rounded-full inline-flex items-center gap-[6px]",
													pill.muted
														? "text-gray-400 bg-white border-gray-200"
														: "text-gray-700 bg-gray-50 border-gray-200",
												)}
											>
												<span
													className={cn(
														"w-[5px] h-[5px] rounded-full inline-block",
														pill.muted
															? "bg-gray-300"
															: "bg-gray-700",
													)}
												/>
												{pill.name}
											</span>
										))}
									</div>

									<div className="border-t border-gray-100">
										{[
											{
												icon: "B",
												name: "Bibit · Top up RDPU",
												meta: "Hari ini · 14:22",
												amount: "− Rp 2.500.000",
												neg: true,
											},
											{
												icon: "G",
												name: "Gaji April",
												meta: "25 Apr · BCA",
												amount: "+ Rp 18.500.000",
												neg: false,
											},
											{
												icon: "I",
												name: "IPOT · BBCA dividen",
												meta: "23 Apr · Saham",
												amount: "+ Rp 340.000",
												neg: false,
											},
										].map((tx) => (
											<div
												key={tx.name}
												className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0"
											>
												<div className="flex items-center gap-3">
													<div className="w-[34px] h-[34px] rounded-[10px] bg-gray-100 grid place-items-center text-gray-700 text-[13px] font-semibold font-serif">
														{tx.icon}
													</div>
													<div>
														<div className="text-[13px] font-medium text-gray-900 leading-[1.2]">
															{tx.name}
														</div>
														<div className="text-[11px] text-gray-400 mt-[2px]">
															{tx.meta}
														</div>
													</div>
												</div>
												<div
													className={cn(
														"text-[13px] font-medium tabular-nums",
														tx.neg
															? "text-gray-500"
															: "text-gray-900",
													)}
												>
													{tx.amount}
												</div>
											</div>
										))}
									</div>
								</div>
							</div>

							<div
								className="absolute -top-[18px] -left-8 max-[880px]:-left-2 max-[880px]:-top-[14px] bg-white border border-gray-200 rounded-xl px-[14px] py-[10px] flex items-center gap-[10px] text-[12px]"
								style={{
									boxShadow: "0 12px 30px -10px rgba(0,0,0,.18)",
									animation:
										"floatTag 6s ease-in-out infinite -2s",
									transform: "rotate(2deg)",
								}}
							>
								<span className="w-2 h-2 rounded-full bg-gray-950 shadow-[0_0_0_4px_rgba(10,10,10,0.08)]" />
								<div>
									<div className="font-medium text-gray-900">
										AI Insight
									</div>
									<div className="text-gray-500">
										Pengeluaran F&amp;B turun 18%
									</div>
								</div>
							</div>
							<div
								className="absolute -bottom-[22px] -right-7 max-[880px]:-right-2 max-[880px]:-bottom-4 bg-white border border-gray-200 rounded-xl px-[14px] py-[10px] flex items-center gap-[10px] text-[12px]"
								style={{
									boxShadow: "0 12px 30px -10px rgba(0,0,0,.18)",
									animation:
										"floatTag 6s ease-in-out infinite -4s",
									transform: "rotate(-3deg)",
								}}
							>
								<div>
									<div className="font-medium text-gray-900">
										Aset terhubung
									</div>
									<div className="text-gray-500">
										7 platform &middot; sinkron
									</div>
								</div>
								<span className="font-serif text-[18px] text-gray-700">
									&#8635;
								</span>
							</div>
						</motion.div>
					</div>
				</div>
			</section>

			{/* MARQUEE */}
			<section
				className="bg-gray-50 border-t border-b border-gray-200 py-7 overflow-hidden"
				aria-label="Mendukung data dari"
			>
				<div className="max-w-[1200px] mx-auto px-8 max-[880px]:px-5">
					<div className="flex items-center gap-12">
						<div className="flex-shrink-0 text-[11px] max-[880px]:text-[10px] uppercase tracking-labelExtra text-gray-400 font-medium pr-6 max-[880px]:pr-4 border-r border-gray-200 mr-6 max-[880px]:mr-4 whitespace-nowrap">
							Mendukung data dari
						</div>
						<div
							className="flex-1 overflow-hidden"
							style={{
								maskImage:
									"linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
								WebkitMaskImage:
									"linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
							}}
						>
							<div
								className="flex w-max gap-16 max-[480px]:gap-12 hover:[animation-play-state:paused]"
								style={{
									animation: "marquee 38s linear infinite",
								}}
							>
								{[...marqueeItems, ...marqueeItems].map(
									(item, i) => (
										<span
											key={`${item}-${i}`}
											className="font-serif text-[28px] max-[480px]:text-[22px] text-gray-500 tracking-tight2 whitespace-nowrap leading-none"
										>
											{item}
											{i < marqueeItems.length * 2 - 1 && (
												<span className="ml-16 max-[480px]:ml-12 text-gray-300">
													&middot;
												</span>
											)}
										</span>
									),
								)}
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* FEATURES */}
			<section
				id="fitur"
				className="py-[140px] max-[880px]:py-[90px] bg-white"
			>
				<div className="max-w-[1200px] mx-auto px-8 max-[880px]:px-5">
					<RevealSection className="text-center mb-20">
						<div className="text-gray-400 text-[11px] uppercase tracking-labelExtra font-medium flex items-center justify-center gap-[10px]">
							Fitur
						</div>
						<h2 className="font-serif font-normal text-[clamp(34px,4.5vw,56px)] leading-[1.05] tracking-display mt-[18px] text-gray-950">
							Satu dashboard.
							<br />
							<em className="italic text-gray-600 font-normal">
								Semua instrumen.
							</em>
						</h2>
					</RevealSection>

					<div className="grid grid-cols-3 max-[880px]:grid-cols-1 border-t border-l border-gray-200">
						{features.map((f, i) => (
							<RevealSection
								key={f.num}
								delay={i * 0.06}
								className="group p-[44px_36px_40px] border-r border-b border-gray-200 relative bg-white transition-colors duration-300 ease-designhub hover:bg-gray-50 min-h-[280px]"
							>
								<div className="font-serif font-light text-[88px] max-[880px]:text-[72px] leading-none text-gray-100 absolute top-6 right-8 pointer-events-none select-none tracking-display transition-colors duration-300 ease-designhub group-hover:text-gray-200">
									{f.num}
								</div>
								<h3 className="text-[20px] font-medium text-gray-950 tracking-tight2 mb-3 relative pt-[88px]">
									{f.name}
								</h3>
								<p className="text-[15px] leading-[1.7] text-gray-600 max-w-[34ch]">
									{f.desc}
								</p>
								<span className="absolute bottom-7 left-9 text-[14px] text-gray-400 transition-all duration-250 ease-designhub inline-flex items-center gap-[6px] group-hover:text-gray-950 group-hover:translate-x-1">
									Pelajari &rarr;
								</span>
							</RevealSection>
						))}
					</div>
				</div>
			</section>

			{/* HOW IT WORKS */}
			<section
				id="cara-kerja"
				className="bg-gray-950 text-white py-[140px] max-[880px]:py-[90px]"
			>
				<div className="max-w-[1200px] mx-auto px-8 max-[880px]:px-5">
					<RevealSection className="text-center mb-[72px]">
						<div className="text-gray-500 text-[11px] uppercase tracking-labelExtra font-medium flex items-center justify-center gap-[10px]">
							Cara Kerja
						</div>
						<h2 className="font-serif font-normal text-[clamp(34px,4.5vw,56px)] leading-[1.05] tracking-display mt-[18px] text-white">
							Mulai dalam
							<br />
							<em className="italic text-gray-500 font-normal">
								3 langkah.
							</em>
						</h2>
					</RevealSection>

					<div className="grid grid-cols-3 max-[880px]:grid-cols-1 border-t border-gray-800 max-[880px]:border-t-0">
						{steps.map((s, i) => (
							<HiwStep key={s.target} s={s} index={i} />
						))}
					</div>
				</div>
			</section>

			{/* TESTIMONIAL */}
			<section className="bg-white py-[160px] max-[880px]:py-[90px] text-center relative overflow-hidden">
				<RevealSection className="max-w-[780px] mx-auto relative px-8">
					<span
						className="font-serif text-[240px] max-[880px]:text-[160px] leading-none text-gray-100 absolute -top-[60px] max-[880px]:-top-[30px] left-0 max-[880px]:left-2 pointer-events-none select-none italic"
						aria-hidden="true"
					>
						&ldquo;
					</span>
					<p className="font-serif font-normal italic text-[clamp(26px,3.2vw,36px)] leading-[1.35] text-gray-950 tracking-tight2 mb-9 relative">
						Pertama kalinya saya tahu persis berapa total kekayaan
						bersih saya. Termasuk saham di IPOT dan emas di Pluang.
					</p>
					<div className="inline-flex items-center gap-[14px] text-[14px] text-gray-400">
						<span
							className="w-9 h-9 rounded-full inline-flex items-center justify-center text-white text-[13px] font-medium font-serif"
							style={{
								background: "linear-gradient(135deg,#3a3a3a,#777)",
							}}
						>
							R
						</span>
						<span>
							Rizky A. &nbsp;&middot;&nbsp; Software Engineer, Jakarta
						</span>
					</div>
				</RevealSection>
			</section>

			{/* FINAL CTA */}
			<section
				id="daftar"
				className="bg-black text-white py-[160px] max-[880px]:py-[90px] text-center"
			>
				<div className="max-w-[1200px] mx-auto px-8 max-[880px]:px-5">
					<RevealSection>
						<h2 className="font-serif font-light text-[clamp(36px,4.6vw,56px)] leading-[1.05] tracking-display text-white max-w-[18ch] mx-auto mb-6">
							Mulai tracking keuangan
							<br />
							kamu{" "}
							<em className="italic font-normal text-gray-500">
								hari ini.
							</em>
						</h2>
						<p className="text-[16px] text-gray-400 max-w-[42ch] mx-auto mb-10 leading-[1.6]">
							Gratis selamanya untuk fitur dasar. Tidak perlu kartu
							kredit, tidak perlu komitmen.
						</p>
						<Link
							href="/login#register"
							className="group inline-flex items-center justify-center h-14 px-8 text-[15px] font-medium bg-white text-black rounded-full min-w-[280px] relative overflow-hidden transition-transform duration-250 ease-designhub hover:translate-y-[-2px]"
						>
							<span className="inline-block transition-all duration-350 ease-designhub group-hover:-translate-x-5 group-hover:opacity-0">
								Daftar Gratis Sekarang
							</span>
							<span className="absolute inset-0 flex items-center justify-center font-serif text-[24px] translate-x-5 opacity-0 transition-all duration-350 ease-designhub group-hover:translate-x-0 group-hover:opacity-100">
								&rarr;
							</span>
						</Link>
					</RevealSection>
				</div>
			</section>

			{/* FOOTER */}
			<footer className="bg-black text-gray-500 border-t border-gray-800 pt-20 pb-12">
				<div className="max-w-[1200px] mx-auto px-8 max-[880px]:px-5">
					<div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] max-[880px]:grid-cols-2 max-[480px]:grid-cols-1 gap-12 max-[880px]:gap-8">
						<div>
							<Link
								href="/"
								className="font-serif text-[22px] font-normal tracking-tight2 leading-none flex items-center gap-2 text-white"
							>
								<LogoMark dark />
								FinanceAI
							</Link>
							<p className="text-[13px] leading-[1.6] text-gray-500 max-w-[28ch] mt-[18px]">
								Personal finance platform untuk profesional muda
								Indonesia.
							</p>
						</div>
						{Object.entries(footerLinks).map(([title, links]) => (
							<div key={title}>
								<h4 className="text-[12px] uppercase tracking-labelWide text-gray-300 font-medium mb-4">
									{title}
								</h4>
								<ul className="flex flex-col gap-[10px]">
									{links.map((link) => (
										<li key={link}>
											<a
												href="#"
												className="text-[14px] text-gray-500 transition-colors duration-200 ease-designhub hover:text-white"
											>
												{link}
											</a>
										</li>
									))}
								</ul>
							</div>
						))}
					</div>
					<div className="mt-16 pt-7 border-t border-gray-800 flex justify-between items-center text-[12px] text-gray-500 flex-wrap max-[880px]:flex-col max-[880px]:items-start gap-3">
						<span>
							&copy; 2026 FinanceAI. Semua hak dilindungi.
						</span>
						<span className="italic font-serif text-[14px]">
							Dibuat dengan presisi.
						</span>
					</div>
				</div>
			</footer>

			<style jsx global>{`
				@keyframes float {
					0%,
					100% {
						transform: rotate(-2deg) translateY(0);
					}
					50% {
						transform: rotate(-2deg) translateY(-12px);
					}
				}
				@keyframes floatTag {
					0%,
					100% {
						transform: translateY(0) rotate(var(--r, 0deg));
					}
					50% {
						transform: translateY(-8px) rotate(var(--r, 0deg));
					}
				}
				@keyframes marquee {
					from {
						transform: translateX(0);
					}
					to {
						transform: translateX(-50%);
					}
				}
				@media (max-width: 880px) {
					@keyframes float {
						0%,
						100% {
							transform: rotate(-1.5deg) translateY(0);
						}
						50% {
							transform: rotate(-1.5deg) translateY(-8px);
						}
					}
				}
			`}</style>
		</>
	);
}
