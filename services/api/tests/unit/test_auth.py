"""Unit tests for the authentication layer — no database, no Clerk network
calls. The Clerk-token tests use a locally generated RSA keypair standing
in for Clerk's real signing key, with ClerkJWKSClient.get_jwks monkeypatched
to serve its public half — this exercises the exact verification code path
(`verify_clerk_token`) against a real signature, not a mock of "it worked".
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jose import jwk, jwt

from app.core.security import (
    AuthContext,
    ClerkJWKSClient,
    issue_customer_jwt,
    verify_clerk_token,
    verify_customer_jwt,
    verify_staff_token,
)
from app.domain.entities.user import AdminRole, AdminUser, StoreUser, StoreUserRole
from app.shared.deps import (
    get_current_admin_auth,
    get_current_customer_auth,
    get_current_store_auth,
    require_admin_role,
    require_role,
)
from app.shared.exceptions import AuthenticationError, AuthorizationError

# --- Fakes reused across tests (same pattern as test_tenant_service.py) ---


class FakeStoreUserRepository:
    def __init__(self, users: dict[str, StoreUser]) -> None:
        self._by_clerk_id = users

    async def get_by_clerk_id(self, clerk_user_id: str) -> StoreUser | None:
        return self._by_clerk_id.get(clerk_user_id)

    async def list_by_tenant(self, tenant_id):  # pragma: no cover — unused here
        return [u for u in self._by_clerk_id.values() if u.tenant_id == tenant_id]


class FakeAdminUserRepository:
    def __init__(self, users: dict[str, AdminUser]) -> None:
        self._by_clerk_id = users

    async def get_by_clerk_id(self, clerk_user_id: str) -> AdminUser | None:
        return self._by_clerk_id.get(clerk_user_id)


class FakeUserService:
    """Stands in for UserService — get_current_store_auth/get_current_admin_auth
    only ever call these two methods on it."""

    def __init__(
        self,
        store_users: dict[str, StoreUser] | None = None,
        admin_users: dict[str, AdminUser] | None = None,
    ) -> None:
        self._store_repo = FakeStoreUserRepository(store_users or {})
        self._admin_repo = FakeAdminUserRepository(admin_users or {})

    async def get_store_user_by_clerk_id(self, clerk_user_id: str) -> StoreUser | None:
        return await self._store_repo.get_by_clerk_id(clerk_user_id)

    async def get_admin_by_clerk_id(self, clerk_user_id: str) -> AdminUser | None:
        return await self._admin_repo.get_by_clerk_id(clerk_user_id)


# --- Customer JWT: issue/verify roundtrip ---


def test_customer_access_token_roundtrip() -> None:
    customer_id, tenant_id = uuid4(), uuid4()
    token = issue_customer_jwt(customer_id, tenant_id, refresh=False)

    claims = verify_customer_jwt(token)

    assert claims["sub"] == str(customer_id)
    assert claims["tenant_id"] == str(tenant_id)
    assert claims["type"] == "access"


def test_customer_refresh_token_is_distinguishable_from_access_token() -> None:
    customer_id, tenant_id = uuid4(), uuid4()
    access = issue_customer_jwt(customer_id, tenant_id, refresh=False)
    refresh = issue_customer_jwt(customer_id, tenant_id, refresh=True)

    assert verify_customer_jwt(access)["type"] == "access"
    assert verify_customer_jwt(refresh)["type"] == "refresh"


def test_verify_customer_jwt_rejects_garbage_token() -> None:
    with pytest.raises(AuthenticationError):
        verify_customer_jwt("not-a-real-token")


def test_verify_customer_jwt_rejects_expired_token() -> None:
    from app.core.config import get_settings

    settings = get_settings()
    now = datetime.now(UTC)
    expired_payload = {
        "sub": str(uuid4()),
        "tenant_id": str(uuid4()),
        "type": "access",
        "iat": now - timedelta(hours=2),
        "exp": now - timedelta(hours=1),  # expired an hour ago
    }
    expired_token = jwt.encode(
        expired_payload, settings.CUSTOMER_JWT_SECRET, algorithm=settings.CUSTOMER_JWT_ALGORITHM
    )

    with pytest.raises(AuthenticationError):
        verify_customer_jwt(expired_token)


def test_verify_customer_jwt_rejects_wrong_secret() -> None:
    now = datetime.now(UTC)
    payload = {
        "sub": str(uuid4()),
        "tenant_id": str(uuid4()),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    forged = jwt.encode(payload, "not-the-real-secret", algorithm="HS256")

    with pytest.raises(AuthenticationError):
        verify_customer_jwt(forged)


# --- get_current_customer_auth ---


async def test_get_current_customer_auth_resolves_from_valid_token() -> None:
    customer_id, tenant_id = uuid4(), uuid4()
    token = issue_customer_jwt(customer_id, tenant_id)

    auth = await get_current_customer_auth(token)

    assert isinstance(auth, AuthContext)
    assert auth.actor_type == "customer"
    assert auth.subject_id == str(customer_id)
    assert auth.tenant_id == tenant_id
    assert auth.role is None


# --- RBAC: require_role / require_admin_role ---


def _store_auth(role: str, tenant_id=None) -> AuthContext:
    return AuthContext(
        actor_type="store_user", subject_id="u1", tenant_id=tenant_id or uuid4(), role=role, raw_claims={}
    )


def _admin_auth(role: str) -> AuthContext:
    return AuthContext(actor_type="admin_user", subject_id="a1", tenant_id=None, role=role, raw_claims={})


def test_require_role_allows_matching_role() -> None:
    check = require_role("owner", "staff")
    auth = _store_auth("owner")
    # _check is a plain sync function — calling it directly with the
    # AuthContext it would have received via Depends(get_current_store_auth)
    # is exactly how FastAPI's own docs recommend unit-testing dependencies.
    assert check(auth) is auth


def test_require_role_denies_non_matching_role() -> None:
    check = require_role("owner")
    with pytest.raises(AuthorizationError):
        check(_store_auth("viewer"))


def test_require_admin_role_allows_matching_role() -> None:
    check = require_admin_role("super_admin", "ops")
    auth = _admin_auth("ops")
    assert check(auth) is auth


def test_require_admin_role_denies_non_matching_role() -> None:
    check = require_admin_role("super_admin", "ops")
    with pytest.raises(AuthorizationError):
        check(_admin_auth("finance"))


def test_store_and_admin_role_vocabularies_are_disjoint() -> None:
    """A regression test for exactly the bug class the require_role /
    require_admin_role split exists to prevent: a store role must never
    satisfy an admin role check, even by string coincidence."""
    check = require_admin_role("owner")  # nonsensical on purpose
    with pytest.raises(AuthorizationError):
        check(_admin_auth("super_admin"))


# --- get_current_store_auth / get_current_admin_auth (Clerk claims resolved via a fake UserService) ---


async def test_get_current_store_auth_resolves_known_user(monkeypatch: pytest.MonkeyPatch) -> None:
    tenant_id = uuid4()
    store_user = StoreUser(
        id=uuid4(),
        tenant_id=tenant_id,
        clerk_user_id="clerk_abc",
        email="owner@khaadi.pk",
        role=StoreUserRole.OWNER,
    )
    fake_service = FakeUserService(store_users={"clerk_abc": store_user})

    async def fake_verify(_token: str) -> dict:
        return {"sub": "clerk_abc"}

    monkeypatch.setattr("app.shared.deps.verify_staff_token", fake_verify)

    auth = await get_current_store_auth("irrelevant-token", fake_service)

    assert auth.actor_type == "store_user"
    assert auth.tenant_id == tenant_id
    assert auth.role == "owner"


async def test_get_current_store_auth_rejects_unknown_clerk_id(monkeypatch: pytest.MonkeyPatch) -> None:
    fake_service = FakeUserService(store_users={})

    async def fake_verify(_token: str) -> dict:
        return {"sub": "clerk_unknown"}

    monkeypatch.setattr("app.shared.deps.verify_staff_token", fake_verify)

    with pytest.raises(AuthenticationError):
        await get_current_store_auth("irrelevant-token", fake_service)


async def test_get_current_admin_auth_resolves_known_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    admin_user = AdminUser(id=uuid4(), clerk_user_id="clerk_ops1", email="ops@zello.ai", role=AdminRole.OPS)
    fake_service = FakeUserService(admin_users={"clerk_ops1": admin_user})

    async def fake_verify(_token: str) -> dict:
        return {"sub": "clerk_ops1"}

    monkeypatch.setattr("app.shared.deps.verify_staff_token", fake_verify)

    auth = await get_current_admin_auth("irrelevant-token", fake_service)

    assert auth.actor_type == "admin_user"
    assert auth.tenant_id is None
    assert auth.role == "ops"


async def test_a_store_owner_session_cannot_satisfy_admin_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    """The concrete failure mode app/shared/deps.py's module docstring
    warns about: a store owner's Clerk identity exists only in
    store_users, so resolving it against admin_users must fail closed."""
    known_store_user = StoreUser(
        id=uuid4(), tenant_id=uuid4(), clerk_user_id="clerk_abc", email="x@y.com", role=StoreUserRole.OWNER
    )
    fake_service = FakeUserService(store_users={"clerk_abc": known_store_user}, admin_users={})

    async def fake_verify(_token: str) -> dict:
        return {"sub": "clerk_abc"}

    monkeypatch.setattr("app.shared.deps.verify_staff_token", fake_verify)

    with pytest.raises(AuthenticationError):
        await get_current_admin_auth("irrelevant-token", fake_service)


# --- Full Clerk JWT verification against a real (locally generated) RSA signature ---


@pytest.fixture
def rsa_keypair():
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    return private_key, public_key


def _pem(private_key) -> bytes:
    from cryptography.hazmat.primitives import serialization

    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )


async def test_verify_clerk_token_accepts_validly_signed_token(
    monkeypatch: pytest.MonkeyPatch, rsa_keypair
) -> None:
    private_key, public_key = rsa_keypair
    kid = "test-signing-key-1"
    issuer = "https://test.clerk.accounts.dev"

    public_jwk = jwk.construct(public_key, algorithm="RS256").to_dict()
    public_jwk["kid"] = kid

    async def fake_get_jwks(_self) -> dict:
        return {"keys": [public_jwk]}

    monkeypatch.setattr(ClerkJWKSClient, "get_jwks", fake_get_jwks)
    monkeypatch.setattr("app.core.security.get_settings", lambda: _settings_with_issuer(issuer))

    now = datetime.now(UTC)
    token = jwt.encode(
        {"sub": "clerk_user_1", "iss": issuer, "iat": now, "exp": now + timedelta(minutes=5)},
        _pem(private_key),
        algorithm="RS256",
        headers={"kid": kid},
    )

    claims = await verify_clerk_token(token)
    assert claims["sub"] == "clerk_user_1"


async def test_verify_clerk_token_rejects_wrong_issuer(monkeypatch: pytest.MonkeyPatch, rsa_keypair) -> None:
    private_key, public_key = rsa_keypair
    kid = "test-signing-key-2"

    public_jwk = jwk.construct(public_key, algorithm="RS256").to_dict()
    public_jwk["kid"] = kid

    async def fake_get_jwks(_self) -> dict:
        return {"keys": [public_jwk]}

    monkeypatch.setattr(ClerkJWKSClient, "get_jwks", fake_get_jwks)
    monkeypatch.setattr("app.core.security.get_settings", lambda: _settings_with_issuer("https://expected.clerk.accounts.dev"))

    now = datetime.now(UTC)
    forged_issuer_payload = {
        "sub": "clerk_user_1",
        "iss": "https://attacker.example",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    token = jwt.encode(forged_issuer_payload, _pem(private_key), algorithm="RS256", headers={"kid": kid})

    with pytest.raises(AuthenticationError):
        await verify_clerk_token(token)


async def test_verify_clerk_token_rejects_token_signed_by_unknown_key(
    monkeypatch: pytest.MonkeyPatch, rsa_keypair
) -> None:
    """Simulates a forged token: signed by a key that isn't in Clerk's
    published JWKS at all."""
    _legit_private, legit_public = rsa_keypair
    attacker_private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    kid = "test-signing-key-3"

    legit_jwk = jwk.construct(legit_public, algorithm="RS256").to_dict()
    legit_jwk["kid"] = kid

    async def fake_get_jwks(_self) -> dict:
        return {"keys": [legit_jwk]}  # only the legit key is published

    monkeypatch.setattr(ClerkJWKSClient, "get_jwks", fake_get_jwks)
    monkeypatch.setattr("app.core.security.get_settings", lambda: _settings_with_issuer("https://test.clerk.accounts.dev"))

    now = datetime.now(UTC)
    forged_token = jwt.encode(
        {"sub": "clerk_user_1", "iat": now, "exp": now + timedelta(minutes=5)},
        _pem(attacker_private_key),
        algorithm="RS256",
        headers={"kid": kid},  # claims the legit kid, but signed by a different key
    )

    with pytest.raises(AuthenticationError):
        await verify_clerk_token(forged_token)


def _settings_with_issuer(issuer: str):
    from app.core.config import get_settings

    settings = get_settings()
    # Settings is a frozen-ish pydantic model in practice but not literally
    # frozen; safest is a shallow copy with the one field overridden.
    return settings.model_copy(update={"CLERK_ISSUER": issuer})


@pytest.mark.parametrize("audience,accepted", [("urn:zello-ai:api", True), ("urn:other:api", False)])
async def test_auth0_staff_token_requires_correct_api_audience(
    monkeypatch: pytest.MonkeyPatch, rsa_keypair, audience: str, accepted: bool
) -> None:
    private_key, public_key = rsa_keypair
    public_jwk = jwk.construct(public_key, algorithm="RS256").to_dict()
    public_jwk["kid"] = "auth0-test-key"

    async def fake_get_jwks(_self) -> dict:
        return {"keys": [public_jwk]}

    monkeypatch.setattr(ClerkJWKSClient, "get_jwks", fake_get_jwks)
    from app.core.config import get_settings

    settings = get_settings().model_copy(update={
        "AUTH_PROVIDER": "auth0",
        "AUTH0_DOMAIN": "test.us.auth0.com",
        "AUTH0_AUDIENCE": "urn:zello-ai:api",
    })
    monkeypatch.setattr("app.core.security.get_settings", lambda: settings)
    now = datetime.now(UTC)
    token = jwt.encode(
        {
            "sub": "auth0|owner-1",
            "iss": "https://test.us.auth0.com/",
            "aud": audience,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        _pem(private_key),
        algorithm="RS256",
        headers={"kid": "auth0-test-key"},
    )
    if accepted:
        assert (await verify_staff_token(token))["sub"] == "auth0|owner-1"
    else:
        with pytest.raises(AuthenticationError):
            await verify_staff_token(token)
