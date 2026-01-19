from sqlalchemy import Column, String, Integer, or_
from sqlalchemy.orm import Session
from backend.database import Base


class Setting(Base):
    """
    A model to store application settings as key-value pairs in the database.
    This allows for dynamic configuration from the UI without needing to restart
    the server.
    """
    __tablename__ = "settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=False)

    @staticmethod
    def get(db: Session, key: str, default: str = None) -> str:
        """Retrieve a setting's value by its key."""
        setting = db.query(Setting).filter(Setting.key == key).first()
        return setting.value if setting else default

    @staticmethod
    def get_all(db: Session) -> dict:
        """Retrieve all settings as a dictionary."""
        settings = db.query(Setting).all()
        return {s.key: s.value for s in settings}

    @staticmethod
    def set(db: Session, key: str, value: str):
        """Create or update a setting."""
        setting = db.query(Setting).filter(Setting.key == key).first()
        if setting:
            setting.value = value
        else:
            setting = Setting(key=key, value=value)
            db.add(setting)
        # The session is committed by the service layer after the operation
        return setting
