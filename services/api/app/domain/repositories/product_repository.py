from abc import ABC, abstractmethod
from uuid import UUID

from app.domain.entities.product import (
    Brand,
    Category,
    InventoryAdjustment,
    Product,
    ProductImage,
    ProductVariant,
)
from app.domain.repositories.base import Repository


class ProductRepository(Repository[Product]):
    @abstractmethod
    async def get_by_external_id(self, tenant_id: UUID, external_id: str) -> Product | None: ...

    @abstractmethod
    async def list_by_tenant(
        self,
        tenant_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        category_id: UUID | None = None,
        brand_id: UUID | None = None,
    ) -> list[Product]: ...

    @abstractmethod
    async def upsert_from_sync(self, tenant_id: UUID, product: Product) -> Product:
        """Idempotent create-or-update keyed on (tenant_id, external_id) —
        the catalog sync connectors (API/CSV/Shopify/WooCommerce, FR-2.2)
        all funnel through this rather than a plain insert."""
        ...


class ProductEmbeddingRepository(ABC):
    """Deliberately not a Repository[T] subtype — vector search is a
    fundamentally different access pattern (similarity, not identity) and
    forcing it into get_by_id/list/add would be a Liskov violation."""

    @abstractmethod
    async def upsert_embedding(self, product_id: UUID, tenant_id: UUID, vector: list[float]) -> None: ...

    @abstractmethod
    async def search_similar(
        self, tenant_id: UUID, query_vector: list[float], *, top_k: int = 10
    ) -> list[Product]:
        """Tenant-isolated similarity search — must never scan across
        tenant_id boundaries (SRS NFR: multi-tenant isolation)."""
        ...

    @abstractmethod
    async def find_similar_to_product(
        self, tenant_id: UUID, product_id: UUID, *, top_k: int = 10
    ) -> list[Product]:
        """"Customers who viewed this also viewed" — nearest neighbors of
        an existing product's own embedding, excluding itself."""
        ...


class CategoryRepository(Repository[Category]):
    @abstractmethod
    async def get_by_slug(self, tenant_id: UUID, slug: str) -> Category | None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: UUID) -> list[Category]: ...


class BrandRepository(Repository[Brand]):
    @abstractmethod
    async def get_by_slug(self, tenant_id: UUID, slug: str) -> Brand | None: ...

    @abstractmethod
    async def list_by_tenant(self, tenant_id: UUID) -> list[Brand]: ...


class ProductVariantRepository(Repository[ProductVariant]):
    @abstractmethod
    async def list_by_product(self, product_id: UUID) -> list[ProductVariant]: ...

    @abstractmethod
    async def get_by_sku(self, product_id: UUID, sku: str) -> ProductVariant | None: ...


class ProductImageRepository(ABC):
    """Not a Repository[T] — images are managed as an ordered collection
    scoped to a product (add/reorder/set-primary), not fetched or updated
    by id as a standalone resource the way the other aggregates are."""

    @abstractmethod
    async def list_by_product(self, product_id: UUID) -> list[ProductImage]: ...

    @abstractmethod
    async def add(self, image: ProductImage) -> ProductImage: ...

    @abstractmethod
    async def delete(self, image_id: UUID) -> None: ...

    @abstractmethod
    async def reorder(self, product_id: UUID, ordered_image_ids: list[UUID]) -> list[ProductImage]: ...

    @abstractmethod
    async def set_primary(self, product_id: UUID, image_id: UUID) -> list[ProductImage]: ...


class InventoryAdjustmentRepository(ABC):
    @abstractmethod
    async def record(self, adjustment: InventoryAdjustment) -> InventoryAdjustment: ...

    @abstractmethod
    async def list_by_product(self, product_id: UUID, *, limit: int = 50) -> list[InventoryAdjustment]: ...
