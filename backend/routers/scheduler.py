from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import MessageCreate, MessageUpdate, MessageResponse
from backend.models import Message, MessageStatus
from backend.services import scheduler_service, telegram_service
from typing import List
from datetime import datetime, timezone

router = APIRouter(prefix="/scheduler", tags=["Scheduler"])


@router.post("/schedule", response_model=MessageResponse)
async def schedule_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db)
):
    """Schedule a message for future delivery."""
    # Ensure Telegram client is connected
    is_loaded = await telegram_service.load_session_from_db(db)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    # Validate scheduled time
    if not message_data.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at is required")
    
    if message_data.scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    
    # Create message record
    message = Message(
        text=message_data.text,
        link=message_data.link,
        media_id=message_data.media_id,
        target_groups=message_data.target_groups,
        status=MessageStatus.SCHEDULED,
        scheduled_at=message_data.scheduled_at
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Schedule the message
    scheduler_service.schedule_message(message.id, message_data.scheduled_at)
    
    return message


@router.get("/jobs", response_model=List[MessageResponse])
async def list_scheduled_jobs(db: Session = Depends(get_db)):
    """List all scheduled messages."""
    scheduled_messages = db.query(Message).filter(
        Message.status == MessageStatus.SCHEDULED,
        Message.scheduled_at.isnot(None)
    ).order_by(Message.scheduled_at).all()
    
    return scheduled_messages


@router.patch("/jobs/{message_id}", response_model=MessageResponse)
async def update_scheduled_job(
    message_id: int,
    update_data: MessageUpdate,
    db: Session = Depends(get_db)
):
    """Update a scheduled message."""
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.status == MessageStatus.SCHEDULED
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Scheduled message not found")
    
    # Update fields
    if update_data.text is not None:
        message.text = update_data.text
    if update_data.link is not None:
        message.link = update_data.link
    if update_data.media_id is not None:
        message.media_id = update_data.media_id
    if update_data.target_groups is not None:
        message.target_groups = update_data.target_groups
    if update_data.scheduled_at is not None:
        if update_data.scheduled_at <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
        message.scheduled_at = update_data.scheduled_at
        
        # Reschedule the job
        scheduler_service.schedule_message(message.id, update_data.scheduled_at)
    
    db.commit()
    db.refresh(message)
    
    return message


@router.delete("/jobs/{message_id}")
async def cancel_scheduled_job(message_id: int, db: Session = Depends(get_db)):
    """Cancel a scheduled message."""
    message = db.query(Message).filter(
        Message.id == message_id,
        Message.status == MessageStatus.SCHEDULED
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Scheduled message not found")
    
    # Cancel the scheduled job
    scheduler_service.cancel_scheduled_message(message_id)
    
    # Delete the message record
    db.delete(message)
    db.commit()
    
    return {"success": True, "message": "Scheduled message cancelled"}
