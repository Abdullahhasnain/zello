from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.conversations.models import CustomerModel


class GuestCustomerRepository:
    """Deliberately its own tiny repository rather than reusing
    ConversationService — issuing a session is an identity/auth concern,
    not a conversation concern, even though both end up touching the same
    `customers` table (owned by the conversations module)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, tenant_id: UUID) -> CustomerModel:
        model = CustomerModel(id=uuid4(), tenant_id=tenant_id)
        self._session.add(model)
        await self._session.flush()
        return model
