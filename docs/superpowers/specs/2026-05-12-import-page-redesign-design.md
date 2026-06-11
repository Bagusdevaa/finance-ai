# Import Page Redesign — Design (Phase 3)

**Status:** Draft, pending implementation
**Date:** 2026-05-12
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch target:** `bugfix` (current) or new `feat/import-redesign`

---

## Context

Phase 1 (commit `39963e4`) shipped `ImageVisionParser`. Phase 2 (commit `d897ffd`) shipped Smart Import Dispatcher with content-based routing — backend now auto-detects file format and picks the right parser regardless of `source_type` value frontend sends.

Frontend `/import` page (`app/(app)/import/page.tsx`, 872 lines) masih tile-first: user pilih 1 dari 15 platform tile, lihat instruksi per platform, upload via dropzone. Logic ini sudah **stale** karena dispatcher backend tidak peduli source_type. User bisa salah pilih tile dan upload tetap berhasil — tapi UX-nya membingungkan.

Phase 3 = full frontend redesign menyesuaikan backend reality:
- Collapse 15 platform tiles → 1 dropzone
- Account dropdown menggantikan tile selection (untuk linking transactions ke account)
- Multi-file batch upload (drop N files → N parallel ImportJobs)
- Right sidebar jobs history dengan per-job status badges
- Review screen inline (no separate route)

Backend tidak diubah sama sekali di Phase 3.

## Goals

1. Replace 15-tile selector dengan single dropzone yang accept all formats (PDF, CSV, PNG, JPEG, WebP).
2. Account dropdown (opsional) untuk link transactions ke specific account.
3. Multi-file batch upload — drop N files → N parallel ImportJobs, status cards di right sidebar.
4. Contextual export tips berdasarkan account name heuristic (no schema change).
5. Inline review panel — click job card → main area replace dropzone dengan review table.
6. Preserve all existing review functionality (editable cells, exclude/include, confirm/cancel).
7. Match existing FinanceAI design system (monochrome, Instrument Serif headings, Geist body, sharp corners, framer-motion easeDesignhub).

## Non-goals

- **Backend changes** — zero. All existing endpoints reused (`GET /v1/accounts`, `GET /v1/import/jobs/:id`, `POST /v1/import/upload`, etc.)
- **Schema migration** — Account model tidak diubah; tidak ada field `bank` baru.
- **New backend `source_type` enum value** (`auto`) — frontend send `"manual_csv"` sebagai default sentinel; dispatcher ignore.
- **Bulk operations** — confirm/cancel multiple jobs sekaligus. Each job confirmed individually.
- **Job rerun/retry from history** — user just re-upload manually if needed.
- **First-time user onboarding tooltip** — defer to separate iteration.
- **Per-row currency override** in review screen — existing logic preserved as-is.
- **Drag-and-drop reorder pending jobs** — not meaningful (jobs processed independently).
- **Onboarding wizard integration** — out of scope.

## Constraints discovered

**Account model has no `bank` field** (verified `app/accounts/models.py:30-46`):
- Fields: `name` (free text), `type` (enum: bank/ewallet/broker/cash), `last4`, `currency`, `is_active`
- Contextual tips must use **heuristic substring match on `account.name`** (e.g. account name "BCA Tahapan Xpresi" → contains "bca" → match BCA tips)
- No backend change required; acceptable accuracy for MVP

## Design

### Architecture & file structure

```
frontend/app/(app)/import/
├── page.tsx                          (REWRITE: 872 → ~200 lines, layout + state coordination)
└── _components/
    ├── AccountSelect.tsx             (NEW ~60 lines: dropdown + last-used localStorage)
    ├── Dropzone.tsx                  (NEW ~80 lines: HTML5 drag-drop + click + multi-file)
    ├── ExportTips.tsx                (NEW ~50 lines: heuristic match account.name → tips lookup)
    ├── JobsHistorySidebar.tsx        (NEW ~120 lines: jobs list, status badges, polling)
    └── JobReviewPanel.tsx            (NEW ~200 lines: review table extracted from current code)

frontend/lib/
└── import-tips.ts                    (NEW ~80 lines: bank/wallet name → instructions map)
```

**Reused from existing page (extracted to components):**
- Review table with editable cells (merchant + category)
- Confidence bucket logic (`ok` / `warn` / `err`)
- Helpers: `fmtRp`, `formatShortDate`, `bucketConfidence` — keep in current location or extract to `lib/utils.ts`
- Confirm/cancel/update-row/exclude-row mutations
- `ConfirmDialog` integration

**Removed:**
- `SOURCE_GROUPS` constant (15 tiles)
- `SOURCE_INSTRUCTIONS` per-platform mapping (replaced by `lib/import-tips.ts` keyed by name keyword)
- 4-step stepper (`STEPS`, `currentStep`, `goStep`)
- Mobile drawer for tile list (`mobileShowContent`)
- Tile search (`searchQuery`)
- `activeSource`, `activePill`, `BANK_PILLS` state
- `MobileMenuButton` (replaced inline if still needed)

### State machine per job

Backend `ImportJobStatus` enum (no change): `pending → processing → review → confirmed | cancelled | failed`.

| Backend status | UI badge | Color | Click behavior |
|---|---|---|---|
| `pending` | "Proses" | yellow (`#fef3c7` bg, `#92400e` text) | Disabled — wait for processing |
| `processing` | "Proses" | yellow with progress bar | Disabled |
| `review` | "Review" | blue (`#dbeafe` / `#1e40af`) | Click → open inline review |
| `confirmed` | "Done" | green (`#dcfce7` / `#166534`) | Click → reopen read-only review |
| `cancelled` | "Batal" | gray | Click → show cancel reason |
| `failed` | "Gagal" | red (`#fee2e2` / `#991b1b`) | Click → expand error_message |

**Polling**: React Query `refetchInterval: 2000` while ada job dalam `pending` atau `processing`. Stop polling kalau semua jobs terminal.

### Layout structure

**Desktop (≥768px):**

```
┌─────────────────────────────────────────────────────────┐
│  Header (Import Data + Bantuan button)                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────────────┐  ┌────────────────┐  │
│  │  AccountSelect dropdown      │  │ Jobs History   │  │
│  │                              │  │                │  │
│  │  Dropzone (large, dashed)    │  │ ┌────────────┐ │  │
│  │                              │  │ │ Job card 1 │ │  │
│  │  ExportTips (if account)     │  │ ├────────────┤ │  │
│  │                              │  │ │ Job card 2 │ │  │
│  └──────────────────────────────┘  │ └────────────┘ │  │
│                                     └────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Grid: `grid-template-columns: 1fr 280px` dengan gap 24-32px. Max-width container 1100px centered.

**Mobile (<768px):**

Stack vertikal. Dropzone full-width on top, jobs section di bawah sebagai full-width list (bukan sidebar). Active review state = full-viewport panel dengan link "← Lihat jobs lain" di top untuk return ke main view.

Implementasi via Tailwind responsive classes (`md:grid-cols-[1fr_280px]`).

### Active states

**State 1 — Empty (default):**
- AccountSelect: placeholder "Pilih akun (opsional)"
- Dropzone: idle, "Drop file apapun di sini"
- ExportTips: hidden (no account selected)
- Sidebar: empty state "Belum ada import"

**State 2 — Account selected, uploading:**
- AccountSelect: shows "BCA Tahapan Xpresi" with active border
- Dropzone: idle (still accepts more uploads)
- ExportTips: visible — "Cara export dari BCA" (3 steps)
- Sidebar: 3 cards stacked. Card 1 "uploading 42%". Card 2 "Review". Card 3 "Review".

**State 3 — Review inline (user clicked job card):**
- Main area: review table replaces dropzone+tips. "← Kembali ke dropzone" button at top.
- AccountSelect & Dropzone hidden.
- Sidebar: still visible, clicked job highlighted with `border-gray-950` border. Other jobs clickable to switch.
- Confirm/Batal buttons at bottom of review table.

### AccountSelect component

```typescript
// _components/AccountSelect.tsx
interface Props {
  value: string | null;            // account.id
  onChange: (accountId: string | null) => void;
}

// Fetch from existing GET /v1/accounts (TanStack Query)
// Display format: "{account.name} {account.last4 ? `(••• ${account.last4})` : ''}"
// Filter accounts where `is_active === true` AND `deleted_at === null`
// Persist last selected to localStorage key: `financeai:import:lastAccountId`
// On mount, restore lastAccountId from localStorage if account still exists
// Render: standard <select> with custom styling matching design system (rounded-md, border-gray-300)
```

**Optional clearance**: includes "— Tanpa akun —" option (value = `null`) so user can upload without linking.

### ExportTips component

```typescript
// _components/ExportTips.tsx
import { lookupTips } from "@/lib/import-tips";

interface Props {
  accountName: string | null;     // null = hidden
}

// If accountName null → return null (component not rendered)
// Lookup tips via lib/import-tips.ts heuristic
// Render: gray panel with uppercase label + numbered ordered list (matches existing SOURCE_INSTRUCTIONS visual)
```

```typescript
// lib/import-tips.ts
interface Tips {
  title: string;
  steps: string[];
}

const TIPS_REGISTRY: { match: string[]; tips: Tips }[] = [
  {
    match: ["bca"],
    tips: { title: "BCA", steps: [
      "Buka aplikasi BCA mobile dan masuk ke menu Info Saldo & Mutasi.",
      "Pilih rentang tanggal yang ingin di-import (maksimal 3 bulan terakhir).",
      "Tap Kirim ke Email, pilih format PDF.",
      "Buka email kamu, unduh attachment-nya, lalu drop di sini.",
    ]},
  },
  { match: ["mandiri"], tips: { title: "Mandiri", steps: [
      "Login ke Livin' by Mandiri.",
      "Buka e-Statement, pilih bulan yang ingin di-import.",
      "Download PDF, lalu drop di sini.",
    ]},
  },
  { match: ["bri"], tips: { title: "BRI", steps: [
      "Buka BRImo, masuk ke Mutasi, pilih periode, kirim ke email PDF.",
      "Drop file PDF di sini.",
    ]},
  },
  { match: ["bni", "wondr"], tips: { title: "BNI", steps: [
      "Buka wondr by BNI, menu Mutasi Rekening, ekspor PDF.",
      "Drop file PDF di sini.",
    ]},
  },
  { match: ["permata"], tips: { title: "Permata", steps: [
      "Login PermataNet / PermataMobile X.",
      "Menu Rekening Koran, pilih periode, download PDF.",
      "Drop file di sini.",
    ]},
  },
  { match: ["gopay", "gojek"], tips: { title: "GoPay", steps: [
      "Buka aplikasi Gojek, ke GoPay, tap Riwayat.",
      "Screenshot riwayat transaksi (multi-page OK).",
      "Drop screenshot di sini — AI akan baca semuanya.",
    ]},
  },
  { match: ["ovo"], tips: { title: "OVO", steps: [
      "Buka OVO, menu History. Screenshot tampilan riwayat.",
      "Drop screenshot di sini.",
    ]},
  },
  { match: ["dana"], tips: { title: "Dana", steps: [
      "Buka DANA, menu History. Screenshot tampilan riwayat.",
      "Drop screenshot di sini.",
    ]},
  },
  { match: ["shopeepay", "shopee"], tips: { title: "ShopeePay", steps: [
      "Buka ShopeePay, menu Riwayat Transaksi.",
      "Screenshot tampilan list. Drop di sini.",
    ]},
  },
  { match: ["bibit"], tips: { title: "Bibit", steps: [
      "Buka Bibit, menu Portofolio → Pengaturan → Export Data.",
      "Pilih CSV. Drop file di sini.",
    ]},
  },
  { match: ["stockbit"], tips: { title: "Stockbit", steps: [
      "Buka Stockbit, tab Portfolio.",
      "Screenshot tampilan holdings (1 layar = 1 file).",
      "Drop semua screenshot di sini.",
    ]},
  },
  { match: ["ipot"], tips: { title: "IPOT", steps: [
      "Login IPOT (web), menu Portfolio → Export.",
      "Pilih format CSV. Drop file di sini.",
    ]},
  },
  { match: ["pluang"], tips: { title: "Pluang", steps: [
      "Buka Pluang, menu Portofolio. Screenshot tampilan emas / kripto.",
      "Drop screenshot di sini.",
    ]},
  },
];

export function lookupTips(accountName: string): Tips | null {
  const lower = accountName.toLowerCase();
  for (const entry of TIPS_REGISTRY) {
    if (entry.match.some((kw) => lower.includes(kw))) {
      return entry.tips;
    }
  }
  return null;
}
```

Account name like "BCA Tahapan Xpresi" → contains "bca" → matches first entry. Account "Cash Wallet" → no match → null → component hidden.

### Dropzone component

```typescript
// _components/Dropzone.tsx
interface Props {
  onFilesAccepted: (files: File[]) => void;
  disabled?: boolean;     // true when activeJobId set (review mode hides dropzone)
}

// HTML5 drag-drop (no react-dropzone library — keep deps minimal)
// Click → trigger hidden <input type="file" multiple accept="application/pdf,image/png,image/jpeg,image/webp,text/csv">
// Drop → e.preventDefault, extract files from e.dataTransfer.files, filter by size (≤10MB), call onFilesAccepted
// Visual: dashed border, dragOver state changes border to solid + bg-gray-50
// Multi-file accepted by default (input has `multiple`)
```

Validation in component:
- File size > 10 MB → skip + show inline toast/error pill
- File MIME tidak supported → skip + error
- Files yang lolos → batch pass ke `onFilesAccepted`

### Multi-file upload flow

```typescript
// page.tsx
const handleFilesAccepted = (files: File[]) => {
  files.forEach((file) => {
    uploadMutation.mutate({
      file,
      account_id: selectedAccountId ?? undefined,
      source_type: "manual_csv",  // sentinel; backend dispatcher ignores
    });
  });
};
```

**`source_type="manual_csv"`** sebagai sentinel — backend dispatcher Phase 2 ignore source_type untuk routing. Field `source_type` masih required di backend schema (non-null), jadi kita kirim value valid manapun. `manual_csv` dipilih karena paling generic.

**Concurrency**: tidak throttled di frontend. Browser handle ~6 parallel HTTP per origin. For very large batches (>10 files), browser auto-queues.

**No await loop**: parallel via `forEach` + `mutate` (TanStack Query handles parallel calls). React Query `invalidateQueries(["import-jobs"])` di onSuccess refresh sidebar.

### JobsHistorySidebar component

```typescript
// _components/JobsHistorySidebar.tsx
interface Props {
  activeJobId: string | null;
  onJobClick: (jobId: string) => void;
}

// useQuery: GET /v1/import/jobs (existing list endpoint)
// refetchInterval: 2000 if ANY job in pending/processing, else false
// Render: list of job cards, newest on top
// Each card: filename + status badge + meta (file size / row count / time ago)
// Active job (matches activeJobId): bg-gray-50 + border-gray-950
// Click → onJobClick(jobId) — disabled for pending/processing (show cursor-not-allowed)
// For pending/processing: include progress bar (indeterminate or actual % if backend exposes)
// Empty state: dashed border + "Belum ada import"
// Soft-delete: confirmed/cancelled/failed jobs older than 7 days hidden by default (filter client-side)
```

### JobReviewPanel component

```typescript
// _components/JobReviewPanel.tsx
interface Props {
  jobId: string;
  onClose: () => void;     // back to dropzone
  onConfirmed: () => void; // after successful confirm
}

// useQuery: GET /v1/import/jobs/:jobId (existing)
// Render existing review table (extract from current page.tsx)
// Editable cells (merchant_name + category) — preserve existing update mutation
// Exclude/include toggle per row — preserve existing exclude mutation
// Confidence bucket filter (all / ok / warn / err) — preserve
// Confirm button → POST /v1/import/jobs/:jobId/confirm → onConfirmed() → close panel
// Cancel button → POST /v1/import/jobs/:jobId/cancel → onClose()
// Header: "← Kembali ke dropzone" + filename + status
```

### Page-level state & URL coordination

```typescript
// page.tsx top-level state
const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
const [activeJobId, setActiveJobId] = useState<string | null>(null);
const [uploadErrors, setUploadErrors] = useState<string[]>([]);

// On mount: restore from localStorage if present
useEffect(() => {
  const saved = localStorage.getItem("financeai:import:lastAccountId");
  if (saved) setSelectedAccountId(saved);
}, []);

// Persist on change
useEffect(() => {
  if (selectedAccountId) {
    localStorage.setItem("financeai:import:lastAccountId", selectedAccountId);
  } else {
    localStorage.removeItem("financeai:import:lastAccountId");
  }
}, [selectedAccountId]);

// URL sync for deep-link to review
const searchParams = useSearchParams();
useEffect(() => {
  const jobParam = searchParams.get("job");
  if (jobParam && jobParam !== activeJobId) setActiveJobId(jobParam);
}, [searchParams]);

useEffect(() => {
  const url = new URL(window.location.href);
  if (activeJobId) url.searchParams.set("job", activeJobId);
  else url.searchParams.delete("job");
  window.history.replaceState({}, "", url.toString());
}, [activeJobId]);
```

URL pattern: `/import` (dropzone mode), `/import?job=<uuid>` (review mode). Shareable across tabs.

### Animations

- Job card masuk sidebar: framer-motion slide-in + fade dari atas, duration 250ms, easing `easeDesignhub`
- Job card status badge change: smooth color transition saat polling update status
- Drop hover: border `dashed gray-300` → `solid gray-950`, bg `white` → `gray-50`, duration 200ms
- Review panel transition: `AnimatePresence mode="wait"` swap dropzone ↔ review panel, fade 250ms

### Design tokens & typography

Match existing system:
- Font: Instrument Serif (titles, italic emphasis), Geist Sans (body), Geist Mono (data/timestamps)
- Color: monochrome grayscale + accent badges (yellow/blue/green/red for status only)
- Radius: 0 untuk tables/cards, 6px untuk buttons/inputs, 9999px untuk pills
- Animation easing: `cubic-bezier(0.2, 0.7, 0.2, 1)` (existing `easeDesignhub`)

## Testing strategy

**Frontend tests are out of scope per project memory** (no Playwright/Vitest setup yet). Manual QA checklist:

### Visual QA
- [ ] Empty state: dropdown, dropzone, empty sidebar visible & aligned
- [ ] Account selection: dropdown opens, selecting persists to localStorage, refreshing page restores selection
- [ ] Tips appear after account selection (for accounts matching keywords)
- [ ] Tips hidden for accounts not matching any keyword (e.g. account named "Cash Wallet")
- [ ] Drop single file: card appears in sidebar with "Proses" badge
- [ ] Drop 5 files: 5 cards appear simultaneously
- [ ] File too big (>10MB): error pill shown, file skipped (others uploaded)
- [ ] Polling: status badges transition Proses → Review → Done correctly
- [ ] Click "Review" card: main area transitions to review table
- [ ] Sidebar stays visible during review; clicked card highlighted
- [ ] Click another job in sidebar while in review: switches without losing context
- [ ] Click "← Kembali" or sidebar empty area: returns to dropzone
- [ ] Confirm job: success state, card status changes to "Done"
- [ ] URL ?job= param updates when entering/leaving review
- [ ] Mobile (<768px): vertical stack, no horizontal scroll, dropzone full-width

### Functional QA (live against running uvicorn)
- [ ] Drop `bni-2025-10.pdf`: routes via dispatcher to PdfBniParser, 57 rows in review
- [ ] Drop `dana-list-1.jpeg`: routes via vision, 8 rows in review
- [ ] Drop `mandiri-statement.pdf`: routes via PdfVisionParser, 2 rows in review (admin fees)
- [ ] Confirm review → rows persist to transactions table → visible in `/transactions`
- [ ] Account selected during upload: confirmed transactions show correct `account_id`

### Regression
- [ ] Existing review functionality intact: editable cells save, exclude toggles, confidence filter works
- [ ] `ConfirmDialog` integration preserved for cancel/confirm actions
- [ ] `frontend tsc --noEmit` clean
- [ ] `pnpm exec next lint` clean

## Verification (post-implementation)

Yang saya jalankan di main session setelah agent selesai:

1. `cd frontend && pnpm exec tsc --noEmit` — clean
2. `cd frontend && pnpm exec next lint` — clean
3. Start `pnpm dev` + manually test each Visual QA checklist item
4. Functional QA dengan upload fixture PDFs/images via uvicorn
5. Mobile viewport test via browser devtools responsive mode

## Out of scope (future iterations)

- Frontend test setup (Playwright/Vitest) — separate effort
- First-time user onboarding flow with tooltips
- Job rerun/retry from history
- Bulk confirm/cancel multiple jobs
- New `source_type=auto` enum value in backend (clean fix for sentinel hack)
- Account create/edit form UI changes (current form likely needs `bank` field but that's separate)
- Cross-job aggregated review (single table showing rows from N jobs)
- WebSocket-based status push (replace 2s polling) — defer until perf concern materializes
- Drag-and-drop reorder of pending jobs — not meaningful
- Accessibility audit (axe-core, focus management) — separate effort
