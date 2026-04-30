"""Request logging middleware.

Tujuannya supaya tiap request kelihatan di log dengan duration.
Pakai structlog supaya output konsisten dengan logger lain.
"""

import time

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


logger = structlog.get_logger("http")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
	async def dispatch(self, request: Request, call_next) -> Response:
		start = time.perf_counter()
		try:
			response = await call_next(request)
		except Exception:
			# Log + re-raise; exception handler nanti yang bentuk response.
			duration_ms = (time.perf_counter() - start) * 1000
			logger.exception(
				"request_failed",
				method=request.method,
				path=request.url.path,
				duration_ms=round(duration_ms, 2),
			)
			raise

		duration_ms = (time.perf_counter() - start) * 1000
		logger.info(
			"request",
			method=request.method,
			path=request.url.path,
			status=response.status_code,
			duration_ms=round(duration_ms, 2),
		)
		return response
