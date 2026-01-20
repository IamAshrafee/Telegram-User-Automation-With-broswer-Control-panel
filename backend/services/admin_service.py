from sqlalchemy.orm import Session
from backend.models.media import Media
from backend.models.group import Group
from backend.models.message import Message
from backend.models.session import TelegramSession
from backend.services import message_service
from backend.config import settings
from pathlib import Path
import shutil


def clear_media_data(db: Session) -> tuple[int, int]:
    """
    Delete all media records from database and files from storage.
    Returns: (records_deleted, files_deleted)
    """
    # ... (existing code)

# ... (existing code)

def clear_scheduled_data(db: Session) -> int:
    """
    Delete all scheduled jobs and cancel pending tasks.
    Returns: number of records deleted
    """
    # Cancel all scheduled jobs in the scheduler
    message_service.cancel_all_jobs()
    
    # Delete scheduled messages from database
    scheduled_count = db.query(Message).filter(
        Message.status == 'scheduled'
    ).count()
    
    db.query(Message).filter(Message.status == 'scheduled').delete()
    db.commit()
    
    return scheduled_count


def clear_all_except_auth(db: Session) -> dict:
    """
    Clear all data but keep authentication session.
    Returns: statistics of deleted records
    """
    stats = {}
    
    # Clear media
    media_records, media_files = clear_media_data(db)
    stats['media_records'] = media_records
    stats['media_files'] = media_files
    
    # Clear groups
    stats['groups'] = clear_groups_data(db)
    
    # Clear all messages (sent and scheduled)
    message_service.cancel_all_jobs()
    message_count = db.query(Message).count()
    db.query(Message).delete()
    db.commit()
    stats['messages'] = message_count
    
    return stats


def clear_everything(db: Session) -> dict:
    """
    Clear ALL data including authentication session.
    Returns: statistics of deleted records
    """
    # First clear all data except auth
    stats = clear_all_except_auth(db)
    
    # Delete session records
    session_count = db.query(TelegramSession).count()
    db.query(TelegramSession).delete()
    db.commit()
    stats['sessions'] = session_count
    
    # Delete session files
    session_path = Path(settings.session_path)
    session_files_deleted = 0
    
    if session_path.exists():
        for file in session_path.glob('*.session*'):
            try:
                file.unlink()
                session_files_deleted += 1
            except Exception as e:
                print(f"Error deleting session file {file}: {e}")
    
    stats['session_files'] = session_files_deleted
    
    return stats
