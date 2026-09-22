-- Zello AI — required Postgres extensions.
-- Run once per database, before 002_schema.sql.

-- UUID generation (gen_random_uuid()) — used as a DEFAULT fallback; the
-- application (SQLAlchemy) generates IDs client-side in normal operation,
-- but the column default matters for any row inserted outside the app
-- (manual fixes, seed scripts).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Vector similarity search for product embeddings — see product_embeddings
-- in 002_schema.sql and FR-4.3 (tenant-isolated semantic retrieval).
CREATE EXTENSION IF NOT EXISTS vector;
