from collections.abc import AsyncGenerator, Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import AuthContext, verify_customer_jwt, verify_staff_token
from app.db.session import get_scoped_db_session
from app.modules.users.dependencies import get_user_service
from app.modules.users.service import UserService
from app.shared.exceptions import AuthenticationError, AuthorizationError

# A real security scheme (not a raw Header dependency) — this is what makes
# every protected route show a padlock in /api/v1/docs and gives Swagger
# UI's "Authorize" button somewhere to put a token, instead of every client
# having to guess the header name and "Bearer " prefix from reading source.
# `auto_error=False` so a missing header raises our own AuthenticationError
# (uniform error shape, per app/shared/exceptions.py) rather than FastAPI's
# default 403.
_bearer_scheme = HTTPBearer(
    auto_error=False,
    description="Clerk session JWT, or the self-issued customer JWT for widget endpoints.",
)


async def _bearer_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)] = None,
) -> str:
    if credentials is None:
        raise AuthenticationError("Missing or malformed Authorization header")
    return credentials.credentials


async def verify_internal_service_token(
    x_internal_token: Annotated[str | None, Header()] = None,
) -> None:
    """Gate for service-to-service calls with no end-user identity behind
    them at all — e.g. the dashboard's Clerk webhook route forwarding a
    user.created event (see app/modules/users/router.py). A shared secret,
    not a session; never accept this on a route a browser calls directly."""
    if x_internal_token != get_settings().INTERNAL_SERVICE_TOKEN:
        raise AuthenticationError("Invalid internal service token")


async def get_clerk_identity(token: Annotated[str, Depends(_bearer_token)]) -> dict:
    """Verifies a Clerk session JWT and returns its claims WITHOUT requiring
    an existing StoreUser row. Only for the one endpoint that runs before
    tenant membership exists: self-serve store creation (POST /tenants).
    Every other store-facing route must use get_current_store_auth."""
    return await verify_staff_token(token)


async def get_current_store_auth(
    token: Annotated[str, Depends(_bearer_token)],
    user_service: Annotated[UserService, Depends(get_user_service)],
) -> AuthContext:
    """Verifies a Clerk session JWT and resolves it to a local StoreUser —
    the identity/tenant-membership split described in
    docs/architecture/auth-flow.md."""
    claims = await verify_staff_token(token)
    clerk_user_id: str = claims["sub"]

    store_user = await user_service.get_store_user_by_clerk_id(clerk_user_id)
    if store_user is None:
        raise AuthenticationError("No store account linked to this session")

    return AuthContext(
        actor_type="store_user",
        subject_id=str(store_user.id),
        tenant_id=store_user.tenant_id,
        role=store_user.role.value,
        raw_claims=claims,
    )


async def get_current_admin_auth(
    token: Annotated[str, Depends(_bearer_token)],
    user_service: Annotated[UserService, Depends(get_user_service)],
) -> AuthContext:
    """Verifies a Clerk session JWT and resolves it to a local AdminUser.
    Kept entirely separate from get_current_store_auth so a store-owner
    session can never accidentally satisfy an admin-only dependency."""
    claims = await verify_staff_token(token)
    clerk_user_id: str = claims["sub"]

    admin_user = await user_service.get_admin_by_clerk_id(clerk_user_id)
    if admin_user is None:
        raise AuthenticationError("No admin account linked to this session")

    return AuthContext(
        actor_type="admin_user",
        subject_id=str(admin_user.id),
        tenant_id=None,
        role=admin_user.role.value,
        raw_claims=claims,
    )


async def get_current_customer_auth(token: Annotated[str, Depends(_bearer_token)]) -> AuthContext:
    """Verifies our self-issued guest/OTP JWT for the customer widget — no
    Clerk involved, and no DB lookup required since tenant_id/customer_id
    are embedded directly in the token's claims."""
    claims = verify_customer_jwt(token)
    return AuthContext(
        actor_type="customer",
        subject_id=claims["sub"],
        tenant_id=UUID(claims["tenant_id"]),
        role=None,
        raw_claims=claims,
    )


def require_role(*allowed_roles: str) -> Callable[[AuthContext], AuthContext]:
    """RBAC for store-owner routes, e.g. `Depends(require_role("owner"))` —
    FR-2.8's owner/staff/viewer distinction. Layers on top of
    get_current_store_auth, not get_current_admin_auth — use
    require_admin_role for admin routes; the two roles vocabularies
    (owner/staff/viewer vs. super_admin/ops/support/finance) are disjoint
    and mixing them here would let a typo'd role string silently satisfy
    the wrong dependency."""

    def _check(auth: Annotated[AuthContext, Depends(get_current_store_auth)]) -> AuthContext:
        if auth.role not in allowed_roles:
            raise AuthorizationError(f"Requires one of roles: {', '.join(allowed_roles)}")
        return auth

    return _check


def require_admin_role(*allowed_roles: str) -> Callable[[AuthContext], AuthContext]:
    """RBAC for admin routes, e.g.
    `Depends(require_admin_role("super_admin", "ops"))` — FR-3.9's
    super_admin/ops/support/finance distinction. A `support` admin
    shouldn't be able to change a tenant's billing plan any more than a
    `finance` admin should approve a new partner; get_current_admin_auth
    alone only proves "this is *some* admin", not which one."""

    def _check(auth: Annotated[AuthContext, Depends(get_current_admin_auth)]) -> AuthContext:
        if auth.role not in allowed_roles:
            raise AuthorizationError(f"Requires one of admin roles: {', '.join(allowed_roles)}")
        return auth

    return _check


async def _apply_tenant_scope(
    auth: AuthContext, session: AsyncSession
) -> AsyncGenerator[AsyncSession, None]:
    """Sets the Postgres session variable the row-level-security policies
    (db/ddl/002_row_level_security.sql) key off of. This — not
    application-level `WHERE tenant_id = ...` filtering — is the hard
    multi-tenant isolation boundary (SRS NFR). Shared by both auth flows
    below since RLS doesn't care whether the caller is a store owner or a
    guest customer, only which tenant they belong to."""
    if auth.tenant_id is None:
        raise AuthorizationError("This endpoint requires a tenant-scoped session")

    # `SET LOCAL name = :param` isn't valid — Postgres's SET statement takes
    # a literal, not a bind parameter (asyncpg emits "$1" and Postgres
    # rejects it as a syntax error). set_config() is the parameterized
    # equivalent; `true` scopes it to the transaction like SET LOCAL does.
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
        {"tenant_id": str(auth.tenant_id)},
    )
    yield session


async def get_tenant_db_session(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    session: Annotated[AsyncSession, Depends(get_scoped_db_session)],
) -> AsyncGenerator[AsyncSession, None]:
    """Tenant-scoped session for store-owner-facing dashboard endpoints.
    Bound to the RLS-enforced (`zello_app`) connection pool — see
    app/db/session.py."""
    async for scoped in _apply_tenant_scope(auth, session):
        yield scoped


async def get_customer_tenant_db_session(
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    session: Annotated[AsyncSession, Depends(get_scoped_db_session)],
) -> AsyncGenerator[AsyncSession, None]:
    """Tenant-scoped session for the customer widget's own endpoints
    (conversations, cart, checkout) — same RLS enforcement, different
    upstream identity check."""
    async for scoped in _apply_tenant_scope(auth, session):
        yield scoped
