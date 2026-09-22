import time

from redis.asyncio import Redis
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings


async def enforce_rate_limit(request: Request, redis: Redis) -> Response | None:
    """Fixed-window rate limit per client (tenant if resolved, else IP),
    backed by Redis so the limit holds across multiple API instances (NFR:
    Scalability). Returns a 429 response to short-circuit with, or None to
    let the request continue — called from a plain `@app.middleware("http")`
    function in main.py rather than wrapped in BaseHTTPMiddleware, since it
    needs the Redis client created in the app's lifespan (app.state.redis),
    which doesn't exist yet when middleware classes are constructed."""
    limit = get_settings().RATE_LIMIT_PER_MINUTE
    window = int(time.time() // 60)
    tenant_id = request.headers.get("x-tenant-id")
    client_key = tenant_id or (request.client.host if request.client else "unknown")
    redis_key = f"ratelimit:{client_key}:{window}"

    current = await redis.incr(redis_key)
    if current == 1:
        await redis.expire(redis_key, 60)

    if current > limit:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please slow down."})

    return None


async def enforce_conversation_rate_limit(conversation_id: str, redis: Redis) -> bool:
    """Per-conversation cap on AI-generated replies, tighter than (and
    separate from) the global per-tenant/IP limit above — an LLM call costs
    real money per request, unlike most endpoints, so it gets its own
    budget. Called from the conversations router (not main.py middleware,
    since it only applies to the one AI-backed endpoint) — returns True if
    the turn is allowed, False if this conversation is over budget for the
    current minute."""
    limit = get_settings().AI_RATE_LIMIT_PER_MINUTE
    window = int(time.time() // 60)
    redis_key = f"ratelimit:ai:{conversation_id}:{window}"

    current = await redis.incr(redis_key)
    if current == 1:
        await redis.expire(redis_key, 60)

    return current <= limit
