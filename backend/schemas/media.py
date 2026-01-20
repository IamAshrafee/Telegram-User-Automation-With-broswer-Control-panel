from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class MediaUploadResponse(BaseModel):
    """Response schema for media upload."""
    id: int
    filename: str
    filepath: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    
    class Config:
        from_attributes = True


class MediaListResponse(BaseModel):
    """Response schema for media list."""
    id: int
    filename: str
    file_size: int
    mime_type: str
    uploaded_at: datetime
    url: Optional[str] = None
    
    class Config:
        from_attributes = True


class PaginatedMediaResponse(BaseModel):
    """Response schema for paginated media list."""
    items: list[MediaListResponse]
    total: int
    page: int
    size: int
    pages: int


class MediaDeleteResponse(BaseModel):
    """Response schema for media deletion."""
    success: bool
    message: str
