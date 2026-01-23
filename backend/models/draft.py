from sqlalchemy import Column, Integer, Text, String, DateTime, JSON, ForeignKey
from datetime import datetime
from backend.database import Base


class MessageDraft(Base):
    """Auto-saved message drafts"""
    __tablename__ = "message_drafts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    text = Column(Text, nullable=True)
    link = Column(String, nullable=True)
    media_id = Column(Integer, nullable=True)
    target_groups = Column(JSON, nullable=True)
    bulk_send = Column(Integer, default=0)  # 0 = individual, 1 = bulk
    bulk_permission = Column(String, nullable=True)
    auto_saved_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
