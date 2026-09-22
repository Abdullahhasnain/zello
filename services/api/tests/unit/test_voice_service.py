import pytest

from app.modules.voice.provider import VoiceProvider
from app.modules.voice.service import VoiceService
from app.shared.exceptions import ValidationError


class FakeVoiceProvider(VoiceProvider):
    def __init__(self) -> None:
        self.transcription_call: tuple[bytes, str, str] | None = None
        self.synthesis_call: tuple[str, str] | None = None

    async def transcribe(self, audio: bytes, *, filename: str, content_type: str) -> str:
        self.transcription_call = (audio, filename, content_type)
        return "mujhe black shoes chahiye"

    async def synthesize(self, text: str, *, instructions: str) -> bytes:
        self.synthesis_call = (text, instructions)
        return b"mp3-audio"


async def test_transcription_accepts_browser_webm_with_codec_parameter() -> None:
    provider = FakeVoiceProvider()
    service = VoiceService(provider, max_audio_bytes=1000)

    text = await service.transcribe(b"voice", "audio/webm;codecs=opus")

    assert text == "mujhe black shoes chahiye"
    assert provider.transcription_call == (b"voice", "voice-turn.webm", "audio/webm")


async def test_transcription_rejects_unsupported_or_oversized_audio() -> None:
    service = VoiceService(FakeVoiceProvider(), max_audio_bytes=4)

    with pytest.raises(ValidationError):
        await service.transcribe(b"voice", "application/octet-stream")
    with pytest.raises(ValidationError):
        await service.transcribe(b"voice", "audio/webm")


async def test_roman_urdu_speech_uses_code_switching_instructions() -> None:
    provider = FakeVoiceProvider()
    service = VoiceService(provider, max_audio_bytes=1000)

    audio = await service.synthesize("Yeh shoes 4500 rupees ke hain.", "roman_urdu")

    assert audio == b"mp3-audio"
    assert provider.synthesis_call is not None
    assert "Urdu-English code switching" in provider.synthesis_call[1]
