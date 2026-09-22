from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from app.domain.entities.conversation import (
    Conversation,
    ConversationChannel,
    ConversationMessage,
    ConversationStatus,
    MessageRole,
)
from app.domain.repositories.conversation_repository import ConversationRepository
from app.shared.exceptions import NotFoundError


class ConversationService:
    """Session bookkeeping and context memory. Deciding *what the assistant
    says* in response to a message is deliberately NOT here — that
    orchestration (running search, composing a reply) lives at the router
    layer (see app/modules/conversations/router.py's post_message), which
    composes this service with SearchService. Keeping ConversationService
    itself free of a SearchService dependency means it stays testable with
    nothing but a fake repository (see tests/unit/test_conversation_context.py)
    and reusable by channels that don't do product search at all."""

    def __init__(self, conversation_repository: ConversationRepository) -> None:
        self._conversations = conversation_repository

    async def start_conversation(
        self, tenant_id: UUID, channel: ConversationChannel, language: str, customer_id: UUID | None = None
    ) -> Conversation:
        conversation = Conversation(
            id=uuid4(),
            tenant_id=tenant_id,
            channel=channel,
            status=ConversationStatus.ACTIVE,
            language=language,
            customer_id=customer_id,
        )
        return await self._conversations.add(conversation)

    async def get_conversation(self, conversation_id: UUID) -> Conversation:
        conversation = await self._conversations.get_by_id(conversation_id)
        if conversation is None:
            raise NotFoundError(f"Conversation {conversation_id} not found")
        return conversation

    async def record_message(
        self, conversation_id: UUID, role: MessageRole, content: str, **kwargs
    ) -> ConversationMessage:
        message = ConversationMessage(
            id=uuid4(), conversation_id=conversation_id, role=role, content=content, **kwargs
        )
        return await self._conversations.add_message(conversation_id, message)

    async def touch_activity(self, conversation_id: UUID) -> Conversation:
        """Called on every inbound message — resets the session-expiry
        clock (see is_expired) and, as a side effect, auto-reactivates a
        conversation a customer returns to after it went abandoned."""
        conversation = await self.get_conversation(conversation_id)
        conversation.last_activity_at = datetime.now(UTC)
        if conversation.status == ConversationStatus.ABANDONED:
            conversation.status = ConversationStatus.ACTIVE
        return await self._conversations.update(conversation)

    async def update_context(self, conversation_id: UUID, updates: dict) -> Conversation:
        """Shallow-merges `updates` into the conversation's accumulated
        slot memory — a later turn's value for a key overwrites an
        earlier one (the shopper changed their mind about budget), but
        keys not mentioned in this turn are preserved from before."""
        conversation = await self.get_conversation(conversation_id)
        conversation.context = {**conversation.context, **updates}
        return await self._conversations.update(conversation)

    @staticmethod
    def is_expired(conversation: Conversation, ttl_minutes: int) -> bool:
        """Pure function, not a query — session expiry is evaluated
        against the entity already in hand rather than pushed into SQL, so
        the TTL policy has exactly one implementation regardless of which
        repository the conversation came from."""
        if conversation.last_activity_at is None:
            return False
        return datetime.now(UTC) - conversation.last_activity_at > timedelta(minutes=ttl_minutes)

    async def end_conversation(self, conversation_id: UUID, status: ConversationStatus) -> Conversation:
        conversation = await self.get_conversation(conversation_id)
        conversation.status = status
        conversation.ended_at = datetime.now(UTC)
        return await self._conversations.update(conversation)

    async def list_conversations(
        self, tenant_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        return await self._conversations.list_by_tenant(tenant_id, limit=limit, offset=offset)

    async def get_transcript(self, conversation_id: UUID) -> list[ConversationMessage]:
        return await self._conversations.list_messages(conversation_id)

    async def list_flagged(self, tenant_id: UUID | None = None) -> list[Conversation]:
        """Admin moderation queue — FR-3.4."""
        return await self._conversations.list_flagged(tenant_id)
