from redis.asyncio import Redis

from app.core.config import get_settings

_redis_client: Redis | None = None


def get_redis_client() -> Redis:
    """One Redis client for the whole process (redis-py pools connections
    internally, so there's no need for FastAPI's per-request dependency
    lifecycle here — just a shared singleton, same shape as
    app/db/session.py's engine caching)."""
    global _redis_client
    if _redis_client is None:
        _redis_client = Redis.from_url(str(get_settings().REDIS_URL), decode_responses=True)
    return _redis_client


async def get_redis() -> Redis:
    """FastAPI dependency form of the above, for handlers/services that
    want Redis injected rather than importing the singleton directly."""
    return get_redis_client()
