from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.conversations.repository import SqlAlchemyConversationRepository
from app.modules.conversations.service import ConversationService
from app.shared.deps import get_customer_tenant_db_session, get_tenant_db_session


def get_conversation_service_for_customer(
    session: Annotated[AsyncSession, Depends(get_customer_tenant_db_session)],
) -> ConversationService:
    """For the widget's own conversation endpoints (start/message/end)."""
    return ConversationService(SqlAlchemyConversationRepository(session))


def get_conversation_service_for_store(
    session: Annotated[AsyncSession, Depends(get_tenant_db_session)],
) -> ConversationService:
    """For the dashboard's read-only transcript/analytics views (FR-2.7)."""
    return ConversationService(SqlAlchemyConversationRepository(session))
