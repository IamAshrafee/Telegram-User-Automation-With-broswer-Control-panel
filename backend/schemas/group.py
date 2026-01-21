from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from backend.models.group import PermissionType


class GroupBase(BaseModel):
    """Base schema for group data."""
    title: str
    permission_type: PermissionType = PermissionType.ALL
    is_active: bool = True


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
