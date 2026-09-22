from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

from app.shared.schema import CamelModel

T = TypeVar("T")


class PageParams(BaseModel):
    limit: int = 50
    offset: int = 0


def page_params(limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> PageParams:
    return PageParams(limit=limit, offset=offset)


class Page(CamelModel, Generic[T]):
    items: list[T]
    limit: int
    offset: int
    total: int
