from uuid import UUID, uuid4

from app.domain.entities.tenant import StorePhase, Tenant, TenantStatus
from app.domain.repositories.tenant_repository import TenantRepository
from app.shared.exceptions import ConflictError, NotFoundError


class TenantService:
    """Use-cases for the tenant aggregate. Depends on the TenantRepository
    *interface* (Dependency Inversion Principle) — dependencies.py is the
    only place that decides which concrete implementation to inject, so
    this class never imports SQLAlchemy."""

    def __init__(self, tenant_repository: TenantRepository) -> None:
        self._tenants = tenant_repository

    async def create_tenant(self, name: str, slug: str) -> Tenant:
        existing = await self._tenants.get_by_slug(slug)
        if existing is not None:
            raise ConflictError(f"A tenant with slug '{slug}' already exists")

        tenant = Tenant(
            id=uuid4(),
            name=name,
            slug=slug,
            status=TenantStatus.PILOT,
            phase=StorePhase.PHASE_1_TEXT_BETA,
        )
        return await self._tenants.add(tenant)

    async def get_tenant(self, tenant_id: UUID) -> Tenant:
        tenant = await self._tenants.get_by_id(tenant_id)
        if tenant is None:
            raise NotFoundError(f"Tenant {tenant_id} not found")
        return tenant

    async def get_tenant_by_slug(self, slug: str) -> Tenant:
        """Resolves the public identifier embedded in a partner site's
        widget snippet to a tenant — see the guest-session bootstrap in
        app/modules/auth/router.py and docs/architecture/auth-flow.md."""
        tenant = await self._tenants.get_by_slug(slug)
        if tenant is None:
            raise NotFoundError(f"No tenant with slug '{slug}'")
        return tenant

    async def list_tenants(self, *, limit: int = 50, offset: int = 0) -> list[Tenant]:
        """Partner list — FR-3.1/3.2. Admin-only by virtue of which router
        wires this in (see app/modules/admin/router.py)."""
        return await self._tenants.list(limit=limit, offset=offset)

    async def update_branding(self, tenant_id: UUID, branding: dict) -> Tenant:
        tenant = await self.get_tenant(tenant_id)
        tenant.branding = branding
        return await self._tenants.update(tenant)

    async def advance_phase(self, tenant_id: UUID, phase: StorePhase) -> Tenant:
        """Admin-only operation (see app/modules/admin) — the only path that
        should ever change a tenant's phase, since it gates the widget
        bundle and backend capability entitlement checks."""
        tenant = await self.get_tenant(tenant_id)
        tenant.phase = phase
        return await self._tenants.update(tenant)

    async def set_feature_flag(self, tenant_id: UUID, key: str, enabled: bool):
        await self.get_tenant(tenant_id)  # 404s if the tenant doesn't exist
        return await self._tenants.set_feature_flag(tenant_id, key, enabled)

    async def list_feature_flags(self, tenant_id: UUID):
        await self.get_tenant(tenant_id)
        return await self._tenants.list_feature_flags(tenant_id)

    async def is_feature_enabled(self, tenant_id: UUID, key: str) -> bool:
        flags = await self._tenants.list_feature_flags(tenant_id)
        return any(f.key == key and f.enabled for f in flags)
