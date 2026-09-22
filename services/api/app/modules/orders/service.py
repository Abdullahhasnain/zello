from decimal import Decimal
from uuid import UUID, uuid4

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
from app.domain.repositories.product_repository import ProductRepository
from app.shared.exceptions import NotFoundError, ValidationError


class OrderService:
    """Owns the one gate the SRS insists on: an order is created here, and
    only here — never by the AI layer directly (FR-4.6). The confidence
    check itself is a placeholder until the Conversation Orchestrator (AI
    module) exists to supply a real score; the structural boundary is what
    this foundation module establishes."""

    def __init__(
        self,
        cart_repository: CartRepository,
        order_repository: OrderRepository,
        product_repository: ProductRepository,
    ) -> None:
        self._carts = cart_repository
        self._orders = order_repository
        self._products = product_repository

    async def create_cart(self, tenant_id: UUID, conversation_id: UUID | None = None) -> Cart:
        cart = Cart(id=uuid4(), tenant_id=tenant_id, status=CartStatus.OPEN, conversation_id=conversation_id)
        return await self._carts.add(cart)

    async def add_item(self, cart_id: UUID, product_id: UUID, quantity: int) -> CartItem:
        # Price is read from the catalog, never accepted from the client —
        # same price-tampering concern as the checkout total below.
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise NotFoundError(f"Product {product_id} not found")
        if quantity < 1:
            raise ValidationError("Quantity must be at least 1")

        # Same product added twice merges into one line rather than
        # duplicating rows — what every cart UI expects.
        for existing in await self._carts.list_items(cart_id):
            if existing.product_id == product_id:
                existing.quantity += quantity
                return await self._carts.update_item(existing)

        item = CartItem(
            id=uuid4(), cart_id=cart_id, product_id=product_id, quantity=quantity, unit_price=product.price
        )
        return await self._carts.add_item(cart_id, item)

    async def get_cart(self, tenant_id: UUID, cart_id: UUID) -> Cart:
        cart = await self._carts.get_by_id(cart_id)
        if cart is None or cart.tenant_id != tenant_id:
            raise NotFoundError(f"Cart {cart_id} not found")
        return cart

    async def list_cart_items(self, cart_id: UUID) -> list[CartItem]:
        return await self._carts.list_items(cart_id)

    async def list_cart_items_with_products(self, cart_id: UUID) -> list[tuple[CartItem, str, str | None]]:
        """(item, product title, primary image url) triples for the cart UI —
        enriched here rather than forcing the storefront into N+1 product
        fetches per cart render."""
        enriched: list[tuple[CartItem, str, str | None]] = []
        for item in await self._carts.list_items(cart_id):
            product = await self._products.get_by_id(item.product_id)
            title = product.title if product else "(product removed)"
            image = product.images[0] if product and product.images else None
            enriched.append((item, title, image))
        return enriched

    async def update_item_quantity(
        self, tenant_id: UUID, cart_id: UUID, item_id: UUID, quantity: int
    ) -> CartItem:
        await self.get_cart(tenant_id, cart_id)  # 404s on wrong tenant
        if quantity < 1:
            raise ValidationError("Quantity must be at least 1 — remove the item instead")
        item = await self._carts.get_item(cart_id, item_id)
        if item is None:
            raise NotFoundError(f"Cart item {item_id} not found")
        item.quantity = quantity
        return await self._carts.update_item(item)

    async def remove_item(self, tenant_id: UUID, cart_id: UUID, item_id: UUID) -> None:
        await self.get_cart(tenant_id, cart_id)
        await self._carts.remove_item(cart_id, item_id)

    async def get_order(self, tenant_id: UUID, order_id: UUID) -> Order:
        order = await self._orders.get_by_id(order_id)
        if order is None or order.tenant_id != tenant_id:
            raise NotFoundError(f"Order {order_id} not found")
        return order

    async def checkout(
        self,
        tenant_id: UUID,
        cart_id: UUID,
        payment_method: PaymentProvider,
        *,
        confidence: float | None = None,
        confirmed_by_customer: bool = True,
    ) -> Order:
        if confidence is not None and confidence < 0.8 and not confirmed_by_customer:
            raise ValidationError(
                "Autonomous checkout requires explicit customer confirmation below the confidence threshold"
            )

        cart = await self._carts.get_by_id(cart_id)
        if cart is None:
            raise NotFoundError(f"Cart {cart_id} not found")

        items = await self._carts.list_items(cart_id)
        if not items:
            raise ValidationError("Cannot check out an empty cart")
        # Always computed server-side from persisted cart_items — an order
        # total supplied by the client would be a price-tampering hole.
        total_amount = sum((item.unit_price * item.quantity for item in items), Decimal("0"))

        order = Order(
            id=uuid4(),
            tenant_id=tenant_id,
            status=OrderStatus.PENDING,
            total_amount=total_amount,
            currency="PKR",
            payment_method=payment_method,
            payment_status=PaymentStatus.PENDING,
            cart_id=cart_id,
            customer_id=cart.customer_id,
            conversation_id=cart.conversation_id,
        )
        order = await self._orders.add(order)

        cart.status = CartStatus.CONVERTED
        await self._carts.update(cart)

        if payment_method == PaymentProvider.COD:
            order.payment_status = PaymentStatus.PENDING
        # JazzCash/Easypaisa payment initiation is a call to the Payments
        # module's provider client — not implemented in this foundation
        # module (FR-5.1 lands with the payments integration work).

        return order

    async def record_payment_result(
        self, order_id: UUID, tenant_id: UUID, provider: PaymentProvider, amount: Decimal, succeeded: bool
    ) -> Payment:
        payment = Payment(
            id=uuid4(),
            order_id=order_id,
            tenant_id=tenant_id,
            provider=provider,
            amount=amount,
            status=PaymentStatus.SUCCEEDED if succeeded else PaymentStatus.FAILED,
        )
        return await self._orders.record_payment(order_id, payment)

    async def list_orders(self, tenant_id: UUID, *, limit: int = 50, offset: int = 0) -> list[Order]:
        return await self._orders.list_by_tenant(tenant_id, limit=limit, offset=offset)
