from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.modules.catalog.models import EMBEDDING_DIM
from app.modules.catalog.repository import SqlAlchemyProductEmbeddingRepository
from app.modules.search.embedding_provider import (
    EmbeddingProvider,
    GeminiEmbeddingProvider,
    OpenAIEmbeddingProvider,
)
from app.modules.search.service import SearchService
from app.shared.deps import get_customer_tenant_db_session, get_tenant_db_session

_embedding_provider: EmbeddingProvider | None = None
_embedding_model_version: str | None = None


def _resolve_active_embedding_config(settings: Settings) -> tuple[EmbeddingProvider, str]:
    """(provider, model_version) as one unit, not two independent lookups —
    model_version is the label SqlAlchemyProductEmbeddingRepository keys
    writes and reads on (see app/modules/catalog/repository.py), so it must
    always match whichever provider actually produced the vector. Deriving
    them separately risks them silently drifting apart (e.g. AI_PROVIDER
    flips to gemini but something still labels rows "text-embedding-3-small")
    which would either mix incompatible vector spaces under one label or
    make search silently blind to what indexing just wrote."""
    if settings.AI_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
        return (
            GeminiEmbeddingProvider(
                api_key=settings.GEMINI_API_KEY,
                model=settings.GEMINI_EMBEDDING_MODEL,
                output_dimensionality=EMBEDDING_DIM,
            ),
            settings.GEMINI_EMBEDDING_MODEL,
        )
    return (
        OpenAIEmbeddingProvider(api_key=settings.OPENAI_API_KEY, model=settings.OPENAI_EMBEDDING_MODEL),
        settings.OPENAI_EMBEDDING_MODEL,
    )


def get_embedding_provider() -> EmbeddingProvider:
    """One provider instance for the process — the vendor SDK client
    manages its own connection pooling internally, same rationale as
    app/core/redis.py's singleton."""
    global _embedding_provider, _embedding_model_version
    if _embedding_provider is None:
        _embedding_provider, _embedding_model_version = _resolve_active_embedding_config(get_settings())
    return _embedding_provider


def get_embedding_model_version(
    _provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
) -> str:
    """Depends on get_embedding_provider purely to guarantee it already ran
    (and so populated _embedding_model_version) — every caller below takes
    both, so this is never read uninitialized."""
    assert _embedding_model_version is not None
    return _embedding_model_version


def get_search_service_for_customer(
    session: Annotated[AsyncSession, Depends(get_customer_tenant_db_session)],
    embedding_provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
    model_version: Annotated[str, Depends(get_embedding_model_version)],
) -> SearchService:
    """For the widget's own search/recommendation endpoints."""
    return SearchService(
        embedding_provider, SqlAlchemyProductEmbeddingRepository(session, model_version=model_version)
    )


def get_search_service_for_store(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
    embedding_provider: Annotated[EmbeddingProvider, Depends(get_embedding_provider)],
    model_version: Annotated[str, Depends(get_embedding_model_version)],
) -> SearchService:
    """For the catalog module's post-write indexing calls (see
    app/modules/catalog/router.py) and any future dashboard-side search/
    preview tooling."""
    return SearchService(
        embedding_provider, SqlAlchemyProductEmbeddingRepository(session, model_version=model_version)
    )
