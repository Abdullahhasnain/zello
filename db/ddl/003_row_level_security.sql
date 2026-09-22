-- Zello AI — row-level security. Run after 002_schema.sql.
--
-- Multi-tenant isolation here is enforced at TWO levels, not one:
--   1. A Postgres session variable (`app.current_tenant_id`), set by
--      app/shared/deps.py's get_tenant_db_session / get_customer_tenant_db_session
--      before any tenant-scoped query runs.
--   2. A distinct, non-BYPASSRLS database role (`zello_app`) that those same
--      dependencies connect as — see app/db/session.py's module docstring.
--
-- Neither alone is sufficient. A session variable the application can set
-- freely is not a security boundary by itself (a code path that forgets to
-- set it, or sets it to the wrong value, would silently see everything) —
-- it only becomes one once paired with a role that has no way to bypass the
-- policies checking it. Conversely, RLS with no session variable would
-- block a role from ALL rows, tenant-scoped or not, since nothing would
-- ever satisfy `tenant_id = current_setting(...)`.

-- ============================================================================
-- Roles
-- ============================================================================

-- Owns the tables (via whichever role ran 002_schema.sql — typically the
-- database's default owner/superuser). Table owners bypass RLS by default;
-- that's intentional here, since Alembic migrations need unrestricted DDL
-- and DML access and are not part of the request-serving path this is
-- protecting.

-- RLS-enforced application role: everything that reads or writes a specific
-- tenant's business data. Deliberately NOT granted BYPASSRLS — this is the
-- role the isolation guarantee actually rests on. The migration runner
-- creates this role from DATABASE_URL_APP so its password is never committed.
-- The privileged DATABASE_URL connects as the database owner, which already
-- bypasses policies on tables it owns and is supported by managed Postgres.

GRANT USAGE ON SCHEMA public TO zello_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zello_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO zello_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zello_app;

-- ============================================================================
-- Policies — one per tenant-scoped table, all identical in shape
-- ============================================================================

-- Tables with a direct tenant_id column.
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'tenant_feature_flags', 'store_users', 'products', 'product_embeddings',
        'categories', 'brands', 'product_variants', 'product_images',
        'inventory_adjustments',
        'customers', 'conversations', 'carts', 'orders', 'payments',
        'subscriptions', 'commission_ledger_entries', 'invoices',
        'analytics_events', 'notification_log'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I
                USING (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)
                WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true)::uuid)',
            t
        );
    END LOOP;
END
$$;

-- `tenants` itself: a scoped session may only see its own row. (The admin
-- role reads this table via the BYPASSRLS `zello_admin` connection instead,
-- for partner-list/approval operations — see app/modules/admin/router.py.)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
    USING (id = current_setting('app.current_tenant_id', true)::uuid)
    WITH CHECK (id = current_setting('app.current_tenant_id', true)::uuid);

-- Child tables with no direct tenant_id column: scoped via their parent.
-- (A denormalized tenant_id column is the faster alternative if these
-- policies show up in a slow query log at scale — not needed yet.)
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON cart_items;
CREATE POLICY tenant_isolation ON cart_items
    USING (EXISTS (
        SELECT 1 FROM carts
        WHERE carts.id = cart_items.cart_id
          AND carts.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ));

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON order_items;
CREATE POLICY tenant_isolation ON order_items
    USING (EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
          AND orders.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ));

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON conversation_messages;
CREATE POLICY tenant_isolation ON conversation_messages
    USING (EXISTS (
        SELECT 1 FROM conversations
        WHERE conversations.id = conversation_messages.conversation_id
          AND conversations.tenant_id = current_setting('app.current_tenant_id', true)::uuid
    ));

-- Deliberately NOT row-level-secured: admin_users, subscription_plans
-- (global catalog, not tenant data), audit_logs, webhook_logs (platform-wide
-- by design — see database-schema.md).
