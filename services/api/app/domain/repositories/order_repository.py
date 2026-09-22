from abc import abstractmethod
from uuid import UUID

from app.domain.entities.order import Cart, CartItem, Order, Payment
from app.domain.repositories.base import Repository


class CartRepository(Repository[Cart]):
    @abstractmethod
    async def get_open_cart_for_conversation(self, conversation_id: UUID) -> Cart | None: ...

    @abstractmethod
    async def list_items(self, cart_id: UUID) -> list[CartItem]:
        """The order total is always computed server-side from these rows —
        never from a client-supplied amount (price tampering)."""
        ...

    @abstractmethod
    async def add_item(self, cart_id: UUID, item: CartItem) -> CartItem: ...

    @abstractmethod
    async def get_item(self, cart_id: UUID, item_id: UUID) -> CartItem | None: ...

    @abstractmethod
    async def update_item(self, item: CartItem) -> CartItem: ...

    @abstractmethod
    async def remove_item(self, cart_id: UUID, item_id: UUID) -> None: ...


class OrderRepository(Repository[Order]):
    @abstractmethod
    async def list_by_tenant(
        self, tenant_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Order]: ...

    @abstractmethod
    async def record_payment(self, order_id: UUID, payment: Payment) -> Payment: ...
