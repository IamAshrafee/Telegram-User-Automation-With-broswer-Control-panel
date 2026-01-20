from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.services import admin_service, settings_service

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/rate-limit-status")
async def get_rate_limit_status(db: Session = Depends(get_db)):
    """Get current rate limiting status"""
    from backend.models import Message, MessageStatus
    from datetime import datetime, timedelta
    
    # Get settings from service (cached)
    daily_limit = settings_service.get_setting("daily_message_limit", 100)
    
    today = datetime.now().date()
    
    # Count messages sent today
    start_of_day = datetime.combine(today, datetime.min.time())
    
    sent_today = 0
    
    # Get all messages associated with today
    # Note: Using 'sent_at' corresponds to when the batch started. 
    # This might edge-case cross-day batches, but consistent with safety limit.
    today_messages = db.query(Message).filter(
        Message.status == MessageStatus.SENT,
        Message.sent_at >= start_of_day
    ).all()
    
    for msg in today_messages:
        if msg.group_status:
            for info in msg.group_status.values():
                if info.get("status") == "sent":
                    sent_today += 1
    
    remaining = max(0, daily_limit - sent_today)
    percentage_used = (sent_today / daily_limit * 100) if daily_limit > 0 else 0
    
    # Calculate reset time (midnight tonight)
    reset_at = datetime.combine(today + timedelta(days=1), datetime.min.time())
    
    return {
        "sent_today": sent_today,
        "daily_limit": daily_limit,
        "remaining": remaining,
        "percentage_used": round(percentage_used, 1),
        "reset_at": reset_at.isoformat()
    }


@router.delete("/clear/media")
async def clear_media(db: Session = Depends(get_db)):
    """
    Delete all media records from database and files from storage.
    """
    try:
        deleted_count, files_deleted = admin_service.clear_media_data(db)
        return {
            "success": True,
            "message": f"Cleared {deleted_count} media records and {files_deleted} files"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/groups")
async def clear_groups(db: Session = Depends(get_db)):
    """
    Delete all group records from database.
    """
    try:
        deleted_count = admin_service.clear_groups_data(db)
        return {
            "success": True,
            "message": f"Cleared {deleted_count} group records"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/messages")
async def clear_messages(db: Session = Depends(get_db)):
    """
    Delete all message history from database.
    """
    try:
        deleted_count = admin_service.clear_messages_data(db)
        return {
            "success": True,
            "message": f"Cleared {deleted_count} message records"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/scheduled")
async def clear_scheduled(db: Session = Depends(get_db)):
    """
    Delete all scheduled jobs and cancel pending tasks.
    """
    try:
        deleted_count = admin_service.clear_scheduled_data(db)
        return {
            "success": True,
            "message": f"Cleared {deleted_count} scheduled jobs"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/all-except-auth")
async def clear_all_except_auth(db: Session = Depends(get_db)):
    """
    Clear all data but keep authentication session.
    """
    try:
        stats = admin_service.clear_all_except_auth(db)
        return {
            "success": True,
            "message": "Cleared all data except authentication",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/clear/everything")
async def clear_everything(db: Session = Depends(get_db)):
    """
    Clear ALL data including authentication session.
    User will be logged out.
    """
    try:
        stats = admin_service.clear_everything(db)
        return {
            "success": True,
            "message": "Cleared all data including authentication",
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
