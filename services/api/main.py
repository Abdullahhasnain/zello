"""Vercel ASGI entrypoint.

The application itself remains in ``app.main``; this thin module only gives
the platform a conventional root-level FastAPI entrypoint.
"""

from app.main import app

__all__ = ["app"]
