from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import SendCodeRequest, VerifyCodeRequest, SessionStatusResponse, AuthResponse
from backend.services import telegram_service
from backend.models import TelegramSession

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/send-code", response_model=AuthResponse)
async def send_code(request: SendCodeRequest, db: Session = Depends(get_db)):
    """Send OTP code to phone number."""
    success = await telegram_service.send_code_request(request.phone_number)
    
    if success:
        return AuthResponse(
            success=True,
            message="OTP code sent successfully. Check your Telegram app."
        )
    else:
        raise HTTPException(status_code=400, detail="Failed to send OTP code")


@router.post("/verify-code", response_model=AuthResponse)
async def verify_code(request: VerifyCodeRequest, db: Session = Depends(get_db)):
    """Verify OTP code and create session."""
    success, message = await telegram_service.sign_in(
        request.phone_number,
        request.code,
        request.password,
        db
    )
    
    if message == "2FA_REQUIRED":
        return AuthResponse(
            success=False,
            message="2FA password required. Please enter your password."
        )
    
    if success:
        session = db.query(TelegramSession).filter(
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
async def get_status(db: Session = Depends(get_db)):
    """Check if there's an active session."""
    session = db.query(TelegramSession).filter(
        TelegramSession.is_active == True
    ).first()
    
    if session:
        # Verify session is still valid
        is_valid = await telegram_service.load_session_from_db(db)
        
        return SessionStatusResponse(
            is_active=is_valid,
            phone_number=session.phone_number if is_valid else None
        )
    
    return SessionStatusResponse(is_active=False)


@router.post("/logout", response_model=AuthResponse)
async def logout(db: Session = Depends(get_db)):
    """Invalidate current session."""
    session = db.query(TelegramSession).filter(
        TelegramSession.is_active == True
    ).first()
    
    if session:
        session.is_active = False
        db.commit()
        await telegram_service.disconnect()
        
        return AuthResponse(
            success=True,
            message="Logged out successfully"
        )
    
    raise HTTPException(status_code=404, detail="No active session found")
