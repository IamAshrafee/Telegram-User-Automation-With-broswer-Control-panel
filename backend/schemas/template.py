from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TemplateCreate(BaseModel):
    name: str
    text: str
    link: Optional[str] = None
    media_id: Optional[int] = None
    category: Optional[str] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    text: Optional[str] = None
    link: Optional[str] = None
    media_id: Optional[int] = None
    category: Optional[str] = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    text: str
    link: Optional[str]
    media_id: Optional[int]
    category: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DraftResponse(BaseModel):
    id: int
    text: Optional[str]
    link: Optional[str]
    media_id: Optional[int]
    target_groups: Optional[list]
    bulk_send: int
    bulk_permission: Optional[str]
    auto_saved_at: datetime
    
    class Config:
        from_attributes = True
