# API Architecture

How `services/api` is actually put together, and why. Read this alongside
the code — file paths below are exact.

## Layering (Clean Architecture)

```
app/domain/            framework-agnostic entities + repository interfaces
    entities/           plain dataclasses — Tenant, Product, Conversation, Order, ...
    repositories/        ABCs — TenantRepository, ProductRepository, ...

app/modules/<name>/     one vertical slice per bounded context
    models.py            SQLAlchemy ORM — the ONLY file that knows about tables
    schemas.py           Pydantic DTOs (CamelModel) — the wire format
    repository.py        concrete Sql Alchemy<X>Repository, implements the domain interface
    service.py            use-cases; depends on the domain interface, never on SQLAlchemy
    dependencies.py        composition root — wires concrete repo -> service for FastAPI's DI
    router.py              HTTP endpoints; depends on the service, never on the repository

app/shared/             cross-cutting: exceptions, pagination, camelCase schema base, auth deps
app/core/                config, security (Clerk/JWT verification), logging, middleware
app/api/v1/router.py     the single place every module's router is mounted
app/db/                 Base, mixins, and the two engines (see Authentication doc)
```

The dependency arrow only ever points inward: `router → service → domain
interface`. `service.py` never imports SQLAlchemy, Pydantic, or FastAPI —
see `app/modules/tenants/service.py` for the canonical example, and
`tests/unit/test_tenant_service.py` for what that buys: the service is
tested with a hand-written in-memory fake repository, no database, no
Docker, in 0.08s.

## Why modules, not layers-as-top-level-folders

An earlier draft of this structure put all models in one `models/` folder,
all services in one `services/` folder, etc. That was rejected: touching
"add a field to Product" would mean edits across four unrelated top-level
directories, and nothing stops a `catalog` service from casually importing
an `orders` model. Vertical slices (`app/modules/catalog/`) keep a bounded
context's model/schema/repository/service/router next to each other, and
make a cross-module dependency (e.g. `orders/service.py` importing
`catalog`'s `ProductRepository`) visible as an explicit import instead of
implicit folder proximity.

## Repository pattern, concretely

Every aggregate has:

1. An abstract interface in `app/domain/repositories/*.py` (e.g.
   `TenantRepository(Repository[Tenant])`), narrowed per-aggregate rather
   than one god-repository (Interface Segregation) — `ProductEmbeddingRepository`
   isn't even a `Repository[T]` subtype, because vector similarity search is
   a fundamentally different access pattern than get/list/add/update/delete.
2. A concrete `SqlAlchemy<X>Repository` in the owning module, translating
   between the domain dataclass and the ORM model (`_to_entity` /
   model-construction functions at the top of each `repository.py`).
3. A `Service` class whose constructor takes the *interface* type, and a
   `dependencies.py` function that's the only place deciding which concrete
   class satisfies it.

Swapping Postgres for something else, or writing a test, means touching
`dependencies.py` and nothing else — every service, router, and test caller
is unaffected.

## SOLID, where it actually shows up here

- **SRP**: `service.py` holds use-cases; `repository.py` holds persistence
  translation; `router.py` holds HTTP concerns (status codes, path params).
  None of the three does another's job.
- **OCP**: adding a new payment provider means adding a `PaymentProvider`
  enum value and a new branch in `OrderService`, not editing the
  `Repository` interfaces.
- **LSP**: any `SqlAlchemy<X>Repository` can substitute for its interface in
  a service — enforced structurally by services only ever type-hinting the
  interface.
- **ISP**: `TenantRepository`, `ProductRepository`, `ConversationRepository`,
  etc. are separate, narrow interfaces — no module is forced to implement
  methods it has no use for.
- **DIP**: `service.py` depends on `app/domain/repositories/*.py`
  (abstractions it owns), never on `app/modules/*/repository.py`
  (implementation details) — the classic inversion.

## Multi-tenancy in the request path

Every request resolves to an `AuthContext` (`app/core/security.py`) via one
of three independent dependencies in `app/shared/deps.py` —
`get_current_store_auth`, `get_current_admin_auth`, `get_current_customer_auth`
— never a single dependency that branches on token type. See
[auth-flow.md](./auth-flow.md) for why.

Tenant-scoped endpoints additionally depend on `get_tenant_db_session` /
`get_customer_tenant_db_session`, which set a Postgres session variable
*and* run on a database role with no ability to bypass row-level security —
see [database-schema.md](./database-schema.md)'s "Why RLS, not just WHERE
tenant_id" section. Admin/cross-tenant endpoints use the plain
`get_db_session`, bound to a privileged role instead.

## RBAC

Two role vocabularies, two dependency factories, never crossed:
`require_role("owner", ...)` layers on `get_current_store_auth` and checks
against `owner`/`staff`/`viewer` (FR-2.8); `require_admin_role("ops", ...)`
layers on `get_current_admin_auth` and checks against
`super_admin`/`ops`/`support`/`finance` (FR-3.9). Each is a thin dependency
that 403s via `AuthorizationError` on a mismatch — see
`app/shared/deps.py`. Route-by-route, this is where a tenant's phase
actually gets changed only by `super_admin`/`ops` (not `support` or
`finance`), and the moderation queue is readable by `support` but the
partner-approval endpoints aren't — see `app/modules/tenants/router.py`'s
`admin_router` and `app/modules/admin/router.py`.

## Request/response conventions

- **Versioning**: every route is mounted under `/api/v1` (`app/api/v1/router.py`).
  A breaking change gets `/api/v2` alongside it, not a mutation of v1's contract.
- **Wire format**: camelCase in, camelCase out. Every DTO extends
  `CamelModel` (`app/shared/schema.py`), which handles the alias generation
  once — no module reinvents this.
- **Pagination**: `app/shared/pagination.py`'s `page_params` dependency and
  `Page[T]` model are the one pattern every list endpoint uses
  (`limit`/`offset` query params, `200` max page size).
- **Errors**: routers never raise `HTTPException` directly. Every domain
  error is a subclass of `AppError` (`app/shared/exceptions.py` —
  `NotFoundError`, `ConflictError`, `AuthorizationError`, ...), and one
  exception handler in `app/main.py` maps `AppError.status_code` to the HTTP
  response. This keeps `service.py` free of any HTTP-layer concept.

## Cross-cutting concerns

- **Rate limiting**: `app/core/middleware/rate_limit.py`, Redis-backed fixed
  window, keyed by tenant if resolved else by IP — holds across multiple
  API instances (NFR: Scalability).
- **Request tracing**: `app/core/middleware/request_id.py` assigns/propagates
  `X-Request-ID` and logs one structured line per request — this is what
  will tie an HTTP request to its downstream AI-pipeline trace once that
  module exists.
- **Structured logging**: `app/core/logging.py` — JSON in production,
  human-readable console in dev, one configuration for both.
- **Caching**: `CachedTenantRepository` (`app/modules/tenants/repository.py`)
  decorates `SqlAlchemyTenantRepository` with a Redis-backed cache in front
  of `get_by_slug` — the hottest tenant read in the system (every widget
  page load hits it via `POST /auth/guest-session`). Added without touching
  `TenantService` or the SQL repository — only `dependencies.py` changed to
  start using it, the Open/Closed Principle paying off a second way beyond
  the payment-provider example above.
- **Unhandled errors**: a catch-all `Exception` handler in `app/main.py`
  sits underneath the `AppError` handler — anything that isn't a deliberate
  `AppError` is a bug, gets logged with a full stack trace via `structlog`,
  and returns a generic `{"detail": "An unexpected error occurred."}`
  rather than leaking `str(exc)` (a raw SQL error, a file path) to the
  client.

## What's deliberately not here yet

The Conversation Orchestrator (ASR → NLU → retrieval → generation →
guardrails → TTS sequencing) is not implemented — `ConversationService`
only persists turns. `OrderService.checkout`'s confidence gate is a
placeholder (`confidence: float | None = None`) waiting for that
orchestrator to supply a real score. Payment provider clients (JazzCash/
Easypaisa) are not implemented — `OrderService` creates orders in `pending`
payment status and stops. These are explicit boundaries, not oversights:
this module is project foundation only, per the brief.
