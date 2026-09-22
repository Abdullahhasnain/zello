import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column


class UUIDPKMixin:
    """UUID primary keys everywhere — never auto-increment integers. Multi-
    tenant IDs must not be sequentially guessable across tenants, and UUIDs
    let any service generate an ID before an insert (useful for the
    Conversation Orchestrator, which creates related rows across services)."""

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TenantScopedMixin:
    """Every tenant-owned table gets this column plus a matching Postgres
    row-level-security policy (see db/ddl/002_row_level_security.sql) — the
    hard isolation boundary the SRS's multi-tenancy NFR requires. Application
    code filtering by tenant_id is a performance optimization, not the
    security boundary; RLS is."""

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
