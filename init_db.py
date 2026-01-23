"""
Database initialization script for Telegram Automation System.
Creates all tables and sets up a default admin user.

This script bypasses the normal config loading to avoid Telegram API validation issues.
"""
import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Force environment loading
from dotenv import load_dotenv
env_path = Path(__file__).parent / ".env"
load_dotenv(env_path)

# Set up database connection directly
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./telegram_automation.db")
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_database():
    """Initialize database tables and create default admin user."""
    # Import after engine is created
    import sys
    sys.path.insert(0, str(Path(__file__).parent))
    
    from backend.models.user import User
    from backend.models.group import TelegramGroup
    from backend.models.message_log import MessageLog
    from backend.models.media import Media
    from backend.models.scheduled_message import ScheduledMessage
    from backend.models.setting import Setting
    from backend.database import Base
    from passlib.context import CryptContext
    
    # Password hashing
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully")
    
    # Create session
    db = SessionLocal()
    
    try:
        # Check if admin user already exists
        existing_admin = db.query(User).filter(User.email == "admin@example.com").first()
        
        if existing_admin:
            print("✓ Admin user already exists")
            print(f"   Email: admin@example.com")
        else:
            # Create admin user
            print("\nCreating admin user...")
            admin_user = User(
                email="admin@example.com",
                name="Admin",
                password_hash=pwd_context.hash("admin123"),
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
            
            print("✓ Admin user created successfully")
            print(f"   Email: admin@example.com")
            print(f"   Password: admin123")
            print("\n⚠️  IMPORTANT: Change the admin password after first login!")
    
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()
    
    print("\n✓ Database initialization complete!")
    print("\nYou can now log in with:")
    print("  Email: admin@example.com")
    print("  Password: admin123")

if __name__ == "__main__":
    init_database()
