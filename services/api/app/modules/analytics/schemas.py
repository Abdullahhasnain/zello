from datetime import datetime
from uuid import UUID

from app.shared.schema import CamelModel


class AnalyticsEventCreate(CamelModel):
    event_type: str
    payload: dict = {}


class AnalyticsEventRead(CamelModel):
    id: UUID
    tenant_id: UUID
    event_type: str
    payload: dict
    occurred_at: datetime


class ConversionSummary(CamelModel):
    """Backs the dashboard's headline analytics tile (FR-2.5). Real
    aggregation queries (funnel math, time windows) land with the analytics
    UI module — this is the response shape they'll fill."""

    total_conversations: int
    total_orders: int
    conversion_rate: float
    assistant_replies: int = 0
    cart_additions: int = 0
    cart_add_failures: int = 0
    cart_action_success_rate: float = 0.0
    median_reply_latency_ms: int | None = None
