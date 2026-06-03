# Docker Dev Environment — Design

**Status:** Draft, pending implementation
**Date:** 2026-05-28
**Author:** Claude (PM-mode session with bagus@constructland.com)
**Branch:** `feat/docker-dev-env` (already created)

---

## Context

Project sebelumnya hybrid: Docker untuk Postgres + Qdrant (via `docker-compose.override.yml`), native untuk backend (`venv/bin/uvicorn`) + frontend (`pnpm dev`). Setelah project idle 2 minggu, uvicorn cold-start memakan **6 menit 10 detik** karena macOS background tasks (Time Machine `backupd-helper`, Spotlight `mdbulkimport`, iCloud `cloudd`) hog disk I/O — Python `_io_FileIO_readall_impl` blocked di `read()` syscall membaca `.pyc` files. Frontend `pnpm dev` kena symptom sama (walks `node_modules` + pnpm store di `~/Library/pnpm/store`).

Dokumentasi quirk di `memory/project_quirks.md` 2026-05-27.

Existing files:
- `docker-compose.yml` — production: Caddy + frontend (build, **TIDAK ADA Dockerfile**) + backend (build, Dockerfile ada) + postgres + qdrant
- `docker-compose.override.yml` — dev: hanya expose postgres :5432 + qdrant :6333 ke host
- `Caddyfile` — production: TLS auto, `yourdomain.com` + `api.yourdomain.com`
- `Caddyfile.dev` — dev: no TLS, `localhost` → frontend, `api.localhost` → backend
- `backend/Dockerfile` — production-style, `EXPOSE 8000` + `CMD uvicorn ... --port 8000`
- `frontend/Dockerfile` — **TIDAK ADA**

User akan deploy ke VPS setelah MVP siap. Phase 3 (frontend redesign) shipped 2026-05-12; semua fitur core sudah berfungsi.

## Goals

1. Local dev environment fully containerized — `docker compose up -d` start backend + frontend + postgres + qdrant + caddy semua dalam <15 detik (kalau image sudah built).
2. **Isolasi dari macOS background tasks** — venv + node_modules ter-bake di Docker image layer (overlayfs), tidak terpengaruh Spotlight/Time Machine yang scan host disk.
3. Hot reload working untuk backend (uvicorn `--reload`) dan frontend (Next HMR) via source code bind-mount.
4. Dev environment routing **identical to prod** — pakai Caddy (Caddyfile.dev) untuk reverse proxy `localhost` + `api.localhost`. Sekalian validate routing config sebelum VPS deploy.
5. Convenience wrapper (`Makefile`) untuk operasi umum: `make dev`, `make dev-down`, `make migrate`, `make test`, `make dev-shell-backend/frontend`.
6. Production `docker-compose.yml` + `Caddyfile` + `backend/Dockerfile` **TIDAK diubah** — dev adalah additive only.

## Non-goals

- **Production frontend Dockerfile** (`next build` + `next start`) — defer ke deployment phase. Untuk dev cukup `Dockerfile.dev` dengan `pnpm dev`.
- **Multi-stage build optimization** — defer ke production hardening.
- **CI/CD GitHub Actions** — separate spec.
- **Prod Caddyfile tweaks** — Caddyfile.dev sudah ada, prod tetap untuh.
- **Cache warmup script untuk native dev** — user pilih full Docker.
- **GPU acceleration** vision LLM — Llama 4 Scout pakai Groq cloud, GPU lokal irrelevant.
- **Postgres/Qdrant tuning** — defaults cukup untuk dev.
- **Backup volumes** — postgres_data + qdrant_data volumes persist, tapi backup strategy defer.
- **Devcontainer JSON** untuk VS Code integration — nice-to-have, defer.

## Design

### Architecture

5 containers di compose network internal. Hanya Caddy yang expose port 80 ke host. Postgres + Qdrant tetap reachable di host port 5432/6333 (via override existing) untuk tools eksternal (Postico, Qdrant dashboard).

```
                    ┌── caddy:2-alpine (host :80) ──┐
                    │  Caddyfile.dev mounted         │
                    │  localhost → frontend:3000     │
                    │  api.localhost → backend:8000  │
                    └────────────────┬───────────────┘
                                     │
                ┌────────────────────┼──────────────────┐
                │                                       │
         ┌──────▼──────┐                          ┌────▼─────┐
         │  frontend   │                          │ backend  │
         │ Dockerfile  │                          │ Dockerfile│
         │   .dev      │                          │   .dev   │
         │  pnpm dev   │                          │  uvicorn │
         │  + HMR      │                          │ --reload │
         └──────┬──────┘                          └────┬─────┘
                │                                      │
                └─────────────┬───────────────────────┘
                              │ compose network
                ┌─────────────┼─────────────┐
                │             │             │
          ┌─────▼─────┐  ┌────▼────┐
          │ postgres  │  │ qdrant  │
          │ :16-alp   │  │ :latest │
          └───────────┘  └─────────┘
```

**`*.localhost` resolution**: Modern browsers (Chrome, Safari, Firefox 64+) resolve `*.localhost` ke `127.0.0.1` automatically per RFC 6761. Tidak perlu edit `/etc/hosts`.

### File structure (new vs modified)

| File | Status | Tujuan |
|------|--------|--------|
| `frontend/Dockerfile.dev` | CREATE | `node:20-alpine` + `pnpm install` in image, `pnpm dev` for HMR |
| `frontend/.dockerignore` | CREATE | Exclude `node_modules`, `.next`, `.git`, `*.log` |
| `backend/Dockerfile.dev` | CREATE | `python:3.12-slim` + `pip install` in image, `uvicorn --reload` |
| `backend/.dockerignore` | CREATE | Exclude `venv`, `__pycache__`, `*.pyc`, `tests/fixtures/{bni,bca,mybca,mandiri,bri,permata,vision}` (sensitive) |
| `docker-compose.override.yml` | MODIFY (extend) | Tambah caddy + frontend + backend service overrides dengan bind-mounts |
| `Makefile` | CREATE | Convenience wrapper: `dev`, `dev-build`, `dev-down`, `dev-logs`, `dev-shell-backend`, `dev-shell-frontend`, `migrate`, `test` |
| `docs/superpowers/specs/2026-05-28-docker-dev-env-design.md` | CREATE | This spec |

**NOT modified**: `docker-compose.yml`, `Caddyfile`, `Caddyfile.dev`, `backend/Dockerfile`, frontend/backend source code, `.env`, `.env.example`.

### `backend/Dockerfile.dev`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps for pdfplumber/PyMuPDF + dev utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential curl \
	&& rm -rf /var/lib/apt/lists/*

# Install Python deps in image layer (NOT bind-mounted from host venv)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source code di-bind mount via compose, jadi tidak COPY di sini
# (production Dockerfile yang COPY semua)

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app"]
```

### `frontend/Dockerfile.dev`

```dockerfile
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install deps in image layer
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source code di-bind mount via compose

EXPOSE 3000

CMD ["pnpm", "dev"]
```

### `backend/.dockerignore`

```
venv/
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.mypy_cache/
*.egg-info/
dist/
build/
.coverage
htmlcov/
tests/fixtures/bni/
tests/fixtures/bca/
tests/fixtures/mybca/
tests/fixtures/mandiri/
tests/fixtures/bri/
tests/fixtures/permata/
tests/fixtures/vision/
uploads/
.env
```

### `frontend/.dockerignore`

```
node_modules/
.next/
out/
dist/
build/
.turbo/
.eslintcache
*.log
.env*.local
.git
```

### `docker-compose.override.yml` (extended)

```yaml
# Local development override.
# Auto-loaded by `docker compose` on top of docker-compose.yml.
# Full Docker dev: backend + frontend + caddy + postgres + qdrant.
# Backend dan frontend pakai Dockerfile.dev dengan source code bind-mount + HMR.

services:
  caddy:
    volumes:
      - ./Caddyfile.dev:/etc/caddy/Caddyfile
    # Dev: hanya port 80 (no TLS auto). Port 443 di compose prod tidak di-mount lagi.
    ports:
      - "80:80"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    volumes:
      # Bind-mount source untuk Next HMR
      - ./frontend:/app
      # Named volume untuk shadow node_modules — avoid host overwrite
      - frontend_node_modules:/app/node_modules
      # Shadow .next cache di container (faster than VirtioFS bind)
      - frontend_next_cache:/app/.next
    environment:
      NEXT_PUBLIC_API_URL: http://api.localhost
      # Polling untuk file watcher (Mac VirtioFS HMR reliability)
      WATCHPACK_POLLING: "true"
      CHOKIDAR_USEPOLLING: "true"

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    volumes:
      # Bind-mount source dirs (NOT whole ./backend untuk hindari konflik dengan host venv)
      - ./backend/app:/app/app
      - ./backend/alembic:/app/alembic
      - ./backend/alembic.ini:/app/alembic.ini
      - ./backend/tests:/app/tests
      # Uploads sebagai writable volume (jangan di host filesystem)
      - backend_uploads:/app/uploads
    env_file:
      - ./backend/.env
    environment:
      # Override DB + Qdrant URL untuk pakai container network names
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      QDRANT_URL: http://qdrant:6333
    # Override prod CMD untuk --reload
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app"]

  postgres:
    ports:
      - "5432:5432"

  qdrant:
    ports:
      - "6333:6333"

volumes:
  frontend_node_modules:
  frontend_next_cache:
  backend_uploads:
```

**Penting**:
- Backend mount **individual dirs** (`./backend/app`, `./backend/alembic`, dst) bukan `./backend` penuh — supaya host `backend/venv` tidak conflict dengan image's installed packages.
- `frontend_node_modules` named volume **shadow** `/app/node_modules` — supaya bind-mount source dari host tidak timpa node_modules yang di-install di image saat build.
- `backend_uploads` named volume — uploads tidak di host filesystem, immune dari macOS scan.

### Hot reload behavior

| Service | Source mount | Watcher | Reload approach |
|---------|--------------|---------|-----------------|
| Backend | `./backend/{app,alembic,tests}` → `/app/*` | uvicorn `--reload --reload-dir /app` | Watchfiles (Rust) detect file change → restart worker. Watchfiles handle polling otomatis kalau native FS events tidak reliable. |
| Frontend | `./frontend` → `/app` (full) | Next.js webpack watcher + `WATCHPACK_POLLING=true` + `CHOKIDAR_USEPOLLING=true` | HMR (Hot Module Replacement) tanpa full page reload |

**macOS VirtioFS quirk**: file change events kadang tidak propagate sempurna ke Linux container kernel. Solusi: env vars polling untuk frontend webpack/chokidar. Backend uvicorn pakai `watchfiles` Rust library yang sudah handle ini.

### `Makefile` (convenience)

```makefile
.PHONY: dev dev-build dev-down dev-logs dev-shell-backend dev-shell-frontend dev-restart-backend dev-restart-frontend migrate test help

# Default target — show help
help:
	@echo "Smart Finance — dev commands:"
	@echo "  make dev                    Start full stack (build kalau perlu)"
	@echo "  make dev-build              Force rebuild images (no cache)"
	@echo "  make dev-down               Stop all containers"
	@echo "  make dev-logs               Tail backend + frontend logs"
	@echo "  make dev-shell-backend      bash inside backend container"
	@echo "  make dev-shell-frontend     sh inside frontend container"
	@echo "  make dev-restart-backend    Restart just backend (e.g. after env change)"
	@echo "  make dev-restart-frontend   Restart just frontend"
	@echo "  make migrate                Run alembic upgrade head inside backend"
	@echo "  make test                   Run pytest inside backend container"

# Start full dev stack
dev:
	docker compose up -d --build
	@echo ""
	@echo "✓ Stack running:"
	@echo "  Frontend:  http://localhost"
	@echo "  Backend:   http://api.localhost"
	@echo "  API docs:  http://api.localhost/docs"
	@echo "  Postgres:  localhost:5432 (postgres/postgres/financeai)"
	@echo "  Qdrant:    localhost:6333"
	@echo ""
	@echo "Tail logs: make dev-logs"

dev-build:
	docker compose build --no-cache

dev-down:
	docker compose down

dev-logs:
	docker compose logs -f backend frontend

dev-shell-backend:
	docker compose exec backend bash

dev-shell-frontend:
	docker compose exec frontend sh

dev-restart-backend:
	docker compose restart backend

dev-restart-frontend:
	docker compose restart frontend

migrate:
	docker compose exec backend alembic upgrade head

test:
	docker compose exec backend pytest tests/ -v
```

### Environment variables

Root `.env` untuk compose (sudah ada — verify):
```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=financeai
NEXT_PUBLIC_API_URL=http://api.localhost
```

Backend `backend/.env` (sudah ada — tidak diubah):
```bash
GROQ_API_KEY=...
JWT_SECRET_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
# DATABASE_URL akan di-override compose ke service name (postgres) instead of localhost
# QDRANT_URL same
```

**Catatan**: `DATABASE_URL` di `backend/.env` mungkin pakai `localhost:5432` (untuk native dev mode). Compose override **set ulang** ke `postgres:5432` (service name di container network). Tidak perlu edit `.env`.

### Migration & data persistence

- `postgres_data` named volume — data survive `docker compose down`. Hilang kalau pakai `docker compose down -v`.
- `qdrant_data` named volume — sama.
- `backend_uploads` named volume — uploaded files persist.
- Alembic migration: pakai `make migrate` (= `docker compose exec backend alembic upgrade head`). Pertama kali setup, jalankan ini setelah `make dev` untuk apply semua migrations ke DB.
- Existing dev DB (kalau user pernah pakai `docker compose up -d postgres qdrant` sebelumnya): data **tetap ada** karena pakai volume yang sama (`postgres_data`).

### Performance expectations

| Scenario | Estimated time |
|----------|----------------|
| First `make dev` (cold, full build) | 3-5 menit (download base images + `pip install` + `pnpm install`) |
| Second+ `make dev` (images cached) | 8-15 detik (cuma container start) |
| Backend code change → uvicorn reload | 1-3 detik |
| Frontend code change → Next HMR | <1 detik (kalau HMR) atau 1-5 detik (kalau full route reload) |
| `make dev-down` + `make dev` cycle | ~15 detik |
| After macOS idle 1 minggu, `make dev` | ~15 detik (image layers di Docker overlay fs, immune dari Spotlight) |

Bandingkan dengan native: cold-start setelah idle 2 minggu = **6 menit** (per quirk dokumentasi 2026-05-27). Docker stays consistent.

## Risks & mitigations

1. **Port 80 conflict** — kalau ada web server lain di host (Apache, nginx, lain) di port 80, Caddy tidak bisa bind.
   - Mitigation: `lsof -iTCP:80 -sTCP:LISTEN` cek dulu sebelum `make dev`. Kalau ada conflict, error message Docker akan jelas.

2. **Macbook VirtioFS HMR reliability** — file change events kadang tidak terdeteksi.
   - Mitigation: `WATCHPACK_POLLING=true` + `CHOKIDAR_USEPOLLING=true`. Polling lebih CPU-heavy tapi reliable.

3. **`api.localhost` tidak resolve di Safari versi lama** — Safari <13 tidak handle RFC 6761.
   - Mitigation: User pakai Safari modern atau Chrome. Tidak perlu edit `/etc/hosts`.

4. **Disk space** — Docker images + volumes bisa makan 5-10 GB.
   - Mitigation: Docker Desktop default reserve 64GB. Cukup. Periodic cleanup: `docker system prune -a`.

5. **Backend `.env` tidak ada saat first start** — `env_file: ./backend/.env` di compose akan fail.
   - Mitigation: spec doc + plan akan instruct copy from `.env.example` saat first setup.

6. **First run alembic belum jalan** — backend uvicorn boot tapi DB schema kosong → 500 errors.
   - Mitigation: README/plan instruct `make migrate` setelah first `make dev`. Atau tambah migrate ke startup script (defer).

## Testing strategy

Manual smoke test checklist (PM/saya jalankan setelah agent selesai):

- [ ] `make dev` first time — build success, 5 containers up
- [ ] `docker compose ps` — semua status `running`, healthy
- [ ] `curl http://localhost/` returns 200 + HTML (frontend)
- [ ] `curl http://api.localhost/docs` returns 200 + Swagger UI HTML
- [ ] `curl -X POST http://api.localhost/v1/auth/register -H "Content-Type: application/json" -d '{"email":"smoke@example.com","password":"test12345","name":"Smoke"}'` returns 201
- [ ] Login dari frontend di browser http://localhost — sukses
- [ ] Edit `backend/app/main.py` (tambah `print("hot reload test")` di module load) → log muncul di `make dev-logs`
- [ ] Edit `frontend/app/(app)/dashboard/page.tsx` → HMR trigger, browser auto-update tanpa full reload
- [ ] `make migrate` — alembic apply success
- [ ] `make test` — pytest run, 163 passed + 10 skipped
- [ ] `make dev-down` then `make dev` — restart <15 detik
- [ ] Open Postico ke `localhost:5432`, db `financeai` — connection success
- [ ] `curl http://localhost:6333/collections` — Qdrant accessible

## Verification (post-implementation, PM/main session)

1. All manual smoke test items pass
2. Cek `docker stats` selama 1-2 menit — memory + CPU reasonable (backend ~200MB, frontend ~400MB, postgres ~50MB, qdrant ~400MB, caddy ~30MB)
3. Trigger hot reload backend + frontend, lihat latency
4. Sengaja bikin Spotlight aktif (mis. `mdimport` something), confirm Docker stays fast

## Out of scope (defer)

- Production frontend Dockerfile (defer to deploy phase)
- Multi-stage build optimization (defer)
- CI/CD GitHub Actions (separate spec)
- Devcontainer JSON for VS Code (nice-to-have)
- Postgres + Qdrant tuning (defaults cukup)
- Backup strategy untuk volumes (defer)
- GPU acceleration vision (irrelevant)
- Auto-run migration on startup (defer, manual `make migrate`)
