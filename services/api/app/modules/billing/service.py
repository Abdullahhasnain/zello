from decimal import Decimal
from uuid import UUID, uuid4

from app.domain.entities.billing import (
    CommissionLedgerEntry,
    CommissionStatus,
    Invoice,
    Subscription,
)
from app.domain.repositories.billing_repository import (
    CommissionLedgerRepository,
    InvoiceRepository,
    SubscriptionRepository,
)
from app.shared.exceptions import NotFoundError


class BillingService:
    """SaaS subscription + commission + invoicing use-cases — the direct
    system implication of the three revenue streams in the Business Model
    section: recurring billing, an auditable per-order commission ledger,
    and invoice generation."""

    def __init__(
        self,
        subscription_repository: SubscriptionRepository,
        commission_repository: CommissionLedgerRepository,
        invoice_repository: InvoiceRepository,
    ) -> None:
        self._subscriptions = subscription_repository
        self._commissions = commission_repository
        self._invoices = invoice_repository

    async def get_active_subscription(self, tenant_id: UUID) -> Subscription | None:
        return await self._subscriptions.get_active_for_tenant(tenant_id)

    async def record_commission_for_order(
        self, tenant_id: UUID, order_id: UUID, order_total: Decimal, rate: Decimal
    ) -> CommissionLedgerEntry:
        """Called by the Order service once an order is confirmed — never
        estimated after the fact. See Business Model: Transaction
        Commission."""
        entry = CommissionLedgerEntry(
            id=uuid4(),
            tenant_id=tenant_id,
            order_id=order_id,
            amount=order_total * rate,
            rate=rate,
            status=CommissionStatus.PENDING,
        )
        return await self._commissions.record(entry)

    async def list_pending_commission(self, tenant_id: UUID) -> list[CommissionLedgerEntry]:
        return await self._commissions.list_pending_for_tenant(tenant_id)

    async def list_invoices(self, tenant_id: UUID) -> list[Invoice]:
        return await self._invoices.list_by_tenant(tenant_id)

    async def get_invoice(self, invoice_id: UUID) -> Invoice:
        invoice = await self._invoices.get_by_id(invoice_id)
        if invoice is None:
            raise NotFoundError(f"Invoice {invoice_id} not found")
        return invoice
