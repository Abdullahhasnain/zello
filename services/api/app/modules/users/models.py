from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin


class StoreUserModel(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "store_users"
    __table_args__ = (UniqueConstraint("clerk_user_id", name="uq_store_users_clerk_user_id"),)

    tenant_id: Mapped[str] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="staff")


class AdminUserModel(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "admin_users"
    __table_args__ = (UniqueConstraint("clerk_user_id", name="uq_admin_users_clerk_user_id"),)

    clerk_user_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="ops")
