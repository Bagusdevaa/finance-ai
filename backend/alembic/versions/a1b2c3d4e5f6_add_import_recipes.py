"""add import_recipes

Revision ID: a1b2c3d4e5f6
Revises: 39bc2d1423f7
Create Date: 2026-06-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '39bc2d1423f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'import_recipes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('fingerprint', sa.String(length=64), nullable=False),
        sa.Column('source_label', sa.String(length=100), nullable=False, server_default=''),
        sa.Column('recipe_json', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('schema_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('confidence', sa.Numeric(precision=3, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_import_recipes_fingerprint'),
        'import_recipes',
        ['fingerprint'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_import_recipes_fingerprint'), table_name='import_recipes')
    op.drop_table('import_recipes')
