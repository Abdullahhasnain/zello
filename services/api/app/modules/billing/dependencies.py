from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.repository import (
    SqlAlchemyCommissionLedgerRepository,
    SqlAlchemyInvoiceRepository,
    SqlAlchemySubscriptionRepository,
)
from app.modules.billing.service import BillingService
from app.shared.deps import get_tenant_db_session


def get_billing_service(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
) -> BillingService:
    return BillingService(
        subscription_repository=SqlAlchemySubscriptionRepository(session),
        commission_repository=SqlAlchemyCommissionLedgerRepository(session),
        invoice_repository=SqlAlchemyInvoiceRepository(session),
    )
