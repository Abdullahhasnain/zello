"""Shared, non-production configuration for the API test suite.

The application deliberately requires infrastructure credentials in every real
environment. Unit tests do not connect to those services, however, so they
need syntactically valid placeholders before any module asks for Settings.
"""

from __future__ import annotations

import os


def pytest_configure() -> None:
    os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/zello")
    os.environ.setdefault("DATABASE_URL_APP", "postgresql://test:test@localhost:5432/zello_app")
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
    os.environ.setdefault("INTERNAL_SERVICE_TOKEN", "test-internal-token")
    os.environ.setdefault("CUSTOMER_JWT_SECRET", "test-customer-secret")
    os.environ.setdefault("PARTNER_API_HMAC_SECRET", "test-partner-secret")
    os.environ.setdefault("OPENAI_API_KEY", "test-openai-key")
    os.environ.setdefault("CLERK_JWKS_URL", "https://test.clerk.accounts.dev/.well-known/jwks.json")
