from datetime import datetime
from decimal import Decimal
from uuid import UUID

from app.shared.schema import CamelModel


class SubscriptionRead(CamelModel):
    id: UUID
    tenant_id: UUID
    plan_id: UUID
    status: str
    current_period_start: datetime
    current_period_end: datetime
    trial_end: datetime | None = None


class CommissionLedgerEntryRead(CamelModel):
    id: UUID
    tenant_id: UUID
    order_id: UUID
    amount: Decimal
    rate: Decimal
    status: str


class InvoiceRead(CamelModel):
    id: UUID
    tenant_id: UUID
    period_start: datetime
    period_end: datetime
    amount_due: Decimal
    status: str
