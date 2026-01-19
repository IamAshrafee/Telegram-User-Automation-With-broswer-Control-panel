from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import MediaUploadResponse, MediaListResponse, MediaDeleteResponse
from backend.models import Media
from backend.config import settings
from typing import List
import os
import uuid
import aiofiles

router = APIRouter(prefix="/media", tags=["Media"])


@router.get("/", response_model=List[MediaListResponse])
async def list_media(db: Session = Depends(get_db)):
    """List all uploaded media files."""
    media_files = db.query(Media).order_by(Media.uploaded_at.desc()).all()
    return media_files


@router.post("/upload", response_model=List[MediaUploadResponse])
async def upload_media(files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    """Upload multiple new media files."""
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    uploaded_media = []

    for file in files:
        if file.content_type not in allowed_types:
            # Skip non-image files, or raise an exception if preferred
            # For now, we'll just skip them
            continue

        # Create media directory if it doesn't exist
        os.makedirs(settings.media_path, exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        filepath = os.path.join(settings.media_path, unique_filename)
        
        # Save file
        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        file_size = len(content)
        
        # Save to database
        media = Media(
            filename=file.filename,
            filepath=filepath,
            file_size=file_size,
            mime_type=file.content_type
        )
        db.add(media)
        db.commit()
        db.refresh(media)
        uploaded_media.append(media)
    
    if not uploaded_media:
        raise HTTPException(
            status_code=400,
            detail="No valid image files were uploaded."
        )

    return uploaded_media


@router.get("/{media_id}")
async def get_media(media_id: int, db: Session = Depends(get_db)):
    """Get a specific media file."""
    media = db.query(Media).filter(Media.id == media_id).first()
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    if not os.path.exists(media.filepath):
        raise HTTPException(status_code=404, detail="File not found on disk")
    
    return FileResponse(
        media.filepath,
        media_type=media.mime_type,
        filename=media.filename
    )


@router.delete("/{media_id}", response_model=MediaDeleteResponse)
async def delete_media(media_id: int, db: Session = Depends(get_db)):
    """Delete a media file."""
    media = db.query(Media).filter(Media.id == media_id).first()
    
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Delete file from disk
    if os.path.exists(media.filepath):
        os.remove(media.filepath)
    
    # Delete from database
    db.delete(media)
    db.commit()
    
    return MediaDeleteResponse(
        success=True,
        message="Media deleted successfully"
    )
