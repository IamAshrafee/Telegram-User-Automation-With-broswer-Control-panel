from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas.setting import SettingUpdate, SettingResponse
from backend.services import settings_service
from typing import Dict

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("/", response_model=SettingResponse)
def get_settings() -> SettingResponse:
    """
    Retrieve all configurable settings from the cache.
    """
    return {
        "min_delay_seconds": settings_service.get_setting("min_delay_seconds"),
        "max_delay_seconds": settings_service.get_setting("max_delay_seconds"),
        "daily_message_limit": settings_service.get_setting("daily_message_limit"),
    }


@router.put("/", response_model=SettingResponse)
def update_settings(
    settings_data: SettingUpdate,
    db: Session = Depends(get_db)
) -> SettingResponse:
    """
    Update one or more settings and refresh the cache.
    """
    updated_settings = settings_service.update_settings(db, settings_data)
    return updated_settings
