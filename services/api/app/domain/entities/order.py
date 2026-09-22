from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID


class CartStatus(StrEnum):
    OPEN = "open"
    CONVERTED = "converted"
    ABANDONED = "abandoned"


class OrderStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class PaymentProvider(StrEnum):
    JAZZCASH = "jazzcash"
    EASYPAISA = "easypaisa"
    COD = "cod"


class PaymentStatus(StrEnum):
    PENDING = "pending"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    REFUNDED = "refunded"


@dataclass
class Cart:
    id: UUID
    tenant_id: UUID
    status: CartStatus
    conversation_id: UUID | None = None
    customer_id: UUID | None = None


@dataclass
class CartItem:
    id: UUID
    cart_id: UUID
    product_id: UUID
    quantity: int
    unit_price: Decimal


@dataclass
class Order:
    """Created only by the Order & Checkout service, never directly by the
    AI layer — the Orchestrator requests an order, this service enforces
    the confirmation/confidence gate (SRS FR-4.6) before one is created."""

    id: UUID
    tenant_id: UUID
    status: OrderStatus
    total_amount: Decimal
    currency: str
    payment_method: PaymentProvider
    payment_status: PaymentStatus
    cart_id: UUID | None = None
    customer_id: UUID | None = None
    conversation_id: UUID | None = None
    placed_at: datetime | None = None


@dataclass
class OrderItem:
    id: UUID
    order_id: UUID
    product_id: UUID
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


@dataclass
class Payment:
    id: UUID
    order_id: UUID
    tenant_id: UUID
    provider: PaymentProvider
    amount: Decimal
    status: PaymentStatus
    provider_ref: str | None = None
    created_at: datetime | None = None
