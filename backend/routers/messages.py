from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import MessageCreate, BulkMessageCreate, MessageResponse, MessageSendResponse, MessageUpdate, MessagePaginatedResponse
from backend.models import Message, MessageStatus, Group
from backend.models.user import User
from backend.utils.auth import get_current_user
from backend.services import message_service, telegram_service, settings_service
from backend.utils.logger import setup_logger
from typing import List
from datetime import datetime, timezone
import math
import random

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo # Fallback for older python

logger = setup_logger(__name__)

router = APIRouter(prefix="/api/messages", tags=["Messages"])



@router.post("/send", response_model=MessageSendResponse)
async def send_message(
    message_data: MessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send message immediately to selected groups."""
    # Ensure Telegram client is connected
    is_loaded = await telegram_service.load_session_from_db(db, current_user.id)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    # Create message record
    message = Message(
        user_id=current_user.id,
        text=message_data.text,
        link=message_data.link,
        media_id=message_data.media_id,
        target_groups=message_data.target_groups,
        status=MessageStatus.DRAFT
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send message in background (Async mode for progress tracking)
    background_tasks.add_task(message_service.send_message_bg, message.id)
    
    # Return immediate response with ID for tracking
    return MessageSendResponse(
        success=True,
        message="Message sending started",
        message_id=message.id,
        sent_count=0,
        failed_count=0,
        skipped_count=0
    )


@router.post("/send/bulk", response_model=MessageSendResponse)
async def send_message_bulk(
    message_data: BulkMessageCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send message to all active groups with matching permission type."""
    # Ensure Telegram client is connected
    is_loaded = await telegram_service.load_session_from_db(db, current_user.id)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    # Resolve target groups
    query = db.query(Group.id).filter(
        Group.user_id == current_user.id,
        Group.is_active == True
    )
    if message_data.permission_type != "all":
        query = query.filter(Group.permission_type == message_data.permission_type)
    
    target_groups = [g[0] for g in query.all()]
    
    if not target_groups:
        raise HTTPException(status_code=400, detail=f"No active groups found for permission type: {message_data.permission_type}")
    
    # Create message record
    message = Message(
        user_id=current_user.id,
        text=message_data.text,
        link=message_data.link,
        media_id=message_data.media_id,
        target_groups=target_groups,
        status=MessageStatus.DRAFT
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send message in background
    background_tasks.add_task(message_service.send_message_bg, message.id)
    
    return MessageSendResponse(
        success=True,
        message=f"Bulk send started to {len(target_groups)} groups",
        message_id=message.id,
        sent_count=0,
        failed_count=0,
        skipped_count=0
    )


@router.post("/schedule/bulk", response_model=MessageResponse)
async def schedule_message_bulk(
    message_data: BulkMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a bulk message for future delivery."""
    # Ensure Telegram client is connected
    is_loaded = await telegram_service.load_session_from_db(db, current_user.id)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    if not message_data.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at is required")
    
    # Resolve target groups
    query = db.query(Group.id).filter(Group.is_active == True)
    if message_data.permission_type != "all":
        query = query.filter(Group.permission_type == message_data.permission_type)
    
    target_groups = [g[0] for g in query.all()]
    
    if not target_groups:
        raise HTTPException(status_code=400, detail=f"No active groups found for permission type: {message_data.permission_type}")

    # Handle Timezone (similar to selective schedule)
    user_timezone = settings_service.get_setting(db, current_user.id, "timezone", "UTC")
    try:
        tz = ZoneInfo(user_timezone)
    except Exception:
        tz = timezone.utc

    scheduled_at = message_data.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=tz)
    else:
        scheduled_at = scheduled_at.astimezone(tz)

    scheduled_at_utc = scheduled_at.astimezone(timezone.utc)
    
    if scheduled_at_utc <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    
    # Create message record
    message = Message(
        user_id=current_user.id,
        text=message_data.text,
        link=message_data.link,
        media_id=message_data.media_id,
        target_groups=target_groups,
        status=MessageStatus.SCHEDULED,
        scheduled_at=scheduled_at_utc,
        recurrence_type=message_data.recurrence_type,
        recurrence_interval=message_data.recurrence_interval,
        recurrence_end_date=message_data.recurrence_end_date,
        text_variations=message_data.text_variations,
        jitter_seconds=message_data.jitter_seconds
    )
    
    # Content Rotation for initial message
    if message_data.text_variations and len(message_data.text_variations) > 0:
        message.text = random.choice(message_data.text_variations)

    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Schedule the message
    message_service.schedule_message(message.id, scheduled_at_utc)
    
    if message.scheduled_at and message.scheduled_at.tzinfo is None:
        message.scheduled_at = message.scheduled_at.replace(tzinfo=timezone.utc)
        
    return message


@router.get("/active", response_model=List[MessageResponse])
async def get_active_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get currently running message jobs."""
    active_jobs = db.query(Message).filter(
        Message.user_id == current_user.id,
        Message.status == MessageStatus.SENDING
    ).all()
    return active_jobs


@router.get("/{message_id}/status", response_model=MessageResponse)
async def get_message_status(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed status for a specific message."""
    message = db.query(Message).filter(
        Message.user_id == current_user.id,
        Message.id == message_id
    ).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    return message


@router.get("/history", response_model=MessagePaginatedResponse)
async def get_message_history(
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """Get sent message history with pagination."""
    query = db.query(Message).filter(
        Message.user_id == current_user.id,
        Message.status.in_([MessageStatus.SENT, MessageStatus.FAILED])
    ).order_by(Message.created_at.desc())
    
    total = query.count()
    pages = math.ceil(total / limit)
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "pages": pages,
        "has_next": page < pages,
        "has_prev": page > 1
    }


@router.post("/preview")
async def preview_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Preview message with actual group data (first 3 groups)"""
    try:
        from backend.utils.message_validators import estimate_send_time, format_time_estimate
        from backend.utils.text_processor import process_content
        
        previews = []
        target_groups = message_data.target_groups[:3]  # Preview first 3 groups
        
        for group_id in target_groups:
            group = db.query(Group).filter(
                Group.user_id == current_user.id,
                Group.id == group_id
            ).first()
            if not group:
                continue
            
            # Process content with actual group data
            context = {
                "{group_name}": group.title,
                "{group_id}": str(group.id),
                "{date}": datetime.now().strftime("%Y-%m-%d"),
                "{time}": datetime.now().strftime("%H:%M"),
            }
            
            processed_text = process_content(message_data.text, context)
            
            previews.append({
                "group_id": group.id,
                "group_name": group.title,
                "processed_text": processed_text
            })
        
        # Estimate send time
        total_groups = len(message_data.target_groups)
        estimated_seconds = estimate_send_time(total_groups)
        time_estimate = format_time_estimate(estimated_seconds)
        
        return {
            "previews": previews,
            "total_groups": total_groups,
            "estimated_time": time_estimate
        }
    except Exception as e:
        logger.error(f"Preview error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


# Scheduler Endpoints

@router.post("/schedule", response_model=MessageResponse)
async def schedule_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Schedule a message for future delivery."""
    # Ensure Telegram client is connected
    is_loaded = await telegram_service.load_session_from_db(db, current_user.id)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    # Validate scheduled time
    if not message_data.scheduled_at:
        raise HTTPException(status_code=400, detail="scheduled_at is required")
    
    # Handle Timezone
    user_timezone = settings_service.get_setting(db, current_user.id, "timezone", "UTC")
    try:
        tz = ZoneInfo(user_timezone)
    except Exception:
        tz = timezone.utc # fallback
    
    # If the incoming time is naive (which it usually is from datetime-local),
    # assume it is in the user's selected timezone
    scheduled_at = message_data.scheduled_at
    if scheduled_at.tzinfo is None:
        scheduled_at = scheduled_at.replace(tzinfo=tz)
    else:
        # If it already has tzinfo, convert to intended timezone first
        scheduled_at = scheduled_at.astimezone(tz)

    # Convert to UTC for storage/server time
    scheduled_at_utc = scheduled_at.astimezone(timezone.utc)
    
    if scheduled_at_utc <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
    
    # Create message record
    message = Message(
        user_id=current_user.id,
        text=message_data.text,
        link=message_data.link,
        media_id=message_data.media_id,
        target_groups=message_data.target_groups,
        status=MessageStatus.SCHEDULED,
        scheduled_at=scheduled_at_utc,
        recurrence_type=message_data.recurrence_type,
        recurrence_interval=message_data.recurrence_interval,
        recurrence_end_date=message_data.recurrence_end_date,
        text_variations=message_data.text_variations,
        jitter_seconds=message_data.jitter_seconds
    )
    
    # Content Rotation for initial message
    if message_data.text_variations and len(message_data.text_variations) > 0:
        message.text = random.choice(message_data.text_variations)

    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Schedule the message
    message_service.schedule_message(message.id, scheduled_at_utc)
    
    # Ensure TZ info is present for response
    if message.scheduled_at and message.scheduled_at.tzinfo is None:
        message.scheduled_at = message.scheduled_at.replace(tzinfo=timezone.utc)
        
    return message


@router.get("/scheduled", response_model=List[MessageResponse])
async def list_scheduled_jobs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all scheduled messages."""
    scheduled_messages = db.query(Message).filter(
        Message.user_id == current_user.id,
        Message.status == MessageStatus.SCHEDULED,
        Message.scheduled_at.isnot(None)
    ).order_by(Message.scheduled_at).all()
    
    # Ensure TZ info is present for response (SQLite strips it)
    for msg in scheduled_messages:
        if msg.scheduled_at and msg.scheduled_at.tzinfo is None:
            msg.scheduled_at = msg.scheduled_at.replace(tzinfo=timezone.utc)
    
    return scheduled_messages


@router.patch("/scheduled/{message_id}", response_model=MessageResponse)
async def update_scheduled_job(
    message_id: int,
    update_data: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a scheduled message."""
    message = db.query(Message).filter(
        Message.user_id == current_user.id,
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
        # Handle Timezone for update
        user_timezone = settings_service.get_setting(db, current_user.id, "timezone", "UTC")
        try:
            tz = ZoneInfo(user_timezone)
        except Exception:
            tz = timezone.utc
            
        scheduled_at = update_data.scheduled_at
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=tz)
        else:
            scheduled_at = scheduled_at.astimezone(tz)
            
        scheduled_at_utc = scheduled_at.astimezone(timezone.utc)
        
        if scheduled_at_utc <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="scheduled_at must be in the future")
        message.scheduled_at = scheduled_at_utc
        
        # Reschedule the job
        message_service.schedule_message(message.id, scheduled_at_utc)

    if update_data.recurrence_type is not None:
        message.recurrence_type = update_data.recurrence_type
    if update_data.recurrence_interval is not None:
        message.recurrence_interval = update_data.recurrence_interval
    if update_data.recurrence_end_date is not None:
        message.recurrence_end_date = update_data.recurrence_end_date
    
    if update_data.text_variations is not None:
        message.text_variations = update_data.text_variations
    if update_data.jitter_seconds is not None:
        message.jitter_seconds = update_data.jitter_seconds
    
    db.commit()
    db.refresh(message)
    
    # Ensure TZ info is present for response
    if message.scheduled_at and message.scheduled_at.tzinfo is None:
        message.scheduled_at = message.scheduled_at.replace(tzinfo=timezone.utc)
    
    return message


@router.delete("/scheduled/{message_id}")
async def cancel_scheduled_job(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a scheduled message."""
    message = db.query(Message).filter(
        Message.user_id == current_user.id,
        Message.id == message_id,
        Message.status == MessageStatus.SCHEDULED
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Scheduled message not found")
    
    # Cancel the scheduled job
    message_service.cancel_scheduled_message(message_id)
    
    # Delete the message record
    db.delete(message)
    db.commit()
    
    return {"success": True, "message": "Scheduled message cancelled"}


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific message details."""
    message = db.query(Message).filter(
        Message.user_id == current_user.id,
        Message.id == message_id
    ).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message
