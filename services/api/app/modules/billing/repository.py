from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.billing import (
    CommissionLedgerEntry,
    CommissionStatus,
    Invoice,
    InvoiceStatus,
    Subscription,
    SubscriptionStatus,
)
from app.domain.repositories.billing_repository import (
    CommissionLedgerRepository,
    InvoiceRepository,
    SubscriptionRepository,
)
from app.modules.billing.models import CommissionLedgerEntryModel, InvoiceModel, SubscriptionModel


def _subscription_to_entity(model: SubscriptionModel) -> Subscription:
    return Subscription(
        id=model.id,
        tenant_id=model.tenant_id,
        plan_id=model.plan_id,
        status=SubscriptionStatus(model.status),
        current_period_start=model.current_period_start,
        current_period_end=model.current_period_end,
        trial_end=model.trial_end,
    )


def _ledger_entry_to_entity(model: CommissionLedgerEntryModel) -> CommissionLedgerEntry:
    return CommissionLedgerEntry(
        id=model.id,
        tenant_id=model.tenant_id,
        order_id=model.order_id,
        amount=model.amount,
        rate=model.rate,
        status=CommissionStatus(model.status),
        created_at=model.created_at,
    )


def _invoice_to_entity(model: InvoiceModel) -> Invoice:
    return Invoice(
        id=model.id,
        tenant_id=model.tenant_id,
        period_start=model.period_start,
        period_end=model.period_end,
        amount_due=model.amount_due,
        status=InvoiceStatus(model.status),
        subscription_id=model.subscription_id,
        issued_at=model.issued_at,
        paid_at=model.paid_at,
    )


class SqlAlchemySubscriptionRepository(SubscriptionRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Subscription | None:
        model = await self._session.get(SubscriptionModel, entity_id)
        return _subscription_to_entity(model) if model else None

    async def get_active_for_tenant(self, tenant_id: UUID) -> Subscription | None:
        result = await self._session.execute(
            select(SubscriptionModel).where(
                SubscriptionModel.tenant_id == tenant_id,
                SubscriptionModel.status.in_(
                    [SubscriptionStatus.ACTIVE.value, SubscriptionStatus.TRIALING.value]
                ),
            )
        )
        model = result.scalar_one_or_none()
        return _subscription_to_entity(model) if model else None

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Subscription]:
        result = await self._session.execute(select(SubscriptionModel).limit(limit).offset(offset))
        return [_subscription_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Subscription) -> Subscription:
        model = SubscriptionModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            plan_id=entity.plan_id,
            status=entity.status.value,
            current_period_start=entity.current_period_start,
            current_period_end=entity.current_period_end,
            trial_end=entity.trial_end,
        )
        self._session.add(model)
        await self._session.flush()
        return _subscription_to_entity(model)

    async def update(self, entity: Subscription) -> Subscription:
        model = await self._session.get(SubscriptionModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Subscription {entity.id} not found")
        model.status = entity.status.value
        model.current_period_end = entity.current_period_end
        await self._session.flush()
        return _subscription_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(SubscriptionModel, entity_id)
        if model is not None:
            await self._session.delete(model)


class SqlAlchemyCommissionLedgerRepository(CommissionLedgerRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, entry: CommissionLedgerEntry) -> CommissionLedgerEntry:
        model = CommissionLedgerEntryModel(
            id=entry.id,
            tenant_id=entry.tenant_id,
            order_id=entry.order_id,
            amount=entry.amount,
            rate=entry.rate,
            status=entry.status.value,
        )
        self._session.add(model)
        await self._session.flush()
        return _ledger_entry_to_entity(model)

    async def list_pending_for_tenant(self, tenant_id: UUID) -> list[CommissionLedgerEntry]:
        result = await self._session.execute(
            select(CommissionLedgerEntryModel).where(
                CommissionLedgerEntryModel.tenant_id == tenant_id,
                CommissionLedgerEntryModel.status == CommissionStatus.PENDING.value,
            )
        )
        return [_ledger_entry_to_entity(m) for m in result.scalars().all()]


class SqlAlchemyInvoiceRepository(InvoiceRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Invoice | None:
        model = await self._session.get(InvoiceModel, entity_id)
        return _invoice_to_entity(model) if model else None

    async def list_by_tenant(self, tenant_id: UUID) -> list[Invoice]:
        result = await self._session.execute(
            select(InvoiceModel)
            .where(InvoiceModel.tenant_id == tenant_id)
            .order_by(InvoiceModel.period_start.desc())
        )
        return [_invoice_to_entity(m) for m in result.scalars().all()]

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Invoice]:
        result = await self._session.execute(select(InvoiceModel).limit(limit).offset(offset))
        return [_invoice_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Invoice) -> Invoice:
        model = InvoiceModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            subscription_id=entity.subscription_id,
            period_start=entity.period_start,
            period_end=entity.period_end,
            amount_due=entity.amount_due,
            status=entity.status.value,
            issued_at=entity.issued_at,
            paid_at=entity.paid_at,
        )
        self._session.add(model)
        await self._session.flush()
        return _invoice_to_entity(model)

    async def update(self, entity: Invoice) -> Invoice:
        model = await self._session.get(InvoiceModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Invoice {entity.id} not found")
        model.status = entity.status.value
        model.paid_at = entity.paid_at
        await self._session.flush()
        return _invoice_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(InvoiceModel, entity_id)
        if model is not None:
            await self._session.delete(model)
