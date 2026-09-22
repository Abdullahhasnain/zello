from functools import lru_cache

from pydantic import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Centralized, typed configuration. Values come from the environment —
    see .env.example. Never hard-code secrets or per-environment values here.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    ENVIRONMENT: str = "development"  # development | staging | production
    APP_NAME: str = "zello-ai-api"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # --- Database ---
    # Privileged (BYPASSRLS) role — admin cross-tenant ops + pre-tenant
    # identity lookups only. See app/db/session.py's module docstring and
    # db/ddl/003_row_level_security.sql.
    DATABASE_URL: PostgresDsn
    # RLS-enforced role (`zello_app`, no BYPASSRLS) — everything that reads
    # or writes a specific tenant's data goes through this connection.
    DATABASE_URL_APP: PostgresDsn
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # --- Redis ---
    REDIS_URL: RedisDsn

    # --- Auth: Clerk (store owner / admin) ---
    CLERK_JWKS_URL: str
    CLERK_ISSUER: str

    # --- Internal service-to-service calls (e.g. the dashboard's Clerk
    # webhook route forwarding a user.created event) — shared secret, not a
    # user credential. See docs/architecture/auth-flow.md. ---
    INTERNAL_SERVICE_TOKEN: str

    # --- Auth: internal JWT (guest/OTP customer sessions) ---
    CUSTOMER_JWT_SECRET: str
    CUSTOMER_JWT_ALGORITHM: str = "HS256"
    CUSTOMER_JWT_ACCESS_TTL_MINUTES: int = 60
    CUSTOMER_JWT_REFRESH_TTL_DAYS: int = 14

    # --- Partner integrations ---
    PARTNER_API_HMAC_SECRET: str

    # --- AI: embeddings for semantic product search (FR-4.3) ---
    # Used when AI_PROVIDER=openai (the default). Required either way
    # because Settings can't conditionally require a field — leave it as
    # the .env.example placeholder if you're running AI_PROVIDER=gemini.
    OPENAI_API_KEY: str
    OPENAI_EMBEDDING_MODEL: str = "text-embedding-3-small"
    SEARCH_DEFAULT_TOP_K: int = 10

    # --- AI: Gemini, an alternative to OpenAI for both chat and embeddings.
    # Google's free tier covers real usage with no billing setup at all —
    # set AI_PROVIDER=gemini and GEMINI_API_KEY to run the whole assistant
    # (search + conversation) without an OpenAI account. ---
    GEMINI_API_KEY: str | None = None
    GEMINI_CHAT_MODEL: str = "gemini-2.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"

    # --- AI: conversational shopping assistant (Conversation Orchestrator) ---
    # One switch selects the vendor for BOTH chat replies and search
    # embeddings below — "openai" or "gemini". Set AI_ASSISTANT_ENABLED=false
    # to force every conversation onto the deterministic template replies
    # (app/modules/conversations/reply_composer.py) regardless of which
    # provider is configured, e.g. for a cost-conscious pilot.
    AI_PROVIDER: str = "openai"
    AI_ASSISTANT_ENABLED: bool = True
    AI_CHAT_MODEL: str = "gpt-4o-mini"
    AI_MAX_TOKENS: int = 400
    AI_TEMPERATURE: float = 0.4
    # Number of transcript messages (not user/assistant pairs) included in
    # each plan/reply call. Twenty preserves up to ten spoken exchanges.
    AI_HISTORY_TURNS: int = 20
    AI_REQUEST_TIMEOUT_SECONDS: float = 15.0
    # Per-conversation cap, tighter than RATE_LIMIT_PER_MINUTE below — an AI
    # reply costs real money per call, unlike most endpoints, so it gets its
    # own budget on top of the general API rate limit.
    AI_RATE_LIMIT_PER_MINUTE: int = 15

    # --- Voice transport (server STT + TTS) ---
    # Voice is deliberately separate from AI_PROVIDER: stores may use Gemini
    # for planning/replies while still using OpenAI's audio endpoints for
    # multilingual transcription and speech synthesis.
    VOICE_ENABLED: bool = True
    VOICE_STT_MODEL: str = "gpt-4o-mini-transcribe"
    VOICE_TTS_MODEL: str = "gpt-4o-mini-tts"
    VOICE_TTS_VOICE: str = "marin"
    VOICE_REQUEST_TIMEOUT_SECONDS: float = 30.0
    VOICE_MAX_AUDIO_BYTES: int = 5_000_000

    # --- Conversation engine ---
    CONVERSATION_SESSION_TTL_MINUTES: int = 30

    # --- CORS ---
    CORS_ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # --- Rate limiting ---
    RATE_LIMIT_PER_MINUTE: int = 120

    # --- Observability ---
    LOG_LEVEL: str = "INFO"
    SENTRY_DSN: str | None = None


@lru_cache
def get_settings() -> Settings:
    """Cached so `Settings()` — which parses the environment — runs once."""
    return Settings()  # type: ignore[call-arg]
