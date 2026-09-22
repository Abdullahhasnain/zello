# API Documentation

The API documents itself — this page is a map to where, not a duplicate of
the content.

## Interactive docs

| Environment | Swagger UI | ReDoc | Raw schema |
|---|---|---|---|
| Development/staging | `/api/v1/docs` | `/api/v1/redoc` | `/api/v1/openapi.json` |
| Production | disabled | disabled | disabled |

All three are gated by `ENVIRONMENT != "production"` in `app/main.py` —
the schema itself isn't secret, but there's no reason to hand a public
Swagger UI to anyone poking at the production URL either.

## Authenticating in Swagger UI

Every protected route is backed by FastAPI's `HTTPBearer` security scheme
(`app/shared/deps.py`), which is what makes Swagger UI's **Authorize**
button work at all: paste a token (a Clerk session JWT for store-owner/
admin routes, or the `accessToken` from `POST /auth/guest-session` for
widget routes) and it's attached as `Authorization: Bearer <token>` to
every request you try from the UI afterward. See
[auth-flow.md](./auth-flow.md) for how to obtain each kind of token.

## How routes are organized

Each router's `tags=[...]` groups it in the docs UI, and every tag has a
one-line description set in `app/main.py`'s `OPENAPI_TAGS` — read there
first if you're trying to find which surface owns an endpoint. The
`admin:tenants` vs. `admin` split (two different tags) mirrors a real
code boundary: `admin:tenants` (`app/modules/tenants/router.py`'s
`admin_router`) requires the `super_admin`/`ops` role specifically, while
plain `admin` (`app/modules/admin/router.py`) has per-endpoint role checks
that vary (see the docstring on each).

## What's *not* in the schema

`POST /users/internal/clerk-sync` (`app/modules/users/router.py`) is
registered with `include_in_schema=False` — it's a service-to-service call
authenticated with a shared secret (`X-Internal-Token`), not a route any
API consumer should discover or call directly. See
[auth-flow.md](./auth-flow.md#1-store-owners-dashboard-and-admins-ops-console).

## Error response shape

Every error response — validation, auth, not-found, conflict, or an
unhandled 500 — is `{"detail": "<message>"}`, nothing else. This is
enforced by `app/shared/exceptions.py`'s `AppError` hierarchy plus the two
handlers in `app/main.py` (one for `AppError`, one catch-all for anything
that slips through); no router constructs its own error body shape. FastAPI's
built-in 422 (request validation failure, before your handler even runs)
already returns `{"detail": [...]}` in this same key, so client code can
always look at `response.json()["detail"]` regardless of which layer
rejected the request.

## Adding documentation to a new endpoint

- `summary=` in the route decorator for a short list-view label (falls back
  to the function name, Title Cased, if omitted — often fine for CRUD-shaped
  endpoints, worth setting explicitly for anything less obvious).
- A docstring on the handler function becomes the expanded description in
  the docs UI — this is where an FR reference or a non-obvious constraint
  belongs (see almost any existing handler for the pattern).
- `response_model=` is required on every endpoint — it's both the OpenAPI
  response schema and what strips internal-only fields from whatever the
  service returns.
