from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.core.middleware.rate_limit import enforce_rate_limit
from app.core.middleware.request_id import RequestContextMiddleware
from app.core.redis import get_redis_client
from app.db.session import get_app_engine, get_engine
from app.shared.exceptions import AppError

logger = get_logger(__name__)

OPENAPI_TAGS = [
    {
        "name": "auth",
        "description": (
            "Guest/OTP customer session bootstrap for the widget. Store owner and "
            "admin auth run through Clerk, not these endpoints — see "
            "docs/architecture/auth-flow.md."
        ),
    },
    {"name": "tenants", "description": "A store owner's own tenant profile and branding."},
    {
        "name": "admin:tenants",
        "description": (
            "Partner approval, phase entitlement, and feature flags. Requires the "
            "`super_admin` or `ops` admin role."
        ),
    },
    {"name": "users", "description": "Store user profile and team management (FR-2.8)."},
    {
        "name": "catalog",
        "description": (
            "Product, category, brand, variant, image, and inventory management "
            "(FR-2.2). Store-owner-facing — the widget reaches the catalog only "
            "through `search`."
        ),
    },
    {
        "name": "search",
        "description": (
            "Semantic product search and recommendations (FR-4.3). Roman Urdu, "
            "Urdu, and English queries all work — see "
            "app/modules/search/normalization.py."
        ),
    },
    {"name": "conversations", "description": "Widget conversation sessions and transcripts."},
    {
        "name": "voice",
        "description": "Authenticated speech-to-text and text-to-speech transport for the voice widget.",
    },
    {"name": "orders", "description": "Cart, checkout, and order history."},
    {
        "name": "billing",
        "description": "Subscription, commission ledger, and invoices for the caller's own tenant.",
    },
    {
        "name": "analytics",
        "description": "Conversion/abandonment summary for the caller's own tenant (FR-2.5).",
    },
    {"name": "admin", "description": "Platform-wide partner list and conversation moderation queue."},
    {
        "name": "health",
        "description": "Liveness/readiness — checks Postgres (both roles) and Redis, not just uptime.",
    },
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings = get_settings()
    logger.info("app_startup", environment=settings.ENVIRONMENT)
    yield
    await get_redis_client().aclose()
    logger.info("app_shutdown")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Zello AI API",
        description="Multi-tenant conversational commerce backend.",
        version="0.1.0",
        openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
        docs_url=f"{settings.API_V1_PREFIX}/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url=f"{settings.API_V1_PREFIX}/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_tags=OPENAPI_TAGS,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestContextMiddleware)

    @app.middleware("http")
    async def _rate_limit(request: Request, call_next):
        rejection = await enforce_rate_limit(request, get_redis_client())
        if rejection is not None:
            return rejection
        return await call_next(request)

    @app.exception_handler(AppError)
    async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
        # 5xx AppErrors (rare — most are 4xx client errors) are worth a log
        # line; a 404/409/403 from normal request handling is not.
        if exc.status_code >= 500:
            logger.error("app_error", status_code=exc.status_code, message=exc.message)
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
        """Anything that reaches here is a bug, not an expected failure
        mode (those are AppError subclasses, handled above) — log the full
        exception with a stack trace and return a generic message. Never
        echo `str(exc)` to the client: it can leak internals (a raw SQL
        error, a file path, a stack frame)."""
        logger.exception("unhandled_exception", exc_info=exc)
        return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred."})

    app.include_router(api_router, prefix=settings.API_V1_PREFIX)

    @app.get("/health", tags=["health"], summary="Liveness and dependency check")
    async def health() -> JSONResponse:
        checks: dict[str, str] = {}

        try:
            async with get_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["postgres_admin"] = "ok"
        except Exception as exc:  # noqa: BLE001 — health check must not raise
            checks["postgres_admin"] = f"error: {exc}"

        try:
            async with get_app_engine().connect() as conn:
                await conn.execute(text("SELECT 1"))
            checks["postgres_app"] = "ok"
        except Exception as exc:  # noqa: BLE001
            checks["postgres_app"] = f"error: {exc}"

        try:
            await get_redis_client().ping()
            checks["redis"] = "ok"
        except Exception as exc:  # noqa: BLE001
            checks["redis"] = f"error: {exc}"

        healthy = all(v == "ok" for v in checks.values())
        return JSONResponse(
            status_code=200 if healthy else 503,
            content={"status": "ok" if healthy else "degraded", "checks": checks},
        )

    return app


app = create_app()
