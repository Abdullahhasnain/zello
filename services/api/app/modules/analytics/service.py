from uuid import UUID

from app.modules.analytics.repository import AnalyticsEventRepository
from app.modules.analytics.schemas import ConversionSummary


class AnalyticsService:
    def __init__(self, event_repository: AnalyticsEventRepository) -> None:
        self._events = event_repository

    async def record_event(self, tenant_id: UUID, event_type: str, payload: dict) -> None:
        await self._events.record(tenant_id, event_type, payload)

    async def get_conversion_summary(self, tenant_id: UUID) -> ConversionSummary:
        conversations = await self._events.count_by_type(tenant_id, "conversation_started")
        orders = await self._events.count_by_type(tenant_id, "order_placed")
        rate = (orders / conversations) if conversations else 0.0
        return ConversionSummary(
            total_conversations=conversations, total_orders=orders, conversion_rate=round(rate, 4)
        )
