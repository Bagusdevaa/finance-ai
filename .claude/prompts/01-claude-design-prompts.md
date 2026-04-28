# FinanceAI — Prompts untuk Claude Design
**Cara pakai:** Buka Claude baru. Paste design language (dari 00-design-language.md) DULU,
lalu paste prompt halaman yang ingin kamu desain. Satu sesi = satu halaman untuk hasil terbaik.

---

## PROMPT 01 — Landing Page

```
Kamu adalah senior product designer. Buat mockup HTML interaktif yang sangat detail
untuk landing page aplikasi FinanceAI — personal finance platform untuk pengguna Indonesia.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

NAMA: Landing Page
TUJUAN: Konversi visitor menjadi user registrasi. Target audience: profesional muda
Indonesia 22-35 tahun yang punya investasi di beberapa platform (Bibit, IPOT, bank, e-wallet).

STRUKTUR HALAMAN (top to bottom):

1. NAVIGATION (sticky)
   - Logo "FinanceAI" — kiri, Instrument Serif, 20px
   - Links: Fitur | Cara Kerja | Harga — tengah, 14px gray-600
   - CTA button "Mulai Gratis" — kanan, primary button
   - Behavior: transparent on load → white background + border-bottom saat scroll 60px
   - Animasi: backdrop-blur saat scroll

2. HERO SECTION (100vh)
   - Layout: Split. Kiri 55% teks, Kanan 45% visual
   - Kiri:
     * Label atas: "Personal Finance Platform" — 11px, UPPERCASE, gray-500, letter-spacing 0.1em
     * Headline: "Semua keuangan kamu,\ndalam satu tempat." — 64px, Instrument Serif, weight 300, line-height 1.0
     * Subheadline: "Hubungkan rekening bank, investasi saham, reksa dana, dan e-wallet. AI kami akan menganalisis pola keuangan kamu." — 18px, gray-600, max-width 480px
     * CTA row: Button primary "Mulai Gratis" + text link "Lihat Demo →" (gray-600)
     * Social proof: "Dipercaya 2.400+ pengguna" — 12px, gray-400
   - Kanan:
     * Dashboard preview card (mockup app) — shadow-xl, slight rotation -2deg, floating animation
     * Di dalam card: tampilkan net worth besar (Instrument Serif), mini chart, 2-3 transaksi
     * Animasi: float up-down infinite, subtle, 6s duration
   - Animasi enter: teks kiri stagger dari bawah, card kanan masuk dari kanan

3. SOCIAL PROOF BAR
   - Background: gray-50, border-top + border-bottom gray-200
   - Konten: logo-logo institusi/bank (text only jika tidak ada logo): BCA | Mandiri | BRI | Bibit | IPOT | GoPay
   - Label: "Mendukung data dari" — 11px gray-400 di kiri
   - Infinite scroll marquee animation, kiri ke kanan, lambat

4. FITUR SECTION
   - Background: white
   - Section label: "FITUR" — 11px, UPPERCASE, gray-400, centered
   - Headline: "Satu dashboard.\nSemua instrumen." — 48px, Instrument Serif, centered
   - Grid: 3 kolom x 2 baris, 6 fitur cards
   - Setiap card:
     * Nomor urut: "01" — 80px, Instrument Serif, weight 200, gray-100 (background-like, very faint)
     * Nama fitur: 20px, weight 500, black
     * Deskripsi: 15px, gray-600, line-height 1.7
     * Border: 1px solid gray-200, 0px radius
   - 6 Fitur:
     01. "Import Otomatis" — Upload PDF mutasi atau foto screenshot, AI ekstrak datanya
     02. "Net Worth Real-time" — Total aset dari semua platform dalam satu angka
     03. "AI Financial Advisor" — Tanya apa saja tentang kondisi keuangan kamu
     04. "Multi-akun Saham" — Agregasi portofolio dari beberapa broker otomatis
     05. "Budget Tracker" — Set target per kategori, dapat alert saat overspend
     06. "Laporan Bulanan" — Ringkasan otomatis setiap bulan, dikirim ke email
   - Animasi: cards reveal saat scroll (IntersectionObserver), stagger 50ms

5. HOW IT WORKS
   - Background: gray-950 (near black), teks white
   - Headline: "Mulai dalam 3 langkah." — 48px, Instrument Serif, white, weight 300
   - Layout: 3 kolom, angka besar di atas
   - Step 1: "01" — 120px Instrument Serif weight 200 gray-700 | "Daftar & setup akun" | "Masukkan nama, tujuan keuangan, dan rekening pertamamu."
   - Step 2: "02" — "Import data kamu" | "Upload PDF mutasi, foto screenshot portofolio, atau input manual."
   - Step 3: "03" — "Biarkan AI bekerja" | "Tanya apa saja. Dapatkan insight yang tidak pernah kamu sadari sebelumnya."
   - Border pemisah: 1px solid gray-800 antar kolom
   - Animasi: angka besar counter up saat section masuk viewport

6. TESTIMONIAL / QUOTE
   - Background: white
   - Layout: full-width, centered, max-width 720px
   - Satu quote besar: 32px, Instrument Serif, weight 300, italic, centered
   - "Pertama kalinya saya tahu persis berapa total kekayaan bersih saya. Termasuk saham di IPOT dan emas di Pluang."
   - Attribution: "— Rizky A., Software Engineer, Jakarta" — 14px, gray-400
   - Tanda kutip besar dekoratif: " — 200px, Instrument Serif, gray-100, absolutely positioned

7. CTA FINAL
   - Background: black
   - Teks: white
   - Headline: "Mulai tracking keuangan kamu hari ini." — 48px, Instrument Serif, white, weight 300
   - Subtext: "Gratis selamanya untuk fitur dasar. Tidak perlu kartu kredit." — 16px, gray-400
   - Button: white background, black text — "Daftar Gratis Sekarang"
   - Animasi: button hover — text slides out kanan, "→" slides in

8. FOOTER
   - Background: black, border-top 1px gray-800
   - Layout: 4 kolom: Brand | Produk | Perusahaan | Legal
   - Copyright: "© 2025 FinanceAI. Dibuat dengan presisi."
   - Semua teks: gray-500 kecuali nama kolom gray-300

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file dengan embedded CSS dan JavaScript
- Responsive: Desktop (1280px) + Mobile (375px)
- Semua animasi menggunakan CSS dan vanilla JS (IntersectionObserver untuk scroll triggers)
- Tidak ada library external kecuali Google Fonts (Instrument Serif)
- Semua hover states harus berfungsi
- Simulasikan infinite marquee dengan CSS animation

=== YANG HARUS DIPERHATIKAN ===
- Typography adalah bintangnya — pastikan Instrument Serif load dengan benar
- Angka-angka besar (step numbers) harus sangat bold presence di whitespace yang luas
- Jangan tambahkan warna apapun selain palette monochrome
- Dashboard preview card di hero harus terlihat seperti screenshot app nyata, bukan placeholder
```

---

## PROMPT 02 — Auth Pages (Login & Register)

```
Kamu adalah senior product designer. Buat mockup HTML interaktif untuk halaman
Login dan Register aplikasi FinanceAI.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

NAMA: Auth Pages (Login + Register, switchable)
KONSEP: Split layout — kiri hitam (brand statement), kanan putih (form).
Sesederhana ini adalah keputusan desain yang kuat.

LAYOUT:
- Viewport: full height (100vh)
- Kiri 50%: background black, konten white
- Kanan 50%: background white, form hitam
- Mobile: kiri hilang, kanan full width

PANEL KIRI (black):
- Vertically centered
- Logo "FinanceAI" — atas kiri, Instrument Serif, white, 20px
- Konten tengah:
  * Quote besar: "Angka tidak berbohong.\nKeuangan kamu seharusnya juga tidak." — 36px, Instrument Serif, white, weight 300, line-height 1.2
  * Attribution: "— FinanceAI" — 13px, gray-500
- Bawah kiri: "Dipercaya 2.400+ pengguna aktif" + mini avatars (3 circles initials) — gray-600

PANEL KANAN (white):
- Vertically centered, max-width 380px, horizontal centered dalam panel
- Kecil di atas form: toggle tab "Masuk | Daftar" — dua opsi, yang aktif border-bottom 2px black

LOGIN FORM:
- Heading: "Selamat datang kembali." — 28px, Instrument Serif
- Subtext: "Masuk ke akun FinanceAI kamu." — 14px, gray-500
- Fields:
  * Email — label "EMAIL" (11px uppercase gray-500) + input
  * Password — label "PASSWORD" + input + "Lupa password?" link kanan
- Button: "Masuk" — full width, primary button
- Divider: "atau" dengan garis — gray-200
- Button: "Masuk dengan Google" — secondary button, full width
- Footer: "Belum punya akun? Daftar" — 13px, gray-500

REGISTER FORM:
- Heading: "Mulai gratis hari ini." — 28px, Instrument Serif
- Fields:
  * Nama lengkap
  * Email
  * Password
  * Konfirmasi password
- Button: "Buat Akun" — full width, primary
- Divider + Google button
- Footer: "Sudah punya akun? Masuk"
- Terms: "Dengan mendaftar, kamu menyetujui Syarat & Ketentuan" — 11px, gray-400

ANIMASI:
- Switch antara Login/Register: form content fade out → fade in, 200ms
- Input focus: border animates dari gray-300 ke black, 150ms
- Button hover: fill effect dari kiri
- Error state: border merah (satu-satunya merah di seluruh UI)
- Success: checkmark animate masuk

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file
- JS hanya untuk toggle Login/Register dan validasi form basic
- Form validation: email format, password min 8 chars, konfirmasi password match
- Error messages: merah (EXCEPTION dari monochrome — ini critical feedback)
```

---

## PROMPT 03 — Onboarding Flow

```
Kamu adalah senior product designer. Buat mockup HTML interaktif untuk onboarding flow
FinanceAI — 3 langkah pertama setelah user registrasi.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

NAMA: Onboarding (3-step flow)
KONSEP: Satu pertanyaan fokus per langkah. Tidak ada sidebar. Tidak ada distraksi.
Progress indicator minimalis di atas.

LAYOUT:
- Full page, centered, max-width 560px
- Progress indicator: "1 / 3" — kanan atas, 13px, gray-400, Geist Mono
- Step label: tiga titik/dash — kiri indicator, yang aktif hitam, sisanya gray-200
- Back button: kiri atas, ghost button "← Kembali" (hidden di step 1)

STEP 1 — Profil & Tujuan:
- Heading: "Hai! Kita mulai dari kamu." — 40px, Instrument Serif
- Subtext: "Ini membantu kami personalisasi insight untuk kondisi kamu." — 16px, gray-500
- Fields:
  * Nama panggilan: input text
  * Tujuan keuangan utama: radio cards (bukan radio biasa)
    - "Tabung lebih banyak setiap bulan"
    - "Track semua aset dan investasi"
    - "Kelola utang dan cicilan"
    - "Rencanakan pensiun dini"
  * Radio cards: 1px border, 0px radius. Selected: 1px solid black, kiri ada 2px solid black accent
- CTA: "Lanjut →" — primary button, full width

STEP 2 — Tambah Rekening Pertama:
- Heading: "Rekening mana yang paling sering kamu pakai?" — 40px, Instrument Serif
- Subtext: "Kamu bisa tambah lebih banyak nanti." — 16px, gray-500
- Grid 2x3: pilih bank/platform (cards dengan nama)
  - BCA | Mandiri | BRI | BNI | GoPay | OVO
  - Cards: border 1px gray-200, selected: border black + checkmark kanan atas
  - "Lainnya" card: dengan "+" icon
- Input saldo: "Saldo saat ini (estimasi)" — number input, Rp prefix
- CTA: "Lanjut →"

STEP 3 — Siap Import:
- Heading: "Pilih cara import data pertama kamu." — 40px, Instrument Serif
- Subtext: "Pilih yang paling mudah untuk kamu sekarang." — 16px, gray-500
- 4 option cards (vertical list, full width):
  * "Upload PDF Mutasi" — "Export dari m-banking, upload di sini" — recommended badge
  * "Foto Screenshot" — "Screenshot dashboard investasi kamu"
  * "Input Manual" — "Masukkan transaksi satu per satu"
  * "Lewati dulu" — gray-500 text, akan setup nanti
- CTA: "Mulai →" — primary button
- Kecil di bawah: "Semua data kamu terenkripsi dan aman." — 12px, gray-400

ANIMASI:
- Step transition: konten lama fade left-out, konten baru fade right-in, 250ms
- Progress indicator: dash aktif animates width dari 0 ke penuh
- Radio/option cards: border animates saat selected
- CTA button: disabled (gray) saat belum ada pilihan, enables dengan animasi saat ada pilihan

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file
- JS untuk step navigation, form state, dan validation
- Semua steps dalam satu file, toggle dengan display
```

---

## PROMPT 04 — Dashboard (Halaman Utama App)

```
Kamu adalah senior product designer. Buat mockup HTML interaktif yang sangat lengkap
untuk halaman Dashboard utama aplikasi FinanceAI.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

NAMA: Dashboard
INI HALAMAN TERPENTING — harus paling impressed.

LAYOUT KESELURUHAN:
- Sidebar 240px (fixed) + Main content (fluid)
- Header dalam content: 64px height

SIDEBAR:
- Logo: "FinanceAI" — Instrument Serif, 18px, padding 24px
- Divider: 1px gray-200
- Nav items (dengan Lucide icons, 18px stroke 1.5):
  * Dashboard (LayoutDashboard) — ACTIVE
  * Transaksi (ArrowLeftRight)
  * Aset & Portofolio (PieChart)
  * Anggaran (Target)
  * Import Data (Upload)
  * Chat AI (MessageSquare)
- Active: 2px solid black left border, text black weight 500
- Inactive: gray-500, no background
- Bottom sidebar:
  * Divider
  * Settings (Settings icon)
  * User info: avatar initial + nama + email — 12px gray-500

HEADER (main content):
- Kiri: "Selamat pagi, Rizky." — 24px, Instrument Serif | "Senin, 17 Februari 2025" — 13px gray-400
- Kanan: icon notifikasi (Bell) + button "Import Data" secondary

KONTEN UTAMA (4 baris):

BARIS 1 — KPI Cards (4 kolom):
Setiap card: 0px radius, 1px border gray-200, padding 24px
  Card 1 — Net Worth:
    Label: "TOTAL KEKAYAAN BERSIH" — 11px uppercase gray-500
    Value: "Rp 247.500.000" — 40px, Instrument Serif, weight 300
    Delta: "↑ 12,4% bulan ini" — 13px, weight 500
    Sub: "vs Rp 220.200.000 bulan lalu" — 12px gray-400
  Card 2 — Pemasukan:
    Label: "PEMASUKAN BULAN INI"
    Value: "Rp 8.500.000" — 32px, Geist Mono
    Delta: "↑ Stabil" — weight 500
  Card 3 — Pengeluaran:
    Label: "PENGELUARAN BULAN INI"
    Value: "Rp 3.640.000" — 32px, Geist Mono
    Delta: "↓ Turun 5% — Bagus!" — weight 500
  Card 4 — Tabungan:
    Label: "RATE TABUNGAN"
    Value: "57%" — 40px, Instrument Serif
    Delta: "↑ Target 50% tercapai"
    Progress bar: 100% width, fill 57%, hitam di atas gray-100, 2px height, 0px radius

BARIS 2 — Chart + AI Insight (8 + 4 kolom):
  CHART (8 col):
    Header: "Tren Keuangan 6 Bulan" kiri | toggle "Pemasukan / Pengeluaran / Keduanya" kanan
    SVG line chart: dua garis (hitam solid = pemasukan, hitam dashed = pengeluaran)
    Grid lines: gray-100 horizontal
    Month labels: Sep Okt Nov Des Jan Feb — Geist Mono 11px gray-400
    Area fill di bawah masing-masing garis: gray-50 dengan opacity
    Hover: vertical line + tooltip (white card, shadow, border 1px gray-200)
    Animasi: garis draw dari kiri ke kanan saat load

  AI INSIGHT (4 col):
    Header: "AI Insight" + brain icon (Lucide Sparkles)
    Badge: "Diperbarui tadi malam" — 11px, gray-400
    3 insight cards (stacked, border-bottom pemisah):
      * "↑ Pengeluaran makan naik 34% vs bulan lalu. 18 transaksi ke restoran."
      * "💡 Kalau kamu kurangi langganan 30%, bisa tambah Rp 195.000/bulan untuk investasi."
      * "✓ Rate tabungan kamu 57% — masuk top 15% pengguna FinanceAI."
    Setiap insight: 13px, line-height 1.6, padding 12px 0, divider bawah
    "Tanya AI →" button — ghost, full width, border-top gray-200

BARIS 3 — Aset Breakdown + Transaksi Terbaru (6 + 6 kolom):
  ASET BREAKDOWN (6 col):
    Header: "Alokasi Aset" | link "Lihat Semua →" kanan
    Donut chart: pure SVG, hitam dan shades of gray
      - Saham IDX: black (35%)
      - Reksa Dana: gray-600 (28%)
      - Tabungan: gray-400 (22%)
      - Emas: gray-300 (10%)
      - Lainnya: gray-200 (5%)
    Legend kanan chart: 4 item, bullet color + nama + persentase + nilai
    Total di tengah donut: "Rp 247,5 jt" — Instrument Serif, 20px

  TRANSAKSI TERBARU (6 col):
    Header: "Transaksi Terbaru" | "Lihat Semua →"
    List 5 transaksi:
      Setiap row: icon kategori (16px) | nama merchant + kategori | jumlah kanan
      - Kopi Kenangan | Makanan | -Rp 38.000
      - Gaji Februari | Pemasukan | +Rp 8.500.000
      - Grab | Transportasi | -Rp 24.000
      - Netflix | Hiburan | -Rp 65.000
      - BBCA — 10 lot | Investasi | -Rp 9.150.000
    Positif: weight 500, black. Negatif: weight 400, gray-600
    Row hover: background gray-50

ANIMASI KESELURUHAN:
- Saat load: sidebar muncul instan, konten stagger dari atas ke bawah, 50ms per baris
- KPI values: count-up 800ms saat load
- Chart: draw animasi 600ms setelah KPI selesai
- Donut: segments draw secara arc, clockwise, 800ms
- Setiap hover state harus berfungsi

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file, tidak perlu routing
- Sidebar dapat di-collapse (toggle button, simpan state di memory)
- Chart menggunakan SVG murni (tidak perlu library)
- Donut chart SVG dengan stroke-dasharray/dashoffset
- Semua data adalah data dummy Indonesia yang realistis
- Responsive: di tablet sidebar collapse jadi icon-only (40px)
```

---

## PROMPT 05 — Halaman Aset & Portofolio

```
Kamu adalah senior product designer. Buat mockup HTML interaktif untuk halaman
Aset & Portofolio FinanceAI — halaman paling diferensiasi dari produk ini.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

NAMA: Aset & Portofolio
INI ADALAH FITUR KILLER — agregasi semua instrumen dalam satu view.

HEADER:
- Sama dengan layout sidebar+header dari Dashboard (reuse)
- Page title: "Aset & Portofolio"
- Kanan header: toggle "Aggregate View | Per Akun" — dua tab, border style

HERO SECTION (full width):
- Background: black
- Padding: 48px
- Label: "TOTAL KEKAYAAN BERSIH" — 11px, UPPERCASE, gray-500
- Nilai besar: "Rp 247.500.000" — 72px, Instrument Serif, white, weight 200
- Sub: "Dari 8 akun aktif · Diperbarui 5 menit lalu" — 14px, gray-500
- Delta row: "↑ Rp 27.300.000 (12,4%) bulan ini" — 16px, white weight 500
- Kanan (dalam hero): mini bar chart last 6 months net worth — white bars di atas black

KATEGORI TABS (horizontal):
Semua | Saham | Reksa Dana | Tabungan & Cash | Emas & Kripto | Properti | Utang
- Tab aktif: border-bottom 2px black, text black
- Inactive: gray-500

=== AGGREGATE VIEW ===

SAHAM IDX:
  Header: "Saham IDX" | Total: "Rp 86.700.000" | Return: "↑ +8,3%"
  Tabel:
  Kolom: Kode | Nama | Lot | Harga Avg | Harga Saat Ini | Nilai | P&L | P&L%
  Rows (Geist Mono untuk semua angka):
    BBCA | Bank BCA | 250 lot* | Rp 9.218 | Rp 9.850 | Rp 24.625.000 | +Rp 1.580.000 | +6,9%
    TLKM | Telkom | 300 lot | Rp 3.120 | Rp 3.280 | Rp 9.840.000 | +Rp 480.000 | +5,1%
    BMRI | Bank Mandiri | 150 lot | Rp 6.450 | Rp 6.200 | Rp 9.300.000 | -Rp 375.000 | -3,9%
  *Footnote kecil di "250 lot": "Dari 2 akun (Stockbit: 150 + IPOT: 100)"
  P&L positif: weight 500, black. P&L negatif: gray-500 (BUKAN merah)
  Footer tabel: "Total saham: Rp 86.700.000 | Avg return: ↑ +5,2%"
  Button: "+ Sinkron data saham" — ghost button, kanan

REKSA DANA:
  Header: "Reksa Dana" | Total: "Rp 69.300.000" | Return: "↑ +11,2%"
  Tabel:
  Kolom: Nama Produk | Platform | Unit | NAB/Unit | Nilai | Return
    Schroder Dana Prestasi | Bibit | 3.421,2 | Rp 18.920 | Rp 64.700.000 | ↑ +12,1%
    Manulife Dana Saham | Bareksa | 892,5 | Rp 5.130 | Rp 4.580.000 | ↑ +7,8%

TABUNGAN & CASH:
  Card grid (3 kolom):
  Setiap card: nama bank + nomor akun (masked ****1234) + saldo + "Diperbarui X menit lalu"
    BCA Tahapan: ****7823 | Rp 24.500.000
    Mandiri: ****2211 | Rp 12.800.000
    GoPay: +62812**** | Rp 2.150.000
    OVO: +62813**** | Rp 800.000

=== PER AKUN VIEW (toggle) ===
Grouped by platform:
  STOCKBIT
  Platform badge | 3 saham | Total Rp 52.100.000
  Tabel saham khusus Stockbit saja

  IPOT (Indo Premier)
  Platform badge | 2 saham | Total Rp 34.600.000
  Tabel saham khusus IPOT

ANIMASI:
- Hero nilai: count-up dari 0 saat load, 1200ms, Instrument Serif
- Tab switch: konten fade out/in 200ms
- Tabel rows: stagger reveal dari atas, 30ms per row
- Toggle Aggregate/Per Akun: flip animation — konten slide kiri/kanan

DETAIL PANEL (side panel, muncul saat klik saham):
- Slide in dari kanan, 300ms
- Header: kode saham + nama lengkap
- Tabs: Overview | Riwayat Transaksi | Per Akun
- Overview: grafik harga 1 bulan terakhir + holdings breakdown

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file dengan sidebar sama seperti dashboard
- Toggle aggregate/per-account harus berfungsi dengan JS
- Side panel slide-in harus berfungsi
- Semua angka pakai Geist Mono
- Data dummy Indonesia yang realistis dan konsisten
```

---

## PROMPT 06 — Import Data + Confirmation Flow

```
Kamu adalah senior product designer. Buat mockup HTML interaktif untuk halaman
Import Data FinanceAI, termasuk review/konfirmasi hasil ekstraksi AI.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

NAMA: Import Data
INI ADALAH HALAMAN TEKNIS TERPENTING — UX harus sangat clear karena user mempercayakan data keuangan mereka.

LAYOUT:
- Left panel 260px: Source selector
- Right panel fluid: Content berdasarkan source yang dipilih + step progress

LEFT PANEL — Source Selector:
Header: "Sumber Data" — 12px, UPPERCASE, gray-500
Groups:
  REKENING BANK
    • BCA (PDF Mutasi)
    • Mandiri (PDF/CSV)
    • BRI (PDF)
    • BNI (PDF)
    • + Tambah Bank Lain

  E-WALLET
    • GoPay (PDF/Screenshot)
    • OVO (Screenshot)
    • Dana (Screenshot)

  INVESTASI
    • Bibit (Screenshot/CSV)
    • Stockbit (Screenshot)
    • IPOT (CSV)
    • Pluang (Screenshot)
    • + Tambah Platform

  LAINNYA
    • Input Manual
    • Upload CSV Custom

Active item: 2px left border black, background gray-50
"Coming Soon" badge: gray-100 bg, gray-400 text, 11px — untuk platform belum supported

RIGHT PANEL — 4 tahap (step indicator di atas):
Step indicator: "Upload → Proses → Review → Selesai"
Progress dots + label, active = black, inactive = gray-300

=== STEP 1: UPLOAD ===
(Tampil saat pilih source)
Header: "Upload Mutasi BCA" — 24px, Instrument Serif
Subtext: "Ekspor mutasi dari BCA mobile, lalu upload di sini." — 14px gray-500
Instruction mini: numbered steps cara export dari BCA — 13px, gray-600

DROP ZONE:
- Besar, centered, dashed border 1px gray-300
- 0px radius
- Icon: Upload (Lucide), 48px, gray-400
- Text: "Seret file ke sini, atau klik untuk pilih" — 16px
- Sub: "PDF, PNG, JPG maksimal 10MB" — 12px gray-400
- Animate: dashed border pulses hitam saat drag over

Atau tombol: "Ambil Foto" (kamera) untuk mobile

Bank selector pills di bawah drop zone (jika pilih "Lainnya"):
BCA | Mandiri | BRI | BNI | dst — pills, selected = black bg white text

=== STEP 2: PROCESSING ===
File card di atas: nama file + ukuran + icon PDF

Progress stages (animated, sequential):
1. "Membaca dokumen..." ████████░░ 80%
2. "Mengidentifikasi transaksi..." (muncul setelah stage 1 selesai)
3. "Mengklasifikasi dengan AI..." (muncul setelah stage 2)
4. "Memeriksa duplikat..."

Setiap stage: progress bar hitam, persentase di kanan (Geist Mono), 3px height, 0px radius
Di bawah: "Menemukan 127 transaksi sejauh ini..." — 13px gray-500, updates realtime (simulasi)
Estimasi waktu: "Selesai dalam ~15 detik" — 12px gray-400

=== STEP 3: REVIEW & KONFIRMASI ===
Header: "Periksa hasil ekstraksi" — 24px, Instrument Serif
Sub: "AI berhasil membaca 127 transaksi. Verifikasi data di bawah sebelum menyimpan." — 14px gray-500

SUMMARY CARDS (3 dalam row):
  "127 Transaksi" | "Rp 8.450.000 Pemasukan" | "Rp 3.640.000 Pengeluaran"

CONFIDENCE SECTION:
Jika ada field rendah confidence:
  Alert bar: border 1px gray-300, background gray-50, padding 12px
  "3 field perlu perhatian kamu" — 13px, ikon AlertCircle (Lucide)
  Expand untuk lihat detail

TABEL REVIEW:
Kolom: Tanggal | Merchant | Kategori | Jumlah | Confidence | Aksi
  Row normal: confidence dot hijau (EXCEPTION dari monochrome — ini UX critical)
  Row warning: confidence dot kuning
  Row error: confidence dot merah + row background very light gray

Kategori: editable dropdown per row
Merchant: editable text per row
Inline edit: klik cell → jadi input field

Bulk actions bar (fixed bottom):
"Semua terlihat benar" → "Simpan 127 Transaksi" (primary)
"Hapus semua" → ghost button

=== STEP 4: SELESAI ===
Big checkmark (SVG, draw animasi)
"127 transaksi berhasil disimpan!"
Sub: "Net worth kamu telah diperbarui."

3 action cards:
  "Lihat Dashboard" | "Import Lagi" | "Tanya AI tentang transaksi ini"

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file
- Left panel source selection harus berfungsi (ganti konten kanan)
- Step navigation harus berfungsi (prev/next)
- Processing stage harus animated (setTimeout simulasi)
- Tabel review harus scrollable dengan inline editing cells
```

---

## PROMPT 07 — Chat AI

```
Kamu adalah senior product designer. Buat mockup HTML interaktif untuk halaman
Chat AI FinanceAI — tanya apa saja tentang data keuangan pengguna.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== SPESIFIKASI HALAMAN ===

LAYOUT:
Sidebar sama seperti halaman lain +
Main content dibagi: Chat area (65%) | Context panel (35%)

CHAT AREA:
Header: "Financial Advisor AI" — Instrument Serif 20px | "Data per 17 Feb 2025" — 12px gray-400

Empty state (first load):
- Centered, large
- "Tanya apa saja tentang\nkeuangan kamu." — 40px Instrument Serif weight 300
- Suggested prompts (cards, 2x2 grid):
  * "Bulan ini aku paling boros di mana?"
  * "Kalau aku kurangi langganan, bisa nabung berapa?"
  * "Bandingkan pengeluaran saya 3 bulan terakhir."
  * "Kapan terakhir saya punya cash flow positif?"

Messages (setelah ada conversation):
User bubble: kanan, background black, white text, 0px radius kanan atas
AI bubble: kiri, border 1px gray-200, background white, 0px radius kiri atas
Timestamp: 11px gray-400, di bawah bubble

AI response bisa mengandung:
- Mini tabel data transaksi
- Inline mini chart (SVG sederhana)
- Bold highlights untuk angka penting

Typing indicator: tiga titik animasi (dot bounce, gray-400)

Input area (fixed bottom):
- Full width bar, border-top 1px gray-200
- Textarea: resize-none, 1 line → expand saat isi
- Placeholder: "Tanya apa saja..."
- Kanan: Send button (panah, primary, 0px radius, 36px square)
- Kiri: Attach button (paperclip icon, ghost) untuk upload dokumen

CONTEXT PANEL (kanan):
Header: "Konteks Aktif" — 12px UPPERCASE gray-500

Sections:
  DATA YANG DIGUNAKAN:
  Chips yang bisa di-toggle (on/off):
    ● BCA Mutasi Feb 2025 (127 transaksi)
    ● Stockbit Portfolio
    ● Bibit Reksa Dana
    [+ Tambah sumber]

  STATISTIK CEPAT:
  Small KPI cards (4, dalam 2x2):
    Net Worth | Pengeluaran bulan ini | Rate tabungan | Jumlah transaksi

  RIWAYAT CHAT:
  List conversation sebelumnya:
    "Analisis pengeluaran Jan" — 3 hari lalu
    "Budget makan bulan ini" — 1 minggu lalu

ANIMASI:
- User message: slide up dari input area
- AI message: fade in dari kiri, setelah typing indicator
- Suggested prompts: stagger reveal saat empty state
- Typing indicator: 3 dots, sequential bounce

CONTOH CONVERSATION YANG SUDAH ADA:
User: "Bulan ini aku paling boros di mana?"
AI: [response panjang dengan data tabel mini embedded]
User: "Kalau aku kurangi 50% pengeluaran makan, bisa nabung berapa?"
AI: [response dengan kalkulasi + mini bar chart]
+ typing indicator (AI sedang mengetik)

=== TECHNICAL REQUIREMENTS ===
- Output: Single HTML file
- Suggested prompt cards bisa diklik → masuk ke input dan submit
- Input textarea harus auto-expand
- Typing indicator harus animated
- Simulasikan AI response setelah user submit (setTimeout 1.5s → show response)
```

---

## PROMPT 08, 09, 10 (Shorter — Transaksi, Budget, Settings)

```
Kamu adalah senior product designer. Buat mockup HTML interaktif untuk tiga halaman
FinanceAI berikut: Transaksi, Anggaran (Budget), dan Pengaturan.
Gunakan sidebar dan layout yang konsisten dengan halaman sebelumnya.

=== DESIGN LANGUAGE ===
[Paste isi 00-design-language.md di sini]
======================

=== HALAMAN TRANSAKSI ===
- Full width data table di bawah filter bar
- Filter bar: search input | dropdown Kategori | dropdown Akun | date range picker | toggle "Pemasukan/Pengeluaran/Semua"
- Tabel: Tanggal | Merchant/Nama | Kategori (editable badge) | Akun | Jumlah
- Pagination: "Menampilkan 1-50 dari 423 transaksi"
- Klik row → side panel detail transaksi
- FAB button bawah kanan: "+ Tambah Manual"

=== HALAMAN ANGGARAN ===
- Header: bulan selector (← Feb 2025 →)
- Summary: Total budget Rp X | Terpakai Rp Y | Sisa Rp Z
- Per-kategori cards (2 kolom grid):
  * Nama kategori + icon
  * Progress bar: black fill di atas gray-100, 0px radius
  * "Rp X dari Rp Y" — Geist Mono
  * Overspent: progress bar melebihi 100%, bar color jadi very dark gray, teks merah (EXCEPTION)
  * Klik: expand untuk lihat transaksi dalam kategori ini
- "+ Tambah Anggaran Kategori" button

=== HALAMAN PENGATURAN ===
- Two-column: Left nav (kategori settings) | Right content
- Sections: Profil | Akun & Keamanan | Notifikasi | Kategori | Data & Privacy | Tampilan
- Form style: label di atas, input di bawah, simpan per section (bukan satu tombol global)
- Toggle switches untuk notifikasi (custom CSS, monochrome — black track saat on)
- Danger zone section: merah text, "Hapus Akun" button dengan konfirmasi
```
