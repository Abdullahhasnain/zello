from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TenantScopedMixin, UUIDPKMixin


class NotificationLogModel(UUIDPKMixin, TenantScopedMixin, Base):
    """Outbound notification record (email/SMS/WhatsApp — FR-2.10). The
    actual send is delegated to a provider client that doesn't exist yet in
    this foundation module; this table is the durable log that client will
    write to."""

    __tablename__ = "notification_log"

    channel: Mapped[str] = mapped_column(String(20), nullable=False)
    recipient: Mapped[str] = mapped_column(String(320), nullable=False)
    template: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
