# Database Schema

Source of truth for structure is the SQLAlchemy models under
`services/api/app/modules/*/models.py`; this document is the readable
reference alongside them. See [erd.md](./erd.md) for the entity-relationship
diagram and `db/ddl/` for the equivalent hand-written DDL.

## Conventions

- **Primary keys**: UUID v4 everywhere (`UUIDPKMixin`), never auto-increment
  integers — see the mixin's docstring for why (cross-service ID generation,
  non-guessability across tenants).
- **Multi-tenancy**: every tenant-owned table carries a `tenant_id` column
  (`TenantScopedMixin`) *and* a matching row-level-security policy (see
  `db/ddl/002_row_level_security.sql`). The column is a performance
  optimization for indexed lookups; RLS is the actual security boundary.
- **Timestamps**: `TimestampMixin` gives `created_at`/`updated_at` with
  server-side defaults. Tables that are append-only (messages, ledger
  entries, audit logs) intentionally have only `created_at` — they are never
  updated in place, which is itself part of the audit guarantee.
- **Money**: `NUMERIC(12,2)`, never floating point.
- **JSON columns** (`JSONB`): used only for genuinely schemaless data
  (product attributes, branding config, event payloads) — never as a
  substitute for a proper column/table when the shape is known and queried.

## Tables by module

### `tenants` module

| Table | Purpose |
|---|---|
| `tenants` | One row per partner store. Carries `status` (pilot/active/suspended/churned), `phase` (1–4, per the SRS's phased delivery model), and a `branding` JSONB blob (logo, colors, greeting persona, language mix). |
| `tenant_feature_flags` | Per-tenant capability gates (`voice_enabled`, `autonomous_checkout_enabled`, ...). Unique on `(tenant_id, key)`. This is what a Phase-1 tenant's widget build and the backend both check before allowing voice or autonomous checkout — see the SRS's IP-protection requirement. |

### `users` module

| Table | Purpose |
|---|---|
| `store_users` | Store owner/staff accounts. `clerk_user_id` is the join key to Clerk-owned identity — no password hash is ever stored here. `role` is `owner`/`staff`/`viewer` (FR-2.8). |
| `admin_users` | Zello AI ops accounts. Same Clerk-identity pattern, `role` is `super_admin`/`ops`/`support`/`finance` (FR-3.9). Deliberately a separate table from `store_users`, not a shared `users` table with a discriminator — a bug that confuses the two would be a serious privilege-escalation risk, and a schema-level separation makes that class of bug impossible. |

### `catalog` module

| Table | Purpose |
|---|---|
| `products` | Catalog items synced from a tenant's store (API/CSV/Shopify/WooCommerce — FR-2.2). Unique on `(tenant_id, external_id)` so sync is idempotent (`upsert_from_sync`). |
| `product_embeddings` | Vector embeddings for semantic retrieval (`pgvector`, 1536-dim). Unique on `(product_id, model_version)` so re-embedding after a model upgrade doesn't require a destructive migration. Every query against this table filters by `tenant_id` — cross-tenant retrieval is both a correctness and a security bug. |

### `conversations` module

| Table | Purpose |
|---|---|
| `customers` | End shoppers. Deliberately thin: no password, `phone`/`name` optional — matches the anonymous-guest-first design (see [auth-flow.md](./auth-flow.md)). |
| `conversations` | One row per session. `channel` (widget/whatsapp/instagram/tiktok), `status`, `language`, tied to a `customer_id` once one exists. |
| `conversation_messages` | One row per turn. `intent`/`confidence` are populated by the NLU stage of the AI pipeline (not built in this foundation module) and are what the admin moderation queue (FR-3.4) filters on. No `updated_at` — messages are immutable. |

### `orders` module

| Table | Purpose |
|---|---|
| `carts` | Tied to a conversation and/or customer. `status`: open/converted/abandoned. |
| `cart_items` | Line items. `unit_price` is always copied from the product's *current* price at add-time — never taken from client input (see the Order service's price-tampering note). |
| `orders` | Created only by the Order & Checkout service, never directly by the AI layer (FR-4.6). `total_amount` is computed server-side from `cart_items`, never accepted from a request body. |
| `order_items` | Snapshot of what was ordered, independent of later catalog changes. |
| `payments` | One row per payment attempt against an order. `provider`: jazzcash/easypaisa/cod. |

### `billing` module

| Table | Purpose |
|---|---|
| `subscription_plans` | SaaS pricing tiers (Rs. 15,000/store/month baseline) plus the commission rate (3–5%) bundled with each plan. |
| `subscriptions` | One active/trialing subscription per tenant. `trial_end` backs the 3-month free pilot mentioned in the go-to-market plan. |
| `commission_ledger_entries` | One immutable row per completed order, computed from the Order service's source of truth — never estimated (see Business Model: Transaction Commission in the architecture doc). Unique on `order_id`. |
| `invoices` | Billing period rollups generated from subscriptions + the commission ledger. |

### `analytics` module

| Table | Purpose |
|---|---|
| `analytics_events` | Append-only raw event capture (conversation started, cart item added, order placed, ...). Feeds the dashboard's conversion/abandonment tiles (FR-2.5) directly at this scale; graduates to shipping into the OLAP store (ClickHouse, per the architecture doc) once volume outgrows querying this table directly. |

### `notifications` module

| Table | Purpose |
|---|---|
| `notification_log` | Durable record of every outbound email/SMS/WhatsApp notification (FR-2.10), independent of which provider eventually sends it. |

### `admin` module

| Table | Purpose |
|---|---|
| `audit_logs` | Platform-wide (not tenant-scoped/RLS'd) log of who did what — required so an admin action against Tenant A is visible to ops even when RLS would otherwise hide Tenant A's data from a differently-scoped session. |
| `webhook_logs` | Debugging trail for inbound partner/payment webhooks (JazzCash, Easypaisa, Shopify, WooCommerce, ...). |

## Why RLS, not just `WHERE tenant_id = ...`

Every service method that touches a tenant-scoped table already filters by
`tenant_id` in its queries. Row-level security is deliberately redundant with
that: application code has bugs, a future contributor will eventually forget
a `WHERE` clause, and a raw `psql` session or an ad-hoc script run against
production has no application code to enforce anything at all. RLS makes
tenant isolation a database-enforced invariant instead of a
convention every query has to remember to uphold — see
`db/ddl/002_row_level_security.sql` and `get_tenant_db_session` /
`get_customer_tenant_db_session` in `app/shared/deps.py`, which set the
`app.current_tenant_id` session variable the policies key off of.
