"""Two independent auth mechanisms, deliberately not unified — see
docs/architecture/auth-flow.md:

1. Clerk-issued JWTs for store owners and admins, verified against Clerk's
   published JWKS. We never issue these ourselves.
2. Self-issued HS256 JWTs for anonymous/guest customer widget sessions,
   where pulling in a full Clerk identity is unwarranted overhead.

Both resolve to an `AuthContext` the rest of the app depends on, so callers
never need to know which mechanism authenticated the caller.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID

import httpx
from jose import jwt
from jose.exceptions import JWTError

from app.core.config import get_settings
from app.shared.exceptions import AuthenticationError

ActorType = Literal["store_user", "admin_user", "customer"]


@dataclass(frozen=True)
class AuthContext:
    actor_type: ActorType
    subject_id: str
    tenant_id: UUID | None
    role: str | None
    raw_claims: dict[str, Any]


class ClerkJWKSClient:
    """Fetches and caches Clerk's JSON Web Key Set for local token
    verification — no network round-trip to Clerk per request."""

    def __init__(self, jwks_url: str) -> None:
        self._jwks_url = jwks_url
        self._cached_jwks: dict[str, Any] | None = None
        self._cached_at: datetime | None = None
        self._ttl = timedelta(hours=1)

    async def get_jwks(self) -> dict[str, Any]:
        now = datetime.now(UTC)
        if self._cached_jwks is None or self._cached_at is None or now - self._cached_at > self._ttl:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(self._jwks_url)
                response.raise_for_status()
                self._cached_jwks = response.json()
                self._cached_at = now
        return self._cached_jwks


_clerk_client: ClerkJWKSClient | None = None


def get_clerk_client() -> ClerkJWKSClient:
    global _clerk_client
    if _clerk_client is None:
        _clerk_client = ClerkJWKSClient(get_settings().CLERK_JWKS_URL)
    return _clerk_client


async def verify_clerk_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    jwks = await get_clerk_client().get_jwks()
    try:
        header = jwt.get_unverified_header(token)
        key = next((k for k in jwks["keys"] if k["kid"] == header["kid"]), None)
        if key is None:
            raise AuthenticationError("Unknown signing key")
        claims: dict[str, Any] = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.CLERK_ISSUER,
            options={"verify_aud": False},
        )
        return claims
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired session token") from exc


def issue_customer_jwt(customer_id: UUID, tenant_id: UUID, *, refresh: bool = False) -> str:
    """Self-issued session token for anonymous/guest customer widget
    sessions — see FR-1.11 (session persistence) and the customer auth flow
    in docs/architecture/auth-flow.md."""
    settings = get_settings()
    ttl = (
        timedelta(days=settings.CUSTOMER_JWT_REFRESH_TTL_DAYS)
        if refresh
        else timedelta(minutes=settings.CUSTOMER_JWT_ACCESS_TTL_MINUTES)
    )
    now = datetime.now(UTC)
    payload = {
        "sub": str(customer_id),
        "tenant_id": str(tenant_id),
        "type": "refresh" if refresh else "access",
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.CUSTOMER_JWT_SECRET, algorithm=settings.CUSTOMER_JWT_ALGORITHM)


def verify_customer_jwt(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            settings.CUSTOMER_JWT_SECRET,
            algorithms=[settings.CUSTOMER_JWT_ALGORITHM],
        )
        return claims
    except JWTError as exc:
        raise AuthenticationError("Invalid or expired customer session") from exc
