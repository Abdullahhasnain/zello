from abc import abstractmethod
from uuid import UUID

from app.domain.entities.tenant import FeatureFlag, Tenant
from app.domain.repositories.base import Repository


class TenantRepository(Repository[Tenant]):
    @abstractmethod
    async def get_by_slug(self, slug: str) -> Tenant | None: ...

    @abstractmethod
    async def list_feature_flags(self, tenant_id: UUID) -> list[FeatureFlag]: ...

    @abstractmethod
    async def set_feature_flag(self, tenant_id: UUID, key: str, enabled: bool) -> FeatureFlag: ...
