from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import AuthContext
from app.modules.admin.dependencies import get_admin_conversation_service, get_admin_tenant_service
from app.modules.admin.schemas import ConversationRead, TenantRead
from app.modules.conversations.service import ConversationService
from app.modules.tenants.service import TenantService
from app.shared.deps import get_current_admin_auth, require_admin_role
from app.shared.pagination import PageParams, page_params

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/tenants", response_model=list[TenantRead], summary="List all partner stores")
async def list_tenants(
    _auth: Annotated[AuthContext, Depends(get_current_admin_auth)],
    tenant_service: Annotated[TenantService, Depends(get_admin_tenant_service)],
    pagination: Annotated[PageParams, Depends(page_params)],
) -> list[TenantRead]:
    """Partner list — FR-3.1/3.2. Read-only, so open to any admin role
    (support and finance need this list too, just not the mutation
    endpoints in app/modules/tenants/router.py's admin_router)."""
    tenants = await tenant_service.list_tenants(limit=pagination.limit, offset=pagination.offset)
    return [TenantRead.model_validate(t) for t in tenants]


@router.get("/conversations/flagged", response_model=list[ConversationRead], summary="Moderation queue")
async def list_flagged_conversations(
    _auth: Annotated[AuthContext, Depends(require_admin_role("super_admin", "ops", "support"))],
    conversation_service: Annotated[ConversationService, Depends(get_admin_conversation_service)],
) -> list[ConversationRead]:
    """Moderation queue — FR-3.4. Platform-wide (no tenant filter) since
    ops/support need visibility across all partners. `finance` has no
    reason to read conversation transcripts, so excluded here."""
    conversations = await conversation_service.list_flagged(tenant_id=None)
    return [ConversationRead.model_validate(c) for c in conversations]
