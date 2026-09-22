from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.domain.entities.product import InventoryAdjustmentReason
from app.modules.catalog.dependencies import get_catalog_service, get_catalog_service_for_customer
from app.modules.catalog.schemas import (
    BrandCreate,
    BrandRead,
    BrandUpdate,
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    InventoryAdjustmentRead,
    InventoryAdjustmentRequest,
    ProductCreate,
    ProductImageCreate,
    ProductImageRead,
    ProductImageReorder,
    ProductRead,
    ProductUpdate,
    ProductUpsert,
    ProductVariantCreate,
    ProductVariantRead,
    ProductVariantUpdate,
)
from app.modules.catalog.service import CatalogService
from app.modules.search.dependencies import get_search_service_for_store
from app.modules.search.service import SearchService
from app.shared.deps import get_current_customer_auth, get_current_store_auth, require_role
from app.shared.pagination import PageParams, page_params

router = APIRouter(prefix="/catalog", tags=["catalog"])


# --- Storefront (customer-facing, guest-session auth) ---
# Read-only browse for the public storefront pages — same RLS tenant
# isolation as every widget endpoint, via get_catalog_service_for_customer.


@router.get(
    "/storefront/products",
    response_model=list[ProductRead],
    summary="Browse products (storefront)",
)
async def storefront_list_products(
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service_for_customer)],
    pagination: Annotated[PageParams, Depends(page_params)],
    category_id: UUID | None = None,
) -> list[ProductRead]:
    assert auth.tenant_id is not None
    products = await catalog_service.list_products(
        auth.tenant_id, limit=pagination.limit, offset=pagination.offset, category_id=category_id
    )
    # Shoppers never see archived products; out-of-stock stays visible so
    # the storefront can label it rather than have items vanish silently.
    return [ProductRead.model_validate(p) for p in products if p.status.value != "archived"]


@router.get(
    "/storefront/products/{product_id}",
    response_model=ProductRead,
    summary="Product details (storefront)",
)
async def storefront_get_product(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service_for_customer)],
) -> ProductRead:
    assert auth.tenant_id is not None
    product = await catalog_service.get_product(auth.tenant_id, product_id)
    return ProductRead.model_validate(product)


@router.get(
    "/storefront/categories",
    response_model=list[CategoryRead],
    summary="List categories (storefront)",
)
async def storefront_list_categories(
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service_for_customer)],
) -> list[CategoryRead]:
    assert auth.tenant_id is not None
    categories = await catalog_service.list_categories(auth.tenant_id)
    return [CategoryRead.model_validate(c) for c in categories]


# --- Categories ---


@router.post("/categories", response_model=CategoryRead, status_code=201, summary="Create a category")
async def create_category(
    payload: CategoryCreate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> CategoryRead:
    assert auth.tenant_id is not None
    category = await catalog_service.create_category(
        auth.tenant_id, payload.name, payload.slug, payload.parent_id
    )
    return CategoryRead.model_validate(category)


@router.get("/categories", response_model=list[CategoryRead], summary="List categories")
async def list_categories(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[CategoryRead]:
    assert auth.tenant_id is not None
    categories = await catalog_service.list_categories(auth.tenant_id)
    return [CategoryRead.model_validate(c) for c in categories]


@router.patch("/categories/{category_id}", response_model=CategoryRead, summary="Update a category")
async def update_category(
    category_id: UUID,
    payload: CategoryUpdate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> CategoryRead:
    assert auth.tenant_id is not None
    category = await catalog_service.update_category(
        auth.tenant_id, category_id, payload.name, payload.slug, payload.parent_id
    )
    return CategoryRead.model_validate(category)


@router.delete("/categories/{category_id}", status_code=204, summary="Delete a category")
async def delete_category(
    category_id: UUID,
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> None:
    assert auth.tenant_id is not None
    await catalog_service.delete_category(auth.tenant_id, category_id)


# --- Brands ---


@router.post("/brands", response_model=BrandRead, status_code=201, summary="Create a brand")
async def create_brand(
    payload: BrandCreate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> BrandRead:
    assert auth.tenant_id is not None
    brand = await catalog_service.create_brand(auth.tenant_id, payload.name, payload.slug, payload.logo_url)
    return BrandRead.model_validate(brand)


@router.get("/brands", response_model=list[BrandRead], summary="List brands")
async def list_brands(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[BrandRead]:
    assert auth.tenant_id is not None
    brands = await catalog_service.list_brands(auth.tenant_id)
    return [BrandRead.model_validate(b) for b in brands]


@router.patch("/brands/{brand_id}", response_model=BrandRead, summary="Update a brand")
async def update_brand(
    brand_id: UUID,
    payload: BrandUpdate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> BrandRead:
    assert auth.tenant_id is not None
    brand = await catalog_service.update_brand(
        auth.tenant_id, brand_id, payload.name, payload.slug, payload.logo_url
    )
    return BrandRead.model_validate(brand)


@router.delete("/brands/{brand_id}", status_code=204, summary="Delete a brand")
async def delete_brand(
    brand_id: UUID,
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> None:
    assert auth.tenant_id is not None
    await catalog_service.delete_brand(auth.tenant_id, brand_id)


# --- Products ---


@router.get("/products", response_model=list[ProductRead], summary="List products")
async def list_products(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
    pagination: Annotated[PageParams, Depends(page_params)],
    category_id: UUID | None = None,
    brand_id: UUID | None = None,
) -> list[ProductRead]:
    assert auth.tenant_id is not None
    products = await catalog_service.list_products(
        auth.tenant_id,
        limit=pagination.limit,
        offset=pagination.offset,
        category_id=category_id,
        brand_id=brand_id,
    )
    return [ProductRead.model_validate(p) for p in products]


@router.post("/products", response_model=ProductRead, status_code=201, summary="Create a product")
async def create_product(
    payload: ProductCreate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
    search_service: Annotated[SearchService, Depends(get_search_service_for_store)],
) -> ProductRead:
    assert auth.tenant_id is not None
    product = await catalog_service.create_product(auth.tenant_id, payload.model_dump(by_alias=False))
    await search_service.index_product(auth.tenant_id, product)
    return ProductRead.model_validate(product)


@router.put("/products", response_model=ProductRead, summary="Sync (upsert) a product from a connector")
async def upsert_product(
    payload: ProductUpsert,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
    search_service: Annotated[SearchService, Depends(get_search_service_for_store)],
) -> ProductRead:
    """Catalog sync entry point (FR-2.2) — idempotent on external_id."""
    assert auth.tenant_id is not None
    product = await catalog_service.sync_product(auth.tenant_id, payload.model_dump(by_alias=False))
    await search_service.index_product(auth.tenant_id, product)
    return ProductRead.model_validate(product)


@router.get("/products/{product_id}", response_model=ProductRead, summary="Get a product")
async def get_product(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> ProductRead:
    assert auth.tenant_id is not None
    product = await catalog_service.get_product(auth.tenant_id, product_id)
    return ProductRead.model_validate(product)


@router.patch("/products/{product_id}", response_model=ProductRead, summary="Update a product")
async def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
    search_service: Annotated[SearchService, Depends(get_search_service_for_store)],
) -> ProductRead:
    assert auth.tenant_id is not None
    product = await catalog_service.update_product(
        auth.tenant_id, product_id, payload.model_dump(by_alias=False, exclude_unset=True)
    )
    await search_service.index_product(auth.tenant_id, product)
    return ProductRead.model_validate(product)


@router.delete("/products/{product_id}", status_code=204, summary="Delete a product")
async def delete_product(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(require_role("owner"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> None:
    assert auth.tenant_id is not None
    await catalog_service.delete_product(auth.tenant_id, product_id)


# --- Variants ---


@router.post(
    "/products/{product_id}/variants",
    response_model=ProductVariantRead,
    status_code=201,
    summary="Create a product variant",
)
async def create_variant(
    product_id: UUID,
    payload: ProductVariantCreate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> ProductVariantRead:
    assert auth.tenant_id is not None
    variant = await catalog_service.create_variant(
        auth.tenant_id, product_id, payload.model_dump(by_alias=False)
    )
    return ProductVariantRead.model_validate(variant)


@router.get(
    "/products/{product_id}/variants",
    response_model=list[ProductVariantRead],
    summary="List a product's variants",
)
async def list_variants(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[ProductVariantRead]:
    assert auth.tenant_id is not None
    variants = await catalog_service.list_variants(auth.tenant_id, product_id)
    return [ProductVariantRead.model_validate(v) for v in variants]


@router.patch("/variants/{variant_id}", response_model=ProductVariantRead, summary="Update a product variant")
async def update_variant(
    variant_id: UUID,
    payload: ProductVariantUpdate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> ProductVariantRead:
    assert auth.tenant_id is not None
    variant = await catalog_service.update_variant(
        auth.tenant_id, variant_id, payload.model_dump(by_alias=False, exclude_unset=True)
    )
    return ProductVariantRead.model_validate(variant)


@router.delete("/variants/{variant_id}", status_code=204, summary="Delete a product variant")
async def delete_variant(
    variant_id: UUID,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> None:
    assert auth.tenant_id is not None
    await catalog_service.delete_variant(auth.tenant_id, variant_id)


# --- Images ---


@router.post(
    "/products/{product_id}/images",
    response_model=ProductImageRead,
    status_code=201,
    summary="Add a product image",
)
async def add_image(
    product_id: UUID,
    payload: ProductImageCreate,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> ProductImageRead:
    assert auth.tenant_id is not None
    image = await catalog_service.add_image(auth.tenant_id, product_id, payload.url, payload.alt_text)
    return ProductImageRead.model_validate(image)


@router.get(
    "/products/{product_id}/images", response_model=list[ProductImageRead], summary="List a product's images"
)
async def list_images(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[ProductImageRead]:
    assert auth.tenant_id is not None
    images = await catalog_service.list_images(auth.tenant_id, product_id)
    return [ProductImageRead.model_validate(i) for i in images]


@router.put(
    "/products/{product_id}/images/reorder",
    response_model=list[ProductImageRead],
    summary="Reorder a product's images",
)
async def reorder_images(
    product_id: UUID,
    payload: ProductImageReorder,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[ProductImageRead]:
    assert auth.tenant_id is not None
    images = await catalog_service.reorder_images(auth.tenant_id, product_id, payload.ordered_image_ids)
    return [ProductImageRead.model_validate(i) for i in images]


@router.patch(
    "/products/{product_id}/images/{image_id}/primary",
    response_model=list[ProductImageRead],
    summary="Set a product's primary image",
)
async def set_primary_image(
    product_id: UUID,
    image_id: UUID,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> list[ProductImageRead]:
    assert auth.tenant_id is not None
    images = await catalog_service.set_primary_image(auth.tenant_id, product_id, image_id)
    return [ProductImageRead.model_validate(i) for i in images]


@router.delete("/products/{product_id}/images/{image_id}", status_code=204, summary="Delete a product image")
async def delete_image(
    product_id: UUID,
    image_id: UUID,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> None:
    assert auth.tenant_id is not None
    await catalog_service.delete_image(auth.tenant_id, product_id, image_id)


# --- Inventory ---


@router.post(
    "/products/{product_id}/inventory/adjust",
    response_model=InventoryAdjustmentRead,
    status_code=201,
    summary="Adjust product/variant stock",
)
async def adjust_inventory(
    product_id: UUID,
    payload: InventoryAdjustmentRequest,
    auth: Annotated[AuthContext, Depends(require_role("owner", "staff"))],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
) -> InventoryAdjustmentRead:
    assert auth.tenant_id is not None
    adjustment = await catalog_service.adjust_inventory(
        auth.tenant_id,
        product_id,
        payload.delta,
        InventoryAdjustmentReason(payload.reason),
        variant_id=payload.variant_id,
    )
    return InventoryAdjustmentRead.model_validate(adjustment)


@router.get(
    "/products/{product_id}/inventory/history",
    response_model=list[InventoryAdjustmentRead],
    summary="Get product stock adjustment history",
)
async def get_inventory_history(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    catalog_service: Annotated[CatalogService, Depends(get_catalog_service)],
    pagination: Annotated[PageParams, Depends(page_params)],
) -> list[InventoryAdjustmentRead]:
    assert auth.tenant_id is not None
    history = await catalog_service.get_inventory_history(auth.tenant_id, product_id, limit=pagination.limit)
    return [InventoryAdjustmentRead.model_validate(a) for a in history]
