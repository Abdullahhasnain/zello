from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.modules.billing.dependencies import get_billing_service
from app.modules.billing.schemas import CommissionLedgerEntryRead, InvoiceRead, SubscriptionRead
from app.modules.billing.service import BillingService
from app.shared.deps import get_current_store_auth, require_role

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/subscription", response_model=SubscriptionRead | None)
async def get_my_subscription(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    billing_service: Annotated[BillingService, Depends(get_billing_service)],
) -> SubscriptionRead | None:
    assert auth.tenant_id is not None
    subscription = await billing_service.get_active_subscription(auth.tenant_id)
    return SubscriptionRead.model_validate(subscription) if subscription else None


@router.get("/commission", response_model=list[CommissionLedgerEntryRead])
async def list_pending_commission(
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    billing_service: Annotated[BillingService, Depends(get_billing_service)],
) -> list[CommissionLedgerEntryRead]:
    assert auth.tenant_id is not None
    entries = await billing_service.list_pending_commission(auth.tenant_id)
    return [CommissionLedgerEntryRead.model_validate(e) for e in entries]


@router.get("/invoices", response_model=list[InvoiceRead])
async def list_invoices(
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    billing_service: Annotated[BillingService, Depends(get_billing_service)],
) -> list[InvoiceRead]:
    """FR-2.9 — invoice history."""
    assert auth.tenant_id is not None
    invoices = await billing_service.list_invoices(auth.tenant_id)
    return [InvoiceRead.model_validate(i) for i in invoices]
