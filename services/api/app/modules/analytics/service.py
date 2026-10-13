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
        assistant_replies = await self._events.count_by_type(tenant_id, "assistant_reply_completed")
        cart_additions = await self._events.count_by_type(tenant_id, "cart_add_succeeded")
        cart_add_failures = await self._events.count_by_type(tenant_id, "cart_add_failed")
        reply_payloads = await self._events.list_payloads_by_type(
            tenant_id, "assistant_reply_completed", limit=500
        )
        latencies = sorted(
            int(payload["response_latency_ms"])
            for payload in reply_payloads
            if isinstance(payload, dict)
            and isinstance(payload.get("response_latency_ms"), int | float)
            and payload["response_latency_ms"] >= 0
        )
        rate = (orders / conversations) if conversations else 0.0
        cart_attempts = cart_additions + cart_add_failures
        cart_success_rate = (cart_additions / cart_attempts) if cart_attempts else 0.0
        median_latency = latencies[len(latencies) // 2] if latencies else None
        return ConversionSummary(
            total_conversations=conversations,
            total_orders=orders,
            conversion_rate=round(rate, 4),
            assistant_replies=assistant_replies,
            cart_additions=cart_additions,
            cart_add_failures=cart_add_failures,
            cart_action_success_rate=round(cart_success_rate, 4),
            median_reply_latency_ms=median_latency,
        )
