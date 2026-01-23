from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from backend.config import settings

# Create database engine
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency for getting database session in FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and default settings."""
    # Import models here to avoid circular dependencies
    from backend.models.setting import Setting
    
    Base.metadata.create_all(bind=engine)
    
    # Initialize default settings
    db = SessionLocal()
    try:
        _initialize_default_settings(db)
    finally:
        db.close()

def _initialize_default_settings(db):
    """
    Create default safety settings in the database for the admin user if they don't exist.
    """
    from backend.models.setting import Setting
    from backend.models.user import User

    # Default values from the original config
    defaults = {
        "min_delay_seconds": str(settings.min_delay_seconds),
        "max_delay_seconds": str(settings.max_delay_seconds),
        "daily_message_limit": str(settings.daily_message_limit),
    }

    # Find admin user (usually id 1)
    admin_user = db.query(User).filter(User.id == 1).first()
    
    if admin_user:
        for key, value in defaults.items():
            if not Setting.get(db, admin_user.id, key):
                Setting.set(db, admin_user.id, key, value)
        
        db.commit()

