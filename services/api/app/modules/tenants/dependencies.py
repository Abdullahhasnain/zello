from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.tenants.repository import SqlAlchemyTenantRepository
from app.modules.tenants.service import TenantService
from app.shared.deps import get_customer_tenant_db_session, get_tenant_db_session


def get_tenant_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TenantService:
    """Plain (non-RLS-scoped) session — for admin routes only (see
    admin_router in router.py), which by design operate across tenants."""
    return TenantService(SqlAlchemyTenantRepository(session))


def get_tenant_service_scoped(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
) -> TenantService:
    """RLS-scoped session — for the store-owner-facing `/tenants/me*`
    routes. Even though a store owner only ever asks for their own tenant_id
    (so an application-level bug would be the only way to leak another
    tenant's row), this keeps the same defense-in-depth guarantee every
    other store-facing endpoint gets, rather than making tenants the one
    exception."""
    return TenantService(SqlAlchemyTenantRepository(session))


def get_tenant_service_for_customer(
    session: Annotated[AsyncSession, Depends(get_customer_tenant_db_session)],
) -> TenantService:
    """RLS-scoped session for the widget's own read of its tenant's
    branding (e.g. the greeting persona used when a conversation starts —
    see app/modules/conversations/router.py)."""
    return TenantService(SqlAlchemyTenantRepository(session))
