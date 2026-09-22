from uuid import UUID, uuid4

from app.domain.entities.user import AdminUser, StoreUser, StoreUserRole
from app.domain.repositories.user_repository import AdminUserRepository, StoreUserRepository


class UserService:
    """Identity is owned by Clerk; this service only maintains the local
    projection (tenant membership + role) that Clerk has no concept of —
    see docs/architecture/auth-flow.md."""

    def __init__(
        self,
        store_user_repository: StoreUserRepository,
        admin_user_repository: AdminUserRepository,
    ) -> None:
        self._store_users = store_user_repository
        self._admin_users = admin_user_repository

    async def get_or_create_store_user(
        self, clerk_user_id: str, email: str, tenant_id: UUID
    ) -> StoreUser:
        """Called from the Clerk webhook sync path (see
        apps/dashboard/src/app/api/webhooks/clerk/route.ts) the first time a
        given Clerk identity is seen for a tenant.

        Role defaults to `owner` only for the tenant's first store user —
        every subsequent signup against the same tenant_slug defaults to
        `staff`. A real invite system (a specific person invited as owner
        vs. staff, with an expiring token) is out of scope here; this is
        just the difference between "the store's first account" and
        "someone else joining an already-claimed store"."""
        existing = await self._store_users.get_by_clerk_id(clerk_user_id)
        if existing is not None:
            return existing

        tenant_already_has_users = bool(await self._store_users.list_by_tenant(tenant_id))
        role = StoreUserRole.STAFF if tenant_already_has_users else StoreUserRole.OWNER

        user = StoreUser(
            id=uuid4(),
            tenant_id=tenant_id,
            clerk_user_id=clerk_user_id,
            email=email,
            role=role,
        )
        return await self._store_users.add(user)

    async def get_store_user_by_clerk_id(self, clerk_user_id: str) -> StoreUser | None:
        return await self._store_users.get_by_clerk_id(clerk_user_id)

    async def get_admin_by_clerk_id(self, clerk_user_id: str) -> AdminUser | None:
        return await self._admin_users.get_by_clerk_id(clerk_user_id)

    async def list_store_users(self, tenant_id: UUID) -> list[StoreUser]:
        return await self._store_users.list_by_tenant(tenant_id)
