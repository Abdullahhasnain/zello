# Environment Variables

Every variable below lives in a checked-in `.env.example` next to its
service — this page is the consolidated reference, not a new source of
truth. Copy each `.env.example` to `.env` (same directory) before running
anything; `docker-compose.yml` overrides the handful that differ between
local-host and in-network addressing (documented inline in that file).

## Root (`.env.example`) — read only by `docker-compose.yml`

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `POSTGRES_SUPERUSER` | No | `zello_superuser` | Postgres superuser created by the `postgres` container; owns all tables (see [database-schema.md](./architecture/database-schema.md)). |
| `POSTGRES_SUPERUSER_PASSWORD` | No (dev) / **Yes** (shared envs) | `zello_superuser` | As above. Never use the default outside a throwaway local stack. |

## Backend (`services/api/.env.example`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ENVIRONMENT` | No | `development` | Gates dev-only behavior (API docs exposure, console vs. JSON logging). |
| `DEBUG` | No | `false` | SQLAlchemy query echo + FastAPI debug behavior. |
| `DATABASE_URL` | **Yes** | — | Privileged (BYPASSRLS) connection — admin cross-tenant ops + pre-tenant identity lookups only. See [auth-flow.md](./architecture/auth-flow.md). |
| `DATABASE_URL_APP` | **Yes** | — | RLS-enforced connection (`zello_app` role, no BYPASSRLS) — every tenant/customer-scoped request goes through this instead. |
| `DATABASE_POOL_SIZE` | No | `10` | Per-engine SQLAlchemy pool size (applies to both connections above). |
| `DATABASE_MAX_OVERFLOW` | No | `20` | Extra connections allowed beyond `DATABASE_POOL_SIZE` under burst load. |
| `REDIS_URL` | **Yes** | — | Rate limiting (`app/core/middleware/rate_limit.py`) and future session/cache use. |
| `CLERK_JWKS_URL` | **Yes** | — | Verifies store-owner/admin Clerk session JWTs — see [auth-flow.md](./architecture/auth-flow.md). |
| `CLERK_ISSUER` | **Yes** | — | Expected `iss` claim on Clerk JWTs. |
| `INTERNAL_SERVICE_TOKEN` | **Yes** | — | Shared secret gating service-to-service calls with no end-user session (currently: the dashboard's Clerk-webhook-sync forward). Must match the same variable in `apps/dashboard/.env`. |
| `CUSTOMER_JWT_SECRET` | **Yes** | — | Signs the self-issued guest/OTP JWT for the customer widget. Rotate via a secrets manager in any shared environment. |
| `CUSTOMER_JWT_ALGORITHM` | No | `HS256` | — |
| `CUSTOMER_JWT_ACCESS_TTL_MINUTES` | No | `60` | Widget access token lifetime. |
| `CUSTOMER_JWT_REFRESH_TTL_DAYS` | No | `14` | Widget refresh token lifetime — how long an abandoned-then-returning shopper stays "logged in" without re-bootstrapping. |
| `PARTNER_API_HMAC_SECRET` | **Yes** | — | Reserved for partner catalog/order API request signing (not yet implemented — see the SRS's External Interfaces section). |
| `OPENAI_API_KEY` | **Yes** | — | OpenAI embeddings/chat when selected, and server-backed voice transcription/synthesis when `VOICE_ENABLED=true`. A funded key is required for server voice even when chat/search use Gemini. |
| `OPENAI_EMBEDDING_MODEL` | No | `text-embedding-3-small` | Must stay a 1536-dimension model to match `EMBEDDING_DIM` in `app/modules/catalog/models.py` — changing this requires a migration. |
| `SEARCH_DEFAULT_TOP_K` | No | `10` | Default number of results for a semantic search query. |
| `VOICE_ENABLED` | No | `true` | Enables authenticated server STT/TTS endpoints. The widget falls back to browser speech when available if the server path is disabled. |
| `VOICE_STT_MODEL` | No | `gpt-4o-mini-transcribe` | OpenAI transcription model for recorded customer turns. |
| `VOICE_TTS_MODEL` | No | `gpt-4o-mini-tts` | OpenAI speech model for assistant replies. |
| `VOICE_TTS_VOICE` | No | `marin` | OpenAI built-in voice used for generated replies. |
| `VOICE_REQUEST_TIMEOUT_SECONDS` | No | `30` | Timeout for each upstream audio request. |
| `VOICE_MAX_AUDIO_BYTES` | No | `5000000` | Maximum encoded size of one recorded customer turn. |
| `CONVERSATION_SESSION_TTL_MINUTES` | No | `30` | How long a conversation can sit idle before `ConversationService.is_expired` considers it abandoned. |
| `CORS_ALLOWED_ORIGINS` | No | `["http://localhost:3000","http://localhost:3001"]` | JSON array; add each deployed dashboard/admin origin in production. |
| `RATE_LIMIT_PER_MINUTE` | No | `120` | Per-tenant-or-IP fixed-window limit. |
| `LOG_LEVEL` | No | `INFO` | — |
| `SENTRY_DSN` | No | unset | Reserved; error tracking isn't wired up yet. |

## Store dashboard (`apps/dashboard/.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk client SDK init. |
| `CLERK_SECRET_KEY` | **Yes** | Clerk server SDK (middleware.ts route protection). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `..._SIGN_UP_URL` | No | Route overrides for Clerk's hosted components. |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` / `..._AFTER_SIGN_UP_URL` | No | Post-auth redirect targets. |
| `CLERK_WEBHOOK_SECRET` | **Yes** | Verifies Clerk webhook signatures (Svix) in `api/webhooks/clerk/route.ts`. |
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | Backend base URL the dashboard calls. |
| `INTERNAL_SERVICE_TOKEN` | **Yes** | Must match the backend's value — see above. |
| `NEXT_PUBLIC_APP_URL` | No | This app's own origin, for links/redirects. |

## Admin panel (`apps/admin/.env.example`)

A smaller set than the dashboard — no webhook sync, no self-serve sign-up
(ops accounts are provisioned via SSO, see [auth-flow.md](./architecture/auth-flow.md)):

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk client SDK init. |
| `CLERK_SECRET_KEY` | **Yes** | Clerk server SDK (middleware.ts route protection). |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | No | Route override for Clerk's hosted sign-in component. |
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | Backend base URL the admin panel calls. |
| `NEXT_PUBLIC_APP_URL` | No | This app's own origin. |
| `ADMIN_ALLOWED_IP_RANGES` | No | Comma-separated IP prefixes; defense-in-depth on top of Clerk + RBAC (see `middleware.ts`). Better enforced at the load balancer/VPN layer in production — this is a fallback. |

## Adding a new variable

1. Add it to the relevant service's `.env.example` with a realistic
   placeholder (never a real secret).
2. Add it to `app/core/config.py`'s `Settings` (backend) if it's
   backend-side — this is what makes a missing required variable fail
   loudly at startup instead of silently at first use.
3. Add a row here.
4. If `docker-compose.yml` needs a different value in-network (e.g. a
   service hostname instead of `localhost`), add it to that file's
   `environment:` block for the relevant service, not to the `.env.example`
   default.
