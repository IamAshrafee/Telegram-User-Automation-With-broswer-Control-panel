from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from backend.models.group import PermissionType


class GroupBase(BaseModel):
    """Base schema for group data."""
    title: str
    permission_type: PermissionType = PermissionType.ALL
    is_active: bool = True
    
    # Advanced Stats
    member_count: int = 0
    username: Optional[str] = None
    is_admin: bool = False
    slow_mode_delay: int = 0
    
    # Permission flags (inverted naming for clarity)
    can_send_messages: bool = True
    can_send_media: bool = True
    can_embed_links: bool = True
    can_send_polls: bool = True
    can_send_stickers: bool = True
    
    # Security flags
    is_scam: bool = False
    is_fake: bool = False
    
    # Group characteristics
    is_megagroup: bool = False
    has_photo: bool = False
    unread_count: int = 0



class GroupCreate(GroupBase):
    """Schema for creating a new group."""
    telegram_id: str


class GroupUpdate(BaseModel):
    """Schema for updating group data."""
    permission_type: Optional[PermissionType] = None
    is_active: Optional[bool] = None


class GroupResponse(GroupBase):
    """Response schema for group data."""
    id: int
    telegram_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class GroupSyncResponse(BaseModel):
    """Response schema for group sync operation."""
    success: bool
    message: str
    synced_count: int
    new_count: int


class GroupPaginatedResponse(BaseModel):
    """Response schema for paginated group list."""
    items: list[GroupResponse]
    total: int
    page: int
    pages: int
    has_next: bool
    has_prev: bool
