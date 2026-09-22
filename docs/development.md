# Development Workflow

## Prerequisites

- Node.js 20+, `pnpm` 9+ (`corepack enable` gets you the right version automatically)
- Python 3.12+, [Poetry](https://python-poetry.org/) 1.8+
- Docker + Docker Compose (v2 CLI, i.e. `docker compose`, not `docker-compose`)

## First-time setup

```bash
git clone <repo> zello-ai && cd zello-ai

# Copy every .env.example to .env — see docs/environment-variables.md for
# what each variable means. Fill in real Clerk keys before running anything
# that touches auth; everything else has a working local-dev default.
cp .env.example .env
cp services/api/.env.example services/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/admin/.env.example apps/admin/.env
```

## Running everything (Docker Compose — recommended)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This builds Postgres (with `pgvector`), Redis, runs `migrate` once
(extensions → Alembic → RLS policies → seed data — see
[`db/ddl/README.md`](../db/ddl/README.md)), then starts the API with
`--reload` and both Next.js apps with `pnpm dev`, source bind-mounted for
hot reload on all three.

| Service | URL |
|---|---|
| API | http://localhost:8000 (docs at `/api/v1/docs` outside production) |
| Store dashboard | http://localhost:3000 |
| Admin panel | http://localhost:3001 |
| Postgres | localhost:5432 |
| Redis | localhost:6379 |

Drop `-f docker-compose.dev.yml` to run the production-style build instead
(no hot reload, no bind mounts) — useful for a final check before a deploy.

## Running natively (faster inner loop, more setup)

**Backend:**

```bash
cd services/api
poetry install
# Postgres + Redis still need to be running — either via
# `docker compose up postgres redis` from the repo root, or your own local
# instances. Then, once (or after a schema change):
alembic upgrade head
poetry run uvicorn app.main:app --reload
```

**Frontend (either app):**

```bash
pnpm install                          # from the repo root — installs all workspaces at once
pnpm --filter=@zello-ai/dashboard dev # or @zello-ai/admin
```

## Database migrations

The SQLAlchemy models (`services/api/app/modules/*/models.py`) are the
source of truth; Alembic generates migrations from them.

```bash
cd services/api
alembic revision --autogenerate -m "add store_users.last_login_at"
# review the generated file under alembic/versions/ before committing —
# autogenerate is a draft, not a guarantee, especially around RLS policies
# and CHECK constraints it doesn't know how to detect
alembic upgrade head
```

After a schema change, also update the hand-written references so they
don't silently drift:

- [`db/ddl/002_schema.sql`](../db/ddl/002_schema.sql) — mirror the DDL by hand
- [`db/ddl/003_row_level_security.sql`](../db/ddl/003_row_level_security.sql) — add a policy if the new table is tenant-scoped
- [`docs/architecture/database-schema.md`](./architecture/database-schema.md) and [`erd.md`](./architecture/erd.md)

## Tests

```bash
cd services/api
poetry run pytest tests/unit -v          # fast, no database — see tests/unit/test_tenant_service.py
poetry run pytest tests/integration -v   # needs postgres+redis running
```

Prefer a unit test with a fake repository (see
`tests/unit/test_tenant_service.py`) over an integration test whenever the
thing under test is service-layer logic — that's the entire point of the
Repository pattern described in
[api-architecture.md](./architecture/api-architecture.md). Reach for an
integration test only when you're actually verifying SQL (a repository
implementation, an RLS policy, a migration).

## Linting & formatting

```bash
# Backend
cd services/api && poetry run ruff check . && poetry run mypy app

# Frontend (from repo root — runs across every workspace)
pnpm lint
pnpm type-check
pnpm format
```

## Adding a new backend module

Follow the shape every existing module already has — e.g. copy
`app/modules/billing/` as a template:

1. `models.py` — SQLAlchemy models, inheriting `UUIDPKMixin` +
   `TenantScopedMixin` (if tenant-owned) + `TimestampMixin` (if mutable).
2. Add the new domain entity + repository interface under
   `app/domain/entities/` and `app/domain/repositories/` if the aggregate
   needs one (skip this for simple append-only logs — see
   `AnalyticsEventRepository` for the lighter pattern).
3. `schemas.py` — Pydantic DTOs extending `CamelModel`.
4. `repository.py` — `SqlAlchemy<X>Repository` implementing the interface.
5. `service.py` — use-cases, constructor-injected with the interface type,
   never importing SQLAlchemy.
6. `dependencies.py` — the composition root wiring concrete repo → service.
7. `router.py` — endpoints; import the right `get_current_*_auth` /
   `get_*_tenant_db_session` from `app/shared/deps.py` depending on who
   calls it (store owner, admin, or the customer widget — see
   [auth-flow.md](./architecture/auth-flow.md)).
8. Register the router in `app/api/v1/router.py`.
9. Import `models.py` in `alembic/env.py` (the "registers on `Base.metadata`"
   comment there explains why) and run `alembic revision --autogenerate`.
10. If the new table is tenant-scoped, add its RLS policy to
    `db/ddl/003_row_level_security.sql` and its row to
    `db/ddl/002_schema.sql`.

## Branching & commits

- `main` is always deployable. Branch per feature/fix:
  `feat/widget-studio-persona`, `fix/commission-ledger-rounding`.
- Commit messages: imperative mood, why over what
  (`Add tenant-scoped RLS to conversation_messages` not
  `Update models.py`).
- Open a PR before merging to `main`; CI (once configured) should run the
  lint/type-check/test commands above.
