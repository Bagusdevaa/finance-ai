# BNI e-Statement PDF Parser — Design

**Status:** Draft, pending implementation
**Date:** 2026-05-10
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch target:** `bugfix` (current) or new `feat/bni-pdf-parser` per implementation step

---

## Context

FinanceAI saat ini punya stub parser untuk PDF bank (`pdf_bca`, `pdf_mandiri`, `pdf_bri`) yang semuanya `raise NotImplementedError`. User punya 4 sample PDF e-Statement BNI dari bulan berbeda (Oct 2025, Nov 2025, Feb 2026, Apr 2026) — di-print dari aplikasi/web banking BNI dengan PDFium engine. Pivot dari rencana awal (BCA) ke BNI karena sample BCA belum tersedia.

Sample sudah di-drop ke `backend/tests/fixtures/bni/` (folder di-gitignore karena berisi data sensitif: nama, no rekening, alamat).

## Goals

1. Implementasikan parser PDF e-Statement BNI yang reliable untuk format yang dimiliki user (text-based PDF, bukan scanned).
2. Tambah `pdf_bni` sebagai source type baru di backend dan frontend.
3. Jangan ubah behavior existing parser lain — perubahan harus aditif.
4. Pakai auto-categorizer existing (rule-based) sebagai sumber kategori utama, dengan kategori intrinsik BNI sebagai fallback untuk transaksi yang tidak match keyword apapun.

## Non-goals

- Tidak menangani PDF BNI format lain (e.g. e-Statement formal bulanan dari email, Internet Banking print). Jika user upload format lain, parser kembalikan list kosong (graceful) — bukan dukungan multi-format dalam satu parser.
- Tidak meng-OCR PDF scanned. Hanya text-based PDFs.
- Tidak mengubah schema `ParsedRow` atau `ImportRow` (date-only, tidak menyimpan jam transaksi sebagai field struktural).
- Tidak refactor parser existing.

## Sample PDF Analysis

| File | Pages | Transactions | Period |
|------|-------|--------------|--------|
| bni-2025-10.pdf | 5 | 57 | 01-31 Oct 2025 |
| bni-2025-11.pdf | 3 | 37 | 01-30 Nov 2025 |
| bni-2026-02.pdf | 3 | 35 | 03-28 Feb 2026 |
| bni-2026-04.pdf | 4 | 47 | 01-30 Apr 2026 |

PDF metadata: Creator/Producer = `PDFium` (Chrome's print engine, mengindikasikan print-to-PDF dari aplikasi BNI atau browser). Tabel tidak punya border (pdfplumber `find_tables()` returns 0).

### Layout (text extraction output)

Header per halaman:
```
Laporan Mutasi Rekening
Periode: 1 - 31 Oktober 2025
<NAMA NASABAH> <PRODUCT> - <NO REKENING>
<ALAMAT MULTI-LINE>
<KANTOR CABANG INFO>
Saldo Awal Total Pemasukan Total Pengeluaran Saldo Akhir
<saldo_awal> +<total_in> -<total_out> <saldo_akhir>
Tanggal & Waktu Rincian Transaksi Nominal (IDR) Saldo (IDR)
Saldo Awal <saldo_awal>
```

Tiap transaksi: **3 baris** konsekutif:
```
<DD MMM YYYY> <BNI_CATEGORY>
<+/-NOMINAL> <SALDO_BERJALAN>
<HH:MM:SS> WIB <DESCRIPTION>
```

Footer per halaman:
```
PT Bank Negara Indonesia (Persero) Tbk. berizin dan diawasi oleh Otoritas Jasa Keuangan (OJK) serta merupakan
peserta penjaminan Lembaga Penjamin Simpanan (LPS). N dari M
```

Akhir statement (last page):
```
Saldo Akhir <amount>
Informasi Lainnya
1. Apabila terdapat kesalahan...
[disclaimer text]
```

### Kategori intrinsik BNI (7 nilai dari sample)

`Biaya`, `Ewallet`, `Lainnya`, `Pembayaran Qris`, `Tarik Tunai`, `Transfer`, `Virtual Account`

## Design

### Surface area

**Backend changes:**

| File | Change |
|------|--------|
| `backend/app/import_data/models.py` (line 40-47) | Tambah `pdf_bni = "pdf_bni"` ke enum `ImportSourceType` |
| `backend/app/import_data/parsers/pdf_bni.py` | File baru, ~150 LOC, parser implementation |
| `backend/app/import_data/parsers/__init__.py` | Tambah `pdf_bni` ke import list |
| `backend/alembic/versions/<timestamp>_add_pdf_bni_source_type.py` | Manual migration (alembic generates timestamped filename): `ALTER TYPE import_source_type ADD VALUE 'pdf_bni'`. Postgres tidak izinkan ALTER TYPE ADD VALUE di dalam transaction block — set `transactional_ddl = False` atau gunakan autocommit per Alembic docs |

**Frontend changes:**

| File | Change |
|------|--------|
| `frontend/lib/api/types.ts` (line 194-201) | Tambah `"pdf_bni"` ke union `ImportSourceType` |
| `frontend/app/(app)/import/page.tsx` (line 50) | Hapus `disabled: true`, ganti `sourceType: "pdf_bca"` → `"pdf_bni"` |

**Tests:**

| File | Change |
|------|--------|
| `backend/tests/test_pdf_bni_parser.py` | File baru — load fixtures, assert tx counts dan signs |

**Dependencies:**
`pdfplumber>=0.11,<0.12` sudah di `backend/requirements.txt`. Tidak ada perubahan dependency.

### Parser algorithm

`PdfBniParser.parse(file_bytes: bytes) -> list[ParsedRow]`:

1. Buka PDF dengan `pdfplumber.open(io.BytesIO(file_bytes))`.
2. Concat semua `page.extract_text()` jadi list of lines (split `\n`, strip).
3. Loop linear dengan **3-state finite machine**:
   - **State A:** cari baris yang match `^(\d{2}) (Jan|Feb|...|Dec) (\d{4})\s+(.+)$`. Group 4 = `bni_category`. Simpan tanggal + kategori, lanjut State B.
   - **State B:** ekspektasi baris dengan pattern `^([+-]?[\d,]+)\s+([\d,]+)$` (nominal + saldo). Parse signed amount (strip koma). Lanjut State C. Kalau gagal: discard tx-in-progress, balik State A — dan re-evaluate baris yang gagal sebagai State A baris berikutnya (jangan consume baris). Mencegah missed tx kalau ada noise line di antara header dan transaksi pertama.
   - **State C:** ekspektasi `^(\d{2}:\d{2}:\d{2}) WIB\s+(.+)$`. Group 2 = description. Commit `ParsedRow`. Balik State A.
4. Return list. Kalau exception apapun (corrupt PDF, format tidak dikenal): catch dan return `[]` (parser tidak boleh crash service layer; user akan lihat 0 rows di review screen).

**Skip lines (otomatis di-skip oleh State A karena tidak match):**
- Header `Laporan Mutasi...`, `Periode: ...`, alamat, info nasabah
- Header summary `Saldo Awal Total Pemasukan...`
- Header tabel `Tanggal & Waktu Rincian Transaksi...`
- `Saldo Awal <amount>`, `Saldo Akhir <amount>`
- Footer `... N dari M`
- Disclaimer `Informasi Lainnya`, `1. Apabila...`

### Field mapping

| ParsedRow field | Source | Catatan |
|-----------------|--------|---------|
| `line_no` | counter increment per tx (1-indexed) | Bukan baris fisik PDF, melainkan urutan transaksi |
| `transaction_date` | parse `DD MMM YYYY` → `date` | English month abbreviation; gunakan `datetime.strptime(s, "%d %b %Y")` dengan locale C |
| `amount` | signed Decimal dari nominal line | Sudah ada `+`/`-` di teks, tinggal strip koma |
| `currency` | `"IDR"` hardcoded | BNI domestic statements |
| `merchant_name` | `None` | BNI tidak pisahkan merchant struktural |
| `description` | sisa setelah `"HH:MM:SS WIB "` | Strip whitespace |
| `category` | `categorize_rule_based(merchant=None, description)` → fallback BNI mapping | Lihat tabel mapping di bawah |
| `confidence_score` | `Decimal("1.00")` default | Drop ke `Decimal("0.70")` kalau description kosong setelah strip, ATAU bni_category bukan salah satu dari 7 nilai dikenal (Biaya, Ewallet, Lainnya, Pembayaran Qris, Tarik Tunai, Transfer, Virtual Account) |
| `raw_text` | gabung 3 baris asli pakai `" \| "` separator | Termasuk jam transaksi (informasi yang tidak masuk schema struktural) |

### BNI category fallback mapping

Hanya berlaku jika `categorize_rule_based()` return `None`:

| BNI category | Internal category fallback |
|--------------|----------------------------|
| `Biaya` | `Biaya Bank` |
| `Ewallet` | `Top Up` |
| `Transfer` | `Transfer` |
| `Pembayaran Qris` | `None` (terlalu generik — bisa makanan, belanja, transport) |
| `Virtual Account` | `None` (bisa Tagihan atau Investasi) |
| `Tarik Tunai` | `None` (tidak ada internal category yang cocok; user edit) |
| `Lainnya` | `None` |

### Edge cases

**Yang sudah dihandle:**
- PDF dengan 0 transaksi → return `[]`
- Bytes kosong / random bytes → catch exception, return `[]`
- "Saldo Awal X" / "Saldo Akhir X" lines → tidak match State A pattern, di-skip
- Header dan footer berulang per halaman → tidak match State A
- Tanggal pertama bukan tgl 1 (mis. Feb 2026 mulai 03 Feb) → no special handling needed

**Risk yang belum di-test (sample tidak cover):**
- Description sangat panjang yang wrap ke baris ke-4. **Mitigation:** state machine drop block dengan graceful — tidak crash. Acceptable untuk MVP, improve nanti kalau muncul kasus nyata.
- Multi-rekening dalam 1 PDF (statement gabungan). **Mitigation:** parser asumsi 1 PDF = 1 rekening. Kalau ternyata ada, sample di-validasi pas user lihat hasil (review screen).

## Testing

`backend/tests/test_pdf_bni_parser.py`:

- `test_parse_oct_2025` — assert `len(rows) == 57`, semua tanggal di Oct 2025
- `test_parse_nov_2025` — assert `len(rows) == 37`
- `test_parse_feb_2026` — assert `len(rows) == 35`
- `test_parse_apr_2026` — assert `len(rows) == 47`
- `test_signs_match_summary` — load oct 2025; sum positive amounts == `13,687,644`; sum negative == `-13,706,648`
- `test_categorizer_hybrid` — assert tx dengan description "MANDIRI -" → "Pemasukan"; assert tx dengan bni_category "Biaya" + description tidak match keyword → "Biaya Bank"
- `test_empty_pdf_bytes` — `b""` → `[]`, no exception
- `test_malformed_pdf_bytes` — `b"not a pdf"` → `[]`, no exception
- `test_skip_when_fixtures_missing` — kalau folder `tests/fixtures/bni/` kosong, mark `pytest.skip()` (CI environment)

Strategi: file fixtures di-gitignore, jadi local dev jalankan full test, CI skip otomatis (acceptable — assertion utama tested via local dev).

## Verification (post-implementation)

Yang harus saya jalankan di main session setelah agent selesai:

1. `cd backend && venv/bin/alembic upgrade head` — confirm migration jalan
2. `cd backend && venv/bin/pytest tests/test_pdf_bni_parser.py -v` — confirm semua test pass
3. `cd backend && venv/bin/pytest tests/ -v` — confirm tidak ada regresi (51 existing tests harus tetap pass)
4. Live smoke test:
   - Start uvicorn
   - Login dapat access token
   - `curl POST /v1/import/upload` dengan `bni-2025-10.pdf` + `source_type=pdf_bni`
   - Poll status sampai `review`
   - `curl GET /v1/import/jobs/<id>/rows` — verify 57 rows muncul
   - `curl POST /v1/import/confirm` — verify tersimpan ke transactions table
5. Frontend smoke test:
   - Buka `/import`, click BNI button (no longer disabled)
   - Upload file, see review screen, confirm

## Out of scope (future work)

- Parser BCA, Mandiri, BRI PDF (perlu sample masing-masing)
- Format lain BNI (e-Statement formal bulanan, Internet Banking)
- OCR untuk scanned PDF
- Multi-rekening dalam 1 PDF
- Capture jam transaksi sebagai field struktural (perlu schema migration)
