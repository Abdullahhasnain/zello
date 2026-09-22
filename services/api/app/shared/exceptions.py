class AppError(Exception):
    """Base for all application-raised errors. app/main.py registers one
    exception handler per subclass so routers never construct HTTPException
    directly — that would leak HTTP concerns into the service layer."""

    status_code: int = 500
    default_message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.default_message)
        self.message = message or self.default_message


class NotFoundError(AppError):
    status_code = 404
    default_message = "The requested resource was not found."


class AuthenticationError(AppError):
    status_code = 401
    default_message = "Authentication failed."


class AuthorizationError(AppError):
    status_code = 403
    default_message = "You do not have permission to perform this action."


class ValidationError(AppError):
    status_code = 422
    default_message = "The request was invalid."


class ConflictError(AppError):
    status_code = 409
    default_message = "The request conflicts with the current state of the resource."


class TenantEntitlementError(AppError):
    """Raised when an action requires a phase/feature-flag entitlement the
    tenant doesn't have — e.g. a Phase 1 tenant's session hitting a
    voice-only endpoint. See SRS: Phased delivery & IP protection."""

    status_code = 403
    default_message = "This feature is not enabled for your account's current phase."


class RateLimitExceededError(AppError):
    """Raised by a per-resource limiter (e.g. AI replies per conversation,
    app/core/middleware/rate_limit.py's enforce_conversation_rate_limit) —
    distinct from the global per-tenant/IP limit enforced as HTTP
    middleware in main.py, which returns its own 429 directly rather than
    raising this."""

    status_code = 429
    default_message = "You're sending messages too quickly. Please wait a moment and try again."
