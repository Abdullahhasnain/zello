from uuid import UUID

from app.core.security import issue_customer_jwt, verify_customer_jwt
from app.modules.auth.repository import GuestCustomerRepository
from app.modules.auth.schemas import GuestSessionResponse
from app.modules.tenants.service import TenantService
from app.shared.exceptions import AuthenticationError


class AuthService:
    """Owns the one endpoint that runs before any customer credential
    exists: bootstrapping a guest session for the widget. Everything after
    this is get_current_customer_auth (app/shared/deps.py) verifying the
    token this issues."""

    def __init__(self, tenant_service: TenantService, customer_repository: GuestCustomerRepository) -> None:
        self._tenants = tenant_service
        self._customers = customer_repository

    async def start_guest_session(self, tenant_slug: str) -> GuestSessionResponse:
        tenant = await self._tenants.get_tenant_by_slug(tenant_slug)
        customer = await self._customers.create(tenant.id)

        return GuestSessionResponse(
            access_token=issue_customer_jwt(customer.id, tenant.id, refresh=False),
            refresh_token=issue_customer_jwt(customer.id, tenant.id, refresh=True),
            customer_id=str(customer.id),
            tenant_id=str(tenant.id),
        )

    async def refresh_session(self, refresh_token: str) -> GuestSessionResponse:
        claims = verify_customer_jwt(refresh_token)
        if claims.get("type") != "refresh":
            raise AuthenticationError("Not a refresh token")

        customer_id = UUID(claims["sub"])
        tenant_id = UUID(claims["tenant_id"])
        return GuestSessionResponse(
            access_token=issue_customer_jwt(customer_id, tenant_id, refresh=False),
            refresh_token=issue_customer_jwt(customer_id, tenant_id, refresh=True),
            customer_id=str(customer_id),
            tenant_id=str(tenant_id),
        )
