from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID


class ProductStatus(StrEnum):
    ACTIVE = "active"
    OUT_OF_STOCK = "out_of_stock"
    ARCHIVED = "archived"


@dataclass
class Category:
    """Tenant-owned product taxonomy. `parent_id` allows one level (or more)
    of subcategories — e.g. "Women > Lawn Suits" — without a separate
    subcategory table."""

    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    parent_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Brand:
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    logo_url: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class Product:
    """A catalog item as ingested from a tenant's store (API, CSV, or
    Shopify/WooCommerce connector — FR-2.2). `external_id` is the tenant's
    own SKU/product ID, kept alongside our UUID so sync is idempotent."""

    id: UUID
    tenant_id: UUID
    external_id: str
    title: str
    price: Decimal
    currency: str
    stock_qty: int
    status: ProductStatus
    description: str | None = None
    category_id: UUID | None = None
    brand_id: UUID | None = None
    images: list[str] = field(default_factory=list)
    attributes: dict = field(default_factory=dict)
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ProductVariant:
    """A purchasable variation of a product — e.g. size/color combination.
    `price` is an override: `None` means "use the parent product's price",
    so most single-price-point variants (just different sizes) don't need
    to duplicate the price on every row."""

    id: UUID
    tenant_id: UUID
    product_id: UUID
    sku: str
    attributes: dict
    stock_qty: int
    status: ProductStatus
    price: Decimal | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


@dataclass
class ProductImage:
    """Tenant-curated image gallery for a product — distinct from
    `Product.images` (the raw URL list a catalog sync pushes in). A store
    owner manages alt text, ordering, and which image is primary here;
    the sync path never touches this table."""

    id: UUID
    tenant_id: UUID
    product_id: UUID
    url: str
    sort_order: int
    is_primary: bool
    alt_text: str | None = None
    created_at: datetime | None = None


class InventoryAdjustmentReason(StrEnum):
    RESTOCK = "restock"
    SALE = "sale"
    CORRECTION = "correction"
    RETURN = "return"


@dataclass
class InventoryAdjustment:
    """One immutable row per stock change — never just an UPDATE on
    `stock_qty` in place, so "why did stock go from 40 to 12" always has an
    answer. `resulting_stock_qty` is a snapshot, not derived, so the
    history reads correctly even if adjustments are queried out of order."""

    id: UUID
    tenant_id: UUID
    product_id: UUID
    delta: int
    reason: InventoryAdjustmentReason
    resulting_stock_qty: int
    variant_id: UUID | None = None
    created_at: datetime | None = None
