from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.schemas import GuestSessionRequest, GuestSessionResponse, RefreshRequest
from app.modules.auth.service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/guest-session",
    response_model=GuestSessionResponse,
    status_code=201,
    summary="Bootstrap a guest customer session",
)
async def start_guest_session(
    payload: GuestSessionRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> GuestSessionResponse:
    """The widget calls this once, on load, before any conversation starts
    — see docs/architecture/auth-flow.md. Deliberately unauthenticated: the
    tenant_slug is a public identifier, not a secret, and this only ever
    creates a new low-privilege guest customer."""
    return await auth_service.start_guest_session(payload.tenant_slug)


@router.post(
    "/refresh",
    response_model=GuestSessionResponse,
    summary="Exchange a refresh token for a new access/refresh pair",
)
async def refresh_guest_session(
    payload: RefreshRequest,
    auth_service: Annotated[AuthService, Depends(get_auth_service)],
) -> GuestSessionResponse:
    return await auth_service.refresh_session(payload.refresh_token)
