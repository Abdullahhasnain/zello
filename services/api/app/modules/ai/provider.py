"""Chat completion provider, behind an interface — same rationale as
app/modules/search/embedding_provider.py: the orchestrator (orchestrator.py)
depends on `ChatProvider`, never on a vendor SDK directly, so swapping the
configured LLM provider means editing dependencies.py alone.

Two providers are implemented — OpenAI and Gemini — selected by the
`AI_PROVIDER` setting (see app/modules/ai/dependencies.py). Gemini exists
specifically because its free tier covers real usage with no billing setup,
unlike OpenAI's pay-as-you-go-only API; a tenant with no budget for OpenAI
credits can still run the full assistant on `AI_PROVIDER=gemini`.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

from openai import AsyncOpenAI


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


class ChatProvider(ABC):
    @abstractmethod
    async def complete(
        self, messages: list[ChatMessage], *, max_tokens: int, temperature: float
    ) -> str:
        """Returns the assistant's reply text. Raises on any provider-side
        failure (timeout, auth, rate limit) — callers (AIOrchestrator) are
        responsible for catching and falling back, not this method."""
        ...


class OpenAIChatProvider(ChatProvider):
    def __init__(self, api_key: str, model: str, timeout_seconds: float) -> None:
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout_seconds)
        self._model = model

    async def complete(
        self, messages: list[ChatMessage], *, max_tokens: int, temperature: float
    ) -> str:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        content = response.choices[0].message.content
        return content.strip() if content else ""


class GeminiChatProvider(ChatProvider):
    """Gemini has no `system` role in its `contents` list — a system prompt
    is a separate `system_instruction` config field, and turns use "user"/
    "model" instead of OpenAI's "user"/"assistant". This class is the only
    place that translation happens; AIOrchestrator hands it the same
    ChatMessage list regardless of provider."""

    def __init__(self, api_key: str, model: str, timeout_seconds: float) -> None:
        from google import genai

        self._client = genai.Client(
            api_key=api_key, http_options={"timeout": int(timeout_seconds * 1000)}
        )
        self._model = model

    async def complete(
        self, messages: list[ChatMessage], *, max_tokens: int, temperature: float
    ) -> str:
        from google.genai import types

        system_instruction: str | None = None
        contents: list[types.Content] = []
        for message in messages:
            if message.role == "system":
                # Only one system message is ever built (see
                # prompts.build_system_prompt) — last one wins if there
                # were somehow more than one.
                system_instruction = message.content
                continue
            role = "model" if message.role == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part.from_text(text=message.content)]))

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
        )
        return (response.text or "").strip()
