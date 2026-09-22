from datetime import datetime
from decimal import Decimal

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TenantScopedMixin, TimestampMixin, UUIDPKMixin

# Dimension for the embedding model used by the retrieval stage (AI layer) —
# see docs/architecture — AI layer. Centralized here so a model change is a
# single-constant edit plus a migration, not a scattered find-and-replace.
# Matches OpenAI's text-embedding-3-small — see app/modules/search/embedding_provider.py.
EMBEDDING_DIM = 1536


class CategoryModel(UUIDPKMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_categories_tenant_id_slug"),)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )


class BrandModel(UUIDPKMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "brands"
    __table_args__ = (UniqueConstraint("tenant_id", "slug", name="uq_brands_tenant_id_slug"),)

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)


class ProductModel(UUIDPKMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "products"
    __table_args__ = (
        UniqueConstraint("tenant_id", "external_id", name="uq_products_tenant_id_external_id"),
    )

    external_id: Mapped[str] = mapped_column(String(200), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, server_default="PKR")
    stock_qty: Mapped[int] = mapped_column(nullable=False, server_default="0")
    category_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL"), nullable=True
    )
    brand_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("brands.id", ondelete="SET NULL"), nullable=True
    )
    images: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default="[]")
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")


class ProductVariantModel(UUIDPKMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "product_variants"
    __table_args__ = (UniqueConstraint("product_id", "sku", name="uq_product_variants_product_id_sku"),)

    product_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    stock_qty: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")


class ProductImageModel(UUIDPKMixin, TenantScopedMixin, Base):
    """No TimestampMixin — images have a single `created_at`, no
    `updated_at`; reordering/re-primarying updates rows in place but that's
    not a meaningful "last modified" fact worth tracking here."""

    __tablename__ = "product_images"

    product_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    is_primary: Mapped[bool] = mapped_column(nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class InventoryAdjustmentModel(UUIDPKMixin, TenantScopedMixin, Base):
    """Immutable audit log — see the domain entity's docstring for why this
    is never just an UPDATE on products.stock_qty."""

    __tablename__ = "inventory_adjustments"

    product_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    variant_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=True
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(20), nullable=False)
    resulting_stock_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ProductEmbeddingModel(UUIDPKMixin, Base):
    """One row per product per embedding-model version, so re-embedding
    after a model upgrade doesn't require a destructive migration — see
    FR-4.3 (tenant-isolated semantic search)."""

    __tablename__ = "product_embeddings"
    __table_args__ = (
        UniqueConstraint(
            "product_id", "model_version", name="uq_product_embeddings_product_id_model_version"
        ),
    )

    product_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tenant_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_version: Mapped[str] = mapped_column(String(100), nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM), nullable=False)
