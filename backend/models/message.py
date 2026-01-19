from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from backend.database import Base
import enum


class MessageStatus(str, enum.Enum):
    """Enum for message status."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"


class Message(Base):
    """Model for storing messages and their schedules."""
    
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    link = Column(String, nullable=True)
    media_id = Column(Integer, ForeignKey("media.id"), nullable=True)
    target_groups = Column(JSON, nullable=False)  # Array of group IDs
    status = Column(SQLEnum(MessageStatus), default=MessageStatus.DRAFT)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)  # Null for immediate send
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Message(id={self.id}, status={self.status.value}, groups={len(self.target_groups)})>"
