"""Embedding generation, behind an interface — mirrors the Repository
pattern's rationale exactly (see docs/architecture/api-architecture.md):
CatalogService and SearchService depend on `EmbeddingProvider`, never on a
vendor SDK directly, so the provider can change (a different vendor, a
self-hosted model once volume justifies it — see the SRS's cost posture
note) by editing dependencies.py alone.

Two providers are implemented — OpenAI and Gemini — selected by the same
`AI_PROVIDER` setting that picks the chat provider (see
app/modules/ai/provider.py and app/modules/search/dependencies.py). Both
are configured to output `app.modules.catalog.models.EMBEDDING_DIM`
dimensions, since that's a fixed pgvector column width — Gemini's
`gemini-embedding-001` supports arbitrary output dimensionality
(Matryoshka representation learning) precisely so it can match OpenAI's
1536 without a schema migration. Switching AI_PROVIDER on a tenant with
already-indexed products does mean re-indexing everything: embeddings from
different models don't share a vector space even at the same dimension.
"""

from abc import ABC, abstractmethod

from openai import AsyncOpenAI


class EmbeddingProvider(ABC):
    @abstractmethod
    async def embed_text(self, text: str) -> list[float]: ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Batched form for indexing many products at once — one API call
        instead of N, which matters once a tenant's catalog runs into the
        thousands of SKUs (NFR: Scalability)."""
        ...


class OpenAIEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str) -> None:
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model

    async def embed_text(self, text: str) -> list[float]:
        response = await self._client.embeddings.create(model=self._model, input=text)
        return response.data[0].embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        response = await self._client.embeddings.create(model=self._model, input=texts)
        return [item.embedding for item in response.data]


class GeminiEmbeddingProvider(EmbeddingProvider):
    def __init__(self, api_key: str, model: str, output_dimensionality: int) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model
        self._output_dimensionality = output_dimensionality

    async def embed_text(self, text: str) -> list[float]:
        from google.genai import types

        response = await self._client.aio.models.embed_content(
            model=self._model,
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=self._output_dimensionality),
        )
        return response.embeddings[0].values

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        from google.genai import types

        response = await self._client.aio.models.embed_content(
            model=self._model,
            contents=texts,
            config=types.EmbedContentConfig(output_dimensionality=self._output_dimensionality),
        )
        return [item.values for item in response.embeddings]
