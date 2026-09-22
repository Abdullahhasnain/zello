from uuid import UUID

from app.shared.schema import CamelModel


class StoreUserRead(CamelModel):
    id: UUID
    tenant_id: UUID
    email: str
    role: str


class AdminUserRead(CamelModel):
    id: UUID
    email: str
    role: str


class ClerkSyncRequest(CamelModel):
    """Body of the internal call apps/dashboard's Clerk webhook route
    forwards on a user.created event — see docs/architecture/auth-flow.md.
    `tenant_slug` comes from whatever onboarding context captured which
    store this signup belongs to (an invite link, in the full product)."""

    clerk_user_id: str
    email: str
    tenant_slug: str
