from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID


class SubscriptionStatus(StrEnum):
    TRIALING = "trialing"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"


class CommissionStatus(StrEnum):
    PENDING = "pending"
    INVOICED = "invoiced"
    PAID = "paid"


class InvoiceStatus(StrEnum):
    DRAFT = "draft"
    ISSUED = "issued"
    PAID = "paid"
    OVERDUE = "overdue"


@dataclass
class SubscriptionPlan:
    id: UUID
    name: str
    price_monthly: Decimal
    commission_rate: Decimal
    features: dict = field(default_factory=dict)


@dataclass
class Subscription:
    id: UUID
    tenant_id: UUID
    plan_id: UUID
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime
    trial_end: datetime | None = None


@dataclass
class CommissionLedgerEntry:
    """One row per completed order — the SRS is explicit that commission
    revenue must be computed from the Order Service's source of truth, never
    estimated, since it's an auditable revenue stream (see Business Model:
    Transaction Commission)."""

    id: UUID
    tenant_id: UUID
    order_id: UUID
    amount: Decimal
    rate: Decimal
    status: CommissionStatus
    created_at: datetime | None = None


@dataclass
class Invoice:
    id: UUID
    tenant_id: UUID
    period_start: datetime
    period_end: datetime
    amount_due: Decimal
    status: InvoiceStatus
    subscription_id: UUID | None = None
    issued_at: datetime | None = None
    paid_at: datetime | None = None
