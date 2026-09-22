#!/usr/bin/env python3
"""One-shot migration runner for the `migrate` compose service — see
db/ddl/README.md's "Option B" for why this exact order matters (extensions
before Alembic, RLS/seed after). Uses asyncpg directly rather than shelling
out to `psql`, since the API's runtime image doesn't carry the Postgres
client tools and installing them just for this would bloat every deploy.
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import asyncpg
from sqlalchemy.engine import make_url

DDL_DIR = Path(__file__).resolve().parent.parent.parent / "db" / "ddl"


async def run_sql_file(dsn: str, filename: str) -> None:
    sql = (DDL_DIR / filename).read_text(encoding="utf-8")
    conn = await asyncpg.connect(dsn)
    try:
        print(f"-- running {filename}")
        await conn.execute(sql)
    finally:
        await conn.close()


async def ensure_application_role(admin_dsn: str) -> None:
    """Create/update the non-owner role encoded in DATABASE_URL_APP.

    Production database credentials stay in the hosting provider's secret
    store.  The migration receives the password through the environment and
    never bakes it into SQL, an image layer, or the repository.
    """
    app_url = make_url(os.environ["DATABASE_URL_APP"])
    role_name = app_url.username
    password = app_url.password
    if role_name != "zello_app" or not password:
        raise RuntimeError("DATABASE_URL_APP must use the zello_app role and include a password")

    conn = await asyncpg.connect(admin_dsn)
    try:
        exists = await conn.fetchval("SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1)", role_name)
        quoted_password = await conn.fetchval("SELECT quote_literal($1)", password)
        verb = "ALTER ROLE" if exists else "CREATE ROLE"
        await conn.execute(f"{verb} zello_app LOGIN PASSWORD {quoted_password}")
    finally:
        await conn.close()


def run_alembic_upgrade() -> None:
    print("-- running alembic upgrade head")
    subprocess.run(["alembic", "upgrade", "head"], check=True)


async def main() -> None:
    # asyncpg wants a plain postgresql:// DSN, not SQLAlchemy's
    # postgresql+asyncpg:// — both env vars already point at the same
    # server, just via the two different roles (see app/db/session.py).
    admin_dsn = _sync_dsn_env("DATABASE_URL")

    await run_sql_file(admin_dsn, "001_extensions.sql")
    run_alembic_upgrade()
    await ensure_application_role(admin_dsn)
    await run_sql_file(admin_dsn, "003_row_level_security.sql")
    await run_sql_file(admin_dsn, "004_seed_data.sql")
    print("-- migration complete")


def _sync_dsn_env(name: str) -> str:
    value = os.environ[name]
    value = value.replace("postgresql+asyncpg://", "postgresql://")

    # SQLAlchemy's asyncpg dialect accepts ``ssl=require`` while asyncpg's
    # direct DSN parser expects the libpq spelling ``sslmode=require``.
    # Keep the provider URL valid for both call paths without weakening TLS.
    parts = urlsplit(value)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    ssl_mode = query.pop("ssl", None)
    if ssl_mode and "sslmode" not in query:
        query["sslmode"] = ssl_mode
    return urlunsplit(parts._replace(query=urlencode(query)))


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as exc:  # noqa: BLE001 — top-level entrypoint, must not crash silently
        print(f"MIGRATION FAILED: {exc}", file=sys.stderr)
        sys.exit(1)
