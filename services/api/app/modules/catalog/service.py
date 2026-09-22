from uuid import UUID, uuid4

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
from app.shared.exceptions import ConflictError, NotFoundError, ValidationError


class CatalogService:
    """Every catalog-adjacent use-case — products, categories, brands,
    variants, images, inventory — lives in one service, matching this
    codebase's existing precedent (UserService covers both StoreUser and
    AdminUser) rather than one service class per entity. They're one
    bounded context: creating a product references a category/brand,
    adjusting inventory changes a product's own stock_qty, and splitting
    six services that all still need to reach into ProductRepository
    wouldn't reduce coupling, just hide it behind more constructor
    parameters everywhere.

    Embedding generation itself (calling out to the embedding model)
    belongs to the search module, not here — this service only persists
    whatever vector it's given, keeping the AI-provider dependency out of
    the catalog module entirely."""

    def __init__(
        self,
        product_repository: ProductRepository,
        embedding_repository: ProductEmbeddingRepository,
        category_repository: CategoryRepository,
        brand_repository: BrandRepository,
        variant_repository: ProductVariantRepository,
        image_repository: ProductImageRepository,
        inventory_repository: InventoryAdjustmentRepository,
    ) -> None:
        self._products = product_repository
        self._embeddings = embedding_repository
        self._categories = category_repository
        self._brands = brand_repository
        self._variants = variant_repository
        self._images = image_repository
        self._inventory = inventory_repository

    # --- Products ---

    async def sync_product(self, tenant_id: UUID, upsert: dict) -> Product:
        """Catalog sync entry point (FR-2.2) — idempotent on external_id,
        used by API/CSV/Shopify/WooCommerce connectors."""
        product = Product(
            id=uuid4(),
            tenant_id=tenant_id,
            external_id=upsert["external_id"],
            title=upsert["title"],
            price=upsert["price"],
            currency=upsert.get("currency", "PKR"),
            stock_qty=upsert.get("stock_qty", 0),
            status=ProductStatus.ACTIVE if upsert.get("stock_qty", 0) > 0 else ProductStatus.OUT_OF_STOCK,
            description=upsert.get("description"),
            images=upsert.get("images", []),
            attributes=upsert.get("attributes", {}),
        )
        return await self._products.upsert_from_sync(tenant_id, product)

    async def create_product(self, tenant_id: UUID, data: dict) -> Product:
        """Direct product creation (as opposed to sync_product's
        connector-fed upsert) — the dashboard's own "add product" form."""
        if data.get("category_id") is not None:
            await self._require_category(tenant_id, data["category_id"])
        if data.get("brand_id") is not None:
            await self._require_brand(tenant_id, data["brand_id"])

        existing = await self._products.get_by_external_id(tenant_id, data["external_id"])
        if existing is not None:
            raise ConflictError(f"A product with external_id '{data['external_id']}' already exists")

        stock_qty = data.get("stock_qty", 0)
        product = Product(
            id=uuid4(),
            tenant_id=tenant_id,
            external_id=data["external_id"],
            title=data["title"],
            price=data["price"],
            currency=data.get("currency", "PKR"),
            stock_qty=stock_qty,
            status=ProductStatus.ACTIVE if stock_qty > 0 else ProductStatus.OUT_OF_STOCK,
            description=data.get("description"),
            category_id=data.get("category_id"),
            brand_id=data.get("brand_id"),
            images=data.get("images", []),
            attributes=data.get("attributes", {}),
        )
        return await self._products.add(product)

    async def get_product(self, tenant_id: UUID, product_id: UUID) -> Product:
        product = await self._products.get_by_id(product_id)
        if product is None or product.tenant_id != tenant_id:
            raise NotFoundError(f"Product {product_id} not found")
        return product

    async def update_product(self, tenant_id: UUID, product_id: UUID, data: dict) -> Product:
        product = await self.get_product(tenant_id, product_id)
        if "category_id" in data and data["category_id"] is not None:
            await self._require_category(tenant_id, data["category_id"])
        if "brand_id" in data and data["brand_id"] is not None:
            await self._require_brand(tenant_id, data["brand_id"])

        product.title = data.get("title", product.title)
        product.description = data.get("description", product.description)
        product.price = data.get("price", product.price)
        product.category_id = data.get("category_id", product.category_id)
        product.brand_id = data.get("brand_id", product.brand_id)
        product.images = data.get("images", product.images)
        product.attributes = data.get("attributes", product.attributes)
        if "status" in data:
            product.status = ProductStatus(data["status"])
        return await self._products.update(product)

    async def delete_product(self, tenant_id: UUID, product_id: UUID) -> None:
        await self.get_product(tenant_id, product_id)  # 404s if missing/wrong tenant
        await self._products.delete(product_id)

    async def list_products(
        self,
        tenant_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
        category_id: UUID | None = None,
        brand_id: UUID | None = None,
    ) -> list[Product]:
        return await self._products.list_by_tenant(
            tenant_id, limit=limit, offset=offset, category_id=category_id, brand_id=brand_id
        )

    async def find_similar(
        self, tenant_id: UUID, query_vector: list[float], *, top_k: int = 10
    ) -> list[Product]:
        """Backs FR-4.3 (tenant-isolated semantic retrieval) — the search
        module supplies the query embedding, this just runs the lookup."""
        return await self._embeddings.search_similar(tenant_id, query_vector, top_k=top_k)

    async def find_similar_to_product(
        self, tenant_id: UUID, product_id: UUID, *, top_k: int = 10
    ) -> list[Product]:
        return await self._embeddings.find_similar_to_product(tenant_id, product_id, top_k=top_k)

    # --- Categories ---

    async def create_category(
        self, tenant_id: UUID, name: str, slug: str, parent_id: UUID | None
    ) -> Category:
        existing = await self._categories.get_by_slug(tenant_id, slug)
        if existing is not None:
            raise ConflictError(f"A category with slug '{slug}' already exists")
        if parent_id is not None:
            await self._require_category(tenant_id, parent_id)

        category = Category(id=uuid4(), tenant_id=tenant_id, name=name, slug=slug, parent_id=parent_id)
        return await self._categories.add(category)

    async def list_categories(self, tenant_id: UUID) -> list[Category]:
        return await self._categories.list_by_tenant(tenant_id)

    async def update_category(
        self, tenant_id: UUID, category_id: UUID, name: str, slug: str, parent_id: UUID | None
    ) -> Category:
        category = await self._require_category(tenant_id, category_id)
        if parent_id == category_id:
            raise ValidationError("A category cannot be its own parent")
        if parent_id is not None:
            await self._require_category(tenant_id, parent_id)

        category.name = name
        category.slug = slug
        category.parent_id = parent_id
        return await self._categories.update(category)

    async def delete_category(self, tenant_id: UUID, category_id: UUID) -> None:
        await self._require_category(tenant_id, category_id)
        await self._categories.delete(category_id)

    async def _require_category(self, tenant_id: UUID, category_id: UUID) -> Category:
        category = await self._categories.get_by_id(category_id)
        if category is None or category.tenant_id != tenant_id:
            raise NotFoundError(f"Category {category_id} not found")
        return category

    # --- Brands ---

    async def create_brand(self, tenant_id: UUID, name: str, slug: str, logo_url: str | None) -> Brand:
        existing = await self._brands.get_by_slug(tenant_id, slug)
        if existing is not None:
            raise ConflictError(f"A brand with slug '{slug}' already exists")

        brand = Brand(id=uuid4(), tenant_id=tenant_id, name=name, slug=slug, logo_url=logo_url)
        return await self._brands.add(brand)

    async def list_brands(self, tenant_id: UUID) -> list[Brand]:
        return await self._brands.list_by_tenant(tenant_id)

    async def update_brand(
        self, tenant_id: UUID, brand_id: UUID, name: str, slug: str, logo_url: str | None
    ) -> Brand:
        brand = await self._require_brand(tenant_id, brand_id)
        brand.name = name
        brand.slug = slug
        brand.logo_url = logo_url
        return await self._brands.update(brand)

    async def delete_brand(self, tenant_id: UUID, brand_id: UUID) -> None:
        await self._require_brand(tenant_id, brand_id)
        await self._brands.delete(brand_id)

    async def _require_brand(self, tenant_id: UUID, brand_id: UUID) -> Brand:
        brand = await self._brands.get_by_id(brand_id)
        if brand is None or brand.tenant_id != tenant_id:
            raise NotFoundError(f"Brand {brand_id} not found")
        return brand

    # --- Variants ---

    async def create_variant(self, tenant_id: UUID, product_id: UUID, data: dict) -> ProductVariant:
        await self.get_product(tenant_id, product_id)  # 404s if missing/wrong tenant
        existing = await self._variants.get_by_sku(product_id, data["sku"])
        if existing is not None:
            raise ConflictError(f"A variant with SKU '{data['sku']}' already exists for this product")

        stock_qty = data.get("stock_qty", 0)
        variant = ProductVariant(
            id=uuid4(),
            tenant_id=tenant_id,
            product_id=product_id,
            sku=data["sku"],
            attributes=data.get("attributes", {}),
            price=data.get("price"),
            stock_qty=stock_qty,
            status=ProductStatus.ACTIVE if stock_qty > 0 else ProductStatus.OUT_OF_STOCK,
        )
        return await self._variants.add(variant)

    async def list_variants(self, tenant_id: UUID, product_id: UUID) -> list[ProductVariant]:
        await self.get_product(tenant_id, product_id)
        return await self._variants.list_by_product(product_id)

    async def update_variant(self, tenant_id: UUID, variant_id: UUID, data: dict) -> ProductVariant:
        variant = await self._require_variant(tenant_id, variant_id)
        variant.sku = data.get("sku", variant.sku)
        variant.attributes = data.get("attributes", variant.attributes)
        variant.price = data.get("price", variant.price)
        if "stock_qty" in data:
            variant.stock_qty = data["stock_qty"]
        if "status" in data:
            variant.status = ProductStatus(data["status"])
        return await self._variants.update(variant)

    async def delete_variant(self, tenant_id: UUID, variant_id: UUID) -> None:
        await self._require_variant(tenant_id, variant_id)
        await self._variants.delete(variant_id)

    async def _require_variant(self, tenant_id: UUID, variant_id: UUID) -> ProductVariant:
        variant = await self._variants.get_by_id(variant_id)
        if variant is None or variant.tenant_id != tenant_id:
            raise NotFoundError(f"Product variant {variant_id} not found")
        return variant

    # --- Images ---

    async def add_image(
        self, tenant_id: UUID, product_id: UUID, url: str, alt_text: str | None
    ) -> ProductImage:
        await self.get_product(tenant_id, product_id)
        existing = await self._images.list_by_product(product_id)
        image = ProductImage(
            id=uuid4(),
            tenant_id=tenant_id,
            product_id=product_id,
            url=url,
            alt_text=alt_text,
            sort_order=len(existing),
            is_primary=len(existing) == 0,  # first image for a product is primary by default
        )
        return await self._images.add(image)

    async def list_images(self, tenant_id: UUID, product_id: UUID) -> list[ProductImage]:
        await self.get_product(tenant_id, product_id)
        return await self._images.list_by_product(product_id)

    async def delete_image(self, tenant_id: UUID, product_id: UUID, image_id: UUID) -> None:
        await self.get_product(tenant_id, product_id)
        await self._images.delete(image_id)

    async def reorder_images(
        self, tenant_id: UUID, product_id: UUID, ordered_image_ids: list[UUID]
    ) -> list[ProductImage]:
        await self.get_product(tenant_id, product_id)
        return await self._images.reorder(product_id, ordered_image_ids)

    async def set_primary_image(
        self, tenant_id: UUID, product_id: UUID, image_id: UUID
    ) -> list[ProductImage]:
        await self.get_product(tenant_id, product_id)
        return await self._images.set_primary(product_id, image_id)

    # --- Inventory ---

    async def adjust_inventory(
        self,
        tenant_id: UUID,
        product_id: UUID,
        delta: int,
        reason: InventoryAdjustmentReason,
        variant_id: UUID | None = None,
    ) -> InventoryAdjustment:
        """The only path that changes stock — never a bare `UPDATE
        products SET stock_qty = ...`, so every change has a reason and a
        timestamp attached (see InventoryAdjustment's docstring)."""
        if variant_id is not None:
            variant = await self._require_variant(tenant_id, variant_id)
            if variant.product_id != product_id:
                raise ValidationError("Variant does not belong to the given product")
            new_qty = variant.stock_qty + delta
            if new_qty < 0:
                raise ValidationError(
                    f"Adjustment would result in negative stock ({new_qty}) for variant {variant_id}"
                )
            variant.stock_qty = new_qty
            variant.status = ProductStatus.ACTIVE if new_qty > 0 else ProductStatus.OUT_OF_STOCK
            await self._variants.update(variant)
        else:
            product = await self.get_product(tenant_id, product_id)
            new_qty = product.stock_qty + delta
            if new_qty < 0:
                raise ValidationError(
                    f"Adjustment would result in negative stock ({new_qty}) for product {product_id}"
                )
            product.stock_qty = new_qty
            product.status = ProductStatus.ACTIVE if new_qty > 0 else ProductStatus.OUT_OF_STOCK
            await self._products.update(product)

        adjustment = InventoryAdjustment(
            id=uuid4(),
            tenant_id=tenant_id,
            product_id=product_id,
            variant_id=variant_id,
            delta=delta,
            reason=reason,
            resulting_stock_qty=new_qty,
        )
        return await self._inventory.record(adjustment)

    async def get_inventory_history(
        self, tenant_id: UUID, product_id: UUID, *, limit: int = 50
    ) -> list[InventoryAdjustment]:
        await self.get_product(tenant_id, product_id)
        return await self._inventory.list_by_product(product_id, limit=limit)
