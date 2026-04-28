# FinanceAI — Project Memory

Personal finance platform untuk pasar Indonesia.
Full-stack: Next.js (pure frontend) + FastAPI (semua backend logic).

---

## Architecture

```
Next.js (port 3000)          — pure frontend, zero API routes, zero backend logic
    ↓ HTTP requests langsung
FastAPI (port 8000)          — satu-satunya backend
    ├── PostgreSQL            — data utama (via SQLAlchemy 2.0 async)
    ├── Qdrant (port 6333)   — vector DB untuk RAG pipeline
    └── Groq API             — LLM (Llama 3.3 70B) + Vision (Llama 3.2 11B)
```

Semua service di-containerize via Docker Compose.
Caddy sebagai reverse proxy dengan TLS otomatis.
Deploy ke VPS (8GB RAM, 4 core, 64GB) via GitHub Actions → GHCR → SSH.

---

## Code Style

- Indentasi: **TAB**, ukuran 4
- Komentar: singkat dan purposeful — jelaskan KENAPA, bukan APA
- Logic: sesederhana mungkin, hindari abstraksi berlebihan
- Fungsi: satu tanggung jawab, pendek
- Jangan buat helper function yang hanya dipanggil sekali
- Nama variabel: descriptive, bukan singkatan tidak jelas

---

## Backend Conventions (FastAPI)

**Struktur per fitur** (bukan per layer):
```
app/
├── auth/
│   ├── router.py    # endpoints
│   ├── service.py   # business logic
│   ├── schemas.py   # Pydantic models
│   └── models.py    # SQLAlchemy models
```

**Models:**
- UUID primary key semua table
- Semua table punya `created_at`, `updated_at` (via TimestampMixin)
- Soft delete: `deleted_at` timestamp, bukan hard delete
- Amount keuangan: `Decimal` dengan `Numeric(15, 2)` di DB — tidak pernah float

**API:**
- Semua endpoint di bawah prefix `/v1/`
- Auth: Access token (15 menit) di Authorization header + Refresh token (30 hari) di HttpOnly Cookie
- Cookie `refresh_token` punya `path="/v1/auth"` — hanya dikirim ke auth endpoints
- Refresh token rotation: setiap token hanya boleh dipakai sekali, langsung revoke setelah dipakai
- Error response format selalu:
  ```json
  {"error": {"code": "ERROR_CODE", "message": "...", "details": {}}}
  ```
- List endpoints pakai cursor-based pagination (bukan offset)
- Amount: positif = income, negatif = expense — konsisten di semua tempat

**Database:**
- SQLAlchemy 2.0 async — semua query pakai `await`
- Session dari dependency injection (`Depends(get_session)`)
- Migrations via Alembic — jangan pernah edit schema langsung

**Background tasks:**
- Gunakan FastAPI `BackgroundTasks` untuk operasi berat (PDF parsing, RAG indexing)
- Endpoint upload return 202 Accepted segera — tidak tunggu processing selesai

---

## Frontend Conventions (Next.js)

**Struktur:**
```
app/
├── (marketing)/     # landing page — tidak ada auth guard
├── (auth)/          # login, register, onboarding
└── (app)/           # semua halaman authenticated
    └── layout.tsx   # sidebar + header, auth guard di sini
```

**Rules:**
- Zero API routes — semua call langsung ke FastAPI `http://api.domain.com/v1/`
- State: Zustand untuk global state, TanStack Query untuk server state
- Access token simpan di Zustand store (memory only — tidak persist ke localStorage)
- Refresh token di-handle otomatis oleh browser via cookie
- Semua angka keuangan: format `Rp X.XXX.XXX` — ada utility `formatRupiah()` di `lib/utils.ts`

**Axios instance** (`lib/api.ts`):
- Base URL dari env var `NEXT_PUBLIC_API_URL`
- Request interceptor: inject `Authorization: Bearer {access_token}` dari Zustand
- Response interceptor: kalau 401, call `/v1/auth/refresh` dulu, retry request original
- Kalau refresh juga gagal: clear token + redirect ke `/login`

**Design system:**
- Font: Instrument Serif (display/numbers besar) + Geist Sans (body/UI) + Geist Mono (data/angka)
- Color: strictly monochrome — black (#000000) sampai white (#FFFFFF), gray scale
- Radius: 0px untuk cards/tables, 4px untuk buttons/inputs
- Animasi: Framer Motion, easing `cubic-bezier(0.16, 1, 0.3, 1)`, stagger 50ms
- Semua angka keuangan: count-up animation saat masuk viewport

---

## AI & RAG

**Groq models:**
- Chat: `llama-3.3-70b-versatile`
- Vision (image parsing): `llama-3.2-11b-vision-preview`
- Config di `app/config.py` via env var `GROQ_MODEL`

**RAG flow:**
1. Import confirm → `rag_pipeline.index_transactions()` (background task)
2. Chat message masuk → `rag_pipeline.query()` ambil transaksi relevan
3. Context di-inject ke system prompt sebelum call Groq
4. Response di-stream ke client via Server-Sent Events

**Qdrant:**
- Collection: `financeai_transactions`
- Filter by `user_id` di setiap query — user tidak pernah bisa lihat data user lain
- Point ID = UUID transaksi dari PostgreSQL

---

## Import Pipeline

Sumber data yang didukung:

| Source | Format | Parser |
|--------|--------|--------|
| BCA | PDF | `parsers/pdf_bca.py` |
| Mandiri | PDF | `parsers/pdf_mandiri.py` |
| BRI | PDF | `parsers/pdf_bri.py` |
| Bibit | CSV | `parsers/csv_bibit.py` |
| IPOT | CSV | `parsers/csv_ipot.py` |
| Stockbit, Pluang, dll | Screenshot/foto | `parsers/image_vision.py` |
| Manual | Form input | Langsung ke transactions endpoint |

**Flow:**
`POST /v1/import/upload` → 202 response → background task parse → status PROCESSING → status REVIEW → user konfirmasi → `POST /v1/import/confirm` → simpan ke DB → index ke Qdrant

**Confidence score:**
- ≥ 0.8: tampilkan normal
- 0.5–0.8: highlight kuning, minta perhatian
- < 0.5: highlight merah, wajib konfirmasi manual sebelum bisa simpan

---

## Multi-account Stock Holdings

Saham yang sama bisa ada di beberapa broker (Stockbit + IPOT).

**Storage:** Simpan per akun di `stock_holdings` table (ada unique constraint `account_id + ticker`).

**Display:** Kalkulasi weighted average di service layer saat query, jangan simpan di DB:
```python
weighted_avg = sum(h.lot * h.avg_price for h in holdings) / sum(h.lot for h in holdings)
```

**UI toggle:** Default "Aggregate view" (semua broker digabung), ada toggle ke "Per account view".

---

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/financeai

# JWT
JWT_SECRET_KEY=          # generate dengan: openssl rand -hex 32
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30

# Google OAuth (opsional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://api.yourdomain.com/v1/auth/google/callback

# Groq
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=llama-3.2-11b-vision-preview

# Qdrant
QDRANT_URL=http://qdrant:6333
QDRANT_COLLECTION=financeai_transactions

# App
FRONTEND_URL=https://yourdomain.com
ENVIRONMENT=production
```

---

## Running Locally

```bash
# Start semua service
docker compose up -d

# Backend development (dengan hot reload)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend development
cd frontend && npm run dev

# Database migration
cd backend && alembic upgrade head

# Buat migration baru setelah edit models
cd backend && alembic revision --autogenerate -m "deskripsi perubahan"
```

---

## Hal yang JANGAN dilakukan

- Jangan simpan access token di localStorage — memory only
- Jangan simpan current_price saham di DB — selalu calculated/fetched
- Jangan simpan amount sebagai float — selalu Decimal
- Jangan buat API routes di Next.js — semua ke FastAPI langsung
- Jangan hard delete transaksi — soft delete dengan deleted_at
- Jangan query Qdrant tanpa filter user_id
- Jangan blocking di upload endpoint — selalu background task