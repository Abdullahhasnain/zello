from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Every request/response DTO in every module extends this. Postgres and
    Python stay snake_case; the wire format is camelCase, matching
    packages/types/src/domain.ts on the frontend — one convention, declared
    once, instead of every module reinventing it."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
