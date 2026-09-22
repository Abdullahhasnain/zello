from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.modules.analytics.dependencies import get_analytics_service
from app.modules.analytics.schemas import ConversionSummary
from app.modules.analytics.service import AnalyticsService
from app.shared.deps import get_current_store_auth

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=ConversionSummary)
async def get_conversion_summary(
    auth: Annotated[AuthContext, Depends(get_current_store_auth)],
    analytics_service: Annotated[AnalyticsService, Depends(get_analytics_service)],
) -> ConversionSummary:
    """FR-2.5 headline tile. Deeper funnel/time-series analytics land with
    the analytics UI module."""
    assert auth.tenant_id is not None
    return await analytics_service.get_conversion_summary(auth.tenant_id)
