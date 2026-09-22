from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin


class TenantModel(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pilot")
    phase: Mapped[str] = mapped_column(String(20), nullable=False, server_default="phase_1")
    branding: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    feature_flags: Mapped[list["FeatureFlagModel"]] = relationship(
        back_populates="tenant", cascade="all, delete-orphan"
    )


class FeatureFlagModel(UUIDPKMixin, Base):
    __tablename__ = "tenant_feature_flags"
    __table_args__ = (
        UniqueConstraint("tenant_id", "key", name="uq_tenant_feature_flags_tenant_id_key"),
        {"comment": "Per-tenant phase entitlement (voice_enabled, autonomous_checkout_enabled, ...)."},
    )

    tenant_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    key: Mapped[str] = mapped_column(String(100), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    tenant: Mapped["TenantModel"] = relationship(back_populates="feature_flags")
