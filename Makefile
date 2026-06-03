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
	@docker compose exec -T postgres psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='financeai_test'" | grep -q 1 || \
		docker compose exec -T postgres createdb -U postgres financeai_test
	docker compose exec backend pytest tests/ -v
