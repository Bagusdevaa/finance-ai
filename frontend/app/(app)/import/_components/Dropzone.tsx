"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ACCEPT_MIME = "application/pdf,image/png,image/jpeg,image/webp,text/csv";

interface DropzoneProps {
	onFilesAccepted: (files: File[]) => void;
	onRejection?: (rejections: { name: string; reason: string }[]) => void;
	disabled?: boolean;
}

export function Dropzone({ onFilesAccepted, onRejection, disabled = false }: DropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [dragOver, setDragOver] = useState(false);

	const processFiles = (fileList: FileList | null) => {
		if (!fileList || fileList.length === 0) return;
		const accepted: File[] = [];
		const rejected: { name: string; reason: string }[] = [];
		for (const file of Array.from(fileList)) {
			if (file.size > MAX_SIZE_BYTES) {
				rejected.push({ name: file.name, reason: `Lebih besar dari 10MB (${(file.size / 1024 / 1024).toFixed(1)} MB)` });
				continue;
			}
			accepted.push(file);
		}
		if (rejected.length && onRejection) {
			onRejection(rejected);
		}
		if (accepted.length) {
			onFilesAccepted(accepted);
		}
	};

	if (disabled) return null;

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => inputRef.current?.click()}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					inputRef.current?.click();
				}
			}}
			onDragEnter={(e) => {
				e.preventDefault();
				setDragOver(true);
			}}
			onDragOver={(e) => {
				e.preventDefault();
				setDragOver(true);
			}}
			onDragLeave={(e) => {
				e.preventDefault();
				setDragOver(false);
			}}
			onDrop={(e) => {
				e.preventDefault();
				setDragOver(false);
				processFiles(e.dataTransfer.files);
			}}
			className={cn(
				"relative flex cursor-pointer flex-col items-center gap-3.5 border border-dashed bg-white px-10 py-14 text-center transition-[border-color,background-color] duration-[250ms]",
				dragOver ? "border-solid border-gray-950 bg-gray-50" : "border-gray-300 hover:border-gray-700 hover:bg-gray-50",
			)}
		>
			<svg className="h-12 w-12 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
				<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
				<polyline points="17 8 12 3 7 8" />
				<line x1="12" y1="3" x2="12" y2="15" />
			</svg>
			<div className="font-serif text-[22px] font-normal leading-tight tracking-tight2 text-gray-950">
				Drop file <em className="italic text-gray-700">apapun</em> di sini
			</div>
			<div className="text-[13px] text-gray-500">
				Atau klik untuk pilih dari komputer · max 10 MB per file
			</div>
			<div className="font-mono text-[10px] tracking-[0.06em] text-gray-400">
				PDF · CSV · PNG · JPG · WebP
			</div>
			<input
				ref={inputRef}
				type="file"
				hidden
				multiple
				accept={ACCEPT_MIME}
				onChange={(e) => {
					processFiles(e.target.files);
					// Reset value so user can re-select same file again later
					e.target.value = "";
				}}
			/>
		</div>
	);
}
