from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notifications.models import NotificationLogModel


class NotificationLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log(self, tenant_id: UUID, channel: str, recipient: str, template: str) -> NotificationLogModel:
        model = NotificationLogModel(
            id=uuid4(), tenant_id=tenant_id, channel=channel, recipient=recipient, template=template
        )
        self._session.add(model)
        await self._session.flush()
        return model
