"""Unit tests for ConversationService's context memory and session-expiry
logic — a fake repository, no database, same pattern as
test_tenant_service.py."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest

from app.domain.entities.conversation import (
    Conversation,
    ConversationChannel,
    ConversationMessage,
    ConversationStatus,
    MessageRole,
)
from app.domain.repositories.conversation_repository import ConversationRepository
from app.modules.conversations.service import ConversationService


class FakeConversationRepository(ConversationRepository):
    def __init__(self) -> None:
        self._conversations: dict[UUID, Conversation] = {}
        self._messages: dict[UUID, list[ConversationMessage]] = {}

    async def get_by_id(self, entity_id: UUID) -> Conversation | None:
        return self._conversations.get(entity_id)

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Conversation]:
        return list(self._conversations.values())[offset : offset + limit]

    async def list_by_tenant(
        self, tenant_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        matching = [c for c in self._conversations.values() if c.tenant_id == tenant_id]
        return matching[offset : offset + limit]

    async def add(self, entity: Conversation) -> Conversation:
        self._conversations[entity.id] = entity
        self._messages[entity.id] = []
        return entity

    async def update(self, entity: Conversation) -> Conversation:
        self._conversations[entity.id] = entity
        return entity

    async def delete(self, entity_id: UUID) -> None:
        self._conversations.pop(entity_id, None)

    async def add_message(self, conversation_id: UUID, message: ConversationMessage) -> ConversationMessage:
        self._messages[conversation_id].append(message)
        return message

    async def list_messages(self, conversation_id: UUID) -> list[ConversationMessage]:
        return self._messages[conversation_id]

    async def list_flagged(self, tenant_id: UUID | None = None) -> list[Conversation]:
        return []


@pytest.fixture
def service() -> ConversationService:
    return ConversationService(FakeConversationRepository())


async def _start(service: ConversationService) -> Conversation:
    return await service.start_conversation(uuid4(), ConversationChannel.WIDGET, "roman_urdu")


async def test_new_conversation_starts_with_empty_context(service: ConversationService) -> None:
    conversation = await _start(service)
    assert conversation.context == {}


async def test_update_context_merges_rather_than_replaces(service: ConversationService) -> None:
    conversation = await _start(service)

    await service.update_context(conversation.id, {"budget": 3000})
    updated = await service.update_context(conversation.id, {"category": "shoes"})

    assert updated.context == {"budget": 3000, "category": "shoes"}


async def test_update_context_overwrites_a_repeated_key() -> None:
    service = ConversationService(FakeConversationRepository())
    conversation = await _start(service)

    await service.update_context(conversation.id, {"budget": 3000})
    updated = await service.update_context(conversation.id, {"budget": 1500})

    assert updated.context["budget"] == 1500


async def test_touch_activity_updates_last_activity_at(service: ConversationService) -> None:
    conversation = await _start(service)
    original = conversation.last_activity_at

    touched = await service.touch_activity(conversation.id)

    assert touched.last_activity_at is not None
    assert original is None or touched.last_activity_at >= original


async def test_touch_activity_reactivates_an_abandoned_conversation(service: ConversationService) -> None:
    conversation = await _start(service)
    await service.end_conversation(conversation.id, ConversationStatus.ABANDONED)

    reactivated = await service.touch_activity(conversation.id)

    assert reactivated.status == ConversationStatus.ACTIVE


def test_is_expired_false_for_recent_activity() -> None:
    conversation = Conversation(
        id=uuid4(),
        tenant_id=uuid4(),
        channel=ConversationChannel.WIDGET,
        status=ConversationStatus.ACTIVE,
        language="english",
        last_activity_at=datetime.now(UTC) - timedelta(minutes=5),
    )
    assert ConversationService.is_expired(conversation, ttl_minutes=30) is False


def test_is_expired_true_past_the_ttl() -> None:
    conversation = Conversation(
        id=uuid4(),
        tenant_id=uuid4(),
        channel=ConversationChannel.WIDGET,
        status=ConversationStatus.ACTIVE,
        language="english",
        last_activity_at=datetime.now(UTC) - timedelta(minutes=45),
    )
    assert ConversationService.is_expired(conversation, ttl_minutes=30) is True


def test_is_expired_false_when_never_active() -> None:
    conversation = Conversation(
        id=uuid4(),
        tenant_id=uuid4(),
        channel=ConversationChannel.WIDGET,
        status=ConversationStatus.ACTIVE,
        language="english",
        last_activity_at=None,
    )
    assert ConversationService.is_expired(conversation, ttl_minutes=30) is False


async def test_record_message_persists_role_and_content(service: ConversationService) -> None:
    conversation = await _start(service)

    message = await service.record_message(conversation.id, MessageRole.CUSTOMER, "mujhe joota chahiye")

    transcript = await service.get_transcript(conversation.id)
    assert transcript == [message]
    assert message.role == MessageRole.CUSTOMER
    assert message.content == "mujhe joota chahiye"
