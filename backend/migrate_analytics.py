"""
Database migration script to add analytics fields to groups table.
Run this once to update your existing database.
"""
import sqlite3
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "telegram_automation.db"

def migrate():
    print("Starting database migration...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(groups)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add analytics columns if they don't exist
        if 'messages_sent' not in columns:
            print("Adding messages_sent column...")
            cursor.execute("ALTER TABLE groups ADD COLUMN messages_sent INTEGER DEFAULT 0")
        
        if 'messages_failed' not in columns:
            print("Adding messages_failed column...")
            cursor.execute("ALTER TABLE groups ADD COLUMN messages_failed INTEGER DEFAULT 0")
        
        if 'last_message_at' not in columns:
            print("Adding last_message_at column...")
            cursor.execute("ALTER TABLE groups ADD COLUMN last_message_at TIMESTAMP")
            
        # --- Messages Table Migration ---
        cursor.execute("PRAGMA table_info(messages)")
        msg_columns = [col[1] for col in cursor.fetchall()]
        
        if 'group_status' not in msg_columns:
            print("Adding group_status column to messages...")
            cursor.execute("ALTER TABLE messages ADD COLUMN group_status JSON DEFAULT '{}'")
            
        if 'processed_count' not in msg_columns:
            print("Adding processed_count column to messages...")
            cursor.execute("ALTER TABLE messages ADD COLUMN processed_count INTEGER DEFAULT 0")
            
        if 'total_count' not in msg_columns:
            print("Adding total_count column to messages...")
            cursor.execute("ALTER TABLE messages ADD COLUMN total_count INTEGER DEFAULT 0")
        
        conn.commit()
        print("✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
