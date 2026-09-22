from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import AuthContext
from app.modules.tenants.dependencies import get_tenant_service
from app.modules.tenants.service import TenantService
from app.modules.users.dependencies import get_user_service
from app.modules.users.repository import (
    SqlAlchemyAdminUserRepository,
    SqlAlchemyStoreUserRepository,
)
from app.modules.users.schemas import ClerkSyncRequest, StoreUserRead
from app.modules.users.service import UserService
from app.shared.deps import (
    get_current_store_auth,
    get_tenant_db_session,
    require_role,
    verify_internal_service_token,
)

router = APIRouter(prefix="/users", tags=["users"])


def _scoped_user_service(session: AsyncSession) -> UserService:
    """Not in dependencies.py: that module is imported by app/shared/deps.py
    (for auth resolution, which necessarily runs before any tenant is known
    and so must stay on a plain session) — importing get_tenant_db_session
    back from shared.deps there would be a circular import. Defined here
    instead, since router.py is a leaf no other module imports."""
    return UserService(
        store_user_repository=SqlAlchemyStoreUserRepository(session),
        admin_user_repository=SqlAlchemyAdminUserRepository(session),
    )


def get_user_service_scoped(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
) -> UserService:
    return _scoped_user_service(session)


@router.get("/me", response_model=StoreUserRead)
async def get_my_profile(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    user_service: Annotated[UserService, Depends(get_user_service_scoped)],
) -> StoreUserRead:
    user = await user_service.get_store_user_by_clerk_id(auth.raw_claims["sub"])
    assert user is not None  # guaranteed by get_current_store_auth resolving successfully
    return StoreUserRead.model_validate(user)


@router.get("/team", response_model=list[StoreUserRead])
async def list_team(
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    user_service: Annotated[UserService, Depends(get_user_service_scoped)],
) -> list[StoreUserRead]:
    """Team management (FR-2.8) — owner-only, enforced by require_role."""
    assert auth.tenant_id is not None
    users = await user_service.list_store_users(auth.tenant_id)
    return [StoreUserRead.model_validate(u) for u in users]


@router.post("/internal/clerk-sync", response_model=StoreUserRead, status_code=201, include_in_schema=False)
async def sync_clerk_user(
    payload: ClerkSyncRequest,
    _token: Annotated[None, Depends(verify_internal_service_token)],
    user_service: Annotated[UserService, Depends(get_user_service)],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
) -> StoreUserRead:
    """Called by apps/dashboard's Clerk webhook route on user.created —
    see docs/architecture/auth-flow.md. Not part of the public API surface
    (`include_in_schema=False`, gated by a service token, not a user
    session) — hence no tenant-scoped session either; it runs before any
    StoreUser row (and so any tenant membership) exists."""
    tenant = await tenant_service.get_tenant_by_slug(payload.tenant_slug)
    user = await user_service.get_or_create_store_user(payload.clerk_user_id, payload.email, tenant.id)
    return StoreUserRead.model_validate(user)
