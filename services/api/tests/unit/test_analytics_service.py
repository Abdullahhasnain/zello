from uuid import uuid4

from app.modules.analytics.service import AnalyticsService


class FakeEventRepository:
    def __init__(self) -> None:
        self.counts = {
            "conversation_started": 8,
            "order_placed": 2,
            "assistant_reply_completed": 12,
            "cart_add_succeeded": 3,
            "cart_add_failed": 1,
        }

    async def record(self, *_args: object, **_kwargs: object) -> None:  # pragma: no cover - unused here
        return None

    async def count_by_type(self, _tenant_id, event_type: str) -> int:
        return self.counts.get(event_type, 0)

    async def list_payloads_by_type(self, _tenant_id, _event_type: str, *, limit: int) -> list[dict]:
        assert limit == 500
        return [
            {"response_latency_ms": 900},
            {"response_latency_ms": 1_200},
            {"response_latency_ms": 1_700},
            {"response_latency_ms": "not-a-number"},
        ]


async def test_launch_summary_exposes_cart_health_and_median_reply_latency() -> None:
    summary = await AnalyticsService(FakeEventRepository()).get_conversion_summary(uuid4())

    assert summary.total_conversations == 8
    assert summary.total_orders == 2
    assert summary.conversion_rate == 0.25
    assert summary.assistant_replies == 12
    assert summary.cart_additions == 3
    assert summary.cart_add_failures == 1
    assert summary.cart_action_success_rate == 0.75
    assert summary.median_reply_latency_ms == 1_200
