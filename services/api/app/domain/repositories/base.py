from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Generic, TypeVar
from uuid import UUID

TEntity = TypeVar("TEntity")


class Repository(ABC, Generic[TEntity]):
    """The Dependency Inversion Principle boundary between the application
    layer (services) and persistence (SQLAlchemy). Services in
    app/modules/*/service.py depend on this interface, never on a concrete
    SQLAlchemy repository or session directly — that's what lets a service's
    unit tests run against an in-memory fake instead of a real database, and
    what would let Postgres be swapped without touching a single service.

    Each module's repository interface (e.g. TenantRepository) narrows
    `TEntity` and adds aggregate-specific query methods on top of this —
    Interface Segregation over one bloated god-repository.
    """

    @abstractmethod
    async def get_by_id(self, entity_id: UUID) -> TEntity | None: ...

    @abstractmethod
    async def list(self, *, limit: int = 50, offset: int = 0) -> list[TEntity]: ...

    @abstractmethod
    async def add(self, entity: TEntity) -> TEntity: ...

    @abstractmethod
    async def update(self, entity: TEntity) -> TEntity: ...

    @abstractmethod
    async def delete(self, entity_id: UUID) -> None: ...
