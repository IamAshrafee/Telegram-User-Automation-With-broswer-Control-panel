from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import SendCodeRequest, VerifyCodeRequest, SessionStatusResponse, AuthResponse
from backend.services import telegram_service
from backend.models import TelegramSession
from backend.models.user import User
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/auth/telegram", tags=["Telegram Authentication"])


@router.post("/send-code", response_model=AuthResponse)
async def send_code(
    request: SendCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send OTP code to phone number (requires web authentication)."""
    success = await telegram_service.send_code_request(request.phone_number)
    
    if success:
        return AuthResponse(
            success=True,
            message="OTP code sent successfully. Check your Telegram app."
        )
    else:
        raise HTTPException(status_code=400, detail="Failed to send OTP code")


@router.post("/verify-code", response_model=AuthResponse)
async def verify_code(
    request: VerifyCodeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify OTP code and create Telegram session linked to user."""
    success, message = await telegram_service.sign_in(
        request.phone_number,
        request.code,
        request.password,
        db,
        current_user.id  # Link session to authenticated user
    )
    
    if message == "2FA_REQUIRED":
        return AuthResponse(
            success=False,
            message="2FA password required. Please enter your password."
        )
    
    if success:
        session = db.query(TelegramSession).filter(
            TelegramSession.user_id == current_user.id,
            TelegramSession.phone_number == request.phone_number
        ).first()
        
        return AuthResponse(
            success=True,
            message=message,
            session_status=SessionStatusResponse(
                is_active=True,
                phone_number=request.phone_number
            )
        )
    else:
        raise HTTPException(status_code=400, detail=message)


@router.get("/status", response_model=SessionStatusResponse)
async def get_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check if current user has an active Telegram session."""
    session = db.query(TelegramSession).filter(
        TelegramSession.user_id == current_user.id,
        TelegramSession.is_active == True
    ).first()
    
    if session:
        # Verify session is still valid
        is_valid = await telegram_service.load_session_from_db(db, current_user.id)
        
        return SessionStatusResponse(
            is_active=is_valid,
            phone_number=session.phone_number if is_valid else None
        )
    
    return SessionStatusResponse(is_active=False)


@router.post("/logout", response_model=AuthResponse)
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Invalidate current user's Telegram session."""
    session = db.query(TelegramSession).filter(
        TelegramSession.user_id == current_user.id,
        TelegramSession.is_active == True
    ).first()
    
    if session:
        session.is_active = False
        db.commit()
        await telegram_service.disconnect()
        
        return AuthResponse(
            success=True,
            message="Telegram session logged out successfully"
        )
    
    raise HTTPException(status_code=404, detail="No active Telegram session found")
