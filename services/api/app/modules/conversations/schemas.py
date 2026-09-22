from datetime import datetime
from uuid import UUID

from app.modules.tenants.schemas import TenantBranding
from app.shared.schema import CamelModel


class ConversationMessageRead(CamelModel):
    id: UUID
    conversation_id: UUID
    role: str
    content: str
    audio_url: str | None = None
    intent: dict
    confidence: float | None = None
    created_at: datetime


class ConversationRead(CamelModel):
    id: UUID
    tenant_id: UUID
    customer_id: UUID | None = None
    channel: str
    status: str
    language: str
    context: dict
    started_at: datetime
    last_activity_at: datetime
    ended_at: datetime | None = None


class PostMessageRequest(CamelModel):
    content: str


class MessageExchangeRead(CamelModel):
    """Response for POST /conversations/{id}/messages — both halves of the
    turn in one round trip, so the widget doesn't have to poll for the
    assistant's reply after sending its own message."""

    customer_message: ConversationMessageRead
    assistant_message: ConversationMessageRead


class ConversationStartResponse(CamelModel):
    """Response for POST /conversations — the auto-greeting and the
    tenant's branding (for the widget's theme customization) both come
    back in the same request that creates the session, so the widget never
    needs a separate authenticated call just to know its own colors."""

    conversation: ConversationRead
    greeting: ConversationMessageRead
    branding: TenantBranding
