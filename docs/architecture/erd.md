# Entity-Relationship Diagram

Renders as a diagram in any Mermaid-aware viewer (GitHub, GitLab, most IDE
Markdown previews). See [database-schema.md](./database-schema.md) for the
per-table narrative and `db/ddl/` for the SQL this diagram mirrors.

```mermaid
erDiagram
    TENANTS ||--o{ TENANT_FEATURE_FLAGS : gates
    TENANTS ||--o{ STORE_USERS : employs
    TENANTS ||--o{ PRODUCTS : lists
    TENANTS ||--o{ CUSTOMERS : serves
    TENANTS ||--o{ CONVERSATIONS : hosts
    TENANTS ||--o{ CARTS : owns
    TENANTS ||--o{ ORDERS : owns
    TENANTS ||--o{ PAYMENTS : owns
    TENANTS ||--o{ SUBSCRIPTIONS : subscribes
    TENANTS ||--o{ COMMISSION_LEDGER_ENTRIES : accrues
    TENANTS ||--o{ INVOICES : billed
    TENANTS ||--o{ ANALYTICS_EVENTS : emits
    TENANTS ||--o{ NOTIFICATION_LOG : notified

    PRODUCTS ||--o{ PRODUCT_EMBEDDINGS : embeds
    PRODUCTS ||--o{ CART_ITEMS : referenced_by
    PRODUCTS ||--o{ ORDER_ITEMS : referenced_by

    CUSTOMERS ||--o{ CONVERSATIONS : starts
    CUSTOMERS ||--o{ CARTS : builds
    CUSTOMERS ||--o{ ORDERS : places

    CONVERSATIONS ||--o{ CONVERSATION_MESSAGES : contains
    CONVERSATIONS ||--o{ CARTS : produces
    CONVERSATIONS ||--o{ ORDERS : produces

    CARTS ||--o{ CART_ITEMS : contains
    CARTS ||--o{ ORDERS : converts_to

    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ PAYMENTS : paid_by
    ORDERS ||--o| COMMISSION_LEDGER_ENTRIES : accrues

    SUBSCRIPTION_PLANS ||--o{ SUBSCRIPTIONS : defines
    SUBSCRIPTIONS ||--o{ INVOICES : rolls_up_into

    TENANTS {
        uuid id PK
        string name
        string slug UK
        string status
        string phase
        jsonb branding
    }

    TENANT_FEATURE_FLAGS {
        uuid id PK
        uuid tenant_id FK
        string key
        bool enabled
    }

    STORE_USERS {
        uuid id PK
        uuid tenant_id FK
        string clerk_user_id UK
        string email
        string role
    }

    ADMIN_USERS {
        uuid id PK
        string clerk_user_id UK
        string email
        string role
    }

    PRODUCTS {
        uuid id PK
        uuid tenant_id FK
        string external_id
        string title
        numeric price
        int stock_qty
        string status
    }

    PRODUCT_EMBEDDINGS {
        uuid id PK
        uuid product_id FK
        uuid tenant_id FK
        string model_version
        vector embedding
    }

    CUSTOMERS {
        uuid id PK
        uuid tenant_id FK
        string phone
        string name
    }

    CONVERSATIONS {
        uuid id PK
        uuid tenant_id FK
        uuid customer_id FK
        string channel
        string status
        string language
    }

    CONVERSATION_MESSAGES {
        uuid id PK
        uuid conversation_id FK
        string role
        text content
        jsonb intent
        numeric confidence
    }

    CARTS {
        uuid id PK
        uuid tenant_id FK
        uuid conversation_id FK
        uuid customer_id FK
        string status
    }

    CART_ITEMS {
        uuid id PK
        uuid cart_id FK
        uuid product_id FK
        int quantity
        numeric unit_price
    }

    ORDERS {
        uuid id PK
        uuid tenant_id FK
        uuid cart_id FK
        uuid customer_id FK
        uuid conversation_id FK
        string status
        numeric total_amount
        string payment_method
        string payment_status
    }

    ORDER_ITEMS {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        numeric unit_price
        numeric subtotal
    }

    PAYMENTS {
        uuid id PK
        uuid order_id FK
        uuid tenant_id FK
        string provider
        string provider_ref
        numeric amount
        string status
    }

    SUBSCRIPTION_PLANS {
        uuid id PK
        string name UK
        numeric price_monthly
        numeric commission_rate
    }

    SUBSCRIPTIONS {
        uuid id PK
        uuid tenant_id FK
        uuid plan_id FK
        string status
        timestamp current_period_end
        timestamp trial_end
    }

    COMMISSION_LEDGER_ENTRIES {
        uuid id PK
        uuid tenant_id FK
        uuid order_id FK UK
        numeric amount
        numeric rate
        string status
    }

    INVOICES {
        uuid id PK
        uuid tenant_id FK
        uuid subscription_id FK
        numeric amount_due
        string status
    }

    ANALYTICS_EVENTS {
        uuid id PK
        uuid tenant_id FK
        string event_type
        jsonb payload
    }

    NOTIFICATION_LOG {
        uuid id PK
        uuid tenant_id FK
        string channel
        string recipient
        string status
    }

    AUDIT_LOGS {
        uuid id PK
        string actor_type
        string actor_id
        uuid tenant_id
        string action
        string entity
    }

    WEBHOOK_LOGS {
        uuid id PK
        uuid tenant_id
        string source
        jsonb payload
        string status
    }
```

## Notes on cardinality choices

- **`ORDERS ||--o| COMMISSION_LEDGER_ENTRIES`**: one order accrues at most one
  commission entry (`UNIQUE(order_id)`) — a correction is a new signed entry,
  never an update to the original (see database-schema.md).
- **`CARTS ||--o{ ORDERS`**: modeled one-to-many at the schema level even
  though a given cart converts to one order in practice, since nothing in the
  DB prevents multiple orders referencing the same `cart_id` and the
  application layer (not a DB constraint) is what enforces "one active
  conversion" — a deliberate simplicity trade-off for this foundation module.
- **`ADMIN_USERS`, `AUDIT_LOGS`, `WEBHOOK_LOGS`** have no edges to `TENANTS`
  in this diagram: they are platform-wide tables, not row-level-security
  scoped. `audit_logs.tenant_id` and `webhook_logs.tenant_id` are plain
  nullable references for filtering, not enforced foreign keys — an audit
  record must survive even if the tenant it referenced is later hard-deleted.
