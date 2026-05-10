"""add pdf_bni source type

Revision ID: c524e0da4585
Revises: f359acc39754
Create Date: 2026-05-10 09:57:18.560720+00:00

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c524e0da4585'
down_revision: Union[str, None] = 'f359acc39754'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Postgres tidak mengizinkan ALTER TYPE ADD VALUE di dalam transaction block.
# Set per-migration to disable transactional DDL for this revision.
def upgrade() -> None:
	with op.get_context().autocommit_block():
		op.execute("ALTER TYPE import_source_type ADD VALUE IF NOT EXISTS 'pdf_bni'")


def downgrade() -> None:
	# Postgres tidak punya cara native untuk DROP VALUE dari enum tanpa
	# rebuild type. Skip downgrade — enum value yang tidak terpakai aman.
	pass
