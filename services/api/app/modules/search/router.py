from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.modules.search.dependencies import get_search_service_for_customer
from app.modules.search.schemas import ProductRead, SearchRequest
from app.modules.search.service import SearchService
from app.shared.deps import get_current_customer_auth

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/products", response_model=list[ProductRead], summary="Semantic product search")
async def search_products(
    payload: SearchRequest,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    search_service: Annotated[SearchService, Depends(get_search_service_for_customer)],
) -> list[ProductRead]:
    """Roman Urdu, Urdu, and English queries all work — see
    app/modules/search/normalization.py. This is what the widget calls
    when a shopper types or speaks a product request."""
    assert auth.tenant_id is not None
    products = await search_service.search_products(auth.tenant_id, payload.query, top_k=payload.top_k)
    return [ProductRead.model_validate(p) for p in products]


@router.get(
    "/recommendations/{product_id}",
    response_model=list[ProductRead],
    summary="Products similar to a given product",
)
async def get_recommendations(
    product_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    search_service: Annotated[SearchService, Depends(get_search_service_for_customer)],
    top_k: int = 10,
) -> list[ProductRead]:
    """"Customers who viewed this also viewed" — shown alongside a product
    the shopper is already looking at."""
    assert auth.tenant_id is not None
    products = await search_service.recommend_similar(auth.tenant_id, product_id, top_k=top_k)
    return [ProductRead.model_validate(p) for p in products]
