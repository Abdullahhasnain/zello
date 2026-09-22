"""Module 3: catalog extensions (categories, brands, variants, images,
inventory) and conversation context memory.

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-18

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    # ---- categories ----
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_categories_tenant_id_tenants", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], name="fk_categories_parent_id_categories", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name="pk_categories"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_categories_tenant_id_slug"),
    )
    op.create_index("ix_categories_tenant_id", "categories", ["tenant_id"])

    # ---- brands ----
    op.create_table(
        "brands",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_brands_tenant_id_tenants", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_brands"),
        sa.UniqueConstraint("tenant_id", "slug", name="uq_brands_tenant_id_slug"),
    )
    op.create_index("ix_brands_tenant_id", "brands", ["tenant_id"])

    # ---- products: add category_id / brand_id ----
    op.add_column("products", sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("products", sa.Column("brand_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_products_category_id_categories", "products", "categories", ["category_id"], ["id"], ondelete="SET NULL"
    )
    op.create_foreign_key(
        "fk_products_brand_id_brands", "products", "brands", ["brand_id"], ["id"], ondelete="SET NULL"
    )

    # ---- product_variants ----
    op.create_table(
        "product_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("attributes", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("stock_qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_product_variants_tenant_id_tenants", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="fk_product_variants_product_id_products", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_product_variants"),
        sa.UniqueConstraint("product_id", "sku", name="uq_product_variants_product_id_sku"),
    )
    op.create_index("ix_product_variants_tenant_id", "product_variants", ["tenant_id"])
    op.create_index("ix_product_variants_product_id", "product_variants", ["product_id"])

    # ---- product_images ----
    op.create_table(
        "product_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("url", sa.String(500), nullable=False),
        sa.Column("alt_text", sa.String(300), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_product_images_tenant_id_tenants", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="fk_product_images_product_id_products", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_product_images"),
    )
    op.create_index("ix_product_images_tenant_id", "product_images", ["tenant_id"])
    op.create_index("ix_product_images_product_id", "product_images", ["product_id"])

    # ---- inventory_adjustments ----
    op.create_table(
        "inventory_adjustments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("product_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("delta", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(20), nullable=False),
        sa.Column("resulting_stock_qty", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], name="fk_inventory_adjustments_tenant_id_tenants", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name="fk_inventory_adjustments_product_id_products", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], name="fk_inventory_adjustments_variant_id_product_variants", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name="pk_inventory_adjustments"),
    )
    op.create_index("ix_inventory_adjustments_tenant_id", "inventory_adjustments", ["tenant_id"])
    op.create_index("ix_inventory_adjustments_product_id", "inventory_adjustments", ["product_id"])

    # ---- conversations: context memory + session-expiry tracking ----
    op.add_column(
        "conversations",
        sa.Column("context", postgresql.JSONB(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "last_activity_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_column("conversations", "last_activity_at")
    op.drop_column("conversations", "context")

    op.drop_table("inventory_adjustments")
    op.drop_table("product_images")
    op.drop_table("product_variants")

    op.drop_constraint("fk_products_brand_id_brands", "products", type_="foreignkey")
    op.drop_constraint("fk_products_category_id_categories", "products", type_="foreignkey")
    op.drop_column("products", "brand_id")
    op.drop_column("products", "category_id")

    op.drop_table("brands")
    op.drop_table("categories")
