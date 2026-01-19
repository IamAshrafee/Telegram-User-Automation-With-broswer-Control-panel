from sqlalchemy.orm import Session
from backend.models.setting import Setting
from backend.schemas.setting import SettingUpdate
from typing import Dict, Any

# In-memory cache for settings
_settings_cache: Dict[str, Any] = {}


def get_all_settings(db: Session) -> Dict[str, str]:
    """
    Retrieves all settings from the database and returns them as a dictionary.
    """
    return Setting.get_all(db)


def update_settings(db: Session, settings_data: SettingUpdate) -> Dict[str, str]:
    """
    Updates multiple settings in the database from a Pydantic schema
    and refreshes the cache.
    """
    # Use model_dump to get a dict, excluding unset values
    updated_values = settings_data.model_dump(exclude_unset=True)
    
    for key, value in updated_values.items():
        Setting.set(db, key, str(value))
        
    db.commit()
    
    # Refresh the cache with the new settings
    refresh_settings_cache(db)
    
    return _settings_cache


def refresh_settings_cache(db: Session):
    """
    Loads all settings from the database into the in-memory cache.
    """
    global _settings_cache
    settings_from_db = get_all_settings(db)
    
    # Convert values to their correct types (int, etc.)
    _settings_cache = {
        "min_delay_seconds": int(settings_from_db.get("min_delay_seconds", 10)),
        "max_delay_seconds": int(settings_from_db.get("max_delay_seconds", 30)),
        "daily_message_limit": int(settings_from_db.get("daily_message_limit", 100)),
    }
    print("Settings cache refreshed.")


def get_setting(key: str, default: Any = None) -> Any:
    """
    Retrieves a setting's value from the cache.
    """
    return _settings_cache.get(key, default)

