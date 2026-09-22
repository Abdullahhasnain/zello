from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.models import AnalyticsEventModel


class AnalyticsEventRepository:
    """Not modeled as a domain Repository[T] — events are append-only and
    queried in aggregate, never fetched or updated by id, so the generic
    CRUD interface doesn't fit (Interface Segregation again)."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def record(self, tenant_id: UUID, event_type: str, payload: dict) -> AnalyticsEventModel:
        model = AnalyticsEventModel(id=uuid4(), tenant_id=tenant_id, event_type=event_type, payload=payload)
        self._session.add(model)
        await self._session.flush()
        return model

    async def count_by_type(self, tenant_id: UUID, event_type: str) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(AnalyticsEventModel)
            .where(
                AnalyticsEventModel.tenant_id == tenant_id,
                AnalyticsEventModel.event_type == event_type,
            )
        )
        return result.scalar_one()
