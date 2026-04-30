"""Error types + handler registration.

Format response selalu:
{"error": {"code": "ERROR_CODE", "message": "...", "details": {}}}

Frontend bergantung pada bentuk ini, jangan diubah tanpa koordinasi.
"""

from typing import Any

import structlog
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


logger = structlog.get_logger(__name__)


class AppError(Exception):
	"""Base error untuk semua kesalahan domain."""

	code: str = "INTERNAL_ERROR"
	message: str = "Internal server error"
	status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR

	def __init__(
		self,
		code: str | None = None,
		message: str | None = None,
		details: dict[str, Any] | None = None,
		status_code: int | None = None,
	):
		self.code = code or self.code
		self.message = message or self.message
		self.details = details or {}
		self.status_code = status_code or self.status_code
		super().__init__(self.message)


class NotFoundError(AppError):
	code = "NOT_FOUND"
	message = "Resource not found"
	status_code = status.HTTP_404_NOT_FOUND


class UnauthorizedError(AppError):
	code = "UNAUTHORIZED"
	message = "Authentication required"
	status_code = status.HTTP_401_UNAUTHORIZED


class ForbiddenError(AppError):
	code = "FORBIDDEN"
	message = "Operation not allowed"
	status_code = status.HTTP_403_FORBIDDEN


class ValidationError(AppError):
	code = "VALIDATION_ERROR"
	message = "Invalid input"
	status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


class ConflictError(AppError):
	code = "CONFLICT"
	message = "Resource conflict"
	status_code = status.HTTP_409_CONFLICT


def _error_payload(code: str, message: str, details: dict[str, Any]) -> dict[str, Any]:
	return {"error": {"code": code, "message": message, "details": details}}


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
	return JSONResponse(
		status_code=exc.status_code,
		content=_error_payload(exc.code, exc.message, exc.details),
	)


async def _validation_handler(
	request: Request, exc: RequestValidationError
) -> JSONResponse:
	# Pydantic returns list of error dicts; bungkus sebagai details["errors"].
	return JSONResponse(
		status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
		content=_error_payload(
			"VALIDATION_ERROR",
			"Invalid input",
			{"errors": exc.errors()},
		),
	)


async def _unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
	# Jangan bocorkan stacktrace ke client; log full di server side.
	logger.exception("unhandled_exception", path=request.url.path)
	return JSONResponse(
		status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
		content=_error_payload("INTERNAL_ERROR", "Internal server error", {}),
	)


def register_exception_handlers(app: FastAPI) -> None:
	app.add_exception_handler(AppError, _app_error_handler)
	app.add_exception_handler(RequestValidationError, _validation_handler)
	app.add_exception_handler(Exception, _unhandled_handler)
