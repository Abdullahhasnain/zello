from __future__ import annotations

import json
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.tenant import FeatureFlag as FeatureFlagEntity
from app.domain.entities.tenant import StorePhase, Tenant, TenantStatus
from app.domain.repositories.tenant_repository import TenantRepository
from app.modules.tenants.models import FeatureFlagModel, TenantModel


def _to_entity(model: TenantModel) -> Tenant:
    return Tenant(
        id=model.id,
        name=model.name,
        slug=model.slug,
        status=TenantStatus(model.status),
        phase=StorePhase(model.phase),
        branding=model.branding,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _flag_to_entity(model: FeatureFlagModel) -> FeatureFlagEntity:
    return FeatureFlagEntity(
        id=model.id, tenant_id=model.tenant_id, key=model.key, enabled=model.enabled, updated_at=None
    )


class SqlAlchemyTenantRepository(TenantRepository):
    """The only place in the codebase that knows SQLAlchemy exists for the
    tenant aggregate. TenantService (service.py) depends on the
    TenantRepository interface, not on this class — swap this out for a
    fake in tests without touching the service."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Tenant | None:
        model = await self._session.get(TenantModel, entity_id)
        return _to_entity(model) if model else None

    async def get_by_slug(self, slug: str) -> Tenant | None:
        result = await self._session.execute(select(TenantModel).where(TenantModel.slug == slug))
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Tenant]:
        result = await self._session.execute(select(TenantModel).limit(limit).offset(offset))
        return [_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Tenant) -> Tenant:
        model = TenantModel(
            id=entity.id,
            name=entity.name,
            slug=entity.slug,
            status=entity.status.value,
            phase=entity.phase.value,
            branding=entity.branding,
        )
        self._session.add(model)
        await self._session.flush()
        return _to_entity(model)

    async def update(self, entity: Tenant) -> Tenant:
        model = await self._session.get(TenantModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Tenant {entity.id} not found")
        model.name = entity.name
        model.status = entity.status.value
        model.phase = entity.phase.value
        model.branding = entity.branding
        await self._session.flush()
        return _to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(TenantModel, entity_id)
        if model is not None:
            await self._session.delete(model)

    async def list_feature_flags(self, tenant_id: UUID) -> list[FeatureFlagEntity]:
        result = await self._session.execute(
            select(FeatureFlagModel).where(FeatureFlagModel.tenant_id == tenant_id)
        )
        return [_flag_to_entity(m) for m in result.scalars().all()]

    async def set_feature_flag(self, tenant_id: UUID, key: str, enabled: bool) -> FeatureFlagEntity:
        result = await self._session.execute(
            select(FeatureFlagModel).where(
                FeatureFlagModel.tenant_id == tenant_id, FeatureFlagModel.key == key
            )
        )
        model = result.scalar_one_or_none()
        if model is None:
            model = FeatureFlagModel(tenant_id=tenant_id, key=key, enabled=enabled)
            self._session.add(model)
        else:
            model.enabled = enabled
        await self._session.flush()
        return _flag_to_entity(model)


def _cache_key(slug: str) -> str:
    return f"tenant:slug:{slug}"


class CachedTenantRepository(TenantRepository):
    """Decorates any TenantRepository with a Redis-backed cache in front of
    `get_by_slug` — the hottest tenant read in the system, since it runs on
    every widget page load (POST /auth/guest-session, see
    app/modules/auth/service.py). Everything else passes straight through
    unchanged.

    This is the Open/Closed Principle in practice: caching was added
    without modifying SqlAlchemyTenantRepository or TenantService — only
    dependencies.py (the composition root) needed to change to start using
    it. A 5-minute TTL means a branding/phase change can take up to that
    long to reach a *new* guest session; acceptable for data this rarely
    changes, and existing sessions are unaffected since they don't re-fetch
    the tenant."""

    _TTL_SECONDS = 300

    def __init__(self, inner: TenantRepository, redis: Redis) -> None:
        self._inner = inner
        self._redis = redis

    async def get_by_slug(self, slug: str) -> Tenant | None:
        cached = await self._redis.get(_cache_key(slug))
        if cached is not None:
            data = json.loads(cached)
            return Tenant(
                id=UUID(data["id"]),
                name=data["name"],
                slug=data["slug"],
                status=TenantStatus(data["status"]),
                phase=StorePhase(data["phase"]),
                branding=data["branding"],
            )

        tenant = await self._inner.get_by_slug(slug)
        if tenant is not None:
            await self._redis.set(
                _cache_key(slug),
                json.dumps(
                    {
                        "id": str(tenant.id),
                        "name": tenant.name,
                        "slug": tenant.slug,
                        "status": tenant.status.value,
                        "phase": tenant.phase.value,
                        "branding": tenant.branding,
                    }
                ),
                ex=self._TTL_SECONDS,
            )
        return tenant

    async def get_by_id(self, entity_id: UUID) -> Tenant | None:
        return await self._inner.get_by_id(entity_id)

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Tenant]:
        return await self._inner.list(limit=limit, offset=offset)

    async def add(self, entity: Tenant) -> Tenant:
        return await self._inner.add(entity)

    async def update(self, entity: Tenant) -> Tenant:
        updated = await self._inner.update(entity)
        await self._redis.delete(_cache_key(updated.slug))
        return updated

    async def delete(self, entity_id: UUID) -> None:
        await self._inner.delete(entity_id)

    async def list_feature_flags(self, tenant_id: UUID) -> list[FeatureFlagEntity]:
        return await self._inner.list_feature_flags(tenant_id)

    async def set_feature_flag(self, tenant_id: UUID, key: str, enabled: bool) -> FeatureFlagEntity:
        return await self._inner.set_feature_flag(tenant_id, key, enabled)
