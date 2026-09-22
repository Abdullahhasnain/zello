from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class StoreUserRole(StrEnum):
    OWNER = "owner"
    STAFF = "staff"
    VIEWER = "viewer"


class AdminRole(StrEnum):
    SUPER_ADMIN = "super_admin"
    OPS = "ops"
    SUPPORT = "support"
    FINANCE = "finance"


@dataclass
class StoreUser:
    """A store owner/staff account. Identity is owned by Clerk — clerk_user_id
    is the join key, never a locally-hashed password (see
    docs/architecture/auth-flow.md)."""

    id: UUID
    tenant_id: UUID
    clerk_user_id: str
    email: str
    role: StoreUserRole
    created_at: datetime | None = None


@dataclass
class AdminUser:
    id: UUID
    clerk_user_id: str
    email: str
    role: AdminRole
    created_at: datetime | None = None
