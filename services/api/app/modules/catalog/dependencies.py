from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalog.repository import (
    SqlAlchemyBrandRepository,
    SqlAlchemyCategoryRepository,
    SqlAlchemyInventoryAdjustmentRepository,
    SqlAlchemyProductEmbeddingRepository,
    SqlAlchemyProductImageRepository,
    SqlAlchemyProductRepository,
    SqlAlchemyProductVariantRepository,
)
from app.modules.catalog.service import CatalogService
from app.modules.search.dependencies import get_embedding_model_version
from app.shared.deps import get_customer_tenant_db_session, get_tenant_db_session


def _build_service(session: AsyncSession, model_version: str) -> CatalogService:
    return CatalogService(
        product_repository=SqlAlchemyProductRepository(session),
        # Must be keyed by the SAME model_version search reads with (see
        # app/modules/search/dependencies.py's get_embedding_model_version)
        # — otherwise a product indexed here is invisible to search, which
        # filters by its own idea of the active model_version.
        embedding_repository=SqlAlchemyProductEmbeddingRepository(session, model_version=model_version),
        category_repository=SqlAlchemyCategoryRepository(session),
        brand_repository=SqlAlchemyBrandRepository(session),
        variant_repository=SqlAlchemyProductVariantRepository(session),
        image_repository=SqlAlchemyProductImageRepository(session),
        inventory_repository=SqlAlchemyInventoryAdjustmentRepository(session),
    )


def get_catalog_service(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
    model_version: Annotated[str, Depends(get_embedding_model_version)],
) -> CatalogService:
    """For the dashboard's catalog management endpoints (create/update/
    delete products, categories, brands, variants, images, inventory)."""
    return _build_service(session, model_version)


def get_catalog_service_for_customer(
    session: Annotated[AsyncSession, Depends(get_customer_tenant_db_session)],
    model_version: Annotated[str, Depends(get_embedding_model_version)],
) -> CatalogService:
    """For the widget's read-only product browsing/search — same tenant
    isolation guarantee, different upstream identity check (see
    app/modules/conversations/dependencies.py for the same split)."""
    return _build_service(session, model_version)
