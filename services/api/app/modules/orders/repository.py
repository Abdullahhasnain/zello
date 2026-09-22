from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.order import (
    Cart,
    CartItem,
    CartStatus,
    Order,
    OrderStatus,
    Payment,
    PaymentProvider,
    PaymentStatus,
)
from app.domain.repositories.order_repository import CartRepository, OrderRepository
from app.modules.orders.models import CartItemModel, CartModel, OrderModel, PaymentModel


def _cart_to_entity(model: CartModel) -> Cart:
    return Cart(
        id=model.id,
        tenant_id=model.tenant_id,
        status=CartStatus(model.status),
        conversation_id=model.conversation_id,
        customer_id=model.customer_id,
    )


def _cart_item_to_entity(model: CartItemModel) -> CartItem:
    return CartItem(
        id=model.id,
        cart_id=model.cart_id,
        product_id=model.product_id,
        quantity=model.quantity,
        unit_price=model.unit_price,
    )


def _order_to_entity(model: OrderModel) -> Order:
    return Order(
        id=model.id,
        tenant_id=model.tenant_id,
        status=OrderStatus(model.status),
        total_amount=model.total_amount,
        currency=model.currency,
        payment_method=PaymentProvider(model.payment_method),
        payment_status=PaymentStatus(model.payment_status),
        cart_id=model.cart_id,
        customer_id=model.customer_id,
        conversation_id=model.conversation_id,
        placed_at=model.placed_at,
    )


def _payment_to_entity(model: PaymentModel) -> Payment:
    return Payment(
        id=model.id,
        order_id=model.order_id,
        tenant_id=model.tenant_id,
        provider=PaymentProvider(model.provider),
        amount=model.amount,
        status=PaymentStatus(model.status),
        provider_ref=model.provider_ref,
        created_at=model.created_at,
    )


class SqlAlchemyCartRepository(CartRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Cart | None:
        model = await self._session.get(CartModel, entity_id)
        return _cart_to_entity(model) if model else None

    async def get_open_cart_for_conversation(self, conversation_id: UUID) -> Cart | None:
        result = await self._session.execute(
            select(CartModel).where(
                CartModel.conversation_id == conversation_id, CartModel.status == CartStatus.OPEN.value
            )
        )
        model = result.scalar_one_or_none()
        return _cart_to_entity(model) if model else None

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Cart]:
        result = await self._session.execute(select(CartModel).limit(limit).offset(offset))
        return [_cart_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Cart) -> Cart:
        model = CartModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            conversation_id=entity.conversation_id,
            customer_id=entity.customer_id,
            status=entity.status.value,
        )
        self._session.add(model)
        await self._session.flush()
        return _cart_to_entity(model)

    async def update(self, entity: Cart) -> Cart:
        model = await self._session.get(CartModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Cart {entity.id} not found")
        model.status = entity.status.value
        await self._session.flush()
        return _cart_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(CartModel, entity_id)
        if model is not None:
            await self._session.delete(model)

    async def list_items(self, cart_id: UUID) -> list[CartItem]:
        result = await self._session.execute(
            select(CartItemModel).where(CartItemModel.cart_id == cart_id)
        )
        return [_cart_item_to_entity(m) for m in result.scalars().all()]

    async def add_item(self, cart_id: UUID, item: CartItem) -> CartItem:
        model = CartItemModel(
            id=item.id,
            cart_id=cart_id,
            product_id=item.product_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
        )
        self._session.add(model)
        await self._session.flush()
        return _cart_item_to_entity(model)

    async def get_item(self, cart_id: UUID, item_id: UUID) -> CartItem | None:
        result = await self._session.execute(
            select(CartItemModel).where(CartItemModel.id == item_id, CartItemModel.cart_id == cart_id)
        )
        model = result.scalar_one_or_none()
        return _cart_item_to_entity(model) if model else None

    async def update_item(self, item: CartItem) -> CartItem:
        model = await self._session.get(CartItemModel, item.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Cart item {item.id} not found")
        model.quantity = item.quantity
        await self._session.flush()
        return _cart_item_to_entity(model)

    async def remove_item(self, cart_id: UUID, item_id: UUID) -> None:
        result = await self._session.execute(
            select(CartItemModel).where(CartItemModel.id == item_id, CartItemModel.cart_id == cart_id)
        )
        model = result.scalar_one_or_none()
        if model is not None:
            await self._session.delete(model)


class SqlAlchemyOrderRepository(OrderRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Order | None:
        model = await self._session.get(OrderModel, entity_id)
        return _order_to_entity(model) if model else None

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Order]:
        result = await self._session.execute(select(OrderModel).limit(limit).offset(offset))
        return [_order_to_entity(m) for m in result.scalars().all()]

    async def list_by_tenant(
        self, tenant_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Order]:
        result = await self._session.execute(
            select(OrderModel)
            .where(OrderModel.tenant_id == tenant_id)
            .order_by(OrderModel.placed_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return [_order_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Order) -> Order:
        model = OrderModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            cart_id=entity.cart_id,
            customer_id=entity.customer_id,
            conversation_id=entity.conversation_id,
            status=entity.status.value,
            total_amount=entity.total_amount,
            currency=entity.currency,
            payment_method=entity.payment_method.value,
            payment_status=entity.payment_status.value,
        )
        self._session.add(model)
        await self._session.flush()
        return _order_to_entity(model)

    async def update(self, entity: Order) -> Order:
        model = await self._session.get(OrderModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Order {entity.id} not found")
        model.status = entity.status.value
        model.payment_status = entity.payment_status.value
        await self._session.flush()
        return _order_to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(OrderModel, entity_id)
        if model is not None:
            await self._session.delete(model)

    async def record_payment(self, order_id: UUID, payment: Payment) -> Payment:
        model = PaymentModel(
            id=payment.id,
            tenant_id=payment.tenant_id,
            order_id=order_id,
            provider=payment.provider.value,
            provider_ref=payment.provider_ref,
            amount=payment.amount,
            status=payment.status.value,
        )
        self._session.add(model)
        await self._session.flush()
        return _payment_to_entity(model)
