from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from backend.schemas.media import MediaListResponse

class MediaDuplicateResponse(BaseModel):
    filename: str
    is_duplicate: bool
    existing_id: Optional[int] = None
    message: Optional[str] = None

class BatchUploadResponse(BaseModel):
    uploaded: List[MediaListResponse]
    duplicates: List[MediaDuplicateResponse]
    failed: List[dict]
