"""Store COD delivery details with an order.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-15
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # Nullable first preserves existing demo/legacy orders; all new checkout
    # requests are validated by CheckoutRequest before an order is created.
    op.add_column("orders", sa.Column("customer_name", sa.String(200), nullable=True))
    op.add_column("orders", sa.Column("customer_phone", sa.String(20), nullable=True))
    op.add_column("orders", sa.Column("delivery_address", sa.String(1000), nullable=True))
    op.add_column("orders", sa.Column("delivery_city", sa.String(120), nullable=True))
    op.add_column("orders", sa.Column("order_notes", sa.String(1000), nullable=True))


def downgrade() -> None:
    op.drop_column("orders", "order_notes")
    op.drop_column("orders", "delivery_city")
    op.drop_column("orders", "delivery_address")
    op.drop_column("orders", "customer_phone")
    op.drop_column("orders", "customer_name")
