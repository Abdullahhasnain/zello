from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.domain.entities.tenant import StorePhase
from app.modules.tenants.dependencies import get_tenant_service, get_tenant_service_scoped
from app.modules.tenants.schemas import (
    FeatureFlagRead,
    FeatureFlagUpdate,
    TenantCreate,
    TenantPublicRead,
    TenantRead,
    TenantSignup,
    TenantUpdateBranding,
)
from app.modules.tenants.service import TenantService
from app.modules.users.dependencies import get_user_service
from app.modules.users.service import UserService
from app.shared.deps import (
    get_clerk_identity,
    get_current_store_auth,
    require_admin_role,
    require_role,
)
from app.shared.exceptions import ConflictError

router = APIRouter(prefix="/tenants", tags=["tenants"])
admin_router = APIRouter(prefix="/admin/tenants", tags=["admin:tenants"])


# --- Self-serve signup: a Clerk-authenticated user claims their store ---


@router.post("", response_model=TenantRead, status_code=201, summary="Create my store")
async def create_my_store(
    payload: TenantSignup,
    claims: Annotated[dict, Depends(get_clerk_identity)],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
    user_service: Annotated[UserService, Depends(get_user_service)],
) -> TenantRead:
    """Self-serve store creation for a freshly signed-up Clerk user. Runs
    before any tenant membership exists, so it uses get_clerk_identity (raw
    Clerk claims) rather than get_current_store_auth. One store per user:
    a caller already linked to a store gets a 409, not a second tenant."""
    clerk_user_id: str = claims["sub"]

    existing_user = await user_service.get_store_user_by_clerk_id(clerk_user_id)
    if existing_user is not None:
        raise ConflictError("This account is already linked to a store")

    tenant = await tenant_service.create_tenant(payload.name, payload.slug)
    await user_service.get_or_create_store_user(clerk_user_id, payload.email, tenant.id)
    return TenantRead.model_validate(tenant)


# --- Public storefront info: what an anonymous shopper may see ---


@router.get(
    "/storefront/{slug}",
    response_model=TenantPublicRead,
    summary="Public store info by slug",
)
async def get_storefront_info(
    slug: str,
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
) -> TenantPublicRead:
    """Deliberately unauthenticated, like POST /auth/guest-session: the slug
    is a public identifier, and this returns only name + branding — the same
    information the widget embed already renders on any partner page."""
    tenant = await tenant_service.get_tenant_by_slug(slug)
    return TenantPublicRead.model_validate(tenant)


# --- Store-owner-facing: the caller's own tenant ---


@router.get("/me", response_model=TenantRead, summary="Get my tenant")
async def get_my_tenant(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service_scoped)],
) -> TenantRead:
    assert auth.tenant_id is not None
    tenant = await tenant_service.get_tenant(auth.tenant_id)
    return TenantRead.model_validate(tenant)


@router.patch("/me/branding", response_model=TenantRead, summary="Update my tenant's widget branding")
async def update_my_branding(
    payload: TenantUpdateBranding,
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service_scoped)],
) -> TenantRead:
    """Widget Studio branding/persona update — FR-2.3. Owner-only."""
    assert auth.tenant_id is not None
    tenant = await tenant_service.update_branding(
        auth.tenant_id, payload.branding.model_dump(by_alias=False)
    )
    return TenantRead.model_validate(tenant)


# --- Admin-only: partner approval, phase entitlement, feature flags ---
# super_admin/ops only — these change what a tenant can do or whether it
# exists at all. `support` and `finance` admins can read (list_tenants,
# app/modules/admin/router.py) but not mutate here.


@admin_router.post("", response_model=TenantRead, status_code=201, summary="Approve a new partner store")
async def create_tenant(
    payload: TenantCreate,
    _auth: Annotated[AuthContext, Depends(require_admin_role("super_admin", "ops"))],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
) -> TenantRead:
    """Partner approval — FR-3.1."""
    tenant = await tenant_service.create_tenant(payload.name, payload.slug)
    return TenantRead.model_validate(tenant)


@admin_router.patch(
    "/{tenant_id}/phase", response_model=TenantRead, summary="Advance a tenant's roadmap phase"
)
async def advance_tenant_phase(
    tenant_id: UUID,
    phase: StorePhase,
    _auth: Annotated[AuthContext, Depends(require_admin_role("super_admin", "ops"))],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
) -> TenantRead:
    """Stages rollout per tenant — FR-3.7."""
    tenant = await tenant_service.advance_phase(tenant_id, phase)
    return TenantRead.model_validate(tenant)


@admin_router.get(
    "/{tenant_id}/feature-flags",
    response_model=list[FeatureFlagRead],
    summary="List a tenant's feature flags",
)
async def list_feature_flags(
    tenant_id: UUID,
    _auth: Annotated[AuthContext, Depends(require_admin_role("super_admin", "ops"))],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
) -> list[FeatureFlagRead]:
    flags = await tenant_service.list_feature_flags(tenant_id)
    return [FeatureFlagRead.model_validate(f) for f in flags]


@admin_router.put(
    "/{tenant_id}/feature-flags", response_model=FeatureFlagRead, summary="Set a tenant's feature flag"
)
async def set_feature_flag(
    tenant_id: UUID,
    payload: FeatureFlagUpdate,
    _auth: Annotated[AuthContext, Depends(require_admin_role("super_admin", "ops"))],
    tenant_service: Annotated[TenantService, Depends(get_tenant_service)],
) -> FeatureFlagRead:
    """FR-3.3 / FR-3.7 — e.g. `{"key": "voice_enabled", "enabled": true}`
    when a pilot store graduates to Phase 2."""
    flag = await tenant_service.set_feature_flag(tenant_id, payload.key, payload.enabled)
    return FeatureFlagRead.model_validate(flag)
