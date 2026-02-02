"""
Database Migration Script: Add New Group Metadata Fields
Run this script to update the existing database schema with new fields.

This migration:
1. Adds new permission fields (can_send_messages, can_send_media, etc.)
2. Adds security flags (is_scam, is_fake)
3. Adds group characteristics (is_megagroup, has_photo, unread_count)
4. Removes old fields (has_media_restriction, has_link_restriction)
"""

import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from backend.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_database():
    """Apply database migrations for new group fields."""
    engine = create_engine(settings.database_url)
    
    with engine.connect() as conn:
        try:
            logger.info("Starting database migration...")
            
            # Add new permission columns
            logger.info("Adding permission columns...")
            conn.execute(text("ALTER TABLE groups ADD COLUMN can_send_messages BOOLEAN DEFAULT 1"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN can_send_media BOOLEAN DEFAULT 1"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN can_embed_links BOOLEAN DEFAULT 1"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN can_send_polls BOOLEAN DEFAULT 1"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN can_send_stickers BOOLEAN DEFAULT 1"))
            
            # Add security flags
            logger.info("Adding security flag columns...")
            conn.execute(text("ALTER TABLE groups ADD COLUMN is_scam BOOLEAN DEFAULT 0"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN is_fake BOOLEAN DEFAULT 0"))
            
            # Add group characteristics
            logger.info("Adding group characteristic columns...")
            conn.execute(text("ALTER TABLE groups ADD COLUMN is_megagroup BOOLEAN DEFAULT 0"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN has_photo BOOLEAN DEFAULT 0"))
            conn.execute(text("ALTER TABLE groups ADD COLUMN unread_count INTEGER DEFAULT 0"))
            
            # Migrate old data: Convert has_media_restriction to can_send_media (inverted)
            logger.info("Migrating old permission data...")
            conn.execute(text("""
                UPDATE groups 
                SET can_send_media = CASE WHEN has_media_restriction = 1 THEN 0 ELSE 1 END
            """))
            conn.execute(text("""
                UPDATE groups 
                SET can_embed_links = CASE WHEN has_link_restriction = 1 THEN 0 ELSE 1 END
            """))
            
            # Drop old columns (optional - uncomment if you want to remove them)
            # logger.info("Removing old columns...")
            # conn.execute(text("ALTER TABLE groups DROP COLUMN has_media_restriction"))
            # conn.execute(text("ALTER TABLE groups DROP COLUMN has_link_restriction"))
            
            conn.commit()
            logger.info("✅ Migration completed successfully!")
            
        except Exception as e:
            logger.error(f"❌ Migration failed: {e}")
            conn.rollback()
            raise


if __name__ == "__main__":
    migrate_database()
