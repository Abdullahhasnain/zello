from typing import Literal

from pydantic import Field

from app.shared.schema import CamelModel


class TranscriptionRead(CamelModel):
    text: str


class SpeechCreate(CamelModel):
    text: str = Field(min_length=1, max_length=2000)
    language: Literal["english", "roman_urdu", "urdu"] = "roman_urdu"
