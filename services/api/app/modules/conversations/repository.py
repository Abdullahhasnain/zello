from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.conversation import (
    Conversation,
    ConversationChannel,
    ConversationMessage,
    ConversationStatus,
    MessageRole,
)
from app.domain.repositories.conversation_repository import ConversationRepository
from app.modules.conversations.models import ConversationMessageModel, ConversationModel

# Below this confidence, a turn is surfaced in the admin moderation queue —
# FR-3.4. Kept here (not hard-coded in the query) so it's one obvious knob.
LOW_CONFIDENCE_THRESHOLD = 0.55


def _to_entity(model: ConversationModel) -> Conversation:
    return Conversation(
        id=model.id,
        tenant_id=model.tenant_id,
        channel=ConversationChannel(model.channel),
        status=ConversationStatus(model.status),
        language=model.language,
        customer_id=model.customer_id,
        context=model.context,
        started_at=model.started_at,
        last_activity_at=model.last_activity_at,
        ended_at=model.ended_at,
    )


def _message_to_entity(model: ConversationMessageModel) -> ConversationMessage:
    return ConversationMessage(
        id=model.id,
        conversation_id=model.conversation_id,
        role=MessageRole(model.role),
        content=model.content,
        audio_url=model.audio_url,
        intent=model.intent,
        confidence=float(model.confidence) if model.confidence is not None else None,
        created_at=model.created_at,
    )


class SqlAlchemyConversationRepository(ConversationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_id(self, entity_id: UUID) -> Conversation | None:
        model = await self._session.get(ConversationModel, entity_id)
        return _to_entity(model) if model else None

    async def list(self, *, limit: int = 50, offset: int = 0) -> list[Conversation]:
        result = await self._session.execute(select(ConversationModel).limit(limit).offset(offset))
        return [_to_entity(m) for m in result.scalars().all()]

    async def list_by_tenant(
        self, tenant_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Conversation]:
        result = await self._session.execute(
            select(ConversationModel)
            .where(ConversationModel.tenant_id == tenant_id)
            .order_by(ConversationModel.started_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return [_to_entity(m) for m in result.scalars().all()]

    async def add(self, entity: Conversation) -> Conversation:
        model = ConversationModel(
            id=entity.id,
            tenant_id=entity.tenant_id,
            customer_id=entity.customer_id,
            channel=entity.channel.value,
            status=entity.status.value,
            language=entity.language,
        )
        self._session.add(model)
        await self._session.flush()
        return _to_entity(model)

    async def update(self, entity: Conversation) -> Conversation:
        model = await self._session.get(ConversationModel, entity.id)
        if model is None:
            from app.shared.exceptions import NotFoundError

            raise NotFoundError(f"Conversation {entity.id} not found")
        model.status = entity.status.value
        model.context = entity.context
        model.last_activity_at = entity.last_activity_at or model.last_activity_at
        model.ended_at = entity.ended_at
        await self._session.flush()
        return _to_entity(model)

    async def delete(self, entity_id: UUID) -> None:
        model = await self._session.get(ConversationModel, entity_id)
        if model is not None:
            await self._session.delete(model)

    async def add_message(
        self, conversation_id: UUID, message: ConversationMessage
    ) -> ConversationMessage:
        model = ConversationMessageModel(
            id=message.id,
            conversation_id=conversation_id,
            role=message.role.value,
            content=message.content,
            audio_url=message.audio_url,
            intent=message.intent,
            confidence=message.confidence,
        )
        self._session.add(model)
        await self._session.flush()
        return _message_to_entity(model)

    async def list_messages(self, conversation_id: UUID) -> list[ConversationMessage]:
        result = await self._session.execute(
            select(ConversationMessageModel)
            .where(ConversationMessageModel.conversation_id == conversation_id)
            .order_by(ConversationMessageModel.created_at.asc())
        )
        return [_message_to_entity(m) for m in result.scalars().all()]

    async def list_flagged(self, tenant_id: UUID | None = None) -> list[Conversation]:
        query = (
            select(ConversationModel)
            .join(ConversationMessageModel, ConversationMessageModel.conversation_id == ConversationModel.id)
            .where(
                (ConversationModel.status == ConversationStatus.ESCALATED.value)
                | (ConversationMessageModel.confidence < LOW_CONFIDENCE_THRESHOLD)
            )
            .distinct()
        )
        if tenant_id is not None:
            query = query.where(ConversationModel.tenant_id == tenant_id)

        result = await self._session.execute(query)
        return [_to_entity(m) for m in result.scalars().all()]
