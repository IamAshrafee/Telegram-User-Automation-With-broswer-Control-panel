"""
Database migration script for new template and draft tables
"""
from sqlalchemy import create_engine, inspect
from backend.database import Base, engine
from backend.models import MessageTemplate, MessageDraft


def migrate_templates():
    """Create template and draft tables if they don't exist"""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    tables_to_create = []
    
    if 'message_templates' not in existing_tables:
        tables_to_create.append('message_templates')
        print("Creating message_templates table...")
    
    if 'message_drafts' not in existing_tables:
        tables_to_create.append('message_drafts')
        print("Creating message_drafts table...")
    
    if tables_to_create:
        # Create only the new tables
        MessageTemplate.__table__.create(engine, checkfirst=True)
        MessageDraft.__table__.create(engine, checkfirst=True)
        print(f"✅ Created tables: {', '.join(tables_to_create)}")
    else:
        print("✅ Template tables already exist")


if __name__ == "__main__":
    migrate_templates()
