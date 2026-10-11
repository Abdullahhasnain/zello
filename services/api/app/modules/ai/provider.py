"""Chat completion provider, behind an interface — same rationale as
app/modules/search/embedding_provider.py: the orchestrator (orchestrator.py)
depends on `ChatProvider`, never on a vendor SDK directly, so swapping the
configured LLM provider means editing dependencies.py alone.

OpenAI, Gemini, and a local Ollama provider are selectable through
`AI_PROVIDER` (see app/modules/ai/dependencies.py).  Every provider shares
the same ChatProvider boundary, so tenant-scoped catalog grounding and
deterministic cart actions never become vendor-specific.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


class ChatProvider(ABC):
    @abstractmethod
    async def complete(self, messages: list[ChatMessage], *, max_tokens: int, temperature: float) -> str:
        """Returns the assistant's reply text. Raises on any provider-side
        failure (timeout, auth, rate limit) — callers (AIOrchestrator) are
        responsible for catching and falling back, not this method."""
        ...


class OpenAIChatProvider(ChatProvider):
    def __init__(self, api_key: str, model: str, timeout_seconds: float) -> None:
        self._client = AsyncOpenAI(api_key=api_key, timeout=timeout_seconds)
        self._model = model

    async def complete(self, messages: list[ChatMessage], *, max_tokens: int, temperature: float) -> str:
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

        self._client = genai.Client(api_key=api_key, http_options={"timeout": int(timeout_seconds * 1000)})
        self._model = model

    async def complete(self, messages: list[ChatMessage], *, max_tokens: int, temperature: float) -> str:
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
                # Short sales turns do not need adaptive thinking. Without
                # this, Flash can spend the voice latency/token budget on
                # internal reasoning and leave an incomplete spoken reply.
                thinking_config=(
                    types.ThinkingConfig(thinking_budget=0) if self._model == "gemini-2.5-flash" else None
                ),
            ),
        )
        return (response.text or "").strip()


class OllamaChatProvider(ChatProvider):
    """Local Ollama adapter.

    It deliberately uses Ollama's OpenAI-compatible *message* shape only at
    this boundary.  The orchestrator therefore keeps exactly the same
    grounded prompt, history window, planner parsing, and safe fallback as
    the hosted providers.  ``stream=False`` is intentional here: the current
    REST endpoint returns one persisted assistant turn, while speech can
    begin as soon as that concise turn is available.
    """

    def __init__(self, base_url: str, model: str, timeout_seconds: float, think: bool = False) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._timeout_seconds = timeout_seconds
        self._think = think

    async def complete(self, messages: list[ChatMessage], *, max_tokens: int, temperature: float) -> str:
        payload = {
            "model": self._model,
            "messages": [{"role": message.role, "content": message.content} for message in messages],
            "stream": False,
            "think": self._think,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        }
        try:
            async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
                response = await client.post(f"{self._base_url}/api/chat", json=payload)
                response.raise_for_status()
                data = response.json()
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            raise RuntimeError("Ollama is unavailable or returned an invalid response") from exc

        message = data.get("message") if isinstance(data, dict) else None
        content = message.get("content") if isinstance(message, dict) else None
        return content.strip() if isinstance(content, str) else ""
