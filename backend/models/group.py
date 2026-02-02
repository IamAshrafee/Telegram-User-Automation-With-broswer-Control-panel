from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum, ForeignKey
from sqlalchemy.sql import func
from backend.database import Base
import enum


class PermissionType(str, enum.Enum):
    """Enum for group content permission types."""
    ALL = "all"  # Text, link, image, file allowed
    TEXT_ONLY = "text_only"  # Only text
    TEXT_LINK = "text_link"  # Text and links
    TEXT_IMAGE = "text_image"  # Text and images
    TEXT_LINK_IMAGE = "text_link_image"  # Text, links, and images


class Group(Base):
    """Model for storing Telegram groups with their permissions."""
    
    __tablename__ = "groups"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    telegram_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    permission_type = Column(SQLEnum(PermissionType), default=PermissionType.ALL)
    is_active = Column(Boolean, default=True)
    
    # Advanced Stats & Metadata
    member_count = Column(Integer, default=0)
    username = Column(String, nullable=True)
    is_admin = Column(Boolean, default=False)
    slow_mode_delay = Column(Integer, default=0)
    has_media_restriction = Column(Boolean, default=False)
    has_link_restriction = Column(Boolean, default=False)
    
    # Analytics fields
    messages_sent = Column(Integer, default=0)
    messages_failed = Column(Integer, default=0)
    last_message_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    @property
    def success_rate(self):
        """Calculate success rate percentage."""
        total = self.messages_sent + self.messages_failed
        if total == 0:
            return 100.0
        return round((self.messages_sent / total) * 100, 1)
    
    def __repr__(self):
        return f"<Group(title={self.title}, permission={self.permission_type.value})>"
