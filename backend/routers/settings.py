from fastapi import APIRouter, Depends
from backend.models.user import User
from backend.utils.auth import get_current_user
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas.setting import SettingUpdate, SettingResponse
from backend.services import settings_service
from typing import Dict

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("/", response_model=SettingResponse)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> SettingResponse:
    """
    Retrieve all configurable settings from the database for the current user.
    """
    return settings_service.get_settings_dict(db, current_user.id)


@router.put("/", response_model=SettingResponse)
def update_settings(
    settings_data: SettingUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> SettingResponse:
    """
    Update one or more settings
    """
    updated_settings = settings_service.update_settings(db, current_user.id, settings_data)
    return updated_settings
