from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from datetime import datetime
from backend.database import Base


class MessageTemplate(Base):
    """Message templates for reusable content"""
    __tablename__ = "message_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    link = Column(String, nullable=True)
    media_id = Column(Integer, ForeignKey('media.id'), nullable=True)
    category = Column(String, nullable=True)  # e.g., "Marketing", "Announcement"
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
