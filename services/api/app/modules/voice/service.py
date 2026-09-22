from app.modules.voice.provider import VoiceProvider
from app.shared.exceptions import ValidationError

_CONTENT_TYPES: dict[str, str] = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/flac": "flac",
}

_SPEECH_INSTRUCTIONS = {
    "english": "Speak warmly and concisely in natural Pakistani English, like a helpful sales assistant.",
    "roman_urdu": (
        "Speak warmly and concisely with natural Pakistani Urdu-English code switching. "
        "Pronounce Roman Urdu as spoken Urdu, and keep product names, sizes, prices, and brands clear."
    ),
    "urdu": (
        "Speak warmly and concisely in natural Pakistani Urdu. Keep product names, sizes, prices, "
        "and English brand names clear."
    ),
}


class VoiceService:
    def __init__(self, provider: VoiceProvider, *, max_audio_bytes: int) -> None:
        self._provider = provider
        self._max_audio_bytes = max_audio_bytes

    async def transcribe(self, audio: bytes, content_type: str) -> str:
        normalized_type = content_type.split(";", 1)[0].strip().lower()
        extension = _CONTENT_TYPES.get(normalized_type)
        if extension is None:
            raise ValidationError("Unsupported audio format. Use WebM, OGG, MP4, MP3, WAV, or FLAC.")
        if not audio:
            raise ValidationError("The audio recording is empty.")
        if len(audio) > self._max_audio_bytes:
            raise ValidationError("The audio recording is too large. Please keep each turn short.")
        return await self._provider.transcribe(
            audio,
            filename=f"voice-turn.{extension}",
            content_type=normalized_type,
        )

    async def synthesize(self, text: str, language: str) -> bytes:
        cleaned = text.strip()
        if not cleaned:
            raise ValidationError("Speech text cannot be empty.")
        instructions = _SPEECH_INSTRUCTIONS.get(language, _SPEECH_INSTRUCTIONS["english"])
        return await self._provider.synthesize(cleaned, instructions=instructions)
