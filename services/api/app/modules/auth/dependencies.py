from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis_client
from app.db.session import get_db_session
from app.modules.auth.repository import GuestCustomerRepository
from app.modules.auth.service import AuthService
from app.modules.tenants.repository import CachedTenantRepository, SqlAlchemyTenantRepository
from app.modules.tenants.service import TenantService


def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AuthService:
    """Privileged (BYPASSRLS) session — resolving a tenant by public slug
    and creating its first customer row necessarily runs before any tenant
    is known to scope a session to (see app/db/session.py).

    Wraps the tenant repository in CachedTenantRepository: this is the
    hottest tenant-by-slug read path in the system (every widget page load
    hits it), and the only place in the codebase that needs that cache —
    everywhere else reads tenants by id, not slug."""
    tenant_repository = CachedTenantRepository(SqlAlchemyTenantRepository(session), get_redis_client())
    return AuthService(
        tenant_service=TenantService(tenant_repository),
        customer_repository=GuestCustomerRepository(session),
    )
