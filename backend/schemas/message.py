from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from backend.models.message import MessageStatus


class MessageCreate(BaseModel):
    """Schema for creating a new message."""
    text: str = Field(..., min_length=1, description="Message text content")
    link: Optional[str] = None
    media_id: Optional[int] = None
    target_groups: List[int] = Field(..., min_items=1, description="List of group IDs to send to")
    scheduled_at: Optional[datetime] = None


class BulkMessageCreate(BaseModel):
    """Schema for bulk sending to groups by permission."""
    text: str = Field(..., min_length=1, description="Message text content")
    link: Optional[str] = None
    media_id: Optional[int] = None
    permission_type: str = Field(..., description="Target permission type (all, text_only, etc)")
    scheduled_at: Optional[datetime] = None


class MessageUpdate(BaseModel):
    """Schema for updating a scheduled message."""
    text: Optional[str] = None
    link: Optional[str] = None
    media_id: Optional[int] = None
    target_groups: Optional[List[int]] = None
    scheduled_at: Optional[datetime] = None


class MessageResponse(BaseModel):
    """Response schema for message data."""
    id: int
    text: str
    link: Optional[str] = None
    media_id: Optional[int] = None
    target_groups: List[int]
    status: MessageStatus
    
    # Progress info
    processed_count: int = 0
    total_count: int = 0
    group_status: dict = {}
    
    scheduled_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class MessageSendResponse(BaseModel):
    """Response schema for message send operation."""
    success: bool
    message: str
    message_id: int
    sent_count: int
    failed_count: int
    skipped_count: int
