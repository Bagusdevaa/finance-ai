"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

interface ConfirmDialogProps {
	open: boolean;
	title: string;
	description?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: "neutral" | "danger";
	onConfirm: () => void;
	onClose: () => void;
	loading?: boolean;
}

const ease = [0.2, 0.7, 0.2, 1] as const;

export function ConfirmDialog({
	open,
	title,
	description,
	confirmLabel = "Konfirmasi",
	cancelLabel = "Batal",
	tone = "neutral",
	onConfirm,
	onClose,
	loading = false,
}: ConfirmDialogProps) {
	// Esc untuk close.
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
			if (e.key === "Enter" && !loading) onConfirm();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, loading, onConfirm, onClose]);

	return (
		<AnimatePresence>
			{open && (
				<motion.div
					className="fixed inset-0 z-50 flex items-center justify-center px-4"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 0.15 }}
				>
					<motion.div
						className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
						onClick={onClose}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					/>
					<motion.div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="confirm-title"
						className="relative w-full max-w-[380px] border border-gray-200 bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)]"
						initial={{ opacity: 0, scale: 0.96, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={{ duration: 0.18, ease }}
					>
						<div className="px-6 pb-5 pt-6">
							<h2
								id="confirm-title"
								className="m-0 font-serif text-[20px] font-normal leading-tight tracking-tight2 text-gray-950"
							>
								{title}
							</h2>
							{description && (
								<p className="mt-2 text-[13.5px] leading-relaxed text-gray-600">
									{description}
								</p>
							)}
						</div>
						<div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50/60 px-5 py-3.5">
							<button
								type="button"
								onClick={onClose}
								disabled={loading}
								className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3.5 text-[13px] font-medium text-gray-700 transition-[border-color,color] duration-200 hover:border-gray-950 hover:text-gray-950 disabled:opacity-50"
							>
								{cancelLabel}
							</button>
							<button
								type="button"
								onClick={onConfirm}
								disabled={loading}
								className={cn(
									"inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-medium text-white transition-[background-color] duration-200 disabled:opacity-50",
									tone === "danger"
										? "bg-[#dc2626] hover:bg-[#b91c1c]"
										: "bg-gray-950 hover:bg-black",
								)}
							>
								{loading ? "Memproses..." : confirmLabel}
							</button>
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
