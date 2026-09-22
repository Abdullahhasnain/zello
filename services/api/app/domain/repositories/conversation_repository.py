from abc import abstractmethod
from uuid import UUID

from app.domain.entities.conversation import Conversation, ConversationMessage
from app.domain.repositories.base import Repository


class ConversationRepository(Repository[Conversation]):
    @abstractmethod
    async def list_by_tenant(
        self, tenant_id: UUID, *, limit: int = 50, offset: int = 0
    ) -> list[Conversation]: ...

    @abstractmethod
    async def add_message(
        self, conversation_id: UUID, message: ConversationMessage
    ) -> ConversationMessage: ...

    @abstractmethod
    async def list_messages(self, conversation_id: UUID) -> list[ConversationMessage]: ...

    @abstractmethod
    async def list_flagged(self, tenant_id: UUID | None = None) -> list[Conversation]:
        """Backs the admin moderation queue (FR-3.4). tenant_id=None means
        platform-wide — only callable by an AdminUser-scoped service."""
        ...
