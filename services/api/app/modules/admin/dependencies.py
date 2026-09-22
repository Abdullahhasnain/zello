from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.modules.conversations.repository import SqlAlchemyConversationRepository
from app.modules.conversations.service import ConversationService
from app.modules.tenants.repository import SqlAlchemyTenantRepository
from app.modules.tenants.service import TenantService


def get_admin_conversation_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ConversationService:
    """Plain (non-RLS-scoped) session — the moderation queue (FR-3.4) is
    platform-wide by design, so it must see across tenants."""
    return ConversationService(SqlAlchemyConversationRepository(session))


def get_admin_tenant_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TenantService:
    return TenantService(SqlAlchemyTenantRepository(session))
