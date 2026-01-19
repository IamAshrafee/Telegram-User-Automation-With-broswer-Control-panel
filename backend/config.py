from pydantic_settings import BaseSettings
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application configuration settings loaded from environment variables."""
    
    # Telegram API Credentials
    telegram_api_id: int
    telegram_api_hash: str
    
    # Database
    database_url: str = "sqlite:///./telegram_automation.db"
    
    # Storage Paths
    session_path: str = "./telegram_sessions"
    media_path: str = "./storage/media"
    
    # Safety Settings
    min_delay_seconds: int = 10
    max_delay_seconds: int = 30
    daily_message_limit: int = 100
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    
    class Config:
        # Look for .env file in parent directory (project root)
        env_file = str(Path(__file__).parent.parent / ".env")
        case_sensitive = False


# Global settings instance
settings = Settings()
