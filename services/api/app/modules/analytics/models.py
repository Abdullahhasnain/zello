from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TenantScopedMixin, UUIDPKMixin


class AnalyticsEventModel(UUIDPKMixin, TenantScopedMixin, Base):
    """Raw, append-only event capture — conversation turns, cart adds,
    checkouts, widget impressions. Feeds the dashboard's conversion/
    abandonment analytics (FR-2.5) and the OLAP layer described in the
    architecture doc; this table is intentionally not the OLAP store
    itself, just the durable inbox events are shipped from before being
    aggregated there."""

    __tablename__ = "analytics_events"

    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )
