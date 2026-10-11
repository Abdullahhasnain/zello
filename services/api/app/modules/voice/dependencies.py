from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.modules.voice.provider import EdgeTTSVoiceProvider, OpenAIVoiceProvider, VoiceProvider
from app.modules.voice.service import VoiceService
from app.shared.exceptions import AppError


class VoiceUnavailableError(AppError):
    status_code = 503
    default_message = "Server voice is not configured."


def _has_openai_key(value: str) -> bool:
    lowered = value.lower()
    return value.startswith("sk-") and "replace" not in lowered and "not-configured" not in lowered


def get_voice_service(settings: Annotated[Settings, Depends(get_settings)]) -> VoiceService:
    if not settings.VOICE_ENABLED:
        raise VoiceUnavailableError()

    edge_provider = EdgeTTSVoiceProvider(voice=settings.VOICE_EDGE_TTS_VOICE)
    openai_provider: VoiceProvider | None = None
    if _has_openai_key(settings.OPENAI_API_KEY):
        openai_provider = OpenAIVoiceProvider(
            api_key=settings.OPENAI_API_KEY,
            stt_model=settings.VOICE_STT_MODEL,
            tts_model=settings.VOICE_TTS_MODEL,
            voice=settings.VOICE_TTS_VOICE,
            timeout_seconds=settings.VOICE_REQUEST_TIMEOUT_SECONDS,
        )

    if settings.VOICE_TTS_PROVIDER.lower() == "edge":
        # Keep OpenAI STT when configured; otherwise `/transcriptions` returns
        # the existing 503 and the widget falls back to browser speech input.
        return VoiceService(
            openai_provider or edge_provider,
            tts_provider=edge_provider,
            max_audio_bytes=settings.VOICE_MAX_AUDIO_BYTES,
        )
    if openai_provider:
        return VoiceService(openai_provider, max_audio_bytes=settings.VOICE_MAX_AUDIO_BYTES)
    raise VoiceUnavailableError()
