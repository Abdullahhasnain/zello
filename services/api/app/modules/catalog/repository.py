from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy import update as sa_update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.domain.repositories.product_repository import (
    BrandRepository,
    CategoryRepository,
    InventoryAdjustmentRepository,
    ProductEmbeddingRepository,
    ProductImageRepository,
    ProductRepository,
    ProductVariantRepository,
)
from app.modules.catalog.models import (
    BrandModel,
    CategoryModel,
    InventoryAdjustmentModel,
    ProductEmbeddingModel,
    ProductImageModel,
    ProductModel,
    ProductVariantModel,
)
from app.shared.exceptions import NotFoundError


def _to_entity(model: ProductModel) -> Product:
    return Product(
        id=model.id,
        tenant_id=model.tenant_id,
        external_id=model.external_id,
        title=model.title,
        description=model.description,
        price=model.price,
        currency=model.currency,
        stock_qty=model.stock_qty,
        status=ProductStatus(model.status),
        category_id=model.category_id,
        brand_id=model.brand_id,
        images=model.images,
        attributes=model.attributes,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _category_to_entity(model: CategoryModel) -> Category:
    return Category(
        id=model.id,
        tenant_id=model.tenant_id,
        name=model.name,
        slug=model.slug,
        parent_id=model.parent_id,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _brand_to_entity(model: BrandModel) -> Brand:
    return Brand(
        id=model.id,
        tenant_id=model.tenant_id,
        name=model.name,
        slug=model.slug,
        logo_url=model.logo_url,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _variant_to_entity(model: ProductVariantModel) -> ProductVariant:
    return ProductVariant(
        id=model.id,
        tenant_id=model.tenant_id,
        product_id=model.product_id,
        sku=model.sku,
        attributes=model.attributes,
        price=model.price,
        stock_qty=model.stock_qty,
        status=ProductStatus(model.status),
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _image_to_entity(model: ProductImageModel) -> ProductImage:
    return ProductImage(
        id=model.id,
        tenant_id=model.tenant_id,
        product_id=model.product_id,
        url=model.url,
        alt_text=model.alt_text,
        sort_order=model.sort_order,
        is_primary=model.is_primary,
        created_at=model.created_at,
    )


def _adjustment_to_entity(model: InventoryAdjustmentModel) -> InventoryAdjustment:
    return InventoryAdjustment(
        id=model.id,
        tenant_id=model.tenant_id,
        product_id=model.product_id,
        variant_id=model.variant_id,
        delta=model.delta,
        reason=InventoryAdjustmentReason(model.reason),
        resulting_stock_qty=model.resulting_stock_qty,
        created_at=model.created_at,
    )


class SqlAlchemyProductRepository(ProductRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Product | None:
        model = await self._session.get(ProductModel, entity_id)
        return _to_entity(model) if model else None

    async def get_by_external_id(self, tenant_id: UUID, external_id: str) -> Product | None:
        result = await self._session.execute(
            select(ProductModel).where(
                ProductModel.tenant_id == tenant_id, ProductModel.external_id == external_id
            )
        )
        model = result.scalar_one_or_none()
        return _to_entity(model) if model else None

    async def list_by_tenant(
        self,
        tenant_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        category_id: UUID | None = None,
        brand_id: UUID | None = None,
    ) -> list[Product]:
        query = select(ProductModel).where(ProductModel.tenant_id == tenant_id)
        if category_id is not None:
            query = query.where(ProductModel.category_id == category_id)
        if brand_id is not None:
            query = query.where(ProductModel.brand_id == brand_id)
        result = await self._session.execute(query.limit(limit).offset(offset))
        return [_to_entity(m) for m in result.scalars().all()]

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Product]:
        result = await self._session.execute(select(ProductModel).limit(limit).offset(offset))
        return [_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Product) -> Product:
        model = ProductModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            external_id=entity.external_id,
            title=entity.title,
            description=entity.description,
            price=entity.price,
            currency=entity.currency,
            stock_qty=entity.stock_qty,
            status=entity.status.value,
            category_id=entity.category_id,
            brand_id=entity.brand_id,
            images=entity.images,
            attributes=entity.attributes,
        )
        self._session.add(model)
        await self._session.flush()
        return _to_entity(model)

    async def update(self, entity: Product) -> Product:
        model = await self._session.get(ProductModel, entity.id)
        if model is None:
            raise NotFoundError(f"Product {entity.id} not found")
        model.title = entity.title
        model.description = entity.description
        model.price = entity.price
        model.stock_qty = entity.stock_qty
        model.status = entity.status.value
        model.category_id = entity.category_id
        model.brand_id = entity.brand_id
        model.images = entity.images
        model.attributes = entity.attributes
        await self._session.flush()
        return _to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(ProductModel, entity_id)
        if model is not None:
            await self._session.delete(model)

    async def upsert_from_sync(self, tenant_id: UUID, product: Product) -> Product:
        """True upsert via Postgres `ON CONFLICT`, not a select-then-branch —
        catalog syncs run concurrently per tenant and a race between two
        sync jobs must not create duplicate rows."""
        stmt = (
            pg_insert(ProductModel)
            .values(
                id=product.id,
                tenant_id=tenant_id,
                external_id=product.external_id,
                title=product.title,
                description=product.description,
                price=product.price,
                currency=product.currency,
                stock_qty=product.stock_qty,
                status=product.status.value,
                images=product.images,
                attributes=product.attributes,
            )
            .on_conflict_do_update(
                index_elements=["tenant_id", "external_id"],
                set_={
                    "title": product.title,
                    "description": product.description,
                    "price": product.price,
                    "stock_qty": product.stock_qty,
                    "status": product.status.value,
                    "images": product.images,
                    "attributes": product.attributes,
                },
            )
            .returning(ProductModel)
        )
        result = await self._session.execute(stmt)
        await self._session.flush()
        return _to_entity(result.scalar_one())


class SqlAlchemyProductEmbeddingRepository(ProductEmbeddingRepository):
    def __init__(self, session: AsyncSession, model_version: str = "text-embedding-3-small") -> None:
        self._session = session
        self._model_version = model_version

    async def upsert_embedding(self, product_id: UUID, tenant_id: UUID, vector: list[float]) -> None:
        stmt = (
            pg_insert(ProductEmbeddingModel)
            .values(
                product_id=product_id,
                tenant_id=tenant_id,
                model_version=self._model_version,
                embedding=vector,
            )
            .on_conflict_do_update(
                index_elements=["product_id", "model_version"],
                set_={"embedding": vector},
            )
        )
        await self._session.execute(stmt)
        await self._session.flush()

    async def search_similar(
        self, tenant_id: UUID, query_vector: list[float], *, top_k: int = 10
    ) -> list[Product]:
        result = await self._session.execute(
            select(ProductModel)
            .join(ProductEmbeddingModel, ProductEmbeddingModel.product_id == ProductModel.id)
            .where(
                ProductEmbeddingModel.tenant_id == tenant_id,  # tenant isolation, not just a filter
                ProductEmbeddingModel.model_version == self._model_version,
                ProductModel.status == ProductStatus.ACTIVE.value,
            )
            .order_by(ProductEmbeddingModel.embedding.cosine_distance(query_vector))
            .limit(top_k)
        )
        return [_to_entity(m) for m in result.scalars().all()]

    async def find_similar_to_product(
        self, tenant_id: UUID, product_id: UUID, *, top_k: int = 10
    ) -> list[Product]:
        source = await self._session.execute(
            select(ProductEmbeddingModel.embedding).where(
                ProductEmbeddingModel.product_id == product_id,
                ProductEmbeddingModel.tenant_id == tenant_id,
                ProductEmbeddingModel.model_version == self._model_version,
            )
        )
        source_vector = source.scalar_one_or_none()
        if source_vector is None:
            return []

        result = await self._session.execute(
            select(ProductModel)
            .join(ProductEmbeddingModel, ProductEmbeddingModel.product_id == ProductModel.id)
            .where(
                ProductEmbeddingModel.tenant_id == tenant_id,
                ProductEmbeddingModel.model_version == self._model_version,
                ProductModel.id != product_id,
                ProductModel.status == ProductStatus.ACTIVE.value,
            )
            .order_by(ProductEmbeddingModel.embedding.cosine_distance(source_vector))
            .limit(top_k)
        )
        return [_to_entity(m) for m in result.scalars().all()]


class SqlAlchemyCategoryRepository(CategoryRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Category | None:
        model = await self._session.get(CategoryModel, entity_id)
        return _category_to_entity(model) if model else None

    async def get_by_slug(self, tenant_id: UUID, slug: str) -> Category | None:
        result = await self._session.execute(
            select(CategoryModel).where(CategoryModel.tenant_id == tenant_id, CategoryModel.slug == slug)
        )
        model = result.scalar_one_or_none()
        return _category_to_entity(model) if model else None

    async def list_by_tenant(self, tenant_id: UUID) -> list[Category]:
        result = await self._session.execute(
            select(CategoryModel).where(CategoryModel.tenant_id == tenant_id).order_by(CategoryModel.name)
        )
        return [_category_to_entity(m) for m in result.scalars().all()]

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Category]:
        result = await self._session.execute(select(CategoryModel).limit(limit).offset(offset))
        return [_category_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Category) -> Category:
        model = CategoryModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            name=entity.name,
            slug=entity.slug,
            parent_id=entity.parent_id,
        )
        self._session.add(model)
        await self._session.flush()
        return _category_to_entity(model)

    async def update(self, entity: Category) -> Category:
        model = await self._session.get(CategoryModel, entity.id)
        if model is None:
            raise NotFoundError(f"Category {entity.id} not found")
        model.name = entity.name
        model.slug = entity.slug
        model.parent_id = entity.parent_id
        await self._session.flush()
        return _category_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(CategoryModel, entity_id)
        if model is not None:
            await self._session.delete(model)


class SqlAlchemyBrandRepository(BrandRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Brand | None:
        model = await self._session.get(BrandModel, entity_id)
        return _brand_to_entity(model) if model else None

    async def get_by_slug(self, tenant_id: UUID, slug: str) -> Brand | None:
        result = await self._session.execute(
            select(BrandModel).where(BrandModel.tenant_id == tenant_id, BrandModel.slug == slug)
        )
        model = result.scalar_one_or_none()
        return _brand_to_entity(model) if model else None

    async def list_by_tenant(self, tenant_id: UUID) -> list[Brand]:
        result = await self._session.execute(
            select(BrandModel).where(BrandModel.tenant_id == tenant_id).order_by(BrandModel.name)
        )
        return [_brand_to_entity(m) for m in result.scalars().all()]

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Brand]:
        result = await self._session.execute(select(BrandModel).limit(limit).offset(offset))
        return [_brand_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Brand) -> Brand:
        model = BrandModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            name=entity.name,
            slug=entity.slug,
            logo_url=entity.logo_url,
        )
        self._session.add(model)
        await self._session.flush()
        return _brand_to_entity(model)

    async def update(self, entity: Brand) -> Brand:
        model = await self._session.get(BrandModel, entity.id)
        if model is None:
            raise NotFoundError(f"Brand {entity.id} not found")
        model.name = entity.name
        model.slug = entity.slug
        model.logo_url = entity.logo_url
        await self._session.flush()
        return _brand_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(BrandModel, entity_id)
        if model is not None:
            await self._session.delete(model)


class SqlAlchemyProductVariantRepository(ProductVariantRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> ProductVariant | None:
        model = await self._session.get(ProductVariantModel, entity_id)
        return _variant_to_entity(model) if model else None

    async def get_by_sku(self, product_id: UUID, sku: str) -> ProductVariant | None:
        result = await self._session.execute(
            select(ProductVariantModel).where(
                ProductVariantModel.product_id == product_id, ProductVariantModel.sku == sku
            )
        )
        model = result.scalar_one_or_none()
        return _variant_to_entity(model) if model else None

    async def list_by_product(self, product_id: UUID) -> list[ProductVariant]:
        result = await self._session.execute(
            select(ProductVariantModel).where(ProductVariantModel.product_id == product_id)
        )
        return [_variant_to_entity(m) for m in result.scalars().all()]

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[ProductVariant]:
        result = await self._session.execute(select(ProductVariantModel).limit(limit).offset(offset))
        return [_variant_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: ProductVariant) -> ProductVariant:
        model = ProductVariantModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            product_id=entity.product_id,
            sku=entity.sku,
            attributes=entity.attributes,
            price=entity.price,
            stock_qty=entity.stock_qty,
            status=entity.status.value,
        )
        self._session.add(model)
        await self._session.flush()
        return _variant_to_entity(model)

    async def update(self, entity: ProductVariant) -> ProductVariant:
        model = await self._session.get(ProductVariantModel, entity.id)
        if model is None:
            raise NotFoundError(f"Product variant {entity.id} not found")
        model.sku = entity.sku
        model.attributes = entity.attributes
        model.price = entity.price
        model.stock_qty = entity.stock_qty
        model.status = entity.status.value
        await self._session.flush()
        return _variant_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(ProductVariantModel, entity_id)
        if model is not None:
            await self._session.delete(model)


class SqlAlchemyProductImageRepository(ProductImageRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_by_product(self, product_id: UUID) -> list[ProductImage]:
        result = await self._session.execute(
            select(ProductImageModel)
            .where(ProductImageModel.product_id == product_id)
            .order_by(ProductImageModel.sort_order)
        )
        return [_image_to_entity(m) for m in result.scalars().all()]

    async def add(self, image: ProductImage) -> ProductImage:
        model = ProductImageModel(
            id=image.id,
            tenant_id=image.tenant_id,
            product_id=image.product_id,
            url=image.url,
            alt_text=image.alt_text,
            sort_order=image.sort_order,
            is_primary=image.is_primary,
        )
        self._session.add(model)
        await self._session.flush()
        return _image_to_entity(model)

    async def delete(self, image_id: UUID) -> None:
        model = await self._session.get(ProductImageModel, image_id)
        if model is not None:
            await self._session.delete(model)

    async def reorder(self, product_id: UUID, ordered_image_ids: list[UUID]) -> list[ProductImage]:
        for position, image_id in enumerate(ordered_image_ids):
            await self._session.execute(
                sa_update(ProductImageModel)
                .where(ProductImageModel.id == image_id, ProductImageModel.product_id == product_id)
                .values(sort_order=position)
            )
        await self._session.flush()
        return await self.list_by_product(product_id)

    async def set_primary(self, product_id: UUID, image_id: UUID) -> list[ProductImage]:
        # Postgres has no partial-unique-index shortcut in play here, so
        # "exactly one primary image" is enforced procedurally: clear every
        # image for the product, then set the chosen one — never two
        # UPDATE statements that could observe each other's half-applied state
        # since both run in the same transaction as the calling request.
        await self._session.execute(
            sa_update(ProductImageModel)
            .where(ProductImageModel.product_id == product_id)
            .values(is_primary=False)
        )
        await self._session.execute(
            sa_update(ProductImageModel)
            .where(ProductImageModel.id == image_id, ProductImageModel.product_id == product_id)
            .values(is_primary=True)
        )
        await self._session.flush()
        return await self.list_by_product(product_id)


class SqlAlchemyInventoryAdjustmentRepository(InventoryAdjustmentRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, adjustment: InventoryAdjustment) -> InventoryAdjustment:
        model = InventoryAdjustmentModel(
            id=adjustment.id,
            tenant_id=adjustment.tenant_id,
            product_id=adjustment.product_id,
            variant_id=adjustment.variant_id,
            delta=adjustment.delta,
            reason=adjustment.reason.value,
            resulting_stock_qty=adjustment.resulting_stock_qty,
        )
        self._session.add(model)
        await self._session.flush()
        return _adjustment_to_entity(model)

    async def list_by_product(self, product_id: UUID, *, limit: int = 50) -> list[InventoryAdjustment]:
        result = await self._session.execute(
            select(InventoryAdjustmentModel)
            .where(InventoryAdjustmentModel.product_id == product_id)
            .order_by(InventoryAdjustmentModel.created_at.desc())
            .limit(limit)
        )
        return [_adjustment_to_entity(m) for m in result.scalars().all()]
