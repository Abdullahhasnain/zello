from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.catalog.repository import SqlAlchemyProductRepository
from app.modules.orders.repository import SqlAlchemyCartRepository, SqlAlchemyOrderRepository
from app.modules.orders.service import OrderService
from app.shared.deps import get_customer_tenant_db_session, get_tenant_db_session


def get_order_service_for_customer(
    session: Annotated[AsyncSession, Depends(get_customer_tenant_db_session)],
) -> OrderService:
    """For the widget's own cart/checkout flow (FR-1.7, FR-1.8)."""
    return OrderService(
        cart_repository=SqlAlchemyCartRepository(session),
        order_repository=SqlAlchemyOrderRepository(session),
        product_repository=SqlAlchemyProductRepository(session),
    )


def get_order_service_for_store(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
) -> OrderService:
    """For the dashboard's order list (FR-2.5 revenue/order visibility)."""
    return OrderService(
        cart_repository=SqlAlchemyCartRepository(session),
        order_repository=SqlAlchemyOrderRepository(session),
        product_repository=SqlAlchemyProductRepository(session),
    )
