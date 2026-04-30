"""FastAPI app factory.

App di-instantiate sekali di module-level (dipakai uvicorn).
Semua wiring (CORS, exception handler, middleware, routers) dilakukan di sini.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.health import router as health_router
from app.core.logging import configure_logging
from app.core.middleware import RequestLoggingMiddleware


def create_app() -> FastAPI:
	configure_logging()
	settings = get_settings()

	app = FastAPI(
		title="FinanceAI API",
		version="0.1.0",
		description="Personal finance platform untuk pasar Indonesia.",
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

	return app


app = create_app()
