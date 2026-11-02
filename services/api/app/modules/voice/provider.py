from abc import ABC, abstractmethod
from collections.abc import AsyncIterator

import edge_tts
import httpx
from edge_tts.exceptions import EdgeTTSException


class VoiceProviderError(Exception):
    """A safe boundary around provider/network failures."""


class VoiceProvider(ABC):
    @abstractmethod
    async def transcribe(
        self, audio: bytes, *, filename: str, content_type: str
    ) -> str: ...

    @abstractmethod
    async def synthesize(
        self, text: str, *, instructions: str, voice: str | None = None
    ) -> bytes: ...

    async def stream_synthesize(
        self, text: str, *, instructions: str, voice: str | None = None
    ) -> AsyncIterator[bytes]:
        """Default buffered fallback for providers without native streaming."""
        yield await self.synthesize(text, instructions=instructions, voice=voice)


class OpenAIVoiceProvider(VoiceProvider):
    def __init__(
        self,
        *,
        api_key: str,
        stt_model: str,
        tts_model: str,
        voice: str,
        timeout_seconds: float,
    ) -> None:
        self._api_key = api_key
        self._stt_model = stt_model
        self._tts_model = tts_model
        self._voice = voice
        self._timeout_seconds = timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self._api_key}"}

    async def transcribe(self, audio: bytes, *, filename: str, content_type: str) -> str:
        prompt = (
            "Pakistani ecommerce sales conversation. The customer may naturally mix Urdu and English. "
            "Accurately preserve product names, brands, colours, sizes, numbers, rupee prices, "
            "and city names."
        )
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/transcriptions",
                    headers=self._headers(),
                    files={"file": (filename, audio, content_type)},
                    data={
                        "model": self._stt_model,
                        "response_format": "json",
                        "prompt": prompt,
                    },
                )
                response.raise_for_status()
                payload = response.json()
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise VoiceProviderError("Speech transcription is temporarily unavailable.") from exc

        text = payload.get("text") if isinstance(payload, dict) else None
        if not isinstance(text, str) or not text.strip():
            raise VoiceProviderError("No speech could be transcribed from the audio.")
        return text.strip()

    async def synthesize(
        self, text: str, *, instructions: str, voice: str | None = None
    ) -> bytes:
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={**self._headers(), "Content-Type": "application/json"},
                    json={
                        "model": self._tts_model,
                        "voice": voice or self._voice,
                        "input": text,
                        "instructions": instructions,
                        "response_format": "mp3",
                    },
                )
                response.raise_for_status()
                audio = response.content
        except httpx.HTTPError as exc:
            raise VoiceProviderError("Speech synthesis is temporarily unavailable.") from exc

        if not audio:
            raise VoiceProviderError("The speech provider returned empty audio.")
        return audio


class GeminiVoiceProvider(VoiceProvider):
    """Gemini audio understanding used as keyless-to-the-browser server STT.

    The API key stays server-side. The widget sends the same short audio blob
    it already records, so this avoids Chrome's remote Web Speech service and
    its frequent ``network`` failures without changing the public endpoint.
    """

    def __init__(self, *, api_key: str, model: str, timeout_seconds: float) -> None:
        from google import genai

        self._client = genai.Client(
            api_key=api_key,
            http_options={"timeout": int(timeout_seconds * 1000)},
        )
        self._model = model

    async def transcribe(self, audio: bytes, *, filename: str, content_type: str) -> str:
        del filename
        from google.genai import types

        prompt = (
            "Transcribe this Pakistani ecommerce customer audio exactly. Return only the transcript, "
            "with no commentary or quotation marks. The speaker may naturally mix Urdu, Roman Urdu, "
            "and English. Write spoken Urdu in readable Roman Urdu (Latin script), while preserving "
            "English product names, brands, colours, sizes, numbers, rupee prices, and city names."
        )
        try:
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=[
                    types.Content(
                        role="user",
                        parts=[
                            types.Part.from_text(text=prompt),
                            types.Part.from_bytes(data=audio, mime_type=content_type),
                        ],
                    )
                ],
                config=types.GenerateContentConfig(
                    temperature=0,
                    max_output_tokens=200,
                    thinking_config=(
                        types.ThinkingConfig(thinking_budget=0)
                        if self._model == "gemini-2.5-flash"
                        else None
                    ),
                ),
            )
        except Exception as exc:
            # The SDK exposes several transport/provider exception classes
            # across minor releases. Collapse them at this provider boundary
            # so no credential, response body, or vendor detail leaks to the
            # customer-facing endpoint.
            raise VoiceProviderError("Speech transcription is temporarily unavailable.") from exc

        text = (response.text or "").strip().strip('"')
        if not text:
            raise VoiceProviderError("No speech could be transcribed from the audio.")
        return text

    async def synthesize(
        self, text: str, *, instructions: str, voice: str | None = None
    ) -> bytes:
        del text, instructions, voice
        raise VoiceProviderError("Gemini speech synthesis is not configured.")


class EdgeTTSVoiceProvider(VoiceProvider):
    """Keyless Microsoft Neural Voice adapter for customer-facing speech."""

    _ALLOWED_VOICES = {
        "en-US-AvaMultilingualNeural",
        "en-US-AndrewMultilingualNeural",
    }

    def __init__(self, *, voice: str) -> None:
        self._voice = self._validate_voice(voice)

    async def transcribe(self, audio: bytes, *, filename: str, content_type: str) -> str:
        raise VoiceProviderError("Server transcription is not configured.")

    async def synthesize(
        self, text: str, *, instructions: str, voice: str | None = None
    ) -> bytes:
        chunks = [
            chunk
            async for chunk in self.stream_synthesize(text, instructions=instructions, voice=voice)
        ]
        audio = b"".join(chunks)
        if not audio:
            raise VoiceProviderError("The speech provider returned empty audio.")
        return audio

    async def stream_synthesize(
        self, text: str, *, instructions: str, voice: str | None = None
    ) -> AsyncIterator[bytes]:
        del instructions  # Edge voices do not accept model instruction text.
        selected_voice = self._validate_voice(voice or self._voice)
        received_audio = False
        try:
            communicate = edge_tts.Communicate(text, voice=selected_voice, rate="+0%", pitch="+0Hz")
            async for chunk in communicate.stream():
                if chunk["type"] == "audio" and chunk.get("data"):
                    received_audio = True
                    yield chunk["data"]
        except EdgeTTSException as exc:
            raise VoiceProviderError("Speech synthesis is temporarily unavailable.") from exc

        if not received_audio:
            raise VoiceProviderError("The speech provider returned empty audio.")

    @classmethod
    def _validate_voice(cls, voice: str) -> str:
        if voice not in cls._ALLOWED_VOICES:
            raise VoiceProviderError("The requested voice is unavailable.")
        return voice
