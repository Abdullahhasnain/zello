-- Zello AI — core schema. Hand-written reference DDL mirroring the
-- SQLAlchemy models in services/api/app/modules/*/models.py exactly.
-- The Alembic migrations under services/api/alembic/versions/ are the
-- actual source of truth applied to real environments; this file exists so
-- the schema can be read/reviewed/stood up without running Python — see
-- docs/architecture/database-schema.md for the narrative and erd.md for the
-- diagram this mirrors.
--
-- Run after 001_extensions.sql, before 003_row_level_security.sql.

-- ============================================================================
-- tenants module
-- ============================================================================

CREATE TABLE tenants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pilot',
    phase           VARCHAR(20) NOT NULL DEFAULT 'phase_1',
    branding        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenants_slug UNIQUE (slug)
);
CREATE INDEX ix_tenants_slug ON tenants (slug);

CREATE TABLE tenant_feature_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    key         VARCHAR(100) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT uq_tenant_feature_flags_tenant_id_key UNIQUE (tenant_id, key)
);
CREATE INDEX ix_tenant_feature_flags_tenant_id ON tenant_feature_flags (tenant_id);
COMMENT ON TABLE tenant_feature_flags IS
    'Per-tenant phase entitlement (voice_enabled, autonomous_checkout_enabled, ...).';

-- ============================================================================
-- users module
-- ============================================================================

CREATE TABLE store_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    clerk_user_id   VARCHAR(255) NOT NULL,
    email           VARCHAR(320) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'staff',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_store_users_clerk_user_id UNIQUE (clerk_user_id)
);
CREATE INDEX ix_store_users_tenant_id ON store_users (tenant_id);
CREATE INDEX ix_store_users_clerk_user_id ON store_users (clerk_user_id);

CREATE TABLE admin_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_user_id   VARCHAR(255) NOT NULL,
    email           VARCHAR(320) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'ops',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_users_clerk_user_id UNIQUE (clerk_user_id)
);
CREATE INDEX ix_admin_users_clerk_user_id ON admin_users (clerk_user_id);

-- ============================================================================
-- catalog module
-- ============================================================================

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL,
    parent_id       UUID REFERENCES categories (id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_categories_tenant_id_slug UNIQUE (tenant_id, slug)
);
CREATE INDEX ix_categories_tenant_id ON categories (tenant_id);

CREATE TABLE brands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    name            VARCHAR(200) NOT NULL,
    slug            VARCHAR(200) NOT NULL,
    logo_url        VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_brands_tenant_id_slug UNIQUE (tenant_id, slug)
);
CREATE INDEX ix_brands_tenant_id ON brands (tenant_id);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    external_id     VARCHAR(200) NOT NULL,
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    price           NUMERIC(12, 2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'PKR',
    stock_qty       INTEGER NOT NULL DEFAULT 0,
    category_id     UUID REFERENCES categories (id) ON DELETE SET NULL,
    brand_id        UUID REFERENCES brands (id) ON DELETE SET NULL,
    images          JSONB NOT NULL DEFAULT '[]',
    attributes      JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_products_tenant_id_external_id UNIQUE (tenant_id, external_id)
);
CREATE INDEX ix_products_tenant_id ON products (tenant_id);

CREATE TABLE product_variants (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    sku             VARCHAR(100) NOT NULL,
    attributes      JSONB NOT NULL DEFAULT '{}',
    price           NUMERIC(12, 2),
    stock_qty       INTEGER NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_variants_product_id_sku UNIQUE (product_id, sku)
);
CREATE INDEX ix_product_variants_tenant_id ON product_variants (tenant_id);
CREATE INDEX ix_product_variants_product_id ON product_variants (product_id);

-- Tenant-curated gallery, distinct from products.images (the raw sync
-- URL list) — see database-schema.md.
CREATE TABLE product_images (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    url             VARCHAR(500) NOT NULL,
    alt_text        VARCHAR(300),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_product_images_tenant_id ON product_images (tenant_id);
CREATE INDEX ix_product_images_product_id ON product_images (product_id);

-- Immutable audit log — stock is never just UPDATEd in place (see
-- database-schema.md).
CREATE TABLE inventory_adjustments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    product_id              UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    variant_id              UUID REFERENCES product_variants (id) ON DELETE CASCADE,
    delta                   INTEGER NOT NULL,
    reason                  VARCHAR(20) NOT NULL,
    resulting_stock_qty     INTEGER NOT NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_inventory_adjustments_tenant_id ON inventory_adjustments (tenant_id);
CREATE INDEX ix_inventory_adjustments_product_id ON inventory_adjustments (product_id);

-- Dimension must match the embedding model used by the retrieval stage —
-- see EMBEDDING_DIM in services/api/app/modules/catalog/models.py.
CREATE TABLE product_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    model_version   VARCHAR(100) NOT NULL,
    embedding       VECTOR(1536) NOT NULL,
    CONSTRAINT uq_product_embeddings_product_id_model_version UNIQUE (product_id, model_version)
);
CREATE INDEX ix_product_embeddings_product_id ON product_embeddings (product_id);
CREATE INDEX ix_product_embeddings_tenant_id ON product_embeddings (tenant_id);
-- Approximate nearest-neighbor index for cosine similarity search (FR-4.3).
-- `lists` should scale with row count per tenant; 100 is a reasonable start
-- and should be revisited once real catalog volume exists.
CREATE INDEX ix_product_embeddings_embedding_cosine
    ON product_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- conversations module
-- ============================================================================

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    phone           VARCHAR(20),
    name            VARCHAR(200),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_customers_tenant_id ON customers (tenant_id);
CREATE INDEX ix_customers_phone ON customers (phone);

CREATE TABLE conversations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    customer_id         UUID REFERENCES customers (id) ON DELETE SET NULL,
    channel             VARCHAR(20) NOT NULL DEFAULT 'widget',
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    language            VARCHAR(20) NOT NULL DEFAULT 'roman_urdu',
    -- Accumulated slot memory (last query, extracted filters, ...) carried
    -- across turns — see ConversationService.update_context.
    context             JSONB NOT NULL DEFAULT '{}',
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Session-expiry clock — see ConversationService.is_expired.
    last_activity_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at        TIMESTAMPTZ
);
CREATE INDEX ix_conversations_tenant_id ON conversations (tenant_id);

-- No updated_at — a conversation turn is immutable once written (audit trail).
CREATE TABLE conversation_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role            VARCHAR(20) NOT NULL,
    content         TEXT NOT NULL,
    audio_url       VARCHAR(500),
    intent          JSONB NOT NULL DEFAULT '{}',
    confidence      NUMERIC(4, 3),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_conversation_messages_conversation_id ON conversation_messages (conversation_id);

-- ============================================================================
-- orders module
-- ============================================================================

CREATE TABLE carts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations (id) ON DELETE SET NULL,
    customer_id     UUID REFERENCES customers (id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
);
CREATE INDEX ix_carts_tenant_id ON carts (tenant_id);

CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id         UUID NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      NUMERIC(12, 2) NOT NULL
);
CREATE INDEX ix_cart_items_cart_id ON cart_items (cart_id);

CREATE TABLE orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    cart_id         UUID REFERENCES carts (id) ON DELETE SET NULL,
    customer_id     UUID REFERENCES customers (id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES conversations (id) ON DELETE SET NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount    NUMERIC(12, 2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'PKR',
    payment_method  VARCHAR(20) NOT NULL,
    payment_status  VARCHAR(20) NOT NULL DEFAULT 'pending',
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_orders_tenant_id ON orders (tenant_id);

CREATE TABLE order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
    quantity        INTEGER NOT NULL,
    unit_price      NUMERIC(12, 2) NOT NULL,
    subtotal        NUMERIC(12, 2) NOT NULL
);
CREATE INDEX ix_order_items_order_id ON order_items (order_id);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    provider        VARCHAR(20) NOT NULL,
    provider_ref    VARCHAR(200),
    amount          NUMERIC(12, 2) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_payments_tenant_id ON payments (tenant_id);
CREATE INDEX ix_payments_order_id ON payments (order_id);

-- ============================================================================
-- billing module
-- ============================================================================

CREATE TABLE subscription_plans (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(100) NOT NULL,
    price_monthly       NUMERIC(12, 2) NOT NULL,
    commission_rate     NUMERIC(5, 4) NOT NULL,
    features            JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uq_subscription_plans_name UNIQUE (name)
);

CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    plan_id                 UUID NOT NULL REFERENCES subscription_plans (id) ON DELETE RESTRICT,
    status                  VARCHAR(20) NOT NULL DEFAULT 'trialing',
    current_period_start    TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end      TIMESTAMPTZ NOT NULL,
    trial_end               TIMESTAMPTZ
);
CREATE INDEX ix_subscriptions_tenant_id ON subscriptions (tenant_id);

-- Immutable — a correction is a new (possibly negative) entry, never an
-- update, so the ledger stays a true audit trail.
CREATE TABLE commission_ledger_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    order_id        UUID NOT NULL REFERENCES orders (id) ON DELETE RESTRICT,
    amount          NUMERIC(12, 2) NOT NULL,
    rate            NUMERIC(5, 4) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_commission_ledger_entries_order_id UNIQUE (order_id)
);
CREATE INDEX ix_commission_ledger_entries_tenant_id ON commission_ledger_entries (tenant_id);

CREATE TABLE invoices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    subscription_id     UUID REFERENCES subscriptions (id) ON DELETE SET NULL,
    period_start        TIMESTAMPTZ NOT NULL,
    period_end          TIMESTAMPTZ NOT NULL,
    amount_due          NUMERIC(12, 2) NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'draft',
    issued_at           TIMESTAMPTZ,
    paid_at             TIMESTAMPTZ
);
CREATE INDEX ix_invoices_tenant_id ON invoices (tenant_id);

-- ============================================================================
-- analytics module
-- ============================================================================

CREATE TABLE analytics_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    event_type      VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_analytics_events_tenant_id ON analytics_events (tenant_id);
CREATE INDEX ix_analytics_events_event_type ON analytics_events (event_type);
CREATE INDEX ix_analytics_events_occurred_at ON analytics_events (occurred_at);

-- ============================================================================
-- notifications module
-- ============================================================================

CREATE TABLE notification_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL,
    recipient       VARCHAR(320) NOT NULL,
    template        VARCHAR(100) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_notification_log_tenant_id ON notification_log (tenant_id);

-- ============================================================================
-- admin module — platform-wide, deliberately NOT row-level-security scoped
-- ============================================================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_type      VARCHAR(20) NOT NULL,
    actor_id        VARCHAR(100) NOT NULL,
    tenant_id       UUID,  -- plain reference, not a FK: must outlive a deleted tenant
    action          VARCHAR(100) NOT NULL,
    entity          VARCHAR(100) NOT NULL,
    entity_id       VARCHAR(100) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_audit_logs_tenant_id ON audit_logs (tenant_id);
CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE webhook_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID,  -- plain reference, not a FK — see audit_logs above
    source          VARCHAR(100) NOT NULL,
    payload         JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'received',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_webhook_logs_tenant_id ON webhook_logs (tenant_id);
