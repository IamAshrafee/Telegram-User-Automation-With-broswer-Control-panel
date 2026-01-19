from pydantic import BaseModel, Field
from typing import Optional


class SendCodeRequest(BaseModel):
    """Request schema for sending OTP code."""
    phone_number: str = Field(..., description="Phone number with country code (e.g., +1234567890)")


class VerifyCodeRequest(BaseModel):
    """Request schema for verifying OTP code."""
    phone_number: str = Field(..., description="Phone number with country code")
    code: str = Field(..., description="OTP code received via Telegram")
    password: Optional[str] = Field(None, description="2FA password if enabled")


class SessionStatusResponse(BaseModel):
    """Response schema for session status."""
    is_active: bool
    phone_number: Optional[str] = None
    
    class Config:
        from_attributes = True


class AuthResponse(BaseModel):
    """Response schema for authentication operations."""
    success: bool
    message: str
    session_status: Optional[SessionStatusResponse] = None
