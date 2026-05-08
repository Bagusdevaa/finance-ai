"""FastAPI app factory.

App di-instantiate sekali di module-level (dipakai uvicorn).
Semua wiring (CORS, exception handler, middleware, routers) dilakukan di sini.
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.accounts.router import router as accounts_router
from app.ai.qdrant import ensure_collection
from app.auth.router import router as auth_router
from app.budgets.router import router as budgets_router
from app.chat.router import router as chat_router
from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.health import router as health_router
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware
from app.holdings.router import router as holdings_router
from app.import_data.router import router as import_router
from app.transactions.router import router as transactions_router


_logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
	# Best-effort: kalau Qdrant down, AI features degrade tapi app tetap boot.
	try:
		await ensure_collection()
	except Exception as exc:
		_logger.warning("qdrant_init_failed", error=str(exc))
	yield


def create_app() -> FastAPI:
	configure_logging()
	settings = get_settings()

	app = FastAPI(
		title="FinanceAI API",
		version="0.1.0",
		description="Personal finance platform untuk pasar Indonesia.",
		lifespan=lifespan,
	)

	# CORS — frontend Next.js di FRONTEND_URL.
	app.add_middleware(
		CORSMiddleware,
		allow_origins=[settings.FRONTEND_URL],
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)
	app.add_middleware(RequestLoggingMiddleware)

	register_exception_handlers(app)

	app.include_router(health_router)
	app.include_router(auth_router, prefix="/v1/auth", tags=["auth"])
	app.include_router(accounts_router, prefix="/v1/accounts", tags=["accounts"])
	app.include_router(transactions_router, prefix="/v1/transactions", tags=["transactions"])
	app.include_router(budgets_router, prefix="/v1/budgets", tags=["budgets"])
	app.include_router(holdings_router, prefix="/v1/holdings", tags=["holdings"])
	app.include_router(import_router, prefix="/v1/import", tags=["import"])
	app.include_router(chat_router, prefix="/v1/chat", tags=["chat"])

	return app


app = create_app()
