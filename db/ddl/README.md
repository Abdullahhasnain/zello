# Hand-written reference DDL

Two ways to use this directory — pick one, don't mix them on the same
database.

## Option A — stand up a database without running Python at all

```bash
psql "$DATABASE_URL" -f 001_extensions.sql
psql "$DATABASE_URL" -f 002_schema.sql
psql "$DATABASE_URL" -f 003_row_level_security.sql
psql "$DATABASE_URL" -f 004_seed_data.sql
```

## Option B — the real path: Alembic + this directory's non-table parts

This is what `docker-compose.yml`'s `migrate` service runs, and what every
real environment uses. Alembic (`services/api/alembic/versions/`, generated
from the SQLAlchemy models) is authoritative for table structure — **skip
`002_schema.sql` entirely** here, since Alembic creates those same tables:

```bash
psql "$DATABASE_URL" -f 001_extensions.sql   # BEFORE alembic — the vector
                                              # column type in product_embeddings
                                              # doesn't exist until this runs
alembic upgrade head                         # creates all 22 tables
psql "$DATABASE_URL" -f 003_row_level_security.sql   # roles + RLS policies
psql "$DATABASE_URL" -f 004_seed_data.sql            # subscription plans
```

`002_schema.sql` still matters in Option B — it's the readable reference
this whole directory is named after, and the thing you diff against when
`alembic revision --autogenerate` produces something surprising. Keep it in
sync with the models by hand when the schema changes.

See [`docs/architecture/database-schema.md`](../../docs/architecture/database-schema.md)
for the narrative and [`docs/architecture/erd.md`](../../docs/architecture/erd.md)
for the diagram.
