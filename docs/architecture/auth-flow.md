# Authentication Flow

Three actor types, three independent verification paths — deliberately not
one dependency that branches on token type, because a bug in that branch
would be a cross-actor privilege escalation. See `app/shared/deps.py` and
`app/core/security.py` for the implementation this document describes.

## Why two auth mechanisms at all

| | Store owners & admins | Customers (widget) |
|---|---|---|
| Identity provider | Clerk | Self-issued (this backend) |
| Why | Real accounts: password reset, MFA, OAuth, session management — solved problems Clerk handles well, and this is a low-volume, high-value user base worth paying Clerk's per-MAU pricing for. | Anonymous-first by design (SRS: low-friction shopping). Millions of guest shopper sessions is exactly the volume Clerk's pricing model punishes, and a shopper doesn't need password reset or MFA to add a shirt to a cart. |
| Token | Clerk-issued JWT, verified against Clerk's JWKS | HS256 JWT, issued and verified by this backend |

## 1. Store owners (dashboard) and admins (ops console)

```
Next.js app (@clerk/nextjs)
    │  sign-in / sign-up UI, session cookie, middleware.ts route protection
    ▼
Clerk (hosted)
    │  issues a session JWT; fires a webhook on user/org lifecycle events
    ▼
apps/dashboard/.../api/webhooks/clerk/route.ts  (or apps/admin's equivalent)
    │  verifies the webhook via Svix, forwards the event to the backend
    ▼
FastAPI: POST /api/v1/users/internal/clerk-sync
    (X-Internal-Token shared secret, not a user session — see
    verify_internal_service_token in app/shared/deps.py; maps
    clerk_user_id -> a store_users row, resolving tenant_slug -> tenant_id)
```

On every API request, the Next.js app attaches the Clerk session JWT as a
Bearer token. The backend verifies it independently — it does not trust the
frontend:

```
Authorization: Bearer <clerk-jwt>
    ▼
app/shared/deps.py: get_current_store_auth  (or get_current_admin_auth)
    │  1. verify_clerk_token()  — fetches Clerk's JWKS (cached 1h), validates
    │     signature + issuer via app/core/security.py's ClerkJWKSClient
    │  2. looks up store_users / admin_users by clerk_user_id (the identity/
    │     tenant-membership split: Clerk owns "who are you", this backend
    │     owns "which tenant, what role")
    ▼
AuthContext(actor_type, subject_id, tenant_id, role, raw_claims)
```

`get_current_store_auth` and `get_current_admin_auth` are separate
functions, each looking up a separate table (`store_users` vs
`admin_users`). A store owner's Clerk session can never satisfy an
admin-only dependency, and vice versa — there is no shared "user" row a
role field on it could be tampered with to bridge the two.

**RBAC**: `require_role("owner")` (`app/shared/deps.py`) wraps
`get_current_store_auth` and 403s if `AuthContext.role` isn't in the allowed
set — this is FR-2.8 (owner/staff/viewer) and FR-3.9 (super_admin/ops/
support/finance) enforcement in one shared implementation.

**Admin panel defense-in-depth**: beyond Clerk + RBAC, `apps/admin`'s
`middleware.ts` also checks an IP allowlist (`ADMIN_ALLOWED_IP_RANGES`) —
belt-and-suspenders on top of identity, appropriate for a surface that can
change feature flags and view cross-tenant data.

## 2. Customers (widget)

No Clerk, no password, no email required for the core shopping flow — see
`app/modules/auth/`.

```
Widget loads on a partner site
    ▼
POST /api/v1/auth/guest-session   { "tenantSlug": "khaadi-pilot" }
    │  unauthenticated — tenantSlug is public (visible in the partner
    │  site's page source), not a secret. Creates a new low-privilege
    │  `customers` row scoped to that tenant.
    ▼
{ accessToken, refreshToken, customerId, tenantId }
```

The widget stores both tokens (e.g. `localStorage`, scoped to the partner
site's origin) and sends the access token as a Bearer header on every
subsequent call. `POST /api/v1/auth/refresh` exchanges a refresh token for a
new pair without re-hitting `/guest-session` (and without creating a
duplicate customer row).

```
Authorization: Bearer <customer-jwt>
    ▼
app/shared/deps.py: get_current_customer_auth
    │  verify_customer_jwt() — HS256, this backend's own secret
    │  (CUSTOMER_JWT_SECRET). No DB lookup: tenant_id/customer_id are
    │  embedded directly in the token's claims.
    ▼
AuthContext(actor_type="customer", subject_id=customer_id, tenant_id=..., role=None)
```

**Optional upgrade path** (FR-1.12, order tracking / repeat purchase): a
customer can later attach a phone number via OTP. That's additive
metadata on the same `customers` row and does not change the token
mechanism — still a self-issued JWT, just now associated with a phone
number instead of being purely anonymous. Not implemented in this
foundation module.

## 3. Tenant isolation ties back into auth, not just the database

`get_tenant_db_session` / `get_customer_tenant_db_session`
(`app/shared/deps.py`) both depend on their respective auth function *and*
wrap the database session, so a request can only reach a tenant-scoped
repository once its `AuthContext.tenant_id` has been established by one of
the three verification paths above. The row-level-security policies described in
[database-schema.md](./database-schema.md) are the second, independent
enforcement layer underneath this — auth establishes *which* tenant, RLS
guarantees the query can't see any other tenant even if application code
has a bug.

## 4. Partner & payment integrations

Not user-facing auth, but worth stating alongside it: partner catalog sync
and payment webhooks (JazzCash/Easypaisa) authenticate via API key + HMAC
request signing (`PARTNER_API_HMAC_SECRET`), scoped per tenant — see the
External Interfaces section of the SRS. Not implemented as running code in
this foundation module; `app/core/config.py` reserves the setting and
`app/modules/admin/models.py`'s `webhook_logs` table is where inbound
webhook payloads land once that client exists.

## Summary table

| Actor | Verifies via | Token issued by | Backend lookup |
|---|---|---|---|
| Store owner | `get_current_store_auth` | Clerk | `store_users` by `clerk_user_id` |
| Admin | `get_current_admin_auth` | Clerk | `admin_users` by `clerk_user_id` |
| Customer | `get_current_customer_auth` | This backend (`/auth/guest-session`) | none — claims embedded in JWT |
| Partner integration | HMAC signature (not yet implemented) | N/A (API key) | tenant resolved from key |
