from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.shared.schema import CamelModel

# --- Categories ---


class CategoryRead(CamelModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    parent_id: UUID | None = None


class CategoryCreate(CamelModel):
    name: str
    slug: str
    parent_id: UUID | None = None


class CategoryUpdate(CamelModel):
    name: str
    slug: str
    parent_id: UUID | None = None


# --- Brands ---


class BrandRead(CamelModel):
    id: UUID
    tenant_id: UUID
    name: str
    slug: str
    logo_url: str | None = None


class BrandCreate(CamelModel):
    name: str
    slug: str
    logo_url: str | None = None


class BrandUpdate(CamelModel):
    name: str
    slug: str
    logo_url: str | None = None


# --- Products ---


class ProductRead(CamelModel):
    id: UUID
    tenant_id: UUID
    external_id: str
    title: str
    description: str | None = None
    price: Decimal
    currency: str
    stock_qty: int
    category_id: UUID | None = None
    brand_id: UUID | None = None
    images: list[str]
    attributes: dict
    status: str


class ProductUpsert(CamelModel):
    """Shape pushed by the catalog sync connectors (API / CSV / Shopify /
    WooCommerce — FR-2.2), keyed on external_id for idempotency."""

    external_id: str
    title: str
    price: Decimal
    currency: str = "PKR"
    description: str | None = None
    stock_qty: int = 0
    images: list[str] = []
    attributes: dict = {}


class ProductCreate(CamelModel):
    """Direct creation via the dashboard's own "add product" form, as
    opposed to ProductUpsert's connector-fed sync."""

    external_id: str
    title: str
    price: Decimal
    currency: str = "PKR"
    description: str | None = None
    stock_qty: int = 0
    category_id: UUID | None = None
    brand_id: UUID | None = None
    images: list[str] = []
    attributes: dict = {}


class ProductUpdate(CamelModel):
    title: str | None = None
    description: str | None = None
    price: Decimal | None = None
    category_id: UUID | None = None
    brand_id: UUID | None = None
    images: list[str] | None = None
    attributes: dict | None = None
    status: str | None = None


# --- Variants ---


class ProductVariantRead(CamelModel):
    id: UUID
    tenant_id: UUID
    product_id: UUID
    sku: str
    attributes: dict
    price: Decimal | None = None
    stock_qty: int
    status: str


class ProductVariantCreate(CamelModel):
    sku: str
    attributes: dict = {}
    price: Decimal | None = None
    stock_qty: int = 0


class ProductVariantUpdate(CamelModel):
    sku: str | None = None
    attributes: dict | None = None
    price: Decimal | None = None
    stock_qty: int | None = None
    status: str | None = None


# --- Images ---


class ProductImageRead(CamelModel):
    id: UUID
    tenant_id: UUID
    product_id: UUID
    url: str
    alt_text: str | None = None
    sort_order: int
    is_primary: bool


class ProductImageCreate(CamelModel):
    url: str
    alt_text: str | None = None


class ProductImageReorder(CamelModel):
    ordered_image_ids: list[UUID]


# --- Inventory ---


class InventoryAdjustmentRead(CamelModel):
    id: UUID
    tenant_id: UUID
    product_id: UUID
    variant_id: UUID | None = None
    delta: int
    reason: str
    resulting_stock_qty: int
    created_at: datetime


class InventoryAdjustmentRequest(CamelModel):
    delta: int
    reason: str
    variant_id: UUID | None = None
