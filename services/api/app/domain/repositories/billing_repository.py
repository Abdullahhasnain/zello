from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.billing import CommissionLedgerEntry, Invoice, Subscription
from app.domain.repositories.base import Repository


class SubscriptionRepository(Repository[Subscription]):
    @abstractmethod
    async def get_active_for_tenant(self, tenant_id: UUID) -> Subscription | None: ...


class CommissionLedgerRepository(ABC):
    @abstractmethod
    async def record(self, entry: CommissionLedgerEntry) -> CommissionLedgerEntry: ...

    @abstractmethod
    async def list_pending_for_tenant(self, tenant_id: UUID) -> list[CommissionLedgerEntry]: ...


class InvoiceRepository(Repository[Invoice]):
    @abstractmethod
    async def list_by_tenant(self, tenant_id: UUID) -> list[Invoice]: ...
