from abc import ABC, abstractmethod

import httpx


class VoiceProviderError(Exception):
    """A safe boundary around provider/network failures."""


class VoiceProvider(ABC):
    @abstractmethod
    async def transcribe(
        self, audio: bytes, *, filename: str, content_type: str
    ) -> str: ...

    @abstractmethod
    async def synthesize(self, text: str, *, instructions: str) -> bytes: ...


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

    async def synthesize(self, text: str, *, instructions: str) -> bytes:
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(
                    "https://api.openai.com/v1/audio/speech",
                    headers={**self._headers(), "Content-Type": "application/json"},
                    json={
                        "model": self._tts_model,
                        "voice": self._voice,
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
