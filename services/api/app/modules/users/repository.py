from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.user import AdminRole, AdminUser, StoreUser, StoreUserRole
from app.domain.repositories.user_repository import AdminUserRepository, StoreUserRepository
from app.modules.users.models import AdminUserModel, StoreUserModel


def _store_user_to_entity(model: StoreUserModel) -> StoreUser:
    return StoreUser(
        id=model.id,
        tenant_id=model.tenant_id,
        clerk_user_id=model.clerk_user_id,
        email=model.email,
        role=StoreUserRole(model.role),
        created_at=model.created_at,
    )


def _admin_user_to_entity(model: AdminUserModel) -> AdminUser:
    return AdminUser(
        id=model.id,
        clerk_user_id=model.clerk_user_id,
        email=model.email,
        role=AdminRole(model.role),
        created_at=model.created_at,
    )


class SqlAlchemyStoreUserRepository(StoreUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> StoreUser | None:
        model = await self._session.get(StoreUserModel, entity_id)
        return _store_user_to_entity(model) if model else None

    async def get_by_clerk_id(self, clerk_user_id: str) -> StoreUser | None:
        result = await self._session.execute(
            select(StoreUserModel).where(StoreUserModel.clerk_user_id == clerk_user_id)
        )
        model = result.scalar_one_or_none()
        return _store_user_to_entity(model) if model else None

    async def list_by_tenant(self, tenant_id: UUID) -> list[StoreUser]:
        result = await self._session.execute(
            select(StoreUserModel).where(StoreUserModel.tenant_id == tenant_id)
        )
        return [_store_user_to_entity(m) for m in result.scalars().all()]

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[StoreUser]:
        result = await self._session.execute(select(StoreUserModel).limit(limit).offset(offset))
        return [_store_user_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: StoreUser) -> StoreUser:
        model = StoreUserModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            clerk_user_id=entity.clerk_user_id,
            email=entity.email,
            role=entity.role.value,
        )
        self._session.add(model)
        await self._session.flush()
        return _store_user_to_entity(model)

    async def update(self, entity: StoreUser) -> StoreUser:
        model = await self._session.get(StoreUserModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Store user {entity.id} not found")
        model.email = entity.email
        model.role = entity.role.value
        await self._session.flush()
        return _store_user_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(StoreUserModel, entity_id)
        if model is not None:
            await self._session.delete(model)


class SqlAlchemyAdminUserRepository(AdminUserRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> AdminUser | None:
        model = await self._session.get(AdminUserModel, entity_id)
        return _admin_user_to_entity(model) if model else None

    async def get_by_clerk_id(self, clerk_user_id: str) -> AdminUser | None:
        result = await self._session.execute(
            select(AdminUserModel).where(AdminUserModel.clerk_user_id == clerk_user_id)
        )
        model = result.scalar_one_or_none()
        return _admin_user_to_entity(model) if model else None

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[AdminUser]:
        result = await self._session.execute(select(AdminUserModel).limit(limit).offset(offset))
        return [_admin_user_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: AdminUser) -> AdminUser:
        model = AdminUserModel(
            id=entity.id, clerk_user_id=entity.clerk_user_id, email=entity.email, role=entity.role.value
        )
        self._session.add(model)
        await self._session.flush()
        return _admin_user_to_entity(model)

    async def update(self, entity: AdminUser) -> AdminUser:
        model = await self._session.get(AdminUserModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Admin user {entity.id} not found")
        model.email = entity.email
        model.role = entity.role.value
        await self._session.flush()
        return _admin_user_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(AdminUserModel, entity_id)
        if model is not None:
            await self._session.delete(model)
