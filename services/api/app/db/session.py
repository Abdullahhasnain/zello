from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

# Two connection pools, deliberately bound to two different Postgres roles —
# see docs/architecture/database-schema.md's "Why RLS, not just WHERE
# tenant_id" section and db/ddl/003_row_level_security.sql:
#
# - `_engine` / get_db_session: connects as `zello_admin`, a role granted
#   BYPASSRLS. Used only for (a) genuinely cross-tenant admin operations and
#   (b) identity resolution that runs *before* a tenant is known (looking up
#   a StoreUser by clerk_user_id). A session variable alone can't safely gate
#   this — a role-level privilege, checked by Postgres itself at the
#   connection layer, is what makes RLS a real boundary instead of a
#   convention.
# - `_app_engine` / get_scoped_db_session: connects as `zello_app`, which has
#   ordinary table grants and NO BYPASSRLS. This is the only pool
#   get_tenant_db_session / get_customer_tenant_db_session (app/shared/deps.py)
#   are allowed to use — if this role could bypass RLS too, the `SET LOCAL
#   app.current_tenant_id` those dependencies set would be theater.
_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None
_app_engine: AsyncEngine | None = None
_app_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_async_engine(
            str(settings.DATABASE_URL),
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(), expire_on_commit=False, autoflush=False
        )
    return _session_factory


def get_app_engine() -> AsyncEngine:
    global _app_engine
    if _app_engine is None:
        settings = get_settings()
        _app_engine = create_async_engine(
            str(settings.DATABASE_URL_APP),
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _app_engine


def get_app_session_factory() -> async_sessionmaker[AsyncSession]:
    global _app_session_factory
    if _app_session_factory is None:
        _app_session_factory = async_sessionmaker(
            bind=get_app_engine(), expire_on_commit=False, autoflush=False
        )
    return _app_session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Privileged (BYPASSRLS) session — admin cross-tenant reads/writes and
    pre-tenant-known identity lookups only. Never use this for a request
    that operates on a specific tenant's business data; use
    get_scoped_db_session (wrapped by app/shared/deps.py) instead."""
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_scoped_db_session() -> AsyncGenerator[AsyncSession, None]:
    """RLS-enforced session — the role behind this connection cannot read or
    write another tenant's rows even if application code has a bug, because
    Postgres itself checks the row-level-security policy on every query.
    Always wrapped by get_tenant_db_session / get_customer_tenant_db_session
    (app/shared/deps.py), which additionally set the session variable the
    policies filter on — never depend on this directly."""
    session_factory = get_app_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
