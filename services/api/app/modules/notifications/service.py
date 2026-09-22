from uuid import UUID

from app.modules.notifications.repository import NotificationLogRepository


class NotificationService:
    """Logs outbound notifications. Provider integration (email/SMS/
    WhatsApp send clients) is a separate concern to be wired in behind this
    same interface — services that need to notify someone call
    `send(...)` and never touch a provider SDK directly."""

    def __init__(self, log_repository: NotificationLogRepository) -> None:
        self._log = log_repository

    async def send(self, tenant_id: UUID, channel: str, recipient: str, template: str) -> None:
        await self._log.log(tenant_id, channel, recipient, template)
        # TODO(notifications provider module): dispatch via the actual
        # email/SMS/WhatsApp client and update status on delivery.
