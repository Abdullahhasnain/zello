from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import UUIDPKMixin


class AuditLogModel(UUIDPKMixin, Base):
    """Platform-wide, not tenant-scoped (no TenantScopedMixin) — an admin
    action against Tenant A must still be visible to platform ops even if
    RLS would otherwise hide Tenant A's rows from a differently-scoped
    session. tenant_id here is a plain nullable reference, not an RLS key."""

    __tablename__ = "audit_logs"

    actor_type: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_id: Mapped[str] = mapped_column(String(100), nullable=False)
    tenant_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    log_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, server_default="{}")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), index=True
    )


class WebhookLogModel(UUIDPKMixin, Base):
    """Debugging trail for inbound partner/payment webhooks (JazzCash,
    Easypaisa, Shopify, WooCommerce, ...). Platform-wide for the same
    reason as AuditLogModel."""

    __tablename__ = "webhook_logs"

    tenant_id: Mapped[str | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="received")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
