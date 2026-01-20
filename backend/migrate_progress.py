"""
Database migration script to add progress tracking fields to messages table.
Run this once to update your existing database.
"""
import sqlite3
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "telegram_automation.db"

def migrate():
    print("Starting progress tracking migration...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(messages)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add columns if they don't exist
        if 'group_status' not in columns:
            print("Adding group_status column...")
            cursor.execute("ALTER TABLE messages ADD COLUMN group_status JSON DEFAULT '{}'")
        
        if 'processed_count' not in columns:
            print("Adding processed_count column...")
            cursor.execute("ALTER TABLE messages ADD COLUMN processed_count INTEGER DEFAULT 0")
            
        if 'total_count' not in columns:
            print("Adding total_count column...")
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
