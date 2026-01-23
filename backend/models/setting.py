from sqlalchemy import Column, String, Integer, ForeignKey
from sqlalchemy.orm import Session
from backend.database import Base


class Setting(Base):
    """
    A model to store application settings as key-value pairs in the database.
    This allows for dynamic configuration from the UI without needing to restart
    the server. Settings are now user-specific.
    """
    __tablename__ = "settings"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, index=True)
    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

    @staticmethod
    def get(db: Session, user_id: int, key: str, default: str = None) -> str:
        """Retrieve a setting's value by its key for a specific user."""
        setting = db.query(Setting).filter(
            Setting.user_id == user_id,
            Setting.key == key
        ).first()
        return setting.value if setting else default

    @staticmethod
    def get_all(db: Session, user_id: int) -> dict:
        """Retrieve all settings as a dictionary for a specific user."""
        settings = db.query(Setting).filter(Setting.user_id == user_id).all()
        return {s.key: s.value for s in settings}

    @staticmethod
    def set(db: Session, user_id: int, key: str, value: str):
        """Create or update a setting for a specific user."""
        setting = db.query(Setting).filter(
            Setting.user_id == user_id,
            Setting.key == key
        ).first()
        if setting:
            setting.value = value
        else:
            setting = Setting(user_id=user_id, key=key, value=value)
            db.add(setting)
        # The session is committed by the service layer after the operation
        return setting
