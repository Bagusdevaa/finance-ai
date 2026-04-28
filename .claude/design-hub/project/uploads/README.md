# FinanceAI — Cara Pakai Ketiga File Ini

## Tiga file yang kamu punya:

| File | Untuk apa |
|------|-----------|
| `00-design-language.md` | Fondasi bersama — SELALU include di setiap prompt |
| `01-claude-design-prompts.md` | Copy-paste ke Claude baru untuk desain visual / HTML mockup |
| `02-claude-code-prompts.md` | Copy-paste ke Claude Code di VSCode untuk implementasi |

---

## Cara kerja yang benar

### Untuk desain (mockup visual):
1. Buka Claude baru (claude.ai, fresh conversation)
2. Paste isi `00-design-language.md` sebagai pesan pertama
3. Lalu paste prompt halaman yang diinginkan dari `01-claude-design-prompts.md`
4. Claude akan generate HTML interaktif yang bisa langsung kamu preview

### Untuk coding (implementasi nyata):
1. Buka terminal di VSCode
2. Jalankan `claude` (Claude Code)
3. Paste prompt dari `02-claude-code-prompts.md` — mulai dari SETUP PERTAMA
4. Lanjut satu per satu sesuai urutan

---

## Kenapa terpisah?

- **Claude Design** butuh deskripsi visual yang kaya — warna, layout, animasi dalam bahasa natural
- **Claude Code** butuh spesifikasi teknikal — types, API routes, file structure, library yang dipakai
- Keduanya merujuk ke design language yang sama → output konsisten

---

## Urutan pengerjaan yang disarankan

```
Minggu 1-2:   SETUP + Design language + Landing page (design + code)
Minggu 3:     Auth + Onboarding
Minggu 4-5:   Dashboard + Aset & Portofolio
Minggu 6-7:   Import Data + AI extraction
Minggu 8:     Chat AI + Budget + Transaksi
Minggu 9:     Settings + Polish + Deploy
Minggu 10:    README + Demo video + Case study
```

---

## Koneksi antara design dan code

Design prompt menghasilkan: HTML mockup untuk referensi visual
Code prompt menghasilkan: Komponen React/Next.js yang actual

Keduanya pakai:
- Nama font yang sama (Instrument Serif, Geist)
- Nama token warna yang sama (gray-200, gray-500, dll)
- Nama komponen yang sama (StatCard, DataTable, DonutChart)
- Behavior animasi yang sama (count-up, stagger, expo-out easing)
