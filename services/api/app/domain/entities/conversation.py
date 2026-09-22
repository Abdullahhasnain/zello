from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID


class ConversationChannel(StrEnum):
    WIDGET = "widget"
    WHATSAPP = "whatsapp"
    INSTAGRAM = "instagram"
    TIKTOK = "tiktok"


class ConversationStatus(StrEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"
    ESCALATED = "escalated"


class MessageRole(StrEnum):
    CUSTOMER = "customer"
    ASSISTANT = "assistant"
    SYSTEM = "system"


@dataclass
class Customer:
    """An end shopper. Deliberately thin — no password, no required email;
    matches the anonymous-guest-first design in
    docs/architecture/auth-flow.md. `phone` is populated only if the
    shopper opts into OTP login for order tracking (FR-1.12)."""

    id: UUID
    tenant_id: UUID
    phone: str | None = None
    name: str | None = None
    created_at: datetime | None = None


@dataclass
class Conversation:
    """`context` is the session's accumulated slot memory — extracted
    filters like budget/category/color carried across turns so "show me
    something cheaper" on turn 4 can be interpreted against what was
    already established on turn 1, without re-parsing the whole
    transcript. `last_activity_at` backs session-expiry: a conversation
    with no activity for CONVERSATION_SESSION_TTL_MINUTES is treated as
    abandoned (see ConversationService.is_expired)."""

    id: UUID
    tenant_id: UUID
    channel: ConversationChannel
    status: ConversationStatus
    language: str
    customer_id: UUID | None = None
    context: dict = field(default_factory=dict)
    started_at: datetime | None = None
    last_activity_at: datetime | None = None
    ended_at: datetime | None = None


@dataclass
class ConversationMessage:
    """One turn. `intent`/`confidence` are populated by the NLU stage of the
    AI pipeline (see docs/architecture — AI layer) and are what the
    moderation queue (FR-3.4) filters on."""

    id: UUID
    conversation_id: UUID
    role: MessageRole
    content: str
    audio_url: str | None = None
    intent: dict = field(default_factory=dict)
    confidence: float | None = None
    created_at: datetime | None = None
