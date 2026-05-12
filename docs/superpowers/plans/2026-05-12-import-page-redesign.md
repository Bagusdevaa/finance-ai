# Import Page Redesign Implementation Plan (Phase 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `frontend/app/(app)/import/page.tsx` (872 lines monolith) into focused components — content-routing UX matching backend Phase 2 dispatcher: single dropzone replaces 15 platform tiles, account dropdown links uploads to accounts, right sidebar shows multi-job history with status badges, review panel renders inline when user clicks a job card.

**Architecture:** 6 new component files + 1 utility library + 1 page rewrite. Tile selection state (`activeSource`, `searchQuery`, wizard `currentStep`, mobile drawer) removed entirely. Replaced by `activeJobId: string | null` — null = dropzone mode, set = review panel mode. URL `?job=<uuid>` syncs deep-link. AccountSelect persists last-used to localStorage. Multi-file upload triggers N parallel `uploadMutation.mutate()` calls (no await loop). Backend untouched.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript strict, TanStack Query, framer-motion, Tailwind 3 (existing custom utility classes preserved). pnpm package manager.

**Spec reference:** `docs/superpowers/specs/2026-05-12-import-page-redesign-design.md`

**Commit policy (project memory override):** Agent does NOT commit per task. Run typecheck (`pnpm exec tsc --noEmit`) at end of each task and verify clean. PM does ONE final commit after full verification, format `feat: import page redesign with content-routing UX` (no scope, no co-author trailer). Agent must never run `git commit` or `git push`.

**Working directory:** `/Users/bagusdeva/Documents/Personal Projects/smart-finance/frontend`. Use `pnpm` (not npm). Use `pnpm exec tsc --noEmit` for typecheck (not `pnpm tsc` — that's a wrapper that won't find the binary in some shells).

**Indentation:** TAB (matching existing project style — check `app/(app)/dashboard/page.tsx` or current `import/page.tsx` for reference). All Tailwind classes via `cn()` from `@/lib/cn`.

**No frontend test framework exists in this project.** Tasks verify via TypeScript typecheck + visual smoke test (start dev server, see UI render correctly). Manual QA checklist in spec covers functional verification.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `frontend/lib/import-tips.ts` | CREATE | `lookupTips(accountName)` heuristic substring match → tips object or null |
| `frontend/app/(app)/import/_components/Dropzone.tsx` | CREATE | HTML5 drag-drop + click input + multi-file + size validation |
| `frontend/app/(app)/import/_components/AccountSelect.tsx` | CREATE | Account dropdown with localStorage persistence + "no account" option |
| `frontend/app/(app)/import/_components/ExportTips.tsx` | CREATE | Render tips panel when account selected and matches keyword |
| `frontend/app/(app)/import/_components/JobsHistorySidebar.tsx` | CREATE | Polling jobs list + status badges + click to open review |
| `frontend/app/(app)/import/_components/JobReviewPanel.tsx` | CREATE | Extract existing review table (lines ~470-870 of current page.tsx) into self-contained component |
| `frontend/app/(app)/import/page.tsx` | REWRITE | ~200 lines: layout + state coordination (selectedAccountId, activeJobId, upload handler, URL sync) |

---

## Task 1: Build `lib/import-tips.ts`

Goal: pure data + lookup function. No React, no API, no dependencies.

**Files:**
- Create: `frontend/lib/import-tips.ts`

- [ ] **Step 1: Create the file**

Create `frontend/lib/import-tips.ts`:

```typescript
/**
 * Heuristic substring match of account name → bank/platform export instructions.
 *
 * Account model only has `name` (free text), not an explicit `bank` field.
 * User account named "BCA Tahapan Xpresi" → contains "bca" → returns BCA tips.
 * Account "Tabunganku" → no match → returns null → caller hides tips panel.
 */

export interface Tips {
	title: string;
	steps: string[];
}

const TIPS_REGISTRY: { match: string[]; tips: Tips }[] = [
	{
		match: ["bca"],
		tips: {
			title: "BCA",
			steps: [
				"Buka aplikasi BCA mobile dan masuk ke menu Info Saldo & Mutasi.",
				"Pilih rentang tanggal yang ingin di-import (maksimal 3 bulan terakhir).",
				"Tap Kirim ke Email, pilih format PDF.",
				"Buka email kamu, unduh attachment-nya, lalu drop di sini.",
			],
		},
	},
	{
		match: ["mandiri"],
		tips: {
			title: "Mandiri",
			steps: [
				"Login ke Livin' by Mandiri.",
				"Buka e-Statement, pilih bulan yang ingin di-import.",
				"Download PDF, lalu drop di sini.",
			],
		},
	},
	{
		match: ["bri"],
		tips: {
			title: "BRI",
			steps: [
				"Buka BRImo, masuk ke Mutasi, pilih periode, kirim ke email PDF.",
				"Drop file PDF di sini.",
			],
		},
	},
	{
		match: ["bni", "wondr"],
		tips: {
			title: "BNI",
			steps: [
				"Buka wondr by BNI, menu Mutasi Rekening, ekspor PDF.",
				"Drop file PDF di sini.",
			],
		},
	},
	{
		match: ["permata"],
		tips: {
			title: "Permata",
			steps: [
				"Login PermataNet atau PermataMobile X.",
				"Menu Rekening Koran, pilih periode, download PDF.",
				"Drop file di sini.",
			],
		},
	},
	{
		match: ["gopay", "gojek"],
		tips: {
			title: "GoPay",
			steps: [
				"Buka aplikasi Gojek, ke GoPay, tap Riwayat.",
				"Screenshot riwayat transaksi (multi-page OK).",
				"Drop screenshot di sini — AI akan baca semuanya.",
			],
		},
	},
	{
		match: ["ovo"],
		tips: {
			title: "OVO",
			steps: [
				"Buka OVO, menu History. Screenshot tampilan riwayat.",
				"Drop screenshot di sini.",
			],
		},
	},
	{
		match: ["dana"],
		tips: {
			title: "Dana",
			steps: [
				"Buka DANA, menu History. Screenshot tampilan riwayat.",
				"Drop screenshot di sini.",
			],
		},
	},
	{
		match: ["shopeepay", "shopee"],
		tips: {
			title: "ShopeePay",
			steps: [
				"Buka ShopeePay, menu Riwayat Transaksi.",
				"Screenshot tampilan list. Drop di sini.",
			],
		},
	},
	{
		match: ["bibit"],
		tips: {
			title: "Bibit",
			steps: [
				"Buka Bibit, menu Portofolio → Pengaturan → Export Data.",
				"Pilih CSV. Drop file di sini.",
			],
		},
	},
	{
		match: ["stockbit"],
		tips: {
			title: "Stockbit",
			steps: [
				"Buka Stockbit, tab Portfolio.",
				"Screenshot tampilan holdings (1 layar = 1 file).",
				"Drop semua screenshot di sini.",
			],
		},
	},
	{
		match: ["ipot"],
		tips: {
			title: "IPOT",
			steps: [
				"Login IPOT (web), menu Portfolio → Export.",
				"Pilih format CSV. Drop file di sini.",
			],
		},
	},
	{
		match: ["pluang"],
		tips: {
			title: "Pluang",
			steps: [
				"Buka Pluang, menu Portofolio. Screenshot tampilan emas / kripto.",
				"Drop screenshot di sini.",
			],
		},
	},
];

export function lookupTips(accountName: string | null | undefined): Tips | null {
	if (!accountName) return null;
	const lower = accountName.toLowerCase();
	for (const entry of TIPS_REGISTRY) {
		if (entry.match.some((kw) => lower.includes(kw))) {
			return entry.tips;
		}
	}
	return null;
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 3: Sanity check via Node**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && node --experimental-strip-types -e "
import('./lib/import-tips.ts').then(({lookupTips}) => {
  console.log('BCA Tahapan Xpresi →', JSON.stringify(lookupTips('BCA Tahapan Xpresi')?.title));
  console.log('Cash Wallet →', JSON.stringify(lookupTips('Cash Wallet')));
  console.log('GoPay Saldo →', JSON.stringify(lookupTips('GoPay Saldo')?.title));
});" 2>&1 | tail -5
```

Expected output:
```
BCA Tahapan Xpresi → "BCA"
Cash Wallet → null
GoPay Saldo → "GoPay"
```

If `--experimental-strip-types` flag unavailable on the Node version, skip this step — typecheck in Step 2 is sufficient.

---

## Task 2: Build `Dropzone.tsx`

Goal: reusable dropzone with HTML5 drag-drop + click-to-pick + multi-file support + per-file size validation. No state coordination — just bubble accepted files to parent.

**Files:**
- Create: `frontend/app/(app)/import/_components/Dropzone.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/app/(app)/import/_components/Dropzone.tsx`:

```typescript
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
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0, no errors.

---

## Task 3: Build `AccountSelect.tsx`

Goal: dropdown of user's active accounts + localStorage persistence of last-used.

**Files:**
- Create: `frontend/app/(app)/import/_components/AccountSelect.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/app/(app)/import/_components/AccountSelect.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAccounts } from "@/lib/api/accounts";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "financeai:import:lastAccountId";

interface AccountSelectProps {
	value: string | null;
	onChange: (accountId: string | null) => void;
}

export function AccountSelect({ value, onChange }: AccountSelectProps) {
	const { data: accounts } = useQuery({
		queryKey: ["accounts"],
		queryFn: listAccounts,
	});

	// Restore last selected on mount, if not already set by parent
	useEffect(() => {
		if (value !== null) return;
		const saved = localStorage.getItem(STORAGE_KEY);
		if (!saved) return;
		// Only restore if account still exists
		if (accounts?.some((a) => a.id === saved && a.is_active && !a.deleted_at)) {
			onChange(saved);
		}
	}, [accounts, value, onChange]);

	// Persist on change
	useEffect(() => {
		if (value) {
			localStorage.setItem(STORAGE_KEY, value);
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	}, [value]);

	const activeAccounts = (accounts ?? []).filter((a) => a.is_active && !a.deleted_at);

	return (
		<div className="flex flex-wrap items-center gap-3">
			<label htmlFor="import-account-select" className="text-[11px] font-medium uppercase tracking-label text-gray-500">
				Akun tujuan
			</label>
			<div className="relative">
				<select
					id="import-account-select"
					value={value ?? ""}
					onChange={(e) => onChange(e.target.value || null)}
					className={cn(
						"h-9 appearance-none rounded-md border bg-white pl-3 pr-8 text-[13px] text-gray-900 outline-none transition-[border-color] duration-200",
						"focus:border-gray-950",
						value ? "border-gray-950" : "border-gray-300",
					)}
					style={{
						backgroundImage:
							"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>\")",
						backgroundPosition: "right 8px center",
						backgroundRepeat: "no-repeat",
					}}
				>
					<option value="">— Tanpa akun (opsional) —</option>
					{activeAccounts.map((a) => (
						<option key={a.id} value={a.id}>
							{a.name}
							{a.last4 ? ` (••• ${a.last4})` : ""}
						</option>
					))}
				</select>
			</div>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0. If error about `deleted_at` field — check `lib/api/types.ts` for `AccountResponse` shape and adjust filter accordingly (might be `deleted_at?: string | null` or omitted entirely if backend hides it from response). Remove the `!a.deleted_at` clause if the field doesn't exist on the type.

---

## Task 4: Build `ExportTips.tsx`

Goal: contextual tips panel — show when account selected AND name matches keyword, hidden otherwise.

**Files:**
- Create: `frontend/app/(app)/import/_components/ExportTips.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/app/(app)/import/_components/ExportTips.tsx`:

```typescript
"use client";

import { lookupTips } from "@/lib/import-tips";

interface ExportTipsProps {
	accountName: string | null | undefined;
}

export function ExportTips({ accountName }: ExportTipsProps) {
	const tips = lookupTips(accountName);
	if (!tips) return null;

	return (
		<div className="border border-gray-200 bg-gray-50 px-[22px] py-5">
			<h3 className="mb-3 text-[11px] font-medium uppercase tracking-label text-gray-500">
				Cara export dari {tips.title}
			</h3>
			<ol className="m-0 list-none space-y-0 p-0">
				{tips.steps.map((step, i) => (
					<li key={i} className="flex gap-3.5 py-2 text-[13px] leading-relaxed text-gray-700">
						<span className="min-w-[24px] font-mono text-[11px] font-medium tracking-[0.04em] text-gray-400">
							{String(i + 1).padStart(2, "0")}
						</span>
						{step}
					</li>
				))}
			</ol>
		</div>
	);
}
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0.

---

## Task 5: Build `JobsHistorySidebar.tsx`

Goal: right-side panel with multi-job status cards + polling. Click triggers `onJobClick`.

**Files:**
- Create: `frontend/app/(app)/import/_components/JobsHistorySidebar.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/app/(app)/import/_components/JobsHistorySidebar.tsx`:

```typescript
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
			)}
		</aside>
	);
}
```

- [ ] **Step 2: Verify `ImportJobStatus` and `ImportJobResponse` types**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && grep -E "ImportJobStatus|ImportJobResponse" lib/api/types.ts | head -20
```

Confirm: `ImportJobStatus` union includes `pending | processing | review | confirmed | cancelled | failed`. `ImportJobResponse` has `id`, `file_name`, `status`, `rows_total`, `created_at`. If any field name differs (e.g. `created_at` vs `createdAt`), adjust the component code.

- [ ] **Step 3: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0.

---

## Task 6: Build `JobReviewPanel.tsx`

Goal: extract the existing review table (Step 3 block) from `app/(app)/import/page.tsx` into a self-contained component that loads a single job by id and renders the same review UX as before — editable cells, exclude/include, confirm/cancel.

**Files:**
- Create: `frontend/app/(app)/import/_components/JobReviewPanel.tsx`

- [ ] **Step 1: Read the existing review section from page.tsx**

```bash
sed -n '600,872p' /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend/app/\(app\)/import/page.tsx
```

This is the source of truth for the review table — copy the JSX structure (summary cards, filter buttons, table with sticky header, editable cells, action column). All visual styling preserved.

- [ ] **Step 2: Create the component**

Create `frontend/app/(app)/import/_components/JobReviewPanel.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
	getImportJob,
	updateImportRow,
	excludeImportRow,
	confirmImportJob,
	cancelImportJob,
} from "@/lib/api/import";
import type { ImportJobDetailResponse, ImportRowResponse } from "@/lib/api/types";
import { cn } from "@/lib/cn";

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

type ConfBucket = "ok" | "warn" | "err";

function bucketConfidence(score: string | number | null | undefined): ConfBucket {
	const n = typeof score === "string" ? parseFloat(score) : (score ?? 0);
	if (!Number.isFinite(n)) return "err";
	if (n >= 0.8) return "ok";
	if (n >= 0.5) return "warn";
	return "err";
}

function fmtRp(amountStr: string): string {
	const n = parseFloat(amountStr) || 0;
	const abs = Math.abs(n).toLocaleString("id-ID");
	return (n >= 0 ? "+Rp " : "−Rp ") + abs;
}

function formatShortDate(iso: string): string {
	try {
		return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(iso));
	} catch {
		return iso;
	}
}

const easeDesignhub = [0.2, 0.7, 0.2, 1] as const;
const fadeVariants = {
	hidden: { opacity: 0, y: 8 },
	show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeDesignhub } },
	exit: { opacity: 0, transition: { duration: 0.15 } },
};

interface JobReviewPanelProps {
	jobId: string;
	onClose: () => void;
	onConfirmed: (result: { created: number; existed: number }) => void;
}

export function JobReviewPanel({ jobId, onClose, onConfirmed }: JobReviewPanelProps) {
	const queryClient = useQueryClient();
	const [reviewFilter, setReviewFilter] = useState<"all" | ConfBucket>("all");
	const [editingCell, setEditingCell] = useState<
		{ rowId: string; field: "merchant_name" | "category" } | null
	>(null);

	const { data: job } = useQuery<ImportJobDetailResponse>({
		queryKey: ["import-job", jobId],
		queryFn: () => getImportJob(jobId),
		refetchInterval: (q) => {
			const status = q.state.data?.status;
			if (
				status === "review" ||
				status === "confirmed" ||
				status === "failed" ||
				status === "cancelled"
			) {
				return false;
			}
			return 1500;
		},
	});

	const updateRowMutation = useMutation({
		mutationFn: (args: { rowId: string; data: Parameters<typeof updateImportRow>[2] }) =>
			updateImportRow(jobId, args.rowId, args.data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
		},
	});

	const excludeRowMutation = useMutation({
		mutationFn: (rowId: string) => excludeImportRow(jobId, rowId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-job", jobId] });
		},
	});

	const confirmMutation = useMutation({
		mutationFn: () => confirmImportJob(jobId),
		onSuccess: (r) => {
			queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
			onConfirmed({ created: r.transactions_created, existed: r.already_existed });
		},
	});

	const cancelMutation = useMutation({
		mutationFn: () => cancelImportJob(jobId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
			onClose();
		},
	});

	const handleCellEdit = (
		row: ImportRowResponse,
		field: "merchant_name" | "category",
		value: string,
	) => {
		updateRowMutation.mutate({ rowId: row.id, data: { [field]: value } });
		setEditingCell(null);
	};

	if (!job) {
		return (
			<div className="py-10 text-center text-[13px] text-gray-400">Memuat job...</div>
		);
	}

	const items = job.items ?? [];
	const filteredRows =
		reviewFilter === "all"
			? items
			: items.filter((r) => bucketConfidence(r.confidence_score) === reviewFilter);

	const okCount = job.rows_ok ?? 0;
	const warnCount = job.rows_warn ?? 0;
	const errCount = job.rows_err ?? 0;
	const totalRows = job.rows_total ?? 0;
	const includedRows = items.filter((r) => !r.is_excluded).length;

	const isProcessing = job.status === "pending" || job.status === "processing";
	const isFailed = job.status === "failed";
	const isReview = job.status === "review";
	const isDone = job.status === "confirmed";

	return (
		<motion.div variants={fadeVariants} initial="hidden" animate="show" exit="exit">
			<button
				type="button"
				onClick={onClose}
				className="mb-4 inline-flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-gray-950"
			>
				<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<polyline points="15 18 9 12 15 6" />
				</svg>
				Kembali ke dropzone
			</button>

			<h2 className="mb-1.5 font-serif text-[28px] font-normal leading-[1.1] tracking-tight2 text-gray-950">
				Review <em className="italic text-gray-700">{job.file_name}</em>
			</h2>
			<p className="mb-7 max-w-[580px] text-sm text-gray-500">
				{isProcessing && "AI sedang membaca file kamu..."}
				{isFailed && (job.error_message || "Gagal memproses file.")}
				{isReview && (
					<>
						AI menemukan <strong className="text-gray-950">{totalRows} transaksi</strong>. Verifikasi sebelum simpan. Klik cell untuk edit.
					</>
				)}
				{isDone && (
					<>Job sudah dikonfirmasi. Lihat hasilnya di <a href="/transactions" className="underline">Transactions</a>.</>
				)}
			</p>

			{isProcessing && (
				<div className="border border-gray-200 p-6">
					<div className="flex items-center gap-3 text-[13px] text-gray-700">
						<span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-gray-300 border-t-gray-950" />
						{job.status === "pending" ? "Menunggu antrian..." : "Memproses & klasifikasi AI..."}
					</div>
				</div>
			)}

			{isFailed && (
				<div className="border border-[#dc2626] bg-[#fdf6f6] p-6">
					<div className="mb-2 text-[13px] font-medium text-[#dc2626]">Gagal memproses</div>
					<div className="text-[13px] text-gray-700">
						{job.error_message || "Format file tidak dikenali atau parser error."}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="mt-4 inline-flex h-9 items-center rounded-lg border border-gray-300 px-4 text-[13px] font-medium text-gray-700 hover:border-gray-950 hover:bg-gray-50 hover:text-gray-950"
					>
						Tutup
					</button>
				</div>
			)}

			{(isReview || isDone) && (
				<>
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

					{/* Filter pills */}
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
												<span className="whitespace-nowrap font-mono text-xs text-gray-700">{formatShortDate(row.transaction_date)}</span>
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
														onClick={() => !isDone && setEditingCell({ rowId: row.id, field: "merchant_name" })}
														className={cn("text-gray-950", !isDone && "cursor-text hover:bg-gray-50")}
													>
														{row.merchant_name || <span className="text-gray-400">(kosong)</span>}
													</span>
												)}
											</td>
											<td className="px-3.5 py-2.5">
												{editingCell?.rowId === row.id && editingCell.field === "category" ? (
													<select
														defaultValue={row.category ?? ""}
														autoFocus
														className="w-full rounded border border-gray-950 bg-white px-2 py-1 text-[13px] text-gray-950 outline-none"
														onBlur={(e) => handleCellEdit(row, "category", e.target.value)}
														onChange={(e) => handleCellEdit(row, "category", e.target.value)}
													>
														<option value="">— Pilih —</option>
														{CATEGORIES.map((c) => (
															<option key={c} value={c}>{c}</option>
														))}
													</select>
												) : (
													<span
														onClick={() => !isDone && setEditingCell({ rowId: row.id, field: "category" })}
														className={cn("text-gray-700", !isDone && "cursor-text hover:bg-gray-50")}
													>
														{row.category || <span className="text-gray-400">(kosong)</span>}
													</span>
												)}
											</td>
											<td className="px-3.5 py-2.5 text-right">
												<span className="font-mono tabular-nums text-gray-950">{fmtRp(row.amount)}</span>
											</td>
											<td className="px-3.5 py-2.5">
												<span className="font-mono text-[11px] text-gray-500">{Number(row.confidence_score).toFixed(2)}</span>
											</td>
											<td className="px-3.5 py-2.5 text-right">
												{!isDone && (
													<button
														type="button"
														onClick={() => excludeRowMutation.mutate(row.id)}
														className="text-[11px] text-gray-400 hover:text-gray-950"
														disabled={excludeRowMutation.isPending}
													>
														{row.is_excluded ? "Aktifkan" : "Kecualikan"}
													</button>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{isReview && (
						<div className="mt-5 flex flex-wrap items-center gap-3">
							<button
								type="button"
								onClick={() => confirmMutation.mutate()}
								disabled={confirmMutation.isPending || includedRows === 0}
								className="inline-flex h-10 items-center rounded-md bg-gray-950 px-5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{confirmMutation.isPending ? "Menyimpan..." : `Konfirmasi & Simpan ${includedRows} transaksi`}
							</button>
							<button
								type="button"
								onClick={() => cancelMutation.mutate()}
								disabled={cancelMutation.isPending}
								className="inline-flex h-10 items-center rounded-md border border-gray-300 px-5 text-[13px] font-medium text-gray-700 transition-colors duration-200 hover:border-gray-950 hover:text-gray-950"
							>
								Batal
							</button>
						</div>
					)}
				</>
			)}
		</motion.div>
	);
}
```

- [ ] **Step 3: Verify `updateImportRow` signature**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && grep -A 10 "export async function updateImportRow" lib/api/import.ts
```

Confirm signature is `updateImportRow(jobId, rowId, data)`. If the third param shape differs from `{ merchant_name?: string; category?: string }`, adjust the mutation accordingly.

- [ ] **Step 4: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0.

---

## Task 7: Rewrite `page.tsx`

Goal: replace the 872-line page with ~200 lines that composes the new components. Coordinate state (selectedAccountId, activeJobId), handle multi-file upload, URL `?job=` sync.

**Files:**
- Rewrite: `frontend/app/(app)/import/page.tsx`

- [ ] **Step 1: Replace page.tsx entirely**

Use Write tool (existing file will be overwritten). New content:

```typescript
"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useSidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/cn";
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
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit
```

Expected: exit 0. If there are type errors related to `uploadImport` accepting `account_id`, check the existing `UploadImportParams` interface in `lib/api/import.ts`. If `account_id` isn't in the type, adjust either:
- Add `account_id?: string` to `UploadImportParams` if backend already accepts it (recommended — minor type fix)
- OR drop `account_id` from the call site and accept that uploads won't link to account (degrades UX but ships)

Check first:
```bash
grep -A 5 "interface UploadImportParams\|type UploadImportParams" lib/api/import.ts
```

If `account_id` missing, add it to the interface AND ensure the request body in `uploadImport()` includes the field.

- [ ] **Step 3: Lint check**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec next lint
```

Expected: No warnings or errors.

---

## Task 8: Final verification — agent reports back

Agent does NOT commit. After completing Tasks 1-7, run final verification commands and report.

- [ ] **Step 1: Full typecheck**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec tsc --noEmit 2>&1 | tail -5
```

Expected: exit 0, no errors.

- [ ] **Step 2: Lint**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec next lint 2>&1 | tail -10
```

Expected: No warnings or errors.

- [ ] **Step 3: Backend tests still pass (regression check — should be unchanged)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend && venv/bin/pytest tests/ -v 2>&1 | tail -3
```

Expected: 163 passed, 10 skipped (Phase 2 baseline). No regression — frontend change should not affect backend tests.

- [ ] **Step 4: Build check (production)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend && pnpm exec next build 2>&1 | tail -20
```

Expected: Build succeeds, `/import` route compiled without errors. May see warnings about no static optimization for routes with client components — that's fine.

If build fails: stop and report the exact error. Common cause: missing import or type mismatch.

- [ ] **Step 5: Git status report**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && git status
```

Expected:

**Modified:**
- `frontend/app/(app)/import/page.tsx`

**New:**
- `frontend/lib/import-tips.ts`
- `frontend/app/(app)/import/_components/AccountSelect.tsx`
- `frontend/app/(app)/import/_components/Dropzone.tsx`
- `frontend/app/(app)/import/_components/ExportTips.tsx`
- `frontend/app/(app)/import/_components/JobsHistorySidebar.tsx`
- `frontend/app/(app)/import/_components/JobReviewPanel.tsx`

Possibly modified:
- `frontend/lib/api/import.ts` (if `account_id` added to `UploadImportParams` in Task 7 Step 2)

NOT committed.

- [ ] **Step 6: Report**

Output a final summary block with:
- ✅/❌ per task (1-8)
- Frontend typecheck: clean? Yes/No
- Frontend lint: clean? Yes/No
- `pnpm exec next build`: success/fail
- Backend regression: 163 passed, 10 skipped? (Phase 2 baseline)
- List of modified/created files
- Any deviation from plan (e.g. `account_id` type added to UploadImportParams, lint auto-fix, unexpected behavior, type mismatch needed adjustment)
- Confirmation that NO commits were made

---

## Self-Review Notes (internal — not for agent)

**Spec coverage check:**
- Goal 1 (single dropzone): Task 2 `Dropzone.tsx` ✓
- Goal 2 (account dropdown): Task 3 `AccountSelect.tsx` ✓
- Goal 3 (multi-file batch): Task 7 `handleFilesAccepted` loop ✓
- Goal 4 (contextual tips): Tasks 1+4 (lib + component) ✓
- Goal 5 (inline review): Task 6 `JobReviewPanel.tsx` ✓
- Goal 6 (preserve review functionality): Task 6 copies summary cards, filter pills, editable cells, exclude action ✓
- Goal 7 (design system match): All components use existing utility classes (`tracking-tight2`, `tracking-label`, `easeDesignhub`, font-serif/font-mono) ✓

**Non-goals respected:**
- Backend untouched: only `lib/api/import.ts` `UploadImportParams` type might gain `account_id` field — IF backend already accepts it (verify first); if not, drop the param and document for follow-up
- No schema migration: no Account model change
- No `source_type=auto`: sentinel `"manual_csv"` used per spec
- No bulk operations, no rerun, no first-time onboarding

**Placeholder scan:** No TBD/TODO. Step 2 of Task 7 has conditional adjustment instruction ("If `account_id` missing, add it") — this is an explicit branch, not a placeholder.

**Type consistency:**
- `JobReviewPanelProps.onConfirmed(result: { created; existed })` matches `handleJobConfirmed(result)` in page.tsx ✓
- `JobsHistorySidebarProps.activeJobId` and `onJobClick` match page.tsx usage ✓
- `Dropzone.onFilesAccepted(files: File[])` matches `handleFilesAccepted(files)` ✓
- `AccountSelectProps.{value, onChange}` matches page.tsx usage ✓
- `ExportTips.accountName` matches `selectedAccountName` resolved via accounts memo ✓

**Risks for agent to report on:**
1. **`UploadImportParams.account_id`** — type might not exist on the request body. Step 2 of Task 7 explicitly checks + provides adjustment. If account linking can't be wired, ship without it and note for PM.
2. **`AccountResponse.deleted_at`** — Task 3 filter assumes this field exists. If response type omits it (likely — backend hides soft-deleted accounts via service filter), Step 2 instructs to remove the filter clause.
3. **`updateImportRow` signature** — Task 6 Step 3 verifies. If 3rd param shape differs, adjust mutation.
4. **Tailwind classes referenced** (`tracking-tight2`, `tracking-label`, `bg-amber-100` etc.) — `tracking-tight2` and `tracking-label` are custom utility classes from `tailwind.config.ts`. Standard `bg-amber-*` / `bg-blue-*` are Tailwind core. If any classes don't render correctly, that's a Tailwind config issue — report to PM.
5. **Visual smoke tests** are agent's responsibility for typecheck only. Browser-based visual QA is PM's job during verification.
