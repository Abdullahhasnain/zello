from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.analytics.repository import AnalyticsEventRepository
from app.modules.analytics.service import AnalyticsService
from app.shared.deps import get_tenant_db_session


def get_analytics_service(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
) -> AnalyticsService:
    return AnalyticsService(AnalyticsEventRepository(session))
