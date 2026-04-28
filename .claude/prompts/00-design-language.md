# FinanceAI — Design Language v1.0
**Codename: Noir Finance**
**Ini adalah dokumen fondasi. Selalu sertakan ini di setiap prompt ke Claude Design maupun Claude Code.**

---

## Concept & Philosophy

Minimal monochrome. Tipografi sebagai elemen visual utama.
Tidak ada warna sebagai dekorasi — hitam dan putih sebagai pernyataan kepercayaan dan kejernihan.
UI harus terasa seperti publikasi keuangan premium, bukan aplikasi konsumen biasa.

**Inspirasi:**
- Editorial The Economist (otoritatif, bersih)
- Linear.app (presisi, craft)
- Bloomberg Terminal (data-first, no fluff)
- Stripe Dashboard (trustworthy, clean)

**Core feeling:** Quiet intelligence. Data berbicara sendiri. UI mundur ke belakang.

---

## Typography

### Typefaces

| Role | Font | Import |
|------|------|--------|
| Display / Hero / Numbers Besar | Instrument Serif | Google Fonts |
| Body / UI Elements | Geist Sans | next/font atau cdn.jsdelivr.net |
| Data / Angka / Tabel | Geist Mono | next/font atau cdn.jsdelivr.net |

**Alasan pemilihan:**
- **Instrument Serif**: High-contrast, editorial. Angka besar di font ini terasa otoritatif dan elegan.
- **Geist Sans**: Presisi teknikal. Cocok untuk produk yang berdekatan dengan dunia developer/fintech.
- **Geist Mono**: Semua angka keuangan pakai mono agar kolom selalu sejajar sempurna.

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display-hero` | 80px | 300 | 1.0 | Net worth besar di hero |
| `display-xl` | 64px | 300 | 1.0 | Hero landing page |
| `display-lg` | 48px | 400 | 1.1 | Page header utama |
| `display-md` | 32px | 400 | 1.2 | Section headers |
| `display-sm` | 24px | 500 | 1.3 | Card headers |
| `body-lg` | 18px | 400 | 1.7 | Lead copy, deskripsi |
| `body-md` | 16px | 400 | 1.7 | Body text standar |
| `body-sm` | 14px | 400 | 1.6 | Secondary text |
| `body-xs` | 12px | 400 | 1.5 | Captions |
| `label` | 11px | 500 | 1.0 | UI labels — UPPERCASE, letter-spacing 0.08em |

**Rules yang tidak boleh dilanggar:**
1. Hierarki HANYA melalui ukuran dan weight — tidak pernah melalui warna
2. Semua angka keuangan (Rp, %, lot, dll) selalu Geist Mono
3. Angka besar/hero selalu Instrument Serif
4. Tidak ada font-weight di atas 500 untuk body text
5. Letter spacing: -0.02em untuk display, 0 untuk body

---

## Color System

Strictly monochrome. Tidak ada warna dekoratif.

### Palette

```css
:root {
  --black:     #000000;
  --gray-950:  #0A0A0A;  /* dark section bg */
  --gray-900:  #111111;  /* dark cards */
  --gray-800:  #1C1C1C;  /* secondary dark surfaces */
  --gray-700:  #2E2E2E;  /* hover dark mode */
  --gray-600:  #525252;  /* secondary text */
  --gray-500:  #737373;  /* tertiary text, placeholder */
  --gray-400:  #A3A3A3;  /* disabled, muted */
  --gray-300:  #D4D4D4;  /* borders */
  --gray-200:  #E5E5E5;  /* dividers */
  --gray-100:  #F5F5F5;  /* surface backgrounds */
  --gray-50:   #FAFAFA;  /* page background */
  --white:     #FFFFFF;  /* cards, primary surfaces */
}
```

### The One Accent Rule

**Tidak ada warna di UI.** Satu-satunya pengecualian:
- **Delta positif**: Bold weight + ↑ simbol — bukan hijau
- **Delta negatif**: gray-500 weight + ↓ simbol — bukan merah
- **Critical alert only**: Inverted card (teks putih di background hitam)
- **Chart lines**: Pure black. Dashed untuk seri sekunder.

Constraint ini adalah **fitur**, bukan keterbatasan — memaksa kejelasan melalui tipografi dan layout.

---

## Spacing & Layout

### Grid System
- Max width: 1280px, centered
- Sidebar: 240px (fixed, collapsible di mobile)
- Content area: fluid
- Column gap: 24px
- Page padding: 40px (desktop), 20px (tablet), 16px (mobile)

### Spacing Scale (base 8px)
`4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 128px`

### Border Radius — Aturan Kritis

**Angka keuangan = sudut tajam. Presisi = tidak ada rounding berlebihan.**

| Elemen | Radius |
|--------|--------|
| Cards, data tables, stat cards | 0px (sharp) |
| Buttons | 4px |
| Inputs, dropdowns | 4px |
| Badges, tags | 2px |
| Modals, dialogs | 8px |
| Avatars | 50% |
| Progress bars | 0px |

### Border
- Default: `1px solid var(--gray-200)`
- Hover: `1px solid var(--gray-400)`
- Active/selected: `1px solid var(--black)`
- Dividers: `1px solid var(--gray-100)`

---

## Motion & Animation

**Codename: "Composed"**
Motion mengkomunikasikan state, tidak pernah mendekorasi.
Data keuangan membutuhkan presisi. Animasi harus terasa seperti kalkulasi, bukan pertunjukan.

### Timing

| Tipe | Durasi | Easing |
|------|--------|--------|
| Micro (hover, toggle) | 150ms | ease |
| Standard (reveal, expand) | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Page transition | 400ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Count-up numbers | 800ms | ease-out |
| Chart line draw | 600ms | ease-in-out |
| Stagger delay antar elemen | 50ms | — |

**Easing utama**: `cubic-bezier(0.16, 1, 0.3, 1)` — start cepat, deselerasi halus (Expo out).
Memberikan kesan snappy dan purposeful, tidak bouncy atau playful.

### Animation Patterns

**Page enter (stagger):**
```
- Setiap section: opacity 0→1, translateY 16px→0
- Duration: 300ms, easing expo-out
- Delay antar element group: 50ms
- Maximum 6 elemen yang di-stagger sekaligus
```

**Number count-up:**
```
- Semua angka keuangan animate dari 0 ke nilai final saat masuk viewport
- Duration: 800ms, ease-out
- Gunakan requestAnimationFrame (bukan CSS)
- Format sebagai currency sepanjang animasi (Rp 0 → Rp 24.750.000)
- Font: Geist Mono untuk angka, Instrument Serif untuk display besar
```

**Chart draw:**
```
- Line charts: SVG stroke-dashoffset dari panjang total ke 0
- Duration: 600ms, ease-in-out
- Area fill: fade in setelah garis selesai (delay 100ms)
- Data points: muncul terakhir (delay 50ms setelah area)
```

**Hover state:**
```
- Cards: translateY(-2px), border-color → gray-400, 150ms
- Buttons (primary): background fill dari kiri ke kanan (clip-path trick)
- Links/amounts: underline offset muncul
```

**Skeleton loading:**
```
- Gradient: gray-100 → gray-50 → gray-100 (bukan shimmer berwarna)
- Duration: 1.5s infinite
- Shape mengikuti layout konten (tidak boleh generic bars)
```

---

## Components Spec

### Stat Card (KPI)
```
Background: white
Border: 1px solid gray-200
Radius: 0px
Padding: 24px

Label:  11px, gray-500, UPPERCASE, letter-spacing 0.08em, Geist Sans
Value:  48px, Instrument Serif, black, weight 300
Delta:  13px, Geist Mono
  - Positive: weight 500, "↑ X%" format
  - Negative: gray-500, weight 400, "↓ X%" format
```

### Card (Generic)
```
Background: white
Border: 1px solid gray-200
Radius: 0px
Padding: 24px
Hover: translateY(-2px), border-color gray-400, 150ms
```

### Button — Primary
```
Background: black
Text: white, 14px, weight 500
Padding: 12px 24px
Radius: 4px
Hover: background gray-900 (bukan pure black → sedikit lebih lembut)
Active: scale(0.98)
```

### Button — Secondary
```
Background: white
Border: 1px solid black
Text: black, 14px, weight 500
Hover: background gray-50
```

### Input
```
Border: 1px solid gray-300
Radius: 4px
Padding: 12px 16px
Focus: border-color black (tidak ada ring/glow)
Placeholder: gray-400
```

### Sidebar Navigation
```
Width: 240px
Active item: 2px solid black (left border), text black, weight 500
Inactive item: gray-500, weight 400
Hover: text gray-900
No background highlight — border adalah satu-satunya indicator
```

### Data Table
```
No alternating row colors
Row divider: 1px solid gray-100
Column header: 11px, UPPERCASE, gray-500, weight 500, letter-spacing 0.08em
Number columns: right-aligned, Geist Mono
Row hover: background gray-50
```

### Badge / Tag
```
Radius: 2px
Primary: black bg + white text, 11px, weight 500
Neutral: gray-100 bg + gray-600 text
Positive: gray-100 bg + black text + "↑"
Negative: gray-100 bg + gray-500 text + "↓"
```

---

## Icons & Assets

- **Icon library**: Lucide React
- **Default size**: 20px (18px di tight spaces)
- **Stroke width**: 1.5px (tidak pernah filled)
- **Color**: Inherit dari parent (gray-500 untuk secondary, black untuk primary)
- Tidak ada ilustrasi dekoratif — data adalah ilustrasi
- Empty state boleh menggunakan 1 icon besar (48px), no emoji

---

## Page Layout Specifications

### Authenticated pages (semua kecuali Landing & Auth)
```
Layout: Sidebar (240px) + Main content (fluid)
Sidebar: sticky, full height, border-right 1px gray-200
Header dalam content: page title (display-md) + action buttons, border-bottom 1px gray-200, padding 24px
Content padding: 32px
```

### Landing Page
```
Nav: sticky, background white/transparent, blur on scroll, border-bottom on scroll
Hero: full viewport height, centered atau split layout
Sections: alternating white / gray-50 backgrounds
Max content width: 1024px (narrower dari app untuk readability)
```

### Auth Pages
```
Split layout: Left 50% black, Right 50% white
Left: brand statement, quote, atau large typography treatment
Right: form, tersentralisasi secara vertikal
Mobile: form only (kiri hilang)
```

---

## Dark Mode

Dark mode **bukan** prioritas V1.
Monochrome light theme adalah brand statement.
Jika ditambahkan nanti: invert semua gray tokens, pertahankan sharp corners dan typography yang sama.

---

## Referensi File Ini

Setiap prompt ke Claude Design atau Claude Code harus menyertakan:

```
Ikuti design language dari dokumen "FinanceAI Design Language v1.0 (Noir Finance)".
Ringkasannya:
- Font: Instrument Serif (display/numbers besar) + Geist Sans (body/UI) + Geist Mono (angka/data)
- Color: Strictly monochrome, palette dari black (#000000) sampai white (#FFFFFF) dengan gray steps
- Radius: 0px untuk cards/data, 4px untuk buttons/inputs
- Motion: expo-out easing, stagger 50ms, count-up numbers, chart draw left-to-right
- Border: 1px solid, darkens on hover/active, no glow/ring
- No warna untuk positive/negative — gunakan weight dan simbol saja
```
