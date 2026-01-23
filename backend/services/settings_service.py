from sqlalchemy.orm import Session
from backend.models.setting import Setting
from backend.schemas.setting import SettingUpdate
from typing import Dict, Any


def get_all_settings(db: Session, user_id: int) -> Dict[str, str]:
    """
    Retrieves all settings from the database for a specific user.
    """
    return Setting.get_all(db, user_id)


def update_settings(db: Session, user_id: int, settings_data: SettingUpdate) -> Dict[str, Any]:
    """
    Updates multiple settings in the database for a specific user.
    """
    # Use model_dump to get a dict, excluding unset values
    updated_values = settings_data.model_dump(exclude_unset=True)
    
    for key, value in updated_values.items():
        Setting.set(db, user_id, key, str(value))
        
    db.commit()
    
    # Return updated settings
    return get_settings_dict(db, user_id)


def get_setting(db: Session, user_id: int, key: str, default: Any = None) -> Any:
    """
    Retrieves a setting's value from the database for a specific user.
    """
    val = Setting.get(db, user_id, key)
    if val is None:
        return default
    return val


def get_settings_dict(db: Session, user_id: int) -> Dict[str, Any]:
    """
    Helper to get typed settings dict for response
    """
    settings_from_db = get_all_settings(db, user_id)
    
    return {
        "min_delay_seconds": int(settings_from_db.get("min_delay_seconds", 10)),
        "max_delay_seconds": int(settings_from_db.get("max_delay_seconds", 30)),
        "daily_message_limit": int(settings_from_db.get("daily_message_limit", 100)),
        "timezone": settings_from_db.get("timezone", "UTC"),
    }


