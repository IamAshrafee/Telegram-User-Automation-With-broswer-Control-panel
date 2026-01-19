from pydantic import BaseModel
from typing import Optional


class SettingUpdate(BaseModel):
    """
    Schema for updating application settings from the API.
    All fields are optional to allow for partial updates.
    """
    min_delay_seconds: Optional[int] = None
    max_delay_seconds: Optional[int] = None
    daily_message_limit: Optional[int] = None

    class Config:
        from_attributes = True


class SettingResponse(BaseModel):
    """
    Schema for returning all settings.
    """
    min_delay_seconds: int
    max_delay_seconds: int
    daily_message_limit: int
