from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import MediaUploadResponse, MediaListResponse, MediaDeleteResponse, PaginatedMediaResponse
from backend.schemas.upload import BatchUploadResponse, MediaDuplicateResponse
from backend.models import Media
from backend.config import settings
from typing import List, Optional
import os
import uuid
import aiofiles

router = APIRouter(prefix="/media", tags=["Media"])


@router.get("/", response_model=PaginatedMediaResponse)
async def list_media(
    page: int = 1, 
    limit: int = 20, 
    db: Session = Depends(get_db)
):
    """List all uploaded media files with pagination."""
    skip = (page - 1) * limit
    
    # Get total count
    total = db.query(Media).count()
    
    # Get items
    media_files = db.query(Media).order_by(Media.uploaded_at.desc()).offset(skip).limit(limit).all()
    
    # Add URLs
    base_url = f"http://{settings.host}:{settings.port}/media"
    for media in media_files:
        # We attach the url dynamically for the response
        media.url = f"/media/{media.id}"
        
    import math
    pages = math.ceil(total / limit) if limit > 0 else 0
    
    return {
        "items": media_files,
        "total": total,
        "page": page,
        "size": limit,
        "pages": pages
    }


@router.post("/upload", response_model=BatchUploadResponse)
async def upload_media(
    files: List[UploadFile] = File(...), 
    action: str = Query("check", enum=["check", "keep", "replace"]),
    db: Session = Depends(get_db)
):
    """
    Upload multiple new media files.
    Action:
    - 'check': (Default) Upload unique, return duplicate info for collisions.
    - 'keep': Upload everything, renaming duplicates (e.g., file_duplicate.png).
    - 'replace': Overwrite existing files with same name.
    """
    
    # Validation Constants
    MAGIC_NUMBERS = {
        "image/jpeg": [b'\xff\xd8\xff'],
        "image/png": [b'\x89\x50\x4e\x47\x0d\x0a\x1a\x0a'],
        "image/gif": [b'GIF87a', b'GIF89a'],
        "image/webp": [b'RIFF']
    }
    ALLOWED_MIMES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
    
    uploaded_items = []
    duplicates_found = []
    failed_items = []

    # Create media directory if it doesn't exist
    os.makedirs(settings.media_path, exist_ok=True)

    for file in files:
        # 1. Validation
        if file.content_type not in ALLOWED_MIMES:
            failed_items.append({"filename": file.filename, "reason": "Unsupported MIME type"})
            continue
            
        # Magic number check
        await file.seek(0)
        header = await file.read(12)
        is_valid = False
        for magic in MAGIC_NUMBERS.get(file.content_type, []):
            if header.startswith(magic):
                is_valid = True
                break
        if file.content_type == "image/webp" and not is_valid:
             if header.startswith(b'RIFF') and header[8:12] == b'WEBP':
                 is_valid = True
        
        if not is_valid:
            failed_items.append({"filename": file.filename, "reason": "File content mismatch"})
            continue

        await file.seek(0)
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
             failed_items.append({"filename": file.filename, "reason": "Size exceeds 10MB"})
             continue

        # 2. Duplicate Check
        existing_media = db.query(Media).filter(Media.filename == file.filename).first()
        
        # Decide what to do based on 'action'
        final_filename = file.filename
        should_save = True
        replace_target_id = None

        if existing_media:
            if action == "check":
                duplicates_found.append({
                    "filename": file.filename,
                    "is_duplicate": True,
                    "existing_id": existing_media.id,
                    "message": "File with this name already exists."
                })
                should_save = False
            
            elif action == "replace":
                # We will overwrite the file on disk and update DB info (size, mime)
                # Reuse existing ID and file objects
                final_filename = existing_media.filename # Should be same
                # We need to remove old file from disk first to be clean, or just overwrite
                replace_target_id = existing_media.id
                # Note: We keep the same unique filepath if we can, or generate new?
                # Best to overwrite the exact file at existing_media.filepath
                
            elif action == "keep":
                # Generate new name: filename_duplicate.ext
                # Handle multiple duplicates? e.g. duplicate_duplicate? Simple logic for now.
                name, ext = os.path.splitext(file.filename)
                final_filename = f"{name}_duplicate{ext}"
                # If that exists too, we might have an issue, but requirement says just add flag.
                # To be robust we could loop, but let's stick to requirement: "_duplicate"
                
                # Retrieve checks just in case the duplicate name also exists
                if db.query(Media).filter(Media.filename == final_filename).first():
                     # Fallback to uuid for safety if even the _duplicate exists
                     final_filename = f"{name}_duplicate_{uuid.uuid4().hex[:4]}{ext}"

        if not should_save:
            continue

        # 3. Save to Disk
        if replace_target_id:
            # Overwriting
            filepath = existing_media.filepath
            # Update DB object
            existing_media.file_size = len(content)
            existing_media.mime_type = file.content_type
            # filepath remains same
            # filename remains same
            db.add(existing_media) # Mark for commit
            
            # Write file (aiofiles)
            # Remove old if we want to be safe or valid handles? Overwrite w should truncate.
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(content)
            
            # Add to response
            existing_media.url = f"/media/{existing_media.id}"
            uploaded_items.append(existing_media)
            
        else:
            # New File
            file_extension = os.path.splitext(final_filename)[1]
            unique_sys_filename = f"{uuid.uuid4()}{file_extension}"
            filepath = os.path.join(settings.media_path, unique_sys_filename)
            
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(content)
            
            new_media = Media(
                filename=final_filename, # User facing name
                filepath=filepath,       # System path
                file_size=len(content),
                mime_type=file.content_type
            )
            db.add(new_media)
            db.flush() # to get ID
            db.refresh(new_media)
            new_media.url = f"/media/{new_media.id}"
            uploaded_items.append(new_media)

    db.commit()

    return {
        "uploaded": uploaded_items,
        "duplicates": duplicates_found,
        "failed": failed_items
    }


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
