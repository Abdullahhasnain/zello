from app.core.config import Settings, get_settings
from app.modules.ai.orchestrator import AIOrchestrator
from app.modules.ai.provider import ChatProvider, GeminiChatProvider, OpenAIChatProvider


def _looks_like_a_real_openai_key(api_key: str) -> bool:
    """Distinguishes a real OpenAI key from the placeholder value shipped in
    .env.example / used for local dev without AI configured (e.g.
    'sk-not-configured-...') — skips ever making a network call with a key
    that's obviously not real, rather than making one and catching the
    inevitable auth error. Not a security check; just avoids a wasted round
    trip on every message when AI simply isn't set up yet."""
    return api_key.startswith("sk-") and "not-configured" not in api_key


def _build_provider(settings: Settings) -> ChatProvider | None:
    if not settings.AI_ASSISTANT_ENABLED:
        return None

    if settings.AI_PROVIDER == "gemini":
        if not settings.GEMINI_API_KEY:
            return None
        return GeminiChatProvider(
            api_key=settings.GEMINI_API_KEY,
            model=settings.GEMINI_CHAT_MODEL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )

    if settings.AI_PROVIDER == "openai":
        if not _looks_like_a_real_openai_key(settings.OPENAI_API_KEY):
            return None
        return OpenAIChatProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.AI_CHAT_MODEL,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )

    # An unrecognized AI_PROVIDER value falls back to the templated replies
    # rather than raising at request time.
    return None


def get_ai_orchestrator() -> AIOrchestrator:
    """No auth/session dependency here on purpose — the orchestrator only
    ever receives data the caller (conversations/router.py) already fetched
    through a tenant-scoped session. It has no DB access of its own, so
    there's no tenant-isolation surface to get wrong here."""
    settings = get_settings()
    return AIOrchestrator(
        provider=_build_provider(settings),
        max_tokens=settings.AI_MAX_TOKENS,
        temperature=settings.AI_TEMPERATURE,
        history_turns=settings.AI_HISTORY_TURNS,
    )
