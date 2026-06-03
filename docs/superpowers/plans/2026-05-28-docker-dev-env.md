# Docker Dev Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full Docker-based local dev environment (backend + frontend + caddy + postgres + qdrant) yang isolated dari macOS background tasks — solve uvicorn cold-start 6-min hell yang muncul setelah project idle lama.

**Architecture:** 5 containers di compose network internal. Hanya Caddy yang expose port 80 ke host. Backend pakai `Dockerfile.dev` (pip install deps di image layer, source bind-mount untuk uvicorn `--reload`). Frontend pakai `Dockerfile.dev` (pnpm install di image, source bind-mount untuk Next HMR, node_modules named volume untuk shadow bind mount). Caddy reverse-proxy `localhost` → frontend, `api.localhost` → backend. `Makefile` sebagai convenience wrapper.

**Tech Stack:** Docker Compose v3.8, python:3.12-slim, node:20-alpine, pnpm, caddy:2-alpine, postgres:16-alpine, qdrant:latest, GNU Make.

**Spec reference:** `docs/superpowers/specs/2026-05-28-docker-dev-env-design.md`

**Commit policy (project memory override):** Agent does NOT commit per task. Run verification commands at end of each task and confirm green. PM (main session) does ONE final commit after full verification, format `feat: docker dev environment with hot reload` (no scope, no co-author trailer). Agent must never run `git commit` or `git push`.

**Working directory:** `/Users/bagusdeva/Documents/Personal Projects/smart-finance`. All paths in this plan relative to this root.

**Branch:** `feat/docker-dev-env` (already created by PM).

**Indentation:** Dockerfiles + YAML use 2-space indentation (standard). Makefile uses TAB (required by Make).

**Pre-flight assumptions verified by PM before plan written:**
- `docker-compose.yml` exists with prod services (caddy, frontend, backend, postgres, qdrant)
- `docker-compose.override.yml` exists with only postgres+qdrant port exposure
- `Caddyfile.dev` exists with localhost routing config (no TLS)
- `backend/Dockerfile` exists (production-style)
- `frontend/Dockerfile` does NOT exist
- `backend/.env` exists (gitignored, contains GROQ_API_KEY etc.)
- Root `.env` exists (gitignored, contains POSTGRES_USER/PASSWORD/DB + NEXT_PUBLIC_API_URL)

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `backend/Dockerfile.dev` | CREATE | Dev image: python:3.12-slim + pip install requirements + uvicorn --reload CMD |
| `backend/.dockerignore` | CREATE | Exclude venv, __pycache__, .pyc, sensitive fixtures, .env from image build context |
| `frontend/Dockerfile.dev` | CREATE | Dev image: node:20-alpine + pnpm + pnpm install + `pnpm dev` CMD |
| `frontend/.dockerignore` | CREATE | Exclude node_modules, .next, dist, .env*.local from build context |
| `docker-compose.override.yml` | MODIFY (extend) | Add caddy + frontend + backend service overrides with bind-mounts + named volumes |
| `Makefile` | CREATE | Convenience wrapper for common docker compose operations |

**NOT modified:** `docker-compose.yml`, `Caddyfile`, `Caddyfile.dev`, `backend/Dockerfile`, source code, `.env`, `.env.example`.

---

## Task 1: Create `backend/Dockerfile.dev` and `backend/.dockerignore`

Goal: dev image untuk backend yang install Python deps di image layer (immune dari host filesystem cold-cache).

**Files:**
- Create: `backend/Dockerfile.dev`
- Create: `backend/.dockerignore`

- [ ] **Step 1: Create `backend/.dockerignore`**

Create file at `backend/.dockerignore` with content:

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

This prevents host's `venv/` (Python 3.12 from native dev) from being copied into image context during build (would conflict with image's installed packages + slow build).

- [ ] **Step 2: Create `backend/Dockerfile.dev`**

Create file at `backend/Dockerfile.dev` with content:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps for pdfplumber/PyMuPDF + dev utilities (curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
	build-essential curl \
	&& rm -rf /var/lib/apt/lists/*

# Install Python deps in image layer (NOT bind-mounted from host venv)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Source code di-bind mount via compose, jadi tidak COPY di sini.
# (Production Dockerfile yang COPY semua untuk image yang self-contained.)

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app"]
```

- [ ] **Step 3: Build the backend dev image standalone (verify Dockerfile is valid)**

Run from project root:

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker build -t smart-finance-backend-dev:test -f backend/Dockerfile.dev backend/
```

Expected: build succeeds. Last line includes `Successfully built` or `naming to docker.io/library/smart-finance-backend-dev:test`. Should take 2-4 minutes first time (downloads python:3.12-slim, installs deps). If `pip install` fails on any package, STOP and report which package — likely missing system dep in `apt-get install` list.

- [ ] **Step 4: Quick smoke-test the image**

```bash
docker run --rm smart-finance-backend-dev:test python -c "import fastapi, sqlalchemy, pdfplumber, fitz, groq; print('all imports OK')"
```

Expected output: `all imports OK`. If `ModuleNotFoundError`, check `requirements.txt` actually has the missing module (don't add — report instead).

- [ ] **Step 5: Cleanup test image**

```bash
docker rmi smart-finance-backend-dev:test
```

Expected: image deleted. Don't worry about cleanup if it fails.

---

## Task 2: Create `frontend/Dockerfile.dev` and `frontend/.dockerignore`

Goal: dev image untuk frontend yang install node deps di image layer.

**Files:**
- Create: `frontend/Dockerfile.dev`
- Create: `frontend/.dockerignore`

- [ ] **Step 1: Create `frontend/.dockerignore`**

Create file at `frontend/.dockerignore` with content:

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
.DS_Store
```

- [ ] **Step 2: Create `frontend/Dockerfile.dev`**

Create file at `frontend/Dockerfile.dev` with content:

```dockerfile
FROM node:20-alpine

# Enable corepack (which provides pnpm)
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install deps in image layer (NOT bind-mounted)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source code di-bind mount via compose

EXPOSE 3000

CMD ["pnpm", "dev"]
```

- [ ] **Step 3: Build the frontend dev image standalone**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker build -t smart-finance-frontend-dev:test -f frontend/Dockerfile.dev frontend/
```

Expected: build succeeds. Should take 3-6 minutes first time (downloads node:20-alpine, pnpm install of large dep tree).

If `pnpm install` fails with peer dep error or lockfile mismatch: STOP and report. Don't try `--no-frozen-lockfile` (that would mask drift).

- [ ] **Step 4: Quick smoke-test the image**

```bash
docker run --rm smart-finance-frontend-dev:test sh -c "pnpm --version && node --version && ls node_modules | wc -l"
```

Expected: prints pnpm version (10.x), node version (v20.x), and a number of installed packages (likely 400-600). If `ls: node_modules: No such file or directory`, pnpm install silently failed — STOP and report.

- [ ] **Step 5: Cleanup test image**

```bash
docker rmi smart-finance-frontend-dev:test
```

---

## Task 3: Extend `docker-compose.override.yml`

Goal: add caddy + frontend + backend service overrides with bind-mounts, named volumes, and env vars. PRESERVE existing postgres+qdrant port mappings.

**Files:**
- Modify: `docker-compose.override.yml`

- [ ] **Step 1: Read current override**

```bash
cat /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/docker-compose.override.yml
```

Expected content:

```yaml
# Local development override.
# Auto-loaded by `docker compose` on top of docker-compose.yml.
# Exposes Postgres and Qdrant to the host so you can run uvicorn/alembic locally.

services:
  postgres:
    ports:
      - "5432:5432"

  qdrant:
    ports:
      - "6333:6333"
```

- [ ] **Step 2: Replace entire file with extended version**

Use Write tool on `docker-compose.override.yml` with full new content:

```yaml
# Local development override.
# Auto-loaded by `docker compose` on top of docker-compose.yml.
# Full Docker dev: backend + frontend + caddy + postgres + qdrant.
# Backend dan frontend pakai Dockerfile.dev dengan source code bind-mount + HMR.

services:
  caddy:
    volumes:
      - ./Caddyfile.dev:/etc/caddy/Caddyfile
    # Dev: hanya port 80 (no TLS auto). Override prod compose's "443:443" by
    # explicitly redeclaring ports (compose merges by key — we replace).
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
      # Uploads sebagai writable named volume (jangan di host filesystem)
      - backend_uploads:/app/uploads
    env_file:
      - ./backend/.env
    environment:
      # Override DB + Qdrant URL untuk pakai container network service names
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

- [ ] **Step 3: Validate compose file syntax**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose config --quiet
```

Expected: exit 0, no output. If error: YAML syntax problem OR env var reference unresolved. Common issue: root `.env` missing `POSTGRES_USER`/`POSTGRES_PASSWORD`/`POSTGRES_DB`. Check with `cat .env | grep POSTGRES`. If those vars missing, STOP and report — don't fabricate values.

- [ ] **Step 4: View resolved config (sanity check)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose config 2>&1 | grep -E "image:|build:|ports:|command:" | head -30
```

Expected: shows caddy with `Caddyfile.dev` mounted, frontend + backend with `dockerfile: Dockerfile.dev`, postgres + qdrant ports, backend command with `--reload`.

---

## Task 4: Create `Makefile` convenience wrapper

Goal: single-command interface untuk operasi umum.

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Create Makefile at project root**

Create file at `Makefile` (root, not inside backend/frontend). **CRITICAL: use TAB indentation, not spaces** — Make requires tabs and will error otherwise.

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
	@echo "Stack running:"
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

- [ ] **Step 2: Verify Makefile parses (no tab/space errors)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make help
```

Expected: prints help text listing all commands. If you see `Makefile:N: *** missing separator. Stop.`, the indentation got spaces instead of tabs — re-write with Edit tool ensuring each command line under a target starts with a literal TAB character.

- [ ] **Step 3: Verify `make dev` target syntax (dry-run, don't actually start containers yet)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make -n dev
```

Expected output:
```
docker compose up -d --build
echo ""
echo "Stack running:"
... (rest of echo statements)
```

The `-n` flag prints commands without executing. Confirms target is parseable.

---

## Task 5: Full stack smoke test

Goal: actually run `make dev`, verify all 5 containers come up and respond to requests.

**Files:** (none modified — runtime verification only)

- [ ] **Step 1: Confirm prerequisites**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && ls .env backend/.env Caddyfile.dev 2>&1
```

Expected: all three files exist. If any missing, STOP and report — don't fabricate.

```bash
lsof -iTCP:80 -sTCP:LISTEN -n 2>/dev/null | head -3
```

Expected: empty output (no listener on port 80). If something else is listening on :80 (Apache, nginx, etc.), STOP and report — Caddy can't bind.

```bash
docker compose ps 2>&1 | head
```

If existing containers from project are running (postgres/qdrant from prior native dev session), they'll be replaced when full stack starts. That's OK.

- [ ] **Step 2: Stop any partial running containers first**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && docker compose down
```

Expected: exit 0, removes any prior containers. Volumes persist.

- [ ] **Step 3: Build + start full stack**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && time make dev
```

Expected: builds backend + frontend images (3-6 minutes first time), starts all 5 services, prints `Stack running:` banner. Total wall time: 5-10 minutes first build.

If build fails, log will show which service. Common issues:
- `pnpm install` lockfile drift → report, don't fix automatically
- `pip install` missing system dep → report
- Port 80 in use → already handled in Step 1

- [ ] **Step 4: Verify all containers up**

```bash
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
```

Expected: 5 rows (caddy, frontend, backend, postgres, qdrant) all `running` or `Up`. Postgres should also show `(healthy)`.

If any container is `Restarting` or `Exited`: STOP and report. Run `docker compose logs <service>` to capture errors.

- [ ] **Step 5: Health check via curl**

```bash
echo "--- Caddy ---" && curl -s -o /dev/null -w "GET http://localhost/  → HTTP %{http_code}, %{time_total}s\n" http://localhost/
echo "--- Backend Swagger ---" && curl -s -o /dev/null -w "GET http://api.localhost/docs  → HTTP %{http_code}, %{time_total}s\n" http://api.localhost/docs
echo "--- Postgres ---" && docker compose exec -T postgres pg_isready -U postgres
echo "--- Qdrant ---" && curl -s http://localhost:6333/collections 2>&1 | head -c 200
```

Expected:
- Caddy: `HTTP 200` (frontend HTML) — first hit may take 10-20s (Next dev first compile)
- Swagger: `HTTP 200`
- Postgres: `accepting connections`
- Qdrant: JSON response listing collections (likely just `financeai_transactions` if migrated)

If frontend HTTP returns 502 Bad Gateway: frontend hasn't finished compiling. Wait 30s, retry.

- [ ] **Step 6: Run migrations (first-time setup)**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make migrate
```

Expected: alembic prints `Running upgrade ... -> c524e0da4585, add pdf_bni source type` (or current head) OR `INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.` followed by no upgrade messages if already at head.

- [ ] **Step 7: Run pytest in container**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && make test 2>&1 | tail -5
```

Expected: `163 passed, 10 skipped` or close. The 10 skipped are live integration tests gated by `VISION_TEST_LIVE=1`. If significantly fewer tests pass, something is wrong with the container's test bootstrap — report.

- [ ] **Step 8: Verify hot reload — backend**

```bash
# Capture current first line of app/main.py
head -1 /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/app/main.py

# Touch the file (changes mtime, triggers watchfiles)
touch /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/backend/app/main.py

# Check backend logs for reload message
sleep 3 && docker compose logs --tail 5 backend 2>&1 | grep -i "reload\|reloading\|detected change" | head -3
```

Expected: logs show `WARNING:  WatchFiles detected changes in 'app/main.py'. Reloading...` or similar. If no reload message, polling isn't working — report.

- [ ] **Step 9: Verify hot reload — frontend**

```bash
# Touch a frontend file
touch /Users/bagusdeva/Documents/Personal\ Projects/smart-finance/frontend/app/\(app\)/dashboard/page.tsx

# Check frontend logs for compile message
sleep 5 && docker compose logs --tail 10 frontend 2>&1 | grep -iE "compiled|compiling|recompiled" | head -3
```

Expected: logs show `compiled in Xs` or `compiling...`. If no compile message, the watcher isn't seeing changes — verify `WATCHPACK_POLLING=true` env is set: `docker compose exec frontend env | grep WATCHPACK`.

- [ ] **Step 10: Verify register endpoint end-to-end**

```bash
curl -s -X POST http://api.localhost/v1/auth/register \
	-H "Content-Type: application/json" \
	-d '{"email":"smoke-docker@example.com","password":"testtest123","name":"Docker Smoke"}' \
	-w "\nHTTP %{http_code}\n" | tail -5
```

Expected: HTTP 201 + JSON response with user fields (id, email, name). If duplicate email error from prior session, change the email or skip — endpoint reachability already confirmed by Swagger.

---

## Task 6: Final verification + report

Goal: report state to PM.

**Files:** (none modified)

- [ ] **Step 1: Capture docker stats snapshot**

```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

Expected: 5 rows. Memory roughly:
- backend: 150-300 MB
- frontend: 300-500 MB (Next dev is heavy)
- caddy: <50 MB
- postgres: 30-80 MB
- qdrant: 300-500 MB

If anything is using >2 GB, something is wrong — report.

- [ ] **Step 2: Git status**

```bash
cd /Users/bagusdeva/Documents/Personal\ Projects/smart-finance && git status
```

Expected modified/new files:
- New: `backend/Dockerfile.dev`, `backend/.dockerignore`, `frontend/Dockerfile.dev`, `frontend/.dockerignore`, `Makefile`
- Modified: `docker-compose.override.yml`

NOT committed.

- [ ] **Step 3: Output final report**

Output a single summary block with:
- ✅/❌ per task (1-6)
- Image build times (backend, frontend) from Task 5 Step 3
- `make dev` total time (cold first build)
- `docker compose ps` final state (5 containers running)
- Hot reload verification: backend ✅/❌, frontend ✅/❌
- Migration: applied successfully? Head revision id
- Pytest in container: `X passed, Y skipped`
- Health checks: Caddy ✅, Swagger ✅, Postgres ✅, Qdrant ✅
- Smoke test: register endpoint HTTP 201 ✅
- Docker stats memory totals
- List of created/modified files
- Any deviation from plan (e.g. had to add a system dep, had to change a port, frontend HMR needed extra config)
- Concerns for PM (e.g. lockfile drift, image rebuild needed, etc.)

If anything failed, DON'T attempt to fix it — STOP and report so PM can decide.

---

## Self-Review Notes (internal — not for agent)

**Spec coverage check:**
- Goal 1 (full Docker dev stack): Tasks 1-5 implement ✓
- Goal 2 (isolation from macOS bg): venv/node_modules in image layer per Task 1 + Task 2 ✓
- Goal 3 (hot reload): Backend `--reload` (Task 1 CMD), Frontend `WATCHPACK_POLLING` (Task 3 env vars), verified in Task 5 Steps 8-9 ✓
- Goal 4 (Caddy routing matches prod): Task 3 mounts `Caddyfile.dev`, verified via Task 5 Step 5 curl `api.localhost` ✓
- Goal 5 (Makefile wrapper): Task 4 ✓
- Goal 6 (prod files untouched): Plan explicitly only modifies `docker-compose.override.yml`, creates new dev files ✓

**Non-goals respected:**
- No production frontend Dockerfile (Task 2 only creates `Dockerfile.dev`)
- No multi-stage build
- No CI/CD changes
- No backup strategy
- No auto-migrate on startup (manual `make migrate` per Task 5 Step 6)

**Placeholder scan:** No TBD/TODO. All code blocks are complete. All commands have expected outputs.

**Type consistency:**
- Image names consistent (`smart-finance-backend-dev:test`, `smart-finance-frontend-dev:test` — only used in Task 1/2 build smoke, deleted after)
- Volume names consistent across Task 3 (declared in `volumes:` block + referenced in services)
- Container service names match across Tasks 3, 4, 5 (`backend`, `frontend`, `caddy`, `postgres`, `qdrant`)
- Env var names match `.env` file expectations (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)

**Risks the agent should report on:**
1. **pnpm-lock.yaml drift** — if `pnpm install --frozen-lockfile` fails, lockfile out of sync with package.json. Don't auto-fix; report.
2. **Port 80 conflict** — if another service uses :80, Caddy fails. Plan explicitly checks in Task 5 Step 1.
3. **Postgres existing data** — if user previously ran `docker compose up postgres qdrant`, data in `postgres_data` volume persists. Migrations should be idempotent — `make migrate` should be safe.
4. **First Next.js compile time** — frontend container starts fast but `pnpm dev` first request triggers ~30s compile of all routes. Curl in Step 5 might 502 if hit too early. Plan instructs retry after 30s.
5. **Backend `.env` missing** — Plan checks in Task 5 Step 1.
6. **Existing user's terminal `uvicorn`** — if user still has uvicorn running natively on port 8000, conflict only at host level (not in container). Container's backend talks to `postgres:5432` internally; the host's :5432 from native dev would conflict with override port mapping in Task 3 if native uvicorn isn't shut down. Plan instructs `docker compose down` in Task 5 Step 2 which handles container-side.
