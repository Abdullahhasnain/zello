from app.modules.catalog.schemas import ProductRead
from app.shared.schema import CamelModel

# Re-exported so callers import `from app.modules.search.schemas import
# ProductRead` rather than reaching into the catalog module directly —
# same convention as app/modules/admin/schemas.py.
__all__ = ["ProductRead", "SearchRequest", "RecommendationQuery"]


class SearchRequest(CamelModel):
    query: str
    top_k: int = 10


class RecommendationQuery(CamelModel):
    top_k: int = 10
