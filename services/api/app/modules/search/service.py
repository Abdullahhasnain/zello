from uuid import UUID

from app.domain.entities.product import Product
from app.domain.repositories.product_repository import ProductEmbeddingRepository
from app.modules.search.embedding_provider import EmbeddingProvider
from app.modules.search.normalization import normalize_query


class SearchService:
    """Semantic product search and recommendations (FR-4.3). Depends on
    `EmbeddingProvider` and `ProductEmbeddingRepository` directly rather
    than on CatalogService — search is its own bounded context that only
    ever needs read access to embeddings, not the full catalog CRUD
    surface, and depending on CatalogService here would pull in five
    repositories this module never touches."""

    def __init__(
        self,
        embedding_provider: EmbeddingProvider,
        embedding_repository: ProductEmbeddingRepository,
    ) -> None:
        self._embeddings_provider = embedding_provider
        self._embeddings = embedding_repository

    async def index_product(self, tenant_id: UUID, product: Product) -> None:
        """Called by the catalog module right after a product is created,
        updated, or synced (see app/modules/catalog/router.py) — indexing
        is triggered by catalog writes, but the catalog module never calls
        OpenAI itself; it calls this instead."""
        text = self._build_index_text(product)
        normalized = normalize_query(text)
        vector = await self._embeddings_provider.embed_text(normalized)
        await self._embeddings.upsert_embedding(product.id, tenant_id, vector)

    async def search_products(self, tenant_id: UUID, query: str, *, top_k: int = 10) -> list[Product]:
        normalized = normalize_query(query)
        query_vector = await self._embeddings_provider.embed_text(normalized)
        return await self._embeddings.search_similar(tenant_id, query_vector, top_k=top_k)

    async def recommend_similar(self, tenant_id: UUID, product_id: UUID, *, top_k: int = 10) -> list[Product]:
        """"Customers who viewed this also viewed" — nearest neighbors of
        an existing product's embedding."""
        return await self._embeddings.find_similar_to_product(tenant_id, product_id, top_k=top_k)

    @staticmethod
    def _build_index_text(product: Product) -> str:
        parts = [product.title]
        if product.description:
            parts.append(product.description)
        attribute_values = [str(v) for v in product.attributes.values() if v]
        parts.extend(attribute_values)
        return " ".join(parts)
