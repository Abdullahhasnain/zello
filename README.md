# Zello AI

Pakistan's first AI voice sales agent — an embeddable conversational
commerce widget for e-commerce stores, plus the store-owner dashboard and
internal ops console behind it. This repo is **Module 1: Project
Foundation** — monorepo scaffolding, database schema, and backend
architecture. No AI/voice features and no built-out frontend pages yet; see
[`docs/development.md`](docs/development.md#adding-a-new-backend-module)
for what a next module adds on top of this.

## Start here

- **New to the repo?** [`docs/development.md`](docs/development.md) — setup, running the stack, tests, adding a module.
- **What's the product?** [`docs/architecture/`](docs/architecture/) has the full business synthesis, SRS, and system architecture this codebase implements.
- **What env vars do I need?** [`docs/environment-variables.md`](docs/environment-variables.md).

## Repository layout

```
zello-ai/
├── apps/
│   ├── dashboard/     Next.js — store owner dashboard (catalog, widget studio, analytics, billing)
│   ├── admin/         Next.js — internal ops console (partner approval, feature flags, moderation)
│   └── widget/        Vite — embeddable customer widget (two build targets: text-only / voice-capable)
├── services/
│   └── api/           FastAPI — the backend (see below)
├── packages/
│   ├── ui/             shared React components (empty scaffold — fills in with the UI modules)
│   ├── config/         shared TS/ESLint config
│   └── types/          shared TS domain types, mirroring the backend's Pydantic schemas
├── db/
│   └── ddl/            hand-written reference SQL (extensions, schema, RLS policies, seed data)
├── docs/
│   └── architecture/   business synthesis, SRS, and system architecture docs
├── infra/
│   └── scripts/        migrate.py — the one-shot migration runner docker-compose's `migrate` service runs
├── docker-compose.yml       full local stack
├── docker-compose.dev.yml   hot-reload overlay
└── .env.example             Postgres superuser creds (see docs/environment-variables.md)
```

## Backend architecture, in one paragraph

`services/api` is a modular monolith following Clean Architecture: framework-
agnostic entities and repository interfaces in `app/domain/`, one vertical
slice per bounded context in `app/modules/<name>/` (models → schemas →
repository → service → router), and services that depend on repository
*interfaces* rather than SQLAlchemy directly — see
[`docs/architecture/api-architecture.md`](docs/architecture/api-architecture.md)
for the full breakdown, including exactly where SOLID shows up. Multi-tenant
isolation is enforced twice over: application-level tenant filtering, and
Postgres row-level security backed by a database role
(`zello_app`) with no ability to bypass it — see
[`docs/architecture/database-schema.md`](docs/architecture/database-schema.md).

## Quick start

```bash
cp .env.example .env
cp services/api/.env.example services/api/.env
cp apps/dashboard/.env.example apps/dashboard/.env
cp apps/admin/.env.example apps/admin/.env

docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Dashboard at `localhost:3000`, admin console at `localhost:3001`, API at
`localhost:8000`. Full detail, including running services natively without
Docker, in [`docs/development.md`](docs/development.md).

## Status

Pre-revenue, MVP-stage. This module covers the technical foundation only —
see the roadmap in [`docs/architecture/database-schema.md`](docs/architecture/database-schema.md)
and the SRS's phased-delivery section for what's intentionally not built
yet (voice, autonomous checkout, payment provider integrations).
