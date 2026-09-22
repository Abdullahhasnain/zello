from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.admin.models import AuditLogModel, WebhookLogModel


class AuditLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(
        self,
        actor_type: str,
        actor_id: str,
        action: str,
        entity: str,
        entity_id: str,
        tenant_id: UUID | None = None,
        metadata: dict | None = None,
    ) -> AuditLogModel:
        model = AuditLogModel(
            id=uuid4(),
            actor_type=actor_type,
            actor_id=actor_id,
            tenant_id=tenant_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            log_metadata=metadata or {},
        )
        self._session.add(model)
        await self._session.flush()
        return model


class WebhookLogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, source: str, payload: dict, tenant_id: UUID | None = None) -> WebhookLogModel:
        model = WebhookLogModel(id=uuid4(), source=source, payload=payload, tenant_id=tenant_id)
        self._session.add(model)
        await self._session.flush()
        return model
