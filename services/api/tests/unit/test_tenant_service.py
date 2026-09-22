"""Demonstrates the payoff of the Repository pattern: TenantService is
tested here with a plain in-memory fake, no Postgres, no SQLAlchemy, no
Docker. If this test needed a real database, the abstraction would have
failed at its one job."""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest

from app.domain.entities.tenant import FeatureFlag, StorePhase, Tenant, TenantStatus
from app.domain.repositories.tenant_repository import TenantRepository
from app.modules.tenants.service import TenantService
from app.shared.exceptions import ConflictError


class FakeTenantRepository(TenantRepository):
    def __init__(self) -> None:
        self._tenants: dict[UUID, Tenant] = {}
        self._flags: dict[tuple[UUID, str], FeatureFlag] = {}

    async def get_by_id(self, entity_id: UUID) -> Tenant | None:
        return self._tenants.get(entity_id)

    async def get_by_slug(self, slug: str) -> Tenant | None:
        return next((t for t in self._tenants.values() if t.slug == slug), None)

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Tenant]:
        return list(self._tenants.values())[offset : offset + limit]

    async def add(self, entity: Tenant) -> Tenant:
        self._tenants[entity.id] = entity
        return entity

    async def update(self, entity: Tenant) -> Tenant:
        self._tenants[entity.id] = entity
        return entity

    async def delete(self, entity_id: UUID) -> None:
        self._tenants.pop(entity_id, None)

    async def list_feature_flags(self, tenant_id: UUID) -> list[FeatureFlag]:
        return [f for (tid, _key), f in self._flags.items() if tid == tenant_id]

    async def set_feature_flag(self, tenant_id: UUID, key: str, enabled: bool) -> FeatureFlag:
        flag = FeatureFlag(id=uuid4(), tenant_id=tenant_id, key=key, enabled=enabled)
        self._flags[(tenant_id, key)] = flag
        return flag


@pytest.fixture
def service() -> TenantService:
    return TenantService(FakeTenantRepository())


async def test_create_tenant_defaults_to_pilot_phase_1(service: TenantService) -> None:
    tenant = await service.create_tenant("Khaadi Pilot", "khaadi-pilot")

    assert tenant.status == TenantStatus.PILOT
    assert tenant.phase == StorePhase.PHASE_1_TEXT_BETA


async def test_create_tenant_rejects_duplicate_slug(service: TenantService) -> None:
    await service.create_tenant("Sapphire", "sapphire")

    with pytest.raises(ConflictError):
        await service.create_tenant("Sapphire Again", "sapphire")


async def test_feature_flag_gates_are_independent_per_tenant(service: TenantService) -> None:
    tenant_a = await service.create_tenant("Alkaram", "alkaram")
    tenant_b = await service.create_tenant("Imtiaz", "imtiaz")

    await service.set_feature_flag(tenant_a.id, "voice_enabled", True)

    assert await service.is_feature_enabled(tenant_a.id, "voice_enabled") is True
    assert await service.is_feature_enabled(tenant_b.id, "voice_enabled") is False
