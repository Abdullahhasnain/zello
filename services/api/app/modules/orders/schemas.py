from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.shared.schema import CamelModel


class CartRead(CamelModel):
    id: UUID
    tenant_id: UUID
    status: str


class CartItemRead(CamelModel):
    id: UUID
    cart_id: UUID
    product_id: UUID
    quantity: int
    unit_price: Decimal


class AddCartItemRequest(CamelModel):
    product_id: UUID
    quantity: int = 1


class UpdateCartItemRequest(CamelModel):
    quantity: int


class CartItemDetailRead(CamelModel):
    """A cart line enriched with product display fields — what the
    storefront cart page renders without extra product fetches."""

    id: UUID
    product_id: UUID
    product_title: str
    product_image_url: str | None = None
    quantity: int
    unit_price: Decimal


class CartDetailRead(CamelModel):
    id: UUID
    tenant_id: UUID
    status: str
    items: list[CartItemDetailRead]
    subtotal: Decimal


class OrderRead(CamelModel):
    id: UUID
    tenant_id: UUID
    status: str
    total_amount: Decimal
    currency: str
    payment_method: str
    payment_status: str
    placed_at: datetime


class CheckoutRequest(CamelModel):
    """Triggers the Order & Checkout service's own confirmation/confidence
    gate (SRS FR-4.6) — the AI layer only ever *requests* this, never writes
    an order directly. Note there is no `amount` field: the total is always
    computed server-side from the cart's persisted items."""

    cart_id: UUID
    payment_method: str
