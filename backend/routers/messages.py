from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import MessageCreate, MessageResponse, MessageSendResponse
from backend.models import Message, MessageStatus
from backend.services import message_sender, telegram_service
from backend.utils.logger import setup_logger
from typing import List

logger = setup_logger(__name__)

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.post("/send", response_model=MessageSendResponse)
async def send_message(
    message_data: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Send message immediately to selected groups."""
    # Ensure Telegram client is connected
    is_loaded = await telegram_service.load_session_from_db(db)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    # Create message record
    message = Message(
        text=message_data.text,
        link=message_data.link,
        media_id=message_data.media_id,
        target_groups=message_data.target_groups,
        status=MessageStatus.DRAFT
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Send message in background
    background_tasks.add_task(message_sender.send_message_to_groups, message.id, db)
    
    # Return immediate response (estimates)
    return MessageSendResponse(
        success=True,
        message="Message sending started in background",
        message_id=message.id,
        sent_count=0,
        failed_count=0,
        skipped_count=0
    )


@router.get("/history", response_model=List[MessageResponse])
async def get_message_history(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """Get sent message history."""
    messages = db.query(Message).filter(
        Message.status.in_([MessageStatus.SENT, MessageStatus.FAILED])
    ).order_by(Message.created_at.desc()).limit(limit).all()
    
    return messages


@router.post("/preview")
async def preview_message(
    message_data: MessageCreate,
    db: Session = Depends(get_db)
):
    """Preview message with actual group data (first 3 groups)"""
    try:
        from backend.models import Group
        from backend.utils.message_validators import estimate_send_time, format_time_estimate
        from datetime import datetime
        
        # Try to import text_processor, if it doesn't exist, use simple processing
        try:
            from backend.utils.text_processor import process_content
        except ImportError:
            # Fallback: simple variable replacement
            def process_content(text, context):
                for key, value in context.items():
                    text = text.replace(key, str(value))
                return text
        
        previews = []
        target_groups = message_data.target_groups[:3]  # Preview first 3 groups
        
        for group_id in target_groups:
            group = db.query(Group).filter(Group.id == group_id).first()
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


@router.get("/{message_id}", response_model=MessageResponse)
async def get_message(message_id: int, db: Session = Depends(get_db)):
    """Get specific message details."""
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return message
