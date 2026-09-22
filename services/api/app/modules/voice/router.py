from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response

from app.core.security import AuthContext
from app.modules.voice.dependencies import VoiceUnavailableError, get_voice_service
from app.modules.voice.provider import VoiceProviderError
from app.modules.voice.schemas import SpeechCreate, TranscriptionRead
from app.modules.voice.service import VoiceService
from app.shared.deps import get_current_customer_auth

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post(
    "/transcriptions",
    response_model=TranscriptionRead,
    summary="Transcribe one customer voice turn",
)
async def create_transcription(
    request: Request,
    _auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    voice_service: Annotated[VoiceService, Depends(get_voice_service)],
) -> TranscriptionRead:
    audio = await request.body()
    content_type = request.headers.get("content-type", "application/octet-stream")
    try:
        text = await voice_service.transcribe(audio, content_type)
    except VoiceProviderError as exc:
        raise VoiceUnavailableError(str(exc)) from exc
    return TranscriptionRead(text=text)


@router.post("/speech", summary="Synthesize one assistant voice reply")
async def create_speech(
    payload: SpeechCreate,
    _auth: Annotated[AuthContext, Depends(get_current_customer_auth)],
    voice_service: Annotated[VoiceService, Depends(get_voice_service)],
) -> Response:
    try:
        audio = await voice_service.synthesize(payload.text, payload.language)
    except VoiceProviderError as exc:
        raise VoiceUnavailableError(str(exc)) from exc
    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"},
    )
