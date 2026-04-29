"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

interface Message {
	id: string;
	role: "user" | "ai";
	content: string;
	time: string;
}

interface DataSource {
	id: string;
	name: string;
	sub: string;
	active: boolean;
}

const PROMPTS = [
	{ label: "PENGELUARAN", q: "Bulan ini aku paling boros di mana?" },
	{ label: "PROYEKSI", q: "Kalau aku kurangi 50% pengeluaran makan, bisa nabung berapa setahun?" },
	{ label: "TREN", q: "Bandingkan pengeluaran saya 3 bulan terakhir." },
	{ label: "CASH FLOW", q: "Kapan terakhir saya punya cash flow positif?" },
];

const HISTORY = [
	{ title: "Analisis pengeluaran Januari", when: "3 hari lalu · 8 pesan" },
	{ title: "Budget makan bulan ini", when: "1 minggu lalu · 5 pesan" },
	{ title: "Saham mana yang harus dijual?", when: "2 minggu lalu · 12 pesan" },
	{ title: "Persiapan dana darurat", when: "1 bulan lalu · 6 pesan" },
];

function nowTime(): string {
	const d = new Date();
	return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

function getAiResponse(qLower: string): string {
	if (qLower.includes("boros") || qLower.includes("kategori") || qLower.includes("habis")) {
		return `<p>Berdasarkan 127 transaksi BCA bulan Februari, ini distribusi pengeluaran kamu:</p>
<table class="ai-table"><thead><tr><th>Kategori</th><th class="num">Total</th><th class="num">% Pengeluaran</th></tr></thead><tbody>
<tr><td><strong>Makanan &amp; F&amp;B</strong></td><td class="num">Rp 1.485.000</td><td class="num pct">40,8%</td></tr>
<tr><td>Transportasi</td><td class="num">Rp 624.000</td><td class="num pct">17,1%</td></tr>
<tr><td>Belanja online</td><td class="num">Rp 558.000</td><td class="num pct">15,3%</td></tr>
<tr><td>Tagihan &amp; subscription</td><td class="num">Rp 451.000</td><td class="num pct">12,4%</td></tr>
<tr><td>Hiburan &amp; lainnya</td><td class="num">Rp 522.000</td><td class="num pct">14,4%</td></tr>
</tbody></table>
<p>Top 3 merchant yang paling sering: <strong>Gojek &amp; Grab Food</strong> (24× transaksi), <strong>Starbucks</strong> (8×), dan <strong>Tokopedia</strong> (11×).</p>
<div class="ai-callout"><strong>Insight</strong> — kamu menghabiskan <strong>40,8% pengeluaran untuk makanan</strong>, naik dari 32% bulan lalu. Sebagian besar dari delivery online.</div>
<div class="src-pills"><span class="src-pill">BCA Feb 2026</span><span class="src-pill">127 transaksi</span></div>`;
	}
	if (qLower.includes("langganan") || qLower.includes("subscription") || qLower.includes("nabung") || qLower.includes("makan")) {
		return `<p>Aku hitungkan untuk kamu. Saat ini pengeluaran makanan kamu <strong>Rp 1.485.000 / bulan</strong>. Kalau dipangkas 50%, kamu akan menabung tambahan <strong>Rp 742.500 / bulan</strong> atau <strong>Rp 8.910.000 / tahun</strong>.</p>
<div class="ai-chart"><div class="head"><span>Proyeksi tabungan setahun</span><span>+Rp 8,9 jt</span></div>
<div class="bars"><div class="col"><div class="stack"><div class="seg cur" style="height:32%"></div></div><div class="lbl">Saat ini</div><div class="val">29%</div></div>
<div class="col"><div class="stack"><div class="seg cur" style="height:42%"></div></div><div class="lbl">−25% makan</div><div class="val">36%</div></div>
<div class="col"><div class="stack"><div class="seg cur" style="height:55%"></div></div><div class="lbl">−50% makan</div><div class="val">42%</div></div>
<div class="col"><div class="stack"><div class="seg cur" style="height:72%"></div></div><div class="lbl">−50% + langganan</div><div class="val">48%</div></div>
</div><div class="ai-legend"><span class="cur">Saving rate</span></div></div>
<p>Kalau ditambah pemangkasan langganan yang jarang dipakai (<strong>Netflix Premium</strong> Rp 186rb &amp; <strong>Spotify Premium</strong> Rp 55rb), saving rate kamu naik dari <strong>29% → 48%</strong>.</p>
<div class="ai-callout"><strong>Rekomendasi</strong> — mulai dari memasak 2× seminggu di rumah. Berdasarkan rata-rata Gojek/Grab kamu Rp 58rb per order, ini menghemat ~Rp 460rb per bulan.</div>
<div class="src-pills"><span class="src-pill">BCA</span><span class="src-pill">Bibit</span><span class="src-pill">Stockbit</span></div>`;
	}
	if (qLower.includes("bandingkan") || qLower.includes("3 bulan") || qLower.includes("tren")) {
		return `<p>Ini perbandingan pengeluaran kamu 3 bulan terakhir:</p>
<div class="ai-chart"><div class="head"><span>Pengeluaran bulanan</span><span>↑ +14% rata-rata</span></div>
<div class="bars"><div class="col"><div class="stack"><div class="seg cur" style="height:55%"></div></div><div class="lbl">Des 25</div><div class="val">2,8jt</div></div>
<div class="col"><div class="stack"><div class="seg cur" style="height:64%"></div></div><div class="lbl">Jan 26</div><div class="val">3,2jt</div></div>
<div class="col"><div class="stack"><div class="seg cur" style="height:78%"></div></div><div class="lbl">Feb 26</div><div class="val">3,6jt</div></div>
</div></div>
<p>Pengeluaran kamu naik <strong>+14% rata-rata per bulan</strong>. Kategori dengan kenaikan paling tajam: <strong>Makanan +28%</strong> dan <strong>Belanja online +19%</strong>.</p>
<div class="ai-callout"><strong>Trend alert</strong> — kalau kecepatan kenaikan ini berlanjut, di Mei pengeluaran kamu bisa tembus Rp 5,3 jt/bulan.</div>`;
	}
	if (qLower.includes("cash flow") || qLower.includes("positif") || qLower.includes("terakhir")) {
		return `<p>Cash flow kamu (pemasukan − pengeluaran) <strong>positif setiap bulan dalam 6 bulan terakhir</strong>. Surplus terbesar: <strong>Desember 2025 (Rp 9,4 jt)</strong> karena bonus akhir tahun.</p>
<table class="ai-table"><thead><tr><th>Bulan</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Surplus</th></tr></thead><tbody>
<tr><td>Feb 2026</td><td class="num">Rp 12.500.000</td><td class="num">Rp 3.640.000</td><td class="num">+Rp 8.860.000</td></tr>
<tr><td>Jan 2026</td><td class="num">Rp 12.500.000</td><td class="num">Rp 3.180.000</td><td class="num">+Rp 9.320.000</td></tr>
<tr><td>Des 2025</td><td class="num">Rp 21.800.000</td><td class="num">Rp 12.420.000</td><td class="num">+Rp 9.380.000</td></tr>
</tbody></table>
<p>Terakhir kali kamu cash flow <strong>negatif</strong> adalah <strong>Juni 2025</strong> — surplus minus Rp 1,2 jt karena ada renovasi.</p>`;
	}
	return `<p>Aku belum punya data yang cukup untuk menjawab itu. Coba salah satu dari ini:</p>
<ul style="margin:6px 0 0;padding-left:20px;font-size:13px"><li>“Bulan ini aku paling boros di mana?”</li><li>“Bandingkan pengeluaran 3 bulan terakhir”</li><li>“Berapa total kekayaan bersih saya?”</li></ul>`;
}

const msgVariants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeDesignhub } },
};

const promptVariants = {
	hidden: { opacity: 0, y: 8 },
	show: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: { duration: 0.4, ease: easeDesignhub, delay: 0.1 + i * 0.08 },
	}),
};

function ChatMobileMenuButton() {
	const { setMobileOpen } = useSidebar();
	return (
		<button
			type="button"
			onClick={() => setMobileOpen(true)}
			aria-label="Buka menu"
			className="mr-1 grid h-9 w-9 place-items-center rounded-lg text-gray-600 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-950 md:hidden"
		>
			<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>
	);
}

export default function ChatPage() {
	const router = useRouter();
	const [messages, setMessages] = useState<Message[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isTyping, setIsTyping] = useState(false);
	const [showToast, setShowToast] = useState(false);
	const [showMobileHistory, setShowMobileHistory] = useState(false);
	const [dataSources, setDataSources] = useState<DataSource[]>([
		{ id: "bca", name: "BCA Mutasi Feb 2026", sub: "127 transaksi · diperbarui 2 jam lalu", active: true },
		{ id: "stockbit", name: "Stockbit Portfolio", sub: "5 saham · Rp 52,1 jt", active: true },
		{ id: "bibit", name: "Bibit Reksa Dana", sub: "3 produk · Rp 89,4 jt", active: true },
		{ id: "gopay", name: "GoPay", sub: "Belum dihubungkan", active: false },
	]);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const seeded = useRef(false);

	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		});
	}, []);

	const sendMessage = useCallback((text: string) => {
		if (!text.trim()) return;
		const userMsg: Message = {
			id: crypto.randomUUID(),
			role: "user",
			content: text.trim(),
			time: nowTime(),
		};
		setMessages((prev) => [...prev, userMsg]);
		setInputValue("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		setTimeout(() => {
			setIsTyping(true);
			setTimeout(() => {
				setIsTyping(false);
				const aiMsg: Message = {
					id: crypto.randomUUID(),
					role: "ai",
					content: getAiResponse(text.toLowerCase()),
					time: nowTime(),
				};
				setMessages((prev) => [...prev, aiMsg]);
			}, 1500);
		}, 280);
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, isTyping, scrollToBottom]);

	useEffect(() => {
		if (seeded.current) return;
		seeded.current = true;
		const seed: Message[] = [
			{ id: "s1", role: "user", content: "Bulan ini aku paling boros di mana?", time: "09:15" },
			{ id: "s2", role: "ai", content: getAiResponse("boros"), time: "09:15" },
			{ id: "s3", role: "user", content: "Kalau aku kurangi 50% pengeluaran makan, bisa nabung berapa?", time: "09:16" },
			{ id: "s4", role: "ai", content: getAiResponse("makan"), time: "09:16" },
		];
		setMessages(seed);
		setTimeout(() => {
			setIsTyping(true);
			setTimeout(() => {
				setIsTyping(false);
				setMessages((prev) => [
					...prev,
					{
						id: "s5",
						role: "ai",
						content: "<p>Mau aku bantu hitung skenario yang lebih agresif (misal pangkas 75%)? Atau pilih kategori lain untuk dianalisis?</p>",
						time: nowTime(),
					},
				]);
			}, 4200);
		}, 500);
	}, []);

	const handleNewChat = () => {
		setMessages([]);
		setIsTyping(false);
		setInputValue("");
	};

	const handleShare = () => {
		const text = messages
			.map((m) => {
				const prefix = m.role === "user" ? "Kamu" : "AI";
				const plain = m.content.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&mdash;/g, "—");
				return `[${m.time}] ${prefix}: ${plain}`;
			})
			.join("\n\n");
		navigator.clipboard.writeText(text).then(() => {
			setShowToast(true);
			setTimeout(() => setShowToast(false), 2000);
		});
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage(inputValue);
		}
	};

	const handleTextareaInput = (val: string) => {
		setInputValue(val);
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
		}
	};

	const toggleSource = (id: string) => {
		setDataSources((prev) =>
			prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s)),
		);
	};

	const activeSources = dataSources.filter((s) => s.active).length;

	return (
		<>
			<style jsx global>{`
				.ai-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12.5px; border: 1px solid #e8e8e8; }
				.ai-table th { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #a3a3a3; font-weight: 500; padding: 8px 10px; text-align: left; background: #fafafa; border-bottom: 1px solid #e8e8e8; }
				.ai-table th.num { text-align: right; }
				.ai-table td { padding: 8px 10px; border-bottom: 1px solid #f4f4f4; }
				.ai-table td.num { text-align: right; font-family: var(--font-geist-mono), monospace; font-variant-numeric: tabular-nums; font-weight: 500; color: #0a0a0a; }
				.ai-table tr:last-child td { border-bottom: none; }
				.ai-table .pct { font-family: var(--font-geist-mono), monospace; font-size: 11px; color: #737373; }
				.ai-chart { margin: 14px 0 6px; border: 1px solid #e8e8e8; padding: 14px; }
				.ai-chart .head { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #a3a3a3; font-weight: 500; margin-bottom: 14px; display: flex; justify-content: space-between; }
				.ai-chart .head span:last-child { color: #404040; font-family: var(--font-geist-mono), monospace; }
				.ai-chart .bars { display: flex; align-items: flex-end; gap: 18px; height: 120px; padding: 0 4px; }
				.ai-chart .col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px; }
				.ai-chart .stack { height: 100%; width: 100%; max-width: 36px; display: flex; flex-direction: column; justify-content: flex-end; gap: 2px; position: relative; }
				.ai-chart .seg { width: 100%; background: #d4d4d4; transform-origin: bottom; animation: chatGrow 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) forwards; }
				.ai-chart .seg.cur { background: #0a0a0a; }
				@keyframes chatGrow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
				.ai-chart .col .lbl { font-family: var(--font-geist-mono), monospace; font-size: 10px; color: #737373; letter-spacing: 0.04em; }
				.ai-chart .col .val { font-family: var(--font-geist-mono), monospace; font-size: 11px; color: #0a0a0a; font-weight: 500; font-variant-numeric: tabular-nums; }
				.ai-legend { display: flex; gap: 14px; margin-top: 12px; font-size: 11px; color: #737373; font-family: var(--font-geist-mono), monospace; }
				.ai-legend .cur::before { content: ""; display: inline-block; width: 8px; height: 8px; margin-right: 6px; vertical-align: middle; background: #0a0a0a; }
				.ai-callout { margin: 10px 0 0; padding: 10px 12px; background: #fafafa; border-left: 2px solid #0a0a0a; font-size: 13px; color: #262626; }
				.ai-callout strong { color: #0a0a0a; font-family: var(--font-geist-mono), monospace; font-size: 14px; }
				.src-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #e8e8e8; }
				.src-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 999px; background: #fafafa; border: 1px solid #e8e8e8; font-size: 10px; color: #737373; font-family: var(--font-geist-mono), monospace; letter-spacing: 0.02em; }
			`}</style>

			<div className="grid h-[calc(100vh)] grid-rows-[64px_1fr] max-[1100px]:grid-cols-[1fr] grid-cols-[1fr_340px]">
				{/* Header */}
				<header className="col-span-full flex h-16 items-center justify-between border-b border-gray-200 bg-white/85 px-4 backdrop-blur-[14px] md:px-7" style={{ zIndex: 10 }}>
					<div className="flex min-w-0 items-center gap-3.5">
						<ChatMobileMenuButton />
						<h1 className="m-0 font-serif text-[22px] font-normal tracking-tight2 text-gray-950">
							Financial <em className="italic text-gray-700">Advisor AI</em>
						</h1>
						<span className="hidden items-center gap-2 font-mono text-xs text-gray-400 sm:inline-flex">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-[#16a34a] animate-[pulse_2s_cubic-bezier(0.2,0.7,0.2,1)_infinite]" />
							Data per 17 Feb 2026
						</span>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleShare}
							className="grid h-[34px] w-[34px] place-items-center rounded-lg border border-transparent text-gray-500 transition-[background-color,color,border-color] duration-200 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-950"
							title="Bagikan"
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
						</button>
						<button
							type="button"
							onClick={() => setShowMobileHistory((v) => !v)}
							className={cn(
								"grid h-[34px] w-[34px] place-items-center rounded-lg border text-gray-500 transition-[background-color,color,border-color] duration-200 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-950 min-[1100px]:border-transparent",
								showMobileHistory ? "border-gray-300 bg-gray-50 text-gray-950" : "border-transparent",
							)}
							title="Riwayat"
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
						</button>
						<button
							type="button"
							onClick={handleNewChat}
							className="inline-flex h-[34px] items-center gap-2 rounded-lg border border-gray-300 px-3.5 text-[13px] font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
						>
							<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
							Chat Baru
						</button>
					</div>
				</header>

				{/* Chat area */}
				<section className="flex min-h-0 min-w-0 flex-col bg-white">
					<div className="flex-1 overflow-y-auto scroll-smooth px-4 py-8 md:px-8 max-[880px]:px-5">
						<div className="mx-auto flex max-w-[760px] flex-col gap-6">
							<AnimatePresence mode="wait">
								{messages.length === 0 && !isTyping ? (
									<motion.div
										key="empty"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										transition={{ duration: 0.4, ease: easeDesignhub }}
										className="flex flex-col items-center justify-center py-10 text-center"
										style={{ minHeight: "calc(100vh - 280px)" }}
									>
										<div className="mb-6 grid h-14 w-14 place-items-center rounded-full bg-gray-950 text-white">
											<svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 1 1-3.4-6.8L21 4l-1 3.5A8.5 8.5 0 0 1 21 11.5z" /></svg>
										</div>
										<h2 className="mx-auto mb-3 max-w-[580px] font-serif text-[clamp(32px,4.5vw,44px)] font-light leading-[1.05] tracking-tight2 text-gray-950">
											Tanya apa saja tentang<br /><em className="italic text-gray-700">keuangan kamu.</em>
										</h2>
										<p className="mx-auto mb-8 max-w-[440px] text-sm text-gray-500">
											AI menganalisis dari data yang kamu hubungkan &mdash; transaksi, portofolio, dan tabungan.
										</p>
										<div className="grid w-full max-w-[600px] grid-cols-2 gap-3 max-[880px]:grid-cols-1">
											{PROMPTS.map((p, i) => (
												<motion.button
													key={p.label}
													type="button"
													custom={i}
													variants={promptVariants}
													initial="hidden"
													animate="show"
													onClick={() => sendMessage(p.q)}
													className="flex min-h-[90px] flex-col gap-1.5 border border-gray-200 bg-white p-[18px_20px] text-left transition-[background-color,border-color,transform] duration-200 ease-designhub hover:-translate-y-0.5 hover:border-gray-950 hover:bg-gray-50"
												>
													<span className="font-mono text-[10px] font-medium uppercase tracking-labelWide text-gray-400">{p.label}</span>
													<span className="text-sm font-medium leading-relaxed text-gray-950">{p.q}</span>
												</motion.button>
											))}
										</div>
									</motion.div>
								) : (
									<>
										{messages.map((msg) => (
											<motion.div
												key={msg.id}
												variants={msgVariants}
												initial="hidden"
												animate="show"
												className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}
											>
												<div
													className={cn(
														"max-w-[88%] break-words px-[18px] py-[14px] text-sm leading-relaxed",
														msg.role === "user"
															? "rounded-[14px_0_14px_14px] bg-gray-950 text-white [&_strong]:text-white"
															: "rounded-[0_14px_14px_14px] border border-gray-200 bg-white text-gray-900 [&_strong]:text-gray-950 [&_strong]:font-semibold",
													)}
													dangerouslySetInnerHTML={{ __html: msg.role === "ai" ? msg.content : msg.content.replace(/\n/g, "<br/>") }}
												/>
												<span className={cn("mt-1.5 font-mono text-[11px] text-gray-400", msg.role === "user" ? "mr-1" : "ml-1")}>
													{msg.time}
												</span>
											</motion.div>
										))}
										<AnimatePresence>
											{isTyping && (
												<motion.div
													key="typing"
													variants={msgVariants}
													initial="hidden"
													animate="show"
													exit="hidden"
													className="flex flex-col items-start"
												>
													<div className="rounded-[0_14px_14px_14px] border border-gray-200 bg-white px-2 py-1">
														<div className="inline-flex items-center gap-[5px] px-3 py-[14px]">
															{[0, 1, 2].map((i) => (
																<span
																	key={i}
																	className="h-[7px] w-[7px] rounded-full bg-gray-400"
																	style={{
																		animation: `chatBounce 1.2s infinite cubic-bezier(0.2,0.7,0.2,1)`,
																		animationDelay: `${i * 0.18}s`,
																	}}
																/>
															))}
														</div>
													</div>
												</motion.div>
											)}
										</AnimatePresence>
									</>
								)}
							</AnimatePresence>
							<div ref={messagesEndRef} />
						</div>
					</div>

					{/* Composer */}
					<div className="shrink-0 border-t border-gray-200 bg-white px-7 pb-[22px] pt-4 max-[880px]:px-4 max-[880px]:pb-[18px] max-[880px]:pt-3">
						<div className="mx-auto flex max-w-[760px] items-end gap-2.5 border border-gray-300 bg-white p-[8px_8px_8px_12px] transition-[border-color] duration-200 focus-within:border-gray-950">
							<button
								type="button"
								className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-md text-gray-500 transition-[background-color,color] duration-200 hover:bg-gray-100 hover:text-gray-950"
								title="Lampirkan dokumen"
							>
								<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
							</button>
							<textarea
								ref={textareaRef}
								value={inputValue}
								onChange={(e) => handleTextareaInput(e.target.value)}
								onKeyDown={handleKeyDown}
								rows={1}
								placeholder="Tanya apa saja..."
								className="max-h-[160px] flex-1 resize-none border-none bg-transparent py-2 text-sm leading-normal text-gray-900 outline-none placeholder:text-gray-400"
							/>
							<button
								type="button"
								disabled={!inputValue.trim()}
								onClick={() => sendMessage(inputValue)}
								className="grid h-9 w-9 shrink-0 place-items-center self-end bg-gray-950 text-white transition-[background-color,opacity] duration-200 hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
								aria-label="Kirim"
							>
								<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
							</button>
						</div>
						<div className="mx-auto mt-2 flex max-w-[760px] justify-between font-mono text-[11px] text-gray-400">
							<span>AI dapat membuat kesalahan. Verifikasi angka penting.</span>
							<span className="hidden sm:inline">
								<kbd className="rounded border border-gray-200 bg-gray-50 px-[5px] py-px font-mono text-[10px] text-gray-500" style={{ borderBottomWidth: "1.5px" }}>Enter</kbd> kirim &middot; <kbd className="rounded border border-gray-200 bg-gray-50 px-[5px] py-px font-mono text-[10px] text-gray-500" style={{ borderBottomWidth: "1.5px" }}>Shift</kbd>+<kbd className="rounded border border-gray-200 bg-gray-50 px-[5px] py-px font-mono text-[10px] text-gray-500" style={{ borderBottomWidth: "1.5px" }}>Enter</kbd> baris baru
							</span>
						</div>
					</div>
				</section>

				{/* Context panel */}
				<aside className="hidden h-[calc(100vh-64px)] overflow-y-auto border-l border-gray-200 bg-gray-50 min-[1100px]:block">
					{/* Active sources */}
					<div className="border-b border-gray-200 px-5 py-[18px]">
						<h3 className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
							Konteks Aktif
							<span className="font-mono text-[10px] font-medium text-gray-400">{activeSources} sumber</span>
						</h3>
						<div className="flex flex-col gap-1.5">
							{dataSources.map((src) => (
								<button
									key={src.id}
									type="button"
									onClick={() => toggleSource(src.id)}
									className={cn(
										"flex w-full items-center gap-2.5 border bg-white px-3 py-2.5 text-left text-[12.5px] transition-[background-color,border-color,opacity] duration-200 hover:border-gray-700",
										src.active ? "border-gray-200 text-gray-700" : "border-gray-200 opacity-50",
									)}
								>
									<span className={cn("h-2 w-2 shrink-0 rounded-full", src.active ? "bg-gray-950" : "bg-gray-300")} />
									<span className="flex min-w-0 flex-1 flex-col">
										<span className={cn("truncate font-medium", src.active ? "text-gray-950" : "text-gray-500")}>{src.name}</span>
										<span className="mt-0.5 block font-mono text-[10px] text-gray-400">{src.sub}</span>
									</span>
								</button>
							))}
							<button
								type="button"
								onClick={() => router.push("/import")}
								className="mt-1 flex w-full items-center gap-2 border border-dashed border-gray-300 bg-transparent px-3 py-2 text-xs text-gray-500 transition-[border-color,color] duration-200 hover:border-gray-700 hover:text-gray-950"
							>
								<svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
								Tambah sumber data
							</button>
						</div>
					</div>

					{/* Quick stats */}
					<div className="border-b border-gray-200 px-5 py-[18px]">
						<h3 className="mb-3 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
							Statistik Cepat
						</h3>
						<div className="grid grid-cols-2 border border-gray-200 bg-white">
							<div className="border-b border-r border-gray-200 p-3.5">
								<div className="text-[9.5px] font-medium uppercase tracking-label text-gray-400">Net Worth</div>
								<div className="mt-1 font-serif text-[22px] leading-tight text-gray-950">247,5jt</div>
								<div className="mt-0.5 font-mono text-[10px] text-gray-500">&uarr; +12,4%</div>
							</div>
							<div className="border-b border-gray-200 p-3.5">
								<div className="text-[9.5px] font-medium uppercase tracking-label text-gray-400">Pengeluaran</div>
								<div className="mt-1 font-mono text-sm font-medium leading-tight tracking-tight2 text-gray-950">Rp 3.640.000</div>
								<div className="mt-0.5 font-mono text-[10px] text-gray-500">17 hari &middot; feb</div>
							</div>
							<div className="border-r border-gray-200 p-3.5">
								<div className="text-[9.5px] font-medium uppercase tracking-label text-gray-400">Saving Rate</div>
								<div className="mt-1 font-mono text-sm font-medium leading-tight tracking-tight2 text-gray-950">29%</div>
								<div className="mt-0.5 font-mono text-[10px] text-gray-500">target 25%</div>
							</div>
							<div className="p-3.5">
								<div className="text-[9.5px] font-medium uppercase tracking-label text-gray-400">Transaksi</div>
								<div className="mt-1 font-mono text-sm font-medium leading-tight tracking-tight2 text-gray-950">127</div>
								<div className="mt-0.5 font-mono text-[10px] text-gray-500">bulan ini</div>
							</div>
						</div>
					</div>

					{/* Chat history */}
					<div className="px-5 py-[18px]">
						<h3 className="mb-3 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
							Riwayat Chat
						</h3>
						{HISTORY.map((h) => (
							<button
								key={h.title}
								type="button"
								className="flex w-full items-start gap-2.5 border-b border-gray-200 px-0 py-2.5 text-left text-[12.5px] text-gray-700 last:border-b-0 hover:[&_.hist-name]:text-gray-950"
							>
								<span className="mt-0.5 shrink-0 text-gray-400">
									<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 1 1-3.4-6.8L21 4l-1 3.5A8.5 8.5 0 0 1 21 11.5z" /></svg>
								</span>
								<span className="min-w-0 flex-1">
									<span className="hist-name block truncate font-medium text-gray-800 transition-colors duration-200">{h.title}</span>
									<span className="mt-0.5 block font-mono text-[10.5px] text-gray-400">{h.when}</span>
								</span>
							</button>
						))}
					</div>
				</aside>
			</div>

			{/* Mobile history drawer */}
			<AnimatePresence>
				{showMobileHistory && (
					<>
						<motion.div
							className="fixed inset-0 z-40 bg-black/40 min-[1100px]:hidden"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.2 }}
							onClick={() => setShowMobileHistory(false)}
						/>
						<motion.div
							className="fixed right-0 top-0 z-50 flex h-full w-[320px] max-w-[85vw] flex-col border-l border-gray-200 bg-white shadow-[-12px_0_40px_-10px_rgba(0,0,0,0.15)] min-[1100px]:hidden"
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ duration: 0.3, ease: easeDesignhub }}
						>
							<div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
								<h3 className="text-[13px] font-medium text-gray-950">Riwayat Chat</h3>
								<button
									type="button"
									onClick={() => setShowMobileHistory(false)}
									className="grid h-7 w-7 place-items-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
								>
									<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M6 6l12 12M18 6l-12 12" />
									</svg>
								</button>
							</div>
							<div className="flex-1 overflow-y-auto px-5 py-4">
								{HISTORY.map((h) => (
									<button
										key={h.title}
										type="button"
										onClick={() => setShowMobileHistory(false)}
										className="flex w-full items-start gap-2.5 border-b border-gray-200 px-0 py-3 text-left text-[12.5px] text-gray-700 last:border-b-0"
									>
										<span className="mt-0.5 shrink-0 text-gray-400">
											<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 1 1-3.4-6.8L21 4l-1 3.5A8.5 8.5 0 0 1 21 11.5z" /></svg>
										</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium text-gray-800">{h.title}</span>
											<span className="mt-0.5 block font-mono text-[10.5px] text-gray-400">{h.when}</span>
										</span>
									</button>
								))}
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			{/* Toast */}
			<AnimatePresence>
				{showToast && (
					<motion.div
						className="fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-[13px] font-medium text-gray-950 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)]"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 12 }}
						transition={{ duration: 0.25, ease: easeDesignhub }}
					>
						Chat berhasil disalin!
					</motion.div>
				)}
			</AnimatePresence>

			<style jsx global>{`
				@keyframes chatBounce {
					0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
					40% { transform: translateY(-5px); opacity: 1; }
				}
			`}</style>
		</>
	);
}
