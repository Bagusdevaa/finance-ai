"""Structlog config.

Production: JSON renderer, ready buat di-pipe ke log aggregator.
Development: pretty console renderer biar gampang dibaca pas debug.
"""

import logging
import sys

import structlog

from app.config import get_settings


def configure_logging() -> None:
	settings = get_settings()
	level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

	# Set stdlib logging supaya library lain (uvicorn, sqlalchemy) ikut format.
	logging.basicConfig(
		format="%(message)s",
		stream=sys.stdout,
		level=level,
	)

	shared_processors: list = [
		structlog.contextvars.merge_contextvars,
		structlog.processors.add_log_level,
		structlog.processors.TimeStamper(fmt="iso", utc=True),
		structlog.processors.StackInfoRenderer(),
		structlog.processors.format_exc_info,
	]

	if settings.is_production:
		renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
	else:
		renderer = structlog.dev.ConsoleRenderer(colors=True)

	structlog.configure(
		processors=[*shared_processors, renderer],
		wrapper_class=structlog.make_filtering_bound_logger(level),
		logger_factory=structlog.PrintLoggerFactory(),
		cache_logger_on_first_use=True,
	)
