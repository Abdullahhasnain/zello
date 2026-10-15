from datetime import datetime
from decimal import Decimal
from uuid import UUID
import re

from pydantic import field_validator

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
    customer_name: str | None = None
    customer_phone: str | None = None
    delivery_address: str | None = None
    delivery_city: str | None = None
    order_notes: str | None = None


class CheckoutRequest(CamelModel):
    """Triggers the Order & Checkout service's own confirmation/confidence
    gate (SRS FR-4.6) — the AI layer only ever *requests* this, never writes
    an order directly. Note there is no `amount` field: the total is always
    computed server-side from the cart's persisted items."""

    cart_id: UUID
    payment_method: str
    customer_name: str
    customer_phone: str
    delivery_address: str
    delivery_city: str
    order_notes: str | None = None

    @field_validator("customer_name", "delivery_address", "delivery_city")
    @classmethod
    def required_delivery_text(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("This field is required")
        return value

    @field_validator("customer_phone")
    @classmethod
    def pakistani_mobile(cls, value: str) -> str:
        digits = re.sub(r"[\s-]", "", value)
        if not re.fullmatch(r"(?:\+92|92|0)?3\d{9}", digits):
            raise ValueError("Enter a valid Pakistani mobile number")
        return digits
