from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TenantScopedMixin, TimestampMixin, UUIDPKMixin


class CustomerModel(UUIDPKMixin, TenantScopedMixin, TimestampMixin, Base):
    __tablename__ = "customers"

    phone: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)


class ConversationModel(UUIDPKMixin, TenantScopedMixin, Base):
    __tablename__ = "conversations"

    customer_id: Mapped[str | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True
    )
    channel: Mapped[str] = mapped_column(String(20), nullable=False, server_default="widget")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")
    language: Mapped[str] = mapped_column(String(20), nullable=False, server_default="roman_urdu")
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ConversationMessageModel(UUIDPKMixin, Base):
    """No `updated_at` — a conversation turn is immutable once written; the
    audit trail (SRS: Auditability) depends on messages never being edited
    in place."""

    __tablename__ = "conversation_messages"

    conversation_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(String, nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    intent: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
