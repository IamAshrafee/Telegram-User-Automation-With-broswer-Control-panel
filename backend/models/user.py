from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base


class User(Base):
    """Model for user accounts."""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships (will be defined after updating other models)
    # telegram_sessions = relationship("TelegramSession", back_populates="user")
    # groups = relationship("Group", back_populates="user")
    # messages = relationship("Message", back_populates="user")
    # media = relationship("Media", back_populates="user")
    # templates = relationship("Template", back_populates="user")
    
    def __repr__(self):
        return f"<User(email={self.email}, name={self.name})>"
