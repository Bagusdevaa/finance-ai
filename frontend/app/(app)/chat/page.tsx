"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";
import { listSessions, createSession, getSession, deleteSession, postMessageStream } from "@/lib/api/chat";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { getTransaction } from "@/lib/api/transactions";
import { getErrorMessage } from "@/lib/api";
import { formatRupiah } from "@/lib/formatRupiah";
import type { ChatMessageResponse, ChatSessionResponse } from "@/lib/api/types";

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;

const PROMPTS = [
	{ label: "PENGELUARAN", q: "Bulan ini aku paling boros di mana?" },
	{ label: "PROYEKSI", q: "Kalau aku kurangi 50% pengeluaran makan, bisa nabung berapa setahun?" },
	{ label: "TREN", q: "Bandingkan pengeluaran saya 3 bulan terakhir." },
	{ label: "CASH FLOW", q: "Kapan terakhir saya punya cash flow positif?" },
];

function formatTime(iso: string): string {
	try {
		const d = new Date(iso);
		return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
	} catch {
		return "";
	}
}

function formatRelative(iso: string | null): string {
	if (!iso) return "Belum ada pesan";
	const d = new Date(iso);
	const now = new Date();
	const diff = now.getTime() - d.getTime();
	const day = 24 * 60 * 60 * 1000;
	if (diff < 60_000) return "Baru saja";
	if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} menit lalu`;
	if (diff < day) return `${Math.floor(diff / (60 * 60_000))} jam lalu`;
	if (diff < 7 * day) return `${Math.floor(diff / day)} hari lalu`;
	return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
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

interface StreamingState {
	user: string;
	assistant: string;
	sources: string[];
	error?: string;
}

export default function ChatPage() {
	const router = useRouter();
	const queryClient = useQueryClient();

	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [streaming, setStreaming] = useState<StreamingState | null>(null);
	const [showToast, setShowToast] = useState(false);
	const [showMobileHistory, setShowMobileHistory] = useState(false);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const abortRef = useRef<AbortController | null>(null);

	const { data: sessions } = useQuery({
		queryKey: ["chat-sessions"],
		queryFn: listSessions,
	});

	// Auto-pick first session pada mount awal (sekali saja). Setelah itu,
	// `activeSessionId === null` artinya user explicitly di "Chat Baru" mode —
	// jangan auto-pick supaya empty state tetap muncul.
	const didInitialPickRef = useRef(false);
	useEffect(() => {
		if (didInitialPickRef.current) return;
		if (!sessions) return;
		didInitialPickRef.current = true;
		if (sessions.length > 0) {
			setActiveSessionId(sessions[0].id);
		}
	}, [sessions]);

	const { data: sessionDetail } = useQuery({
		queryKey: ["chat-session", activeSessionId],
		queryFn: () => getSession(activeSessionId!),
		enabled: !!activeSessionId,
	});

	const messages: ChatMessageResponse[] = useMemo(
		() => sessionDetail?.messages ?? [],
		[sessionDetail],
	);

	const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

	const deleteSessionMutation = useMutation({
		mutationFn: (id: string) => deleteSession(id),
		onSuccess: (_, deletedId) => {
			// Update cache dulu sebelum invalidate — supaya auto-pick effect
			// nggak nyangkut milih session yang baru saja dihapus.
			queryClient.setQueryData<ChatSessionResponse[]>(
				["chat-sessions"],
				(old) => (old ?? []).filter((s) => s.id !== deletedId),
			);

			// empty "Chat Baru" state, biar user pilih sendiri mau lanjut ke mana.
			if (deletedId === activeSessionId) {
				setActiveSessionId(null);
			}
			queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
			queryClient.removeQueries({ queryKey: ["chat-session", deletedId] });
			setPendingDeleteId(null);
		},
		onError: () => setPendingDeleteId(null),
	});

	const handleDeleteSession = useCallback((id: string) => {
		setPendingDeleteId(id);
	}, []);

	const pendingDeleteSession = useMemo(
		() => sessions?.find((s) => s.id === pendingDeleteId) ?? null,
		[sessions, pendingDeleteId],
	);

	const scrollToBottom = useCallback(() => {
		requestAnimationFrame(() => {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		});
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, streaming, scrollToBottom]);

	const sendMessage = useCallback(async (text: string) => {
		const content = text.trim();
		if (!content) return;

		// Ensure we have a session.
		let sessionId = activeSessionId;
		if (!sessionId) {
			const created = await createSession();
			sessionId = created.id;
			setActiveSessionId(sessionId);
			queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
		}

		setInputValue("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		setStreaming({ user: content, assistant: "", sources: [] });

		const ctrl = new AbortController();
		abortRef.current = ctrl;

		try {
			for await (const event of postMessageStream(sessionId, content, ctrl.signal)) {
				if (event.type === "context") {
					setStreaming((s) => (s ? { ...s, sources: event.sources ?? [] } : s));
				} else if (event.type === "token") {
					setStreaming((s) => (s ? { ...s, assistant: s.assistant + (event.content ?? "") } : s));
				} else if (event.type === "error") {
					setStreaming((s) => (s ? { ...s, error: event.message ?? "Error" } : s));
					break;
				}
			}
		} catch (err) {
			setStreaming((s) => (s ? { ...s, error: getErrorMessage(err, "Stream gagal.") } : s));
		} finally {
			abortRef.current = null;
			queryClient.invalidateQueries({ queryKey: ["chat-session", sessionId] });
			queryClient.invalidateQueries({ queryKey: ["chat-sessions"] });
			// Slight delay so user sees final token before overlay clears.
			setTimeout(() => setStreaming(null), 150);
		}
	}, [activeSessionId, queryClient]);

	const handleNewChat = () => {
		// Lazy: belum bikin session di DB. Empty state ditampilkan;
		// session beneran dibuat saat user kirim pesan pertama.
		setActiveSessionId(null);
		setShowMobileHistory(false);
	};

	const handleShare = () => {
		const text = messages
			.map((m) => {
				const prefix = m.role === "user" ? "Kamu" : "AI";
				return `[${formatTime(m.created_at)}] ${prefix}: ${m.content}`;
			})
			.join("\n\n");
		if (!text) return;
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

	const sessionList: ChatSessionResponse[] = sessions ?? [];
	const isStreaming = streaming !== null;
	const showEmpty = messages.length === 0 && !isStreaming;

	return (
		<>
			<div className="grid h-[calc(100vh)] grid-rows-[64px_1fr] max-[1100px]:grid-cols-[1fr] grid-cols-[1fr_340px]">
				{/* Header */}
				<header className="col-span-full flex h-16 items-center justify-between border-b border-gray-200 bg-white/85 px-4 backdrop-blur-[14px] md:px-7" style={{ zIndex: 10 }}>
					<div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
						<ChatMobileMenuButton />
						<h1 className="m-0 whitespace-nowrap font-serif text-[18px] font-normal tracking-tight2 text-gray-950 sm:text-[22px]">
							Financial <em className="italic text-gray-700">Advisor AI</em>
						</h1>
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
							className="inline-flex h-[34px] shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 px-2.5 text-[13px] font-medium text-gray-700 transition-[background-color,border-color,color] duration-200 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950 sm:px-3.5"
						>
							<svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
							<span className="hidden min-[375px]:inline">Chat Baru</span>
						</button>
					</div>
				</header>

				{/* Chat area */}
				<section className="flex min-h-0 min-w-0 flex-col bg-white">
					<div className="flex-1 overflow-y-auto scroll-smooth px-4 py-8 md:px-8 max-[880px]:px-5">
						<div className="mx-auto flex max-w-[760px] flex-col gap-6">
							<AnimatePresence mode="wait">
								{showEmpty ? (
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
													disabled={isStreaming}
													className="flex min-h-[90px] flex-col gap-1.5 border border-gray-200 bg-white p-[18px_20px] text-left transition-[background-color,border-color,transform] duration-200 ease-designhub hover:-translate-y-0.5 hover:border-gray-950 hover:bg-gray-50 disabled:opacity-50"
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
											<MessageBubble key={msg.id} role={msg.role} content={msg.content} time={formatTime(msg.created_at)} sources={msg.sources ?? []} />
										))}

										{streaming && (
											<>
												<MessageBubble role="user" content={streaming.user} time="" />
												{streaming.assistant.length === 0 && !streaming.error ? (
													<motion.div
														key="typing"
														variants={msgVariants}
														initial="hidden"
														animate="show"
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
												) : (
													<MessageBubble
														role="assistant"
														content={streaming.assistant + (streaming.error ? `\n\n_Error: ${streaming.error}_` : "")}
														time=""
														sources={streaming.sources}
													/>
												)}
											</>
										)}
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
								disabled={isStreaming}
								rows={1}
								placeholder={isStreaming ? "AI sedang merespons..." : "Tanya apa saja..."}
								className="max-h-[160px] flex-1 resize-none border-none bg-transparent py-2 text-sm leading-normal text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed"
							/>
							<button
								type="button"
								disabled={!inputValue.trim() || isStreaming}
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
					<div className="border-b border-gray-200 px-5 py-[18px]">
						<h3 className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
							Sumber Data
						</h3>
						<button
							type="button"
							onClick={() => router.push("/import")}
							className="flex w-full items-center gap-2 border border-dashed border-gray-300 bg-transparent px-3 py-2 text-xs text-gray-500 transition-[border-color,color] duration-200 hover:border-gray-700 hover:text-gray-950"
						>
							<svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
							Tambah sumber data
						</button>
					</div>

					<div className="px-5 py-[18px]">
						<h3 className="mb-3 text-[11px] font-medium uppercase tracking-labelWide text-gray-500">
							Riwayat Chat
						</h3>
						{sessionList.length === 0 ? (
							<div className="text-[12.5px] text-gray-500">Belum ada chat. Klik &quot;Chat Baru&quot; untuk memulai.</div>
						) : (
							sessionList.map((s) => (
								<SessionItem
									key={s.id}
									session={s}
									active={s.id === activeSessionId}
									onSelect={() => setActiveSessionId(s.id)}
									onDelete={() => handleDeleteSession(s.id)}
								/>
							))
						)}
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
								{sessionList.length === 0 ? (
									<div className="text-[12.5px] text-gray-500">Belum ada chat.</div>
								) : (
									sessionList.map((s) => (
										<SessionItem
											key={s.id}
											session={s}
											active={s.id === activeSessionId}
											onSelect={() => { setActiveSessionId(s.id); setShowMobileHistory(false); }}
											onDelete={() => handleDeleteSession(s.id)}
										/>
									))
								)}
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>

			<ConfirmDialog
				open={pendingDeleteId !== null}
				title="Hapus percakapan?"
				description={
					pendingDeleteSession
						? `"${pendingDeleteSession.title}" beserta seluruh pesannya akan dihapus permanen.`
						: undefined
				}
				confirmLabel="Hapus"
				cancelLabel="Batal"
				tone="danger"
				loading={deleteSessionMutation.isPending}
				onConfirm={() => {
					if (pendingDeleteId) deleteSessionMutation.mutate(pendingDeleteId);
				}}
				onClose={() => {
					if (!deleteSessionMutation.isPending) setPendingDeleteId(null);
				}}
			/>

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

function MessageBubble({
	role,
	content,
	time,
	sources = [],
}: {
	role: "user" | "assistant" | "system";
	content: string;
	time: string;
	sources?: string[];
}) {
	const isUser = role === "user";
	return (
		<motion.div
			variants={msgVariants}
			initial="hidden"
			animate="show"
			className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
		>
			<div
				className={cn(
					"max-w-[88%] whitespace-pre-wrap break-words px-[18px] py-[14px] text-sm leading-relaxed",
					isUser
						? "rounded-[14px_0_14px_14px] bg-gray-950 text-white"
						: "rounded-[0_14px_14px_14px] border border-gray-200 bg-white text-gray-900",
				)}
			>
				{content}
			</div>
			{!isUser && sources.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1.5">
					{sources.map((id) => (
						<SourcePill key={id} txId={id} />
					))}
				</div>
			)}
			{time && (
				<span className={cn("mt-1.5 font-mono text-[11px] text-gray-400", isUser ? "mr-1" : "ml-1")}>
					{time}
				</span>
			)}
		</motion.div>
	);
}

// Source pill — fetches transaction detail on mount, shows preview on hover/tap.
// Tab di mobile (no hover) = toggle. TanStack Query cache by tx id, jadi pill
// dengan id sama (lintas pesan) cuma fetch sekali.
function SourcePill({ txId }: { txId: string }) {
	const [open, setOpen] = useState(false);
	const wrapRef = useRef<HTMLSpanElement>(null);

	const { data: tx } = useQuery({
		queryKey: ["transaction", txId],
		queryFn: () => getTransaction(txId),
		staleTime: 5 * 60_000,
	});

	useEffect(() => {
		if (!open) return;
		const handler = (e: MouseEvent) => {
			if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const label = tx?.merchant_name || `${txId.slice(0, 8)}…`;
	const amount = tx ? parseFloat(tx.amount) : 0;
	const isIncome = amount > 0;

	return (
		<span
			ref={wrapRef}
			className="relative inline-flex"
			onMouseEnter={() => setOpen(true)}
			onMouseLeave={() => setOpen(false)}
		>
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10.5px] text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-950"
			>
				<span className="truncate">{label}</span>
			</button>
			<AnimatePresence>
				{open && tx && (
					<motion.span
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: 4 }}
						transition={{ duration: 0.15 }}
						className="absolute bottom-full left-0 z-20 mb-1.5 w-[240px] rounded-lg border border-gray-200 bg-white p-3 shadow-[0_10px_30px_-8px_rgba(0,0,0,0.18)]"
					>
						<span className="block truncate text-[13px] font-medium text-gray-950">
							{tx.merchant_name || "(tanpa merchant)"}
						</span>
						{tx.description && (
							<span className="mt-0.5 block truncate text-[11.5px] text-gray-500">
								{tx.description}
							</span>
						)}
						<span
							className={cn(
								"mt-2 block font-mono text-[13px] font-medium tabular-nums",
								isIncome ? "text-gray-950" : "text-gray-950",
							)}
						>
							{isIncome ? "+" : "−"} {formatRupiah(Math.abs(amount))}
						</span>
						<span className="mt-1 flex items-center justify-between font-mono text-[10.5px] text-gray-400">
							<span>{tx.transaction_date}</span>
							{tx.category && (
								<span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
									{tx.category}
								</span>
							)}
						</span>
					</motion.span>
				)}
			</AnimatePresence>
		</span>
	);
}

function SessionItem({
	session,
	active,
	onSelect,
	onDelete,
}: {
	session: ChatSessionResponse;
	active: boolean;
	onSelect: () => void;
	onDelete: () => void;
}) {
	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete();
	};

	return (
		<div
			className={cn(
				"group relative flex items-start gap-2.5 border-b border-gray-200 py-2.5 text-[12.5px] last:border-b-0 transition-colors",
				active ? "text-gray-950" : "text-gray-700",
			)}
		>
			<button
				type="button"
				onClick={onSelect}
				className="flex flex-1 items-start gap-2.5 text-left"
			>
				<span className="mt-0.5 shrink-0 text-gray-400">
					<svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 1 1-3.4-6.8L21 4l-1 3.5A8.5 8.5 0 0 1 21 11.5z" /></svg>
				</span>
				<span className="min-w-0 flex-1 pr-6">
					<span className={cn(
						"block truncate font-medium transition-colors duration-200",
						active ? "text-gray-950" : "text-gray-800 group-hover:text-gray-950",
					)}>{session.title}</span>
					<span className="mt-0.5 block font-mono text-[10.5px] text-gray-400">{formatRelative(session.last_message_at)}</span>
				</span>
			</button>
			<button
				type="button"
				onClick={handleDeleteClick}
				aria-label="Hapus percakapan"
				className="absolute right-0 top-2.5 grid h-6 w-6 place-items-center rounded text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-950 group-hover:opacity-100"
			>
				<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
					<path d="M10 11v6M14 11v6" />
				</svg>
			</button>
		</div>
	);
}
