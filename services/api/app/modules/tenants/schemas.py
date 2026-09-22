from uuid import UUID

from app.shared.schema import CamelModel


class FeatureFlagRead(CamelModel):
    id: UUID
    tenant_id: UUID
    key: str
    enabled: bool


class TenantBranding(CamelModel):
    logo_url: str | None = None
    primary_color: str | None = None
    greeting_persona: str | None = None
    language_mix: list[str] = []


class TenantRead(CamelModel):
    id: UUID
    name: str
    slug: str
    status: str
    phase: str
    branding: TenantBranding


class TenantCreate(CamelModel):
    name: str
    slug: str


class TenantSignup(CamelModel):
    """Self-serve store creation (POST /tenants) — the signed-in Clerk user
    becomes the new store's owner. Email comes from the dashboard's
    server-side Clerk session (currentUser()), not user input."""

    name: str
    slug: str
    email: str


class TenantPublicRead(CamelModel):
    """The storefront's public view of a store — only what an anonymous
    shopper may see (same information the widget embed already exposes)."""

    name: str
    slug: str
    branding: TenantBranding


class TenantUpdateBranding(CamelModel):
    branding: TenantBranding


class FeatureFlagUpdate(CamelModel):
    key: str
    enabled: bool
