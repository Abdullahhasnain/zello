"""Unit tests for CatalogService — fakes for all seven repository
interfaces it depends on, no database. Focused on the logic that actually
branches (duplicate-slug/external_id conflicts, self-parent rejection,
and the inventory adjustment's negative-stock guard) rather than
re-testing that a dict assignment happened."""

from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from app.domain.entities.product import (
    Brand,
    Category,
    InventoryAdjustment,
    InventoryAdjustmentReason,
    Product,
    ProductImage,
    ProductStatus,
    ProductVariant,
)
from app.modules.catalog.service import CatalogService
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError


class FakeProductRepository:
    def __init__(self) -> None:
        self._products: dict[UUID, Product] = {}

    async def get_by_id(self, entity_id: UUID) -> Product | None:
        return self._products.get(entity_id)

    async def get_by_external_id(self, tenant_id: UUID, external_id: str) -> Product | None:
        return next(
            (p for p in self._products.values() if p.tenant_id == tenant_id and p.external_id == external_id),
            None,
        )

    async def list_by_tenant(self, tenant_id: UUID, *, limit=50, offset=0, category_id=None, brand_id=None):
        results = [p for p in self._products.values() if p.tenant_id == tenant_id]
        if category_id is not None:
            results = [p for p in results if p.category_id == category_id]
        if brand_id is not None:
            results = [p for p in results if p.brand_id == brand_id]
        return results[offset : offset + limit]

    async def list(self, *, limit=50, offset=0):
        return list(self._products.values())[offset : offset + limit]

    async def add(self, entity: Product) -> Product:
        self._products[entity.id] = entity
        return entity

    async def update(self, entity: Product) -> Product:
        self._products[entity.id] = entity
        return entity

    async def delete(self, entity_id: UUID) -> None:
        self._products.pop(entity_id, None)

    async def upsert_from_sync(self, tenant_id: UUID, product: Product) -> Product:
        existing = await self.get_by_external_id(tenant_id, product.external_id)
        if existing is not None:
            product.id = existing.id
        self._products[product.id] = product
        return product


class FakeProductEmbeddingRepository:
    async def upsert_embedding(self, product_id, tenant_id, vector) -> None:
        pass

    async def search_similar(self, tenant_id, query_vector, *, top_k=10):
        return []

    async def find_similar_to_product(self, tenant_id, product_id, *, top_k=10):
        return []


class FakeCategoryRepository:
    def __init__(self) -> None:
        self._categories: dict[UUID, Category] = {}

    async def get_by_id(self, entity_id: UUID) -> Category | None:
        return self._categories.get(entity_id)

    async def get_by_slug(self, tenant_id: UUID, slug: str) -> Category | None:
        return next(
            (c for c in self._categories.values() if c.tenant_id == tenant_id and c.slug == slug), None
        )

    async def list_by_tenant(self, tenant_id: UUID):
        return [c for c in self._categories.values() if c.tenant_id == tenant_id]

    async def list(self, *, limit=50, offset=0):
        return list(self._categories.values())[offset : offset + limit]

    async def add(self, entity: Category) -> Category:
        self._categories[entity.id] = entity
        return entity

    async def update(self, entity: Category) -> Category:
        self._categories[entity.id] = entity
        return entity

    async def delete(self, entity_id: UUID) -> None:
        self._categories.pop(entity_id, None)


class FakeBrandRepository:
    def __init__(self) -> None:
        self._brands: dict[UUID, Brand] = {}

    async def get_by_id(self, entity_id: UUID) -> Brand | None:
        return self._brands.get(entity_id)

    async def get_by_slug(self, tenant_id: UUID, slug: str) -> Brand | None:
        return next((b for b in self._brands.values() if b.tenant_id == tenant_id and b.slug == slug), None)

    async def list_by_tenant(self, tenant_id: UUID):
        return [b for b in self._brands.values() if b.tenant_id == tenant_id]

    async def list(self, *, limit=50, offset=0):
        return list(self._brands.values())[offset : offset + limit]

    async def add(self, entity: Brand) -> Brand:
        self._brands[entity.id] = entity
        return entity

    async def update(self, entity: Brand) -> Brand:
        self._brands[entity.id] = entity
        return entity

    async def delete(self, entity_id: UUID) -> None:
        self._brands.pop(entity_id, None)


class FakeProductVariantRepository:
    def __init__(self) -> None:
        self._variants: dict[UUID, ProductVariant] = {}

    async def get_by_id(self, entity_id: UUID) -> ProductVariant | None:
        return self._variants.get(entity_id)

    async def get_by_sku(self, product_id: UUID, sku: str) -> ProductVariant | None:
        return next(
            (v for v in self._variants.values() if v.product_id == product_id and v.sku == sku), None
        )

    async def list_by_product(self, product_id: UUID):
        return [v for v in self._variants.values() if v.product_id == product_id]

    async def list(self, *, limit=50, offset=0):
        return list(self._variants.values())[offset : offset + limit]

    async def add(self, entity: ProductVariant) -> ProductVariant:
        self._variants[entity.id] = entity
        return entity

    async def update(self, entity: ProductVariant) -> ProductVariant:
        self._variants[entity.id] = entity
        return entity

    async def delete(self, entity_id: UUID) -> None:
        self._variants.pop(entity_id, None)


class FakeProductImageRepository:
    def __init__(self) -> None:
        self._images: dict[UUID, ProductImage] = {}

    async def list_by_product(self, product_id: UUID):
        return sorted(
            (i for i in self._images.values() if i.product_id == product_id), key=lambda i: i.sort_order
        )

    async def add(self, image: ProductImage) -> ProductImage:
        self._images[image.id] = image
        return image

    async def delete(self, image_id: UUID) -> None:
        self._images.pop(image_id, None)

    async def reorder(self, product_id: UUID, ordered_image_ids):
        for position, image_id in enumerate(ordered_image_ids):
            self._images[image_id].sort_order = position
        return await self.list_by_product(product_id)

    async def set_primary(self, product_id: UUID, image_id: UUID):
        for image in self._images.values():
            if image.product_id == product_id:
                image.is_primary = image.id == image_id
        return await self.list_by_product(product_id)


class FakeInventoryAdjustmentRepository:
    def __init__(self) -> None:
        self.records: list[InventoryAdjustment] = []

    async def record(self, adjustment: InventoryAdjustment) -> InventoryAdjustment:
        self.records.append(adjustment)
        return adjustment

    async def list_by_product(self, product_id: UUID, *, limit=50):
        return [a for a in self.records if a.product_id == product_id][:limit]


@pytest.fixture
def service() -> CatalogService:
    return CatalogService(
        product_repository=FakeProductRepository(),
        embedding_repository=FakeProductEmbeddingRepository(),
        category_repository=FakeCategoryRepository(),
        brand_repository=FakeBrandRepository(),
        variant_repository=FakeProductVariantRepository(),
        image_repository=FakeProductImageRepository(),
        inventory_repository=FakeInventoryAdjustmentRepository(),
    )


async def _create_product(service: CatalogService, tenant_id: UUID, *, stock_qty: int = 10) -> Product:
    return await service.create_product(
        tenant_id,
        {"external_id": "SKU-1", "title": "Lawn Suit", "price": Decimal("2500"), "stock_qty": stock_qty},
    )


async def test_create_category_rejects_duplicate_slug(service: CatalogService) -> None:
    tenant_id = uuid4()
    await service.create_category(tenant_id, "Women", "women", None)

    with pytest.raises(ConflictError):
        await service.create_category(tenant_id, "Women Again", "women", None)


async def test_update_category_rejects_self_as_parent(service: CatalogService) -> None:
    tenant_id = uuid4()
    category = await service.create_category(tenant_id, "Women", "women", None)

    with pytest.raises(ValidationError):
        await service.update_category(tenant_id, category.id, "Women", "women", category.id)


async def test_create_product_rejects_duplicate_external_id(service: CatalogService) -> None:
    tenant_id = uuid4()
    await _create_product(service, tenant_id)

    with pytest.raises(ConflictError):
        await _create_product(service, tenant_id)


async def test_get_product_404s_for_wrong_tenant(service: CatalogService) -> None:
    product = await _create_product(service, uuid4())

    with pytest.raises(NotFoundError):
        await service.get_product(uuid4(), product.id)


async def test_adjust_inventory_restock_increases_stock_and_records_audit_row(
    service: CatalogService,
) -> None:
    tenant_id = uuid4()
    product = await _create_product(service, tenant_id, stock_qty=10)

    adjustment = await service.adjust_inventory(tenant_id, product.id, 20, InventoryAdjustmentReason.RESTOCK)

    assert adjustment.resulting_stock_qty == 30
    updated_product = await service.get_product(tenant_id, product.id)
    assert updated_product.stock_qty == 30
    assert updated_product.status == ProductStatus.ACTIVE


async def test_adjust_inventory_sale_can_zero_out_stock_and_marks_out_of_stock(
    service: CatalogService,
) -> None:
    tenant_id = uuid4()
    product = await _create_product(service, tenant_id, stock_qty=5)

    await service.adjust_inventory(tenant_id, product.id, -5, InventoryAdjustmentReason.SALE)

    updated_product = await service.get_product(tenant_id, product.id)
    assert updated_product.stock_qty == 0
    assert updated_product.status == ProductStatus.OUT_OF_STOCK


async def test_adjust_inventory_rejects_negative_resulting_stock(service: CatalogService) -> None:
    tenant_id = uuid4()
    product = await _create_product(service, tenant_id, stock_qty=5)

    with pytest.raises(ValidationError):
        await service.adjust_inventory(tenant_id, product.id, -10, InventoryAdjustmentReason.SALE)

    # The rejected adjustment must not have partially applied.
    unchanged_product = await service.get_product(tenant_id, product.id)
    assert unchanged_product.stock_qty == 5


async def test_first_image_added_is_primary_by_default(service: CatalogService) -> None:
    tenant_id = uuid4()
    product = await _create_product(service, tenant_id)

    first = await service.add_image(tenant_id, product.id, "https://cdn.example.com/a.jpg", None)
    second = await service.add_image(tenant_id, product.id, "https://cdn.example.com/b.jpg", None)

    assert first.is_primary is True
    assert second.is_primary is False


async def test_set_primary_image_unsets_the_previous_primary(service: CatalogService) -> None:
    tenant_id = uuid4()
    product = await _create_product(service, tenant_id)
    first = await service.add_image(tenant_id, product.id, "https://cdn.example.com/a.jpg", None)
    second = await service.add_image(tenant_id, product.id, "https://cdn.example.com/b.jpg", None)

    images = await service.set_primary_image(tenant_id, product.id, second.id)

    by_id = {i.id: i for i in images}
    assert by_id[second.id].is_primary is True
    assert by_id[first.id].is_primary is False
