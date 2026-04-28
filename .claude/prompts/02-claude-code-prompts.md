# FinanceAI — Prompts untuk Claude Code (VSCode)
**Cara pakai:** Buka Claude Code di terminal VSCode. Gunakan prompts ini secara berurutan.
Selalu mulai dari SETUP dulu sebelum halaman manapun.

---

## SETUP PERTAMA — Wajib dijalankan sekali

```
Bantu saya setup project Next.js 14 baru untuk aplikasi FinanceAI.
Ini adalah personal finance platform dengan design language minimal monochrome.

=== TECH STACK ===
- Framework: Next.js 14 (App Router)
- Language: TypeScript
- Styling: Tailwind CSS
- Animation: Framer Motion
- Icons: Lucide React
- Font: next/font (Geist Sans, Geist Mono) + Google Fonts (Instrument Serif)
- State management: Zustand
- Data fetching: TanStack Query (React Query)
- Form: React Hook Form + Zod
- HTTP client: Axios
- Charts: Recharts (customized monochrome) ATAU SVG manual
- Auth: NextAuth.js
- ORM: Prisma
- Database: PostgreSQL (via Railway atau Supabase)

=== TASK ===
1. Buat struktur folder lengkap:
   financeai/
   ├── app/
   │   ├── (auth)/
   │   │   ├── login/page.tsx
   │   │   └── register/page.tsx
   │   ├── (app)/
   │   │   ├── layout.tsx          ← sidebar + header
   │   │   ├── dashboard/page.tsx
   │   │   ├── transactions/page.tsx
   │   │   ├── assets/page.tsx
   │   │   ├── budget/page.tsx
   │   │   ├── import/page.tsx
   │   │   ├── chat/page.tsx
   │   │   └── settings/page.tsx
   │   ├── (marketing)/
   │   │   └── page.tsx            ← landing page
   │   ├── api/
   │   │   ├── auth/[...nextauth]/route.ts
   │   │   ├── transactions/route.ts
   │   │   ├── assets/route.ts
   │   │   ├── import/route.ts
   │   │   └── chat/route.ts
   │   ├── layout.tsx
   │   └── globals.css
   ├── components/
   │   ├── ui/                     ← design system components
   │   │   ├── Button.tsx
   │   │   ├── Card.tsx
   │   │   ├── Input.tsx
   │   │   ├── Badge.tsx
   │   │   ├── StatCard.tsx
   │   │   ├── DataTable.tsx
   │   │   ├── ProgressBar.tsx
   │   │   └── Skeleton.tsx
   │   ├── layout/
   │   │   ├── Sidebar.tsx
   │   │   ├── Header.tsx
   │   │   └── PageHeader.tsx
   │   ├── charts/
   │   │   ├── LineChart.tsx
   │   │   ├── DonutChart.tsx
   │   │   └── BarChart.tsx
   │   └── features/               ← feature-specific components
   ├── lib/
   │   ├── auth.ts
   │   ├── prisma.ts
   │   ├── groq.ts                 ← Groq AI client
   │   ├── parsers/
   │   │   ├── pdf-parser.ts
   │   │   ├── csv-parser.ts
   │   │   └── image-parser.ts    ← vision AI
   │   └── utils.ts
   ├── hooks/
   │   ├── useCountUp.ts
   │   ├── useIntersectionObserver.ts
   │   └── useNetWorth.ts
   ├── stores/
   │   └── useAppStore.ts          ← Zustand
   ├── types/
   │   ├── index.ts
   │   └── api.ts
   └── prisma/
       └── schema.prisma

2. Setup tailwind.config.ts dengan design tokens:
   - Font families: instrument-serif, geist-sans, geist-mono
   - Colors: monochrome scale (black, gray-950 sampai white)
   - Radius: sharp (0px untuk cards), small (4px untuk buttons)
   - Shadows: hanya yang sangat subtle

3. Setup globals.css dengan CSS custom properties dari design language

4. Buat file types/index.ts dengan semua TypeScript interfaces:
   - User, Account, Transaction, Asset, Budget, ImportSession, ChatMessage
   - Pastikan Transaction punya: amount (positif = income, negatif = expense), category, account_id, confidence_score (untuk hasil AI parsing)
   - Asset punya: type (STOCK | MUTUAL_FUND | CRYPTO | GOLD | CASH | PROPERTY | DEBT), account_id
   - Account punya: platform, type, masked_number

5. Buat prisma/schema.prisma lengkap sesuai types di atas
   Relasi penting:
   - User → many Accounts
   - Account → many Transactions
   - Account → many Assets
   - User → many ImportSessions
   - ImportSession → many Transactions (extracted)

6. Setup environment variables (.env.example):
   DATABASE_URL, NEXTAUTH_SECRET, GROQ_API_KEY, GROQ_MODEL=llama-3.3-70b-versatile

Jalankan: npm install semua dependencies, generate prisma client.
```

---

## COMPONENT LIBRARY — Design System

```
Implementasikan design system components untuk FinanceAI di folder components/ui/.
Ikuti design language ini dengan ketat:

=== DESIGN LANGUAGE RINGKASAN ===
- Font: Instrument Serif (display/numbers besar) + Geist Sans (body/UI) + Geist Mono (angka/data)
- Color: Strictly monochrome — black (#000000) sampai white (#FFFFFF) dengan gray steps
- Radius: 0px untuk cards/stat, 4px untuk buttons/inputs
- Motion: cubic-bezier(0.16, 1, 0.3, 1), stagger 50ms, count-up numbers 800ms
- Border: 1px solid, darkens on hover (gray-200 → gray-400 → black)
- Tidak ada warna untuk positive/negative — gunakan weight dan simbol

=== BUAT FILE-FILE INI ===

components/ui/Button.tsx:
  Variants: 'primary' | 'secondary' | 'ghost'
  Sizes: 'sm' | 'md' | 'lg'
  Primary: black bg, white text, radius 4px
  Hover: bg gray-900, transform scale(0.99), transition 150ms ease
  Loading state: subtle pulse animation

components/ui/Card.tsx:
  Default: white bg, border 1px gray-200, radius 0px, padding 24px
  Hover variant (prop hoverable): translateY(-2px), border → gray-400, 150ms
  Variants: 'default' | 'dark' (black bg, white text)

components/ui/StatCard.tsx:
  Props: label, value, delta?, deltaType ('up'|'down'|'neutral'), subtext?
  Label: 11px, UPPERCASE, gray-500, letter-spacing 0.08em, Geist Sans
  Value: 40px, Instrument Serif, weight 300, black
    - Angka keuangan: Geist Mono, 32px
  Delta: "↑ X%" weight 500 untuk up, "↓ X%" gray-500 weight 400 untuk down
  Animasi: count-up saat masuk viewport (gunakan useCountUp hook)

components/ui/Input.tsx:
  Border: 1px solid gray-300
  Focus: border-color black (tidak ada ring/outline berwarna)
  Radius: 4px
  Label: 11px UPPERCASE gray-500 di atas
  Error state: border merah (satu-satunya merah di design system)

components/ui/Badge.tsx:
  Variants: 'default' (gray-100 bg, gray-600 text) | 'primary' (black bg, white text) | 'outline'
  Radius: 2px
  Size: 11px, weight 500

components/ui/DataTable.tsx:
  Generic table dengan TypeScript generics
  Props: columns (dengan header, accessor, align), data, onRowClick?
  Header: 11px UPPERCASE gray-500, weight 500, letter-spacing 0.08em
  Numbers: right-aligned, Geist Mono font-class
  Row hover: background gray-50
  Row divider: 1px solid gray-100 (bukan alternating rows)
  Pagination built-in

components/ui/ProgressBar.tsx:
  Radius: 0px
  Track: gray-100
  Fill: black (default) atau custom color
  Height variants: 2px | 4px | 8px
  Animasi: fill dari 0% ke target width saat masuk viewport (Framer Motion)

hooks/useCountUp.ts:
  Input: target number, duration (default 800), start? (default 0)
  Trigger: saat elemen masuk viewport (IntersectionObserver)
  Output: current animated value (number)
  Gunakan requestAnimationFrame
  Format: tidak di hook, biarkan parent format sebagai currency

hooks/useIntersectionObserver.ts:
  Reusable hook untuk trigger animasi saat scroll
  Props: threshold (default 0.1), rootMargin (default '0px')
  Return: [ref, isIntersecting]
```

---

## PROMPT: Layout (Sidebar + Header)

```
Buat komponen layout utama untuk authenticated pages di app/(app)/layout.tsx.

=== SIDEBAR (components/layout/Sidebar.tsx) ===

Props: none (data dari session/store)

Konten:
- Logo: "FinanceAI" — Instrument Serif 18px, padding 24px
- Divider 1px gray-200
- Nav items dengan Lucide icons:
  type NavItem = { href: string, label: string, icon: LucideIcon }
  Items:
  - /dashboard — LayoutDashboard — "Dashboard"
  - /transactions — ArrowLeftRight — "Transaksi"
  - /assets — PieChart — "Aset & Portofolio"
  - /budget — Target — "Anggaran"
  - /import — Upload — "Import Data"
  - /chat — MessageSquare — "Chat AI"
- Active detection: usePathname() dari next/navigation
- Active style: border-left 2px solid black, text black weight 500, background transparent
- Inactive: text gray-500, hover text gray-900
- Collapsible: state di Zustand store (isSidebarCollapsed)
  Collapsed: width 60px, icon only, tooltip on hover
  Expanded: width 240px, icon + label
  Transition: width 250ms cubic-bezier(0.16, 1, 0.3, 1)
- Bottom section (di bawah, mt-auto):
  - Link ke /settings dengan Settings icon
  - User info: Avatar (initial circle, 32px, gray-100 bg) + nama + email (truncated)

=== HEADER (components/layout/Header.tsx) ===

Props: title, actions? (ReactNode)

Konten:
- Kiri: title (24px Instrument Serif) + subtitle opsional (tanggal hari ini, 13px gray-400)
- Kanan: slot untuk actions (biasanya buttons)
- Border-bottom: 1px solid gray-200
- Height: 64px
- Background: white, sticky top

=== LAYOUT FILE (app/(app)/layout.tsx) ===
- Sidebar (240px atau 60px) + main content (flex-1, overflow-y-auto)
- Framer Motion AnimatePresence untuk page transitions
- Page transition: opacity 0→1, y 8px→0, duration 0.3s
```

---

## PROMPT: Landing Page

```
Buat landing page untuk FinanceAI di app/(marketing)/page.tsx.

=== DESIGN DIRECTION ===
Minimal monochrome. Tipografi sebagai bintang. Mirip Linear.app tapi untuk fintech Indonesia.
Tidak ada warna selain black dan grays.

=== SECTIONS DAN COMPONENTS ===

1. NAVIGATION (components/marketing/Nav.tsx):
   - Logo kiri, links tengah, CTA kanan
   - Behavior scroll: useScroll dari Framer Motion
     scrollY > 60 → bg white + shadow (1px border-bottom gray-200) + backdrop-blur
   - Sticky, z-50

2. HERO:
   Layout: 2 kolom (55/45)
   Kiri:
     - Eyebrow: "Personal Finance Platform" — 11px UPPERCASE gray-400 tracking-widest
     - H1: "Semua keuangan\nkamu, dalam\nsatu tempat." — 72px Instrument Serif weight 300, line-height 1.0
     - Subtext: 18px gray-600, max-w-[480px]
     - CTA row: primary button + ghost text link
     - Social proof: "2.400+ pengguna aktif" — 12px gray-400
   Kanan:
     - Dashboard preview (screenshot/mockup card)
     - Framer Motion: initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
     - Floating animation: y oscillates ±8px, 4s duration, ease-in-out infinite (Framer keyframes)
   Animasi stagger hero kiri:
     container: staggerChildren 0.08s
     setiap child: initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}

3. MARQUEE BAR (components/marketing/Marquee.tsx):
   CSS infinite scroll: items duplicated, animation translateX dari 0 ke -50%, linear, 20s
   Items: "BCA · Mandiri · BRI · BNI · Bibit · IPOT · Stockbit · GoPay · OVO · Dana · Pluang"
   Background gray-50, border-top + border-bottom gray-200

4. FEATURES GRID (6 cards, 3x2):
   ScrollReveal: useIntersectionObserver per card, stagger 50ms
   Card style: border 1px gray-200, 0px radius, 0px hover → translateY(-2px)
   Nomor besar di background card: "01" dst — 80px Instrument Serif gray-100 absolute, pointer-events-none

5. HOW IT WORKS (dark section):
   Background: black (#000000), text white
   Steps dengan angka besar (120px Instrument Serif gray-800) + judul + deskripsi
   3 kolom, border-right 1px gray-800 antar kolom (kecuali kolom terakhir)
   Animasi: angka count-up saat section masuk viewport (1→3 steps)

6. QUOTE SECTION:
   Centered, max-w-[720px] margin auto
   Quote marks: " — 200px, Instrument Serif, absolute, gray-100, pointer-events-none

7. FINAL CTA (black section):
   Sama styling dengan How It Works tapi lebih compact
   Button: white bg, black text, hover → background gray-100

8. FOOTER:
   Black background, 4-column grid links, copyright

=== ANIMASI GLOBAL ===
Semua sections: Framer Motion whileInView, once: true
viewport: { once: true, margin: "-100px" }
Setiap section: initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
Duration: 0.5s, ease: [0.16, 1, 0.3, 1]
```

---

## PROMPT: Dashboard Page

```
Buat halaman Dashboard di app/(app)/dashboard/page.tsx.

=== STRUKTUR KOMPONEN ===

1. Header: PageHeader dengan "Dashboard" + greeting ("Selamat pagi, {nama}")

2. KPI ROW (4 StatCard dalam grid-4):
   Data dari API /api/dashboard/summary
   - Net Worth: nilai besar Instrument Serif, format Rp
   - Pemasukan bulan ini: Geist Mono
   - Pengeluaran bulan ini: Geist Mono
   - Rate tabungan: persentase
   Loading state: Skeleton component

3. CHART + AI INSIGHT ROW (grid-12, 8+4):
   LineChart (8 col):
     Data: 6 bulan terakhir, pemasukan vs pengeluaran
     Dua garis: hitam solid (pemasukan), hitam dashed (pengeluaran)
     Custom Recharts: hilangkan semua warna default, paksa monochrome
     Tooltip custom: white card, border 1px gray-200, shadow
     Animasi: isAnimationActive={true} di Recharts

   AI Insight Panel (4 col):
     3 insight items, fetch dari /api/ai/insights
     Setiap item: border-bottom 1px gray-100, padding 12px 0
     Loading: skeleton 3 lines

4. ASSET BREAKDOWN + RECENT TRANSACTIONS (grid-12, 6+6):
   DonutChart (6 col):
     SVG murni (bukan Recharts) — lebih kontrol monochrome
     Segments: shades of gray dari black ke gray-300
     Animasi: stroke-dashoffset dari total ke 0, stagger per segment
     Legend: list items dengan color swatch + nama + nilai + persentase

   TransactionList (6 col):
     5 transaksi terbaru dari /api/transactions?limit=5
     Komponen TransactionRow: icon kategori (emoji/svg) + nama + kategori + jumlah
     Positive: weight 500. Negative: gray-600.
     Link "Lihat Semua →" di bottom

=== DATA FETCHING ===
Gunakan TanStack Query:
  const { data: summary } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => axios.get('/api/dashboard/summary').then(r => r.data)
  })

=== ANIMASI ===
- Seluruh halaman: Framer Motion AnimatePresence, page enter
- KPI cards: stagger 0.08s, dari atas
- CountUp untuk semua angka (custom hook)
- Chart: Recharts built-in animation
- Donut: custom SVG animation dengan Framer Motion
```

---

## PROMPT: Halaman Aset & Portofolio

```
Buat halaman Aset & Portofolio di app/(app)/assets/page.tsx.
Ini halaman paling complex dan paling diferensiasi produk ini.

=== KOMPONEN UTAMA ===

1. HERO NET WORTH (full-width, black background):
   - Background black, text white
   - Label, nilai besar (72px Instrument Serif), delta row, sub info
   - Mini sparkline chart (right side): SVG, white line, last 6 months net worth
   - CountUp animation untuk nilai besar saat load

2. VIEW TOGGLE:
   "Aggregate View | Per Akun" — dua tab
   State: viewMode: 'aggregate' | 'per-account' dalam useState
   Framer Motion AnimatePresence untuk transisi konten

3. CATEGORY TABS:
   "Semua | Saham | Reksa Dana | Tabungan | Emas & Kripto | Properti | Utang"
   Filter yang dipilih mengubah konten di bawah

=== AGGREGATE VIEW ===

AssetSection component (reusable):
  Props: title, total, returnPct, children (tabel/cards)
  Header: nama + total (Geist Mono) + return badge (weight berdasarkan positif/negatif)

StockTable component:
  Kolom: Ticker | Nama | Total Lot | Avg Price | Harga Kini | Nilai | PnL | PnL%
  Semua angka: Geist Mono, right-aligned
  PnL positif: weight 600 black. PnL negatif: gray-500 weight 400
  PENTING: Tampilkan footnote "*" pada ticker yang lotnya berasal dari >1 akun
  Footnote tooltip: "250 lot dari Stockbit (150) + IPOT (100)"

  Logic weighted avg price:
  Jika saham di 2 akun:
    avg = (lot_a * avg_a + lot_b * avg_b) / (lot_a + lot_b)

SidePanel (slide in dari kanan):
  Trigger: klik row di StockTable
  Framer Motion: initial={{ x: '100%' }} animate={{ x: 0 }}, 300ms expo-out
  Konten: overview saham + mini chart + breakdown per akun + riwayat transaksi

=== PER ACCOUNT VIEW ===

AccountGroup component:
  Group by platform (Stockbit, IPOT, Bibit, BCA, dll)
  Header: nama platform + jumlah instrumen + total nilai
  Collapsible: Framer Motion AnimateHeight
  Di dalam: tabel instrumen milik platform tersebut

=== DATA TYPES ===
type StockHolding = {
  ticker: string
  name: string
  totalLot: number
  weightedAvgPrice: number
  currentPrice: number
  totalValue: number
  pnl: number
  pnlPercent: number
  accounts: Array<{ accountId: string, platform: string, lot: number, avgPrice: number }>
}

=== ANIMASI ===
- Hero: mount animation, CountUp
- View mode toggle: Framer AnimatePresence, slide transition
- Category tab switch: fade transition
- Table rows: stagger reveal, 30ms per row
- Side panel: slide dari kanan
```

---

## PROMPT: Import Flow + AI Extraction + Confirmation

```
Buat halaman Import Data di app/(app)/import/page.tsx.
Ini halaman paling teknikal — handle PDF, CSV, dan foto/screenshot.

=== LAYOUT ===
SourcePanel (left 260px) + MainPanel (fluid)

=== SOURCE PANEL ===
Grouped navigation sama seperti design prompt.
State: selectedSource: string dalam useState/Zustand
Active item: 2px left border black

=== MAIN PANEL — 4-STEP FLOW ===

type ImportStep = 'upload' | 'processing' | 'review' | 'done'
State: currentStep, importSessionId, extractedData

STEP INDICATOR:
Custom component: 4 steps dengan connector line
Active: black dot + label black
Done: check icon + label gray-400
Pending: empty dot + label gray-300

=== STEP 1: UPLOAD ===
DropZone component:
  - Drag & drop dengan HTML5 File API
  - onDrop: validasi tipe file (PDF, PNG, JPG, CSV)
  - Preview file setelah dipilih
  - Upload ke /api/import/upload (FormData)
  - Response: { sessionId, fileUrl }
  - Setelah upload sukses → pindah ke step 2

=== STEP 2: PROCESSING ===
Polling /api/import/status?sessionId={id} setiap 2 detik
Response: { status: 'processing'|'done', stages: [{name, progress}], extractedCount }

UI: animated stages seperti design — sequential reveal
Gunakan Framer Motion untuk animate progress bar fill

=== STEP 3: REVIEW ===
Fetch: /api/import/preview?sessionId={id}
Response: { transactions: Transaction[], confidence: { low: number, medium: number, high: number } }

ReviewTable component:
  Inline editing: klik cell kategori → Popover dengan dropdown pilih kategori
  Inline editing: klik merchant → input text inline
  Confidence indicator: dot color (hijau/kuning/merah — EXCEPTION dari monochrome, UX critical)
  Bulk selection: checkbox per row + select all
  Bulk action bar (sticky bottom): "Simpan X transaksi" primary button

Alert bar jika ada low-confidence fields:
  Collapsible dengan Framer AnimateHeight

Submit: POST /api/import/confirm { sessionId, transactions: correctedData }

=== STEP 4: DONE ===
Framer Motion: checkmark SVG dengan pathLength animation
Big text confirmation
3 CTA buttons

=== API ROUTES ===
Buat juga:

app/api/import/upload/route.ts:
  - Receive FormData
  - Save file ke /tmp atau cloud storage
  - Create ImportSession di DB
  - Queue parsing job (jalankan background)
  - Return sessionId

app/api/import/parse/route.ts (background job atau bisa inline dulu):
  - Load file
  - Jika PDF: gunakan pdfplumber via Python (atau pdf-parse npm untuk simple)
  - Jika image: kirim ke Groq vision API untuk ekstraksi
  - Jika CSV: parse dengan PapaParse
  - Normalize data ke Transaction format
  - Assign confidence score per field
  - Save ke DB dengan status 'pending_review'
  - Update ImportSession.status = 'done'

app/api/import/confirm/route.ts:
  - Receive corrected transactions
  - Save ke Transactions table
  - Update account balances
  - Trigger net worth recalculation
  - Mark ImportSession as completed

=== GROQ VISION PROMPT (untuk image parsing) ===
Gunakan prompt ini saat kirim screenshot ke Groq:

const visionPrompt = `
Ekstrak semua data keuangan dari gambar ini.
Return JSON dengan format:
{
  "platform": string,
  "type": "bank_statement" | "investment_portfolio" | "ewallet",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": string,
      "amount": number (positif = masuk, negatif = keluar),
      "confidence": number (0-1)
    }
  ],
  "holdings": [  // untuk portofolio saham/reksa dana
    {
      "ticker": string,
      "name": string,
      "lot": number,
      "avgPrice": number,
      "currentPrice": number,
      "confidence": number
    }
  ],
  "summary": {
    "totalBalance": number,
    "confidence": number
  }
}
Jika field tidak bisa dibaca dengan yakin, set confidence < 0.7.
Jika tidak terbaca sama sekali, set null dan confidence 0.
`
```

---

## PROMPT: Chat AI Page

```
Buat halaman Chat AI di app/(app)/chat/page.tsx.
Ini menghubungkan ke Groq API dengan konteks data keuangan user.

=== LAYOUT ===
Chat area (65%) + Context panel (35%) — flex row

=== CHAT AREA ===

State:
  messages: Message[]
  isLoading: boolean
  input: string

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  referencedData?: string[] // ID transaksi/aset yang direferensikan
}

MessageBubble component:
  User: bg black, text white, radius 0px (kanan atas)
  Assistant: border 1px gray-200, bg white, radius 0px (kiri atas)
  Timestamp: 11px gray-400

TypingIndicator: 3 dots Framer Motion, bounce animation

Input area:
  Textarea dengan auto-resize (react-textarea-autosize)
  Submit: Enter (Shift+Enter untuk newline)
  Attach button: trigger file picker untuk lampiran dokumen

Empty state:
  Large centered text + 4 suggested prompt cards
  Klik card → isi input + auto submit

=== API ROUTE: /api/chat/route.ts ===

POST body: { message: string, conversationHistory: Message[], selectedDataSources: string[] }

Handler:
1. Fetch user's financial context dari DB:
   - Recent transactions (last 3 months)
   - Asset holdings
   - Monthly summary stats

2. Build system prompt:
const systemPrompt = `
Kamu adalah financial advisor AI untuk pengguna FinanceAI.
Kamu punya akses ke data keuangan user berikut:

DATA KEUANGAN:
${JSON.stringify(financialContext)}

INSTRUKSI:
- Jawab dalam Bahasa Indonesia, conversational tapi professional
- Gunakan angka spesifik dari data user, jangan asal-asalan
- Jika ditanya tentang data yang tidak ada, katakan tidak ada datanya
- Format angka sebagai Rp X.XXX.XXX
- Jika relevan, sertakan insight atau rekomendasi actionable
- Jangan memberikan rekomendasi investasi spesifik (disclaimer)
`

3. Call Groq API:
const response = await groq.chat.completions.create({
  model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message }
  ],
  stream: true,  // streaming response
  max_tokens: 1000
})

4. Stream response ke client:
   Gunakan ReadableStream dan SSE (Server-Sent Events)
   Client: useEventSource atau fetch dengan streaming

=== STREAMING DI CLIENT ===
const sendMessage = async (content: string) => {
  setIsLoading(true)
  const response = await fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ message: content, conversationHistory: messages })
  })

  const reader = response.body?.getReader()
  let assistantMessage = ''

  while (true) {
    const { done, value } = await reader!.read()
    if (done) break
    const chunk = new TextDecoder().decode(value)
    assistantMessage += chunk
    setMessages(prev => {
      const last = prev[prev.length - 1]
      if (last.role === 'assistant' && last.id === 'streaming') {
        return [...prev.slice(0, -1), { ...last, content: assistantMessage }]
      }
      return [...prev, { id: 'streaming', role: 'assistant', content: assistantMessage, timestamp: new Date() }]
    })
  }
  setIsLoading(false)
}

=== CONTEXT PANEL ===
DataSourceToggle: chips yang bisa di-on/off, ubah selectedDataSources state
MiniStats: 4 StatCard kecil (net worth, pengeluaran bulan ini, dll)
ChatHistory: list conversation sebelumnya dari DB
```

---

## PROMPT: Dockerize Semua Service

```
Buat konfigurasi Docker lengkap untuk project FinanceAI.

=== FILE YANG PERLU DIBUAT ===

1. frontend/Dockerfile (multi-stage):
   Stage 1 (deps): node:20-alpine, npm ci
   Stage 2 (builder): copy deps, npm run build
   Stage 3 (runner): node:20-alpine, copy build artifacts, CMD ["node", "server.js"]
   Target port: 3000

2. docker-compose.yml (development):
   services:
     frontend: build dari ./frontend, port 3000:3000, volume untuk hot reload
     backend (FastAPI): build dari ./backend, port 8000:8000
     postgres: image postgres:16-alpine, volume data, env POSTGRES_DB/USER/PASSWORD
     qdrant: image qdrant/qdrant:latest, port 6333:6333, volume storage

3. docker-compose.prod.yml (production override):
   frontend: image: ghcr.io/{username}/financeai-frontend:latest, no volume
   backend: image: ghcr.io/{username}/financeai-backend:latest, no volume
   restart: unless-stopped untuk semua service

4. Caddyfile:
   Domain kamu {
     reverse_proxy /api/py/* backend:8000
     reverse_proxy /* frontend:3000
   }
   Caddy handle TLS otomatis

5. backend/Dockerfile (Python/FastAPI):
   Stage 1 (builder): python:3.12-slim, pip install --user
   Stage 2 (runtime): python:3.12-slim, copy installed packages, CMD uvicorn
   Note: jangan install pdfplumber di image — terlalu berat, gunakan subprocess call atau API terpisah

6. .dockerignore untuk frontend dan backend

7. .github/workflows/deploy.yml:
   Trigger: push ke main
   Jobs:
     test: pytest backend + next build check
     build-push: docker buildx, push ke GHCR dengan cache-from gha
     deploy: appleboy/ssh-action → cd /opt/financeai && docker compose pull && docker compose up -d --no-build && docker image prune -f

   Secrets yang dibutuhkan di GitHub:
   VPS_HOST, VPS_USER, VPS_SSH_KEY

8. scripts/setup-vps.sh:
   Script setup awal VPS (jalankan sekali):
   - Install Docker + Docker Compose
   - Login ke GHCR
   - mkdir /opt/financeai
   - Copy env files
   - docker compose up -d

=== RAM BUDGET (VPS 8GB) ===
frontend:  ~300MB
backend:   ~400MB
postgres:  ~300MB
qdrant:    ~300MB
caddy:     ~30MB
OS buffer: ~500MB
Total:     ~1.8GB dari 8GB — sangat aman
```

---

## CATATAN PENGGUNAAN

**Urutan yang benar:**
1. Jalankan SETUP PERTAMA dulu
2. Buat COMPONENT LIBRARY
3. Buat LAYOUT
4. Halaman satu per satu (mulai dari Landing + Dashboard)
5. Dockerize di akhir

**Tips untuk Claude Code:**
- Selalu mention "TypeScript strict mode" dalam prompt
- Jika component panjang, minta "buat satu komponen per file"
- Untuk animasi, minta "gunakan Framer Motion, bukan CSS transitions" untuk konsistensi
- Setelah setiap prompt, minta "cek apakah ada TypeScript errors"
