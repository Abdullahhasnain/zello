from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.domain.entities.order import PaymentProvider
from app.modules.orders.dependencies import (
    get_order_service_for_customer,
    get_order_service_for_store,
)
from app.modules.orders.schemas import (
    AddCartItemRequest,
    CartDetailRead,
    CartItemDetailRead,
    CartItemRead,
    CartRead,
    CheckoutRequest,
    OrderRead,
    UpdateCartItemRequest,
)
from app.modules.orders.service import OrderService
from app.shared.deps import get_current_customer_auth, get_current_store_auth
from app.shared.pagination import PageParams, page_params

router = APIRouter(prefix="/orders", tags=["orders"])


async def _cart_detail(order_service: OrderService, tenant_id: UUID, cart_id: UUID) -> CartDetailRead:
    cart = await order_service.get_cart(tenant_id, cart_id)
    enriched = await order_service.list_cart_items_with_products(cart_id)
    items = [
        CartItemDetailRead(
            id=item.id,
            product_id=item.product_id,
            product_title=title,
            product_image_url=image,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        for item, title, image in enriched
    ]
    subtotal = sum((item.unit_price * item.quantity for item in items), Decimal("0"))
    return CartDetailRead(
        id=cart.id, tenant_id=cart.tenant_id, status=cart.status.value, items=items, subtotal=subtotal
    )


@router.post("/carts", response_model=CartRead, status_code=201)
async def create_cart(
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
    conversation_id: UUID | None = None,
) -> CartRead:
    assert auth.tenant_id is not None
    cart = await order_service.create_cart(auth.tenant_id, conversation_id)
    return CartRead.model_validate(cart)


@router.post("/carts/{cart_id}/items", response_model=CartItemRead, status_code=201)
async def add_cart_item(
    cart_id: UUID,
    payload: AddCartItemRequest,
    _auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
) -> CartItemRead:
    """FR-1.7 — price is looked up from the catalog server-side, never
    taken from the request body."""
    item = await order_service.add_item(cart_id, payload.product_id, payload.quantity)
    return CartItemRead.model_validate(item)


@router.get("/carts/{cart_id}", response_model=CartDetailRead)
async def get_cart(
    cart_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
) -> CartDetailRead:
    assert auth.tenant_id is not None
    return await _cart_detail(order_service, auth.tenant_id, cart_id)


@router.patch("/carts/{cart_id}/items/{item_id}", response_model=CartDetailRead)
async def update_cart_item(
    cart_id: UUID,
    item_id: UUID,
    payload: UpdateCartItemRequest,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
) -> CartDetailRead:
    assert auth.tenant_id is not None
    await order_service.update_item_quantity(auth.tenant_id, cart_id, item_id, payload.quantity)
    return await _cart_detail(order_service, auth.tenant_id, cart_id)


@router.delete("/carts/{cart_id}/items/{item_id}", response_model=CartDetailRead)
async def remove_cart_item(
    cart_id: UUID,
    item_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
) -> CartDetailRead:
    assert auth.tenant_id is not None
    await order_service.remove_item(auth.tenant_id, cart_id, item_id)
    return await _cart_detail(order_service, auth.tenant_id, cart_id)


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: UUID,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
) -> OrderRead:
    """Order confirmation page's read — customer-scoped; the RLS session
    plus the service's tenant check both bound it to the caller's store."""
    assert auth.tenant_id is not None
    order = await order_service.get_order(auth.tenant_id, order_id)
    return OrderRead.model_validate(order)


@router.post("/checkout", response_model=OrderRead, status_code=201)
async def checkout(
    payload: CheckoutRequest,
    auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_customer)],
) -> OrderRead:
    """FR-1.8 — total is computed server-side from the cart; the
    confirmation/confidence gate lives in OrderService (SRS FR-4.6)."""
    assert auth.tenant_id is not None
    order = await order_service.checkout(
        auth.tenant_id,
        payload.cart_id,
        payment_method=PaymentProvider(payload.payment_method),
    )
    return OrderRead.model_validate(order)


@router.get("", response_model=list[OrderRead])
async def list_orders(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    order_service: Annotated[OrderService, Depends(get_order_service_for_store)],
    pagination: Annotated[PageParams, Depends(page_params)],
) -> list[OrderRead]:
    assert auth.tenant_id is not None
    orders = await order_service.list_orders(auth.tenant_id, limit=pagination.limit, offset=pagination.offset)
    return [OrderRead.model_validate(o) for o in orders]
