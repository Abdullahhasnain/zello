from abc import abstractmethod
from uuid import UUID

from app.domain.entities.user import AdminUser, StoreUser
from app.domain.repositories.base import Repository


class StoreUserRepository(Repository[StoreUser]):
    @abstractmethod
    async def get_by_clerk_id(self, clerk_user_id: str) -> StoreUser | None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: UUID) -> list[StoreUser]: ...


class AdminUserRepository(Repository[AdminUser]):
    @abstractmethod
    async def get_by_clerk_id(self, clerk_user_id: str) -> AdminUser | None: ...
