"""Alembic env, async-aware.

DATABASE_URL diambil dari app.config.Settings (yang load .env).
Alembic dijalankan via async engine + run_sync — tidak butuh psycopg.
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import semua models supaya ke-register di Base.metadata.
from app.config import get_settings
from app.database import Base
from app.users.models import User  # noqa: F401
from app.auth.models import RefreshToken  # noqa: F401
from app.accounts.models import Account  # noqa: F401
from app.transactions.models import Transaction  # noqa: F401
from app.budgets.models import Budget  # noqa: F401
from app.holdings.models import StockHolding  # noqa: F401
from app.import_data.models import ImportJob, ImportRow  # noqa: F401


config = context.config

if config.config_file_name is not None:
	fileConfig(config.config_file_name)

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
	url = config.get_main_option("sqlalchemy.url")
	context.configure(
		url=url,
		target_metadata=target_metadata,
		literal_binds=True,
		dialect_opts={"paramstyle": "named"},
		compare_type=True,
	)
	with context.begin_transaction():
		context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
	context.configure(
		connection=connection,
		target_metadata=target_metadata,
		compare_type=True,
	)
	with context.begin_transaction():
		context.run_migrations()


async def run_async_migrations() -> None:
	connectable = async_engine_from_config(
		config.get_section(config.config_ini_section, {}),
		prefix="sqlalchemy.",
		poolclass=pool.NullPool,
	)
	async with connectable.connect() as connection:
		await connection.run_sync(do_run_migrations)
	await connectable.dispose()


def run_migrations_online() -> None:
	asyncio.run(run_async_migrations())


if context.is_offline_mode():
	run_migrations_offline()
else:
	run_migrations_online()
