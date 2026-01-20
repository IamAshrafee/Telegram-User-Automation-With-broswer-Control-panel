import asyncio
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Group, Media, Message, MessageStatus
from backend.services.telegram_client import telegram_service
from backend.utils.validators import validate_content_for_group
from backend.services import settings_service
from backend.utils.logger import setup_logger

logger = setup_logger(__name__)

class MessageService:
    """
    Unified service for sending messages (immediate and scheduled)
    with safety mechanisms and background scheduling.
    """
    
    def __init__(self):
        # Scheduler init
        self.scheduler = AsyncIOScheduler()
        self.is_running = False

    # --- Scheduler Methods ---

    def start(self):
        """Start the scheduler."""
        if not self.is_running:
            self.scheduler.start()
            self.is_running = True
            logger.info("Scheduler started")
    
    def shutdown(self):
        """Shutdown the scheduler."""
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Scheduler stopped")
            
    async def _execute_scheduled_message(self, message_id: int):
        """Execute a scheduled message."""
        await self.send_message_bg(message_id)

    async def send_message_bg(self, message_id: int):
        """Execute a message in background with fresh DB session."""
        db = SessionLocal()
        try:
            logger.info(f"Executing background message {message_id}")
            await self.send_message_to_groups(message_id, db)
        except Exception as e:
            logger.error(f"Error executing background message {message_id}: {e}")
        finally:
            db.close()

    def schedule_message(self, message_id: int, scheduled_at: datetime) -> str:
        """
        Schedule a message for future execution.
        Returns: Job ID
        """
        job = self.scheduler.add_job(
            self._execute_scheduled_message,
            trigger=DateTrigger(run_date=scheduled_at),
            args=[message_id],
            id=f"message_{message_id}",
            replace_existing=True
        )
        logger.info(f"Scheduled message {message_id} for {scheduled_at}")
        return job.id

    def cancel_scheduled_message(self, message_id: int) -> bool:
        """Cancel a scheduled message."""
        try:
            job_id = f"message_{message_id}"
            self.scheduler.remove_job(job_id)
            logger.info(f"Cancelled scheduled message {message_id}")
            return True
        except Exception as e:
            logger.error(f"Error cancelling message {message_id}: {e}")
            return False

    def load_scheduled_messages(self, db: Session):
        """Load all scheduled messages from database on startup."""
        scheduled_messages = db.query(Message).filter(
            Message.status == MessageStatus.SCHEDULED,
            Message.scheduled_at.isnot(None),
            Message.scheduled_at > datetime.now()
        ).all()
        
        for message in scheduled_messages:
            self.schedule_message(message.id, message.scheduled_at)
        
        logger.info(f"Loaded {len(scheduled_messages)} scheduled messages")

    def cancel_all_jobs(self):
        """Cancel all scheduled jobs."""
        try:
            self.scheduler.remove_all_jobs()
            logger.info("Cancelled all scheduled jobs")
        except Exception as e:
            logger.error(f"Error cancelling all jobs: {e}")

    def cleanup_stuck_jobs(self, db: Session):
        """Mark messages stuck in SENDING state as FAILED on startup."""
        stuck_messages = db.query(Message).filter(
            Message.status == MessageStatus.SENDING
        ).all()
        
        for msg in stuck_messages:
            msg.status = MessageStatus.FAILED
            # Update group status to show interruption
            if msg.group_status:
                current_status = dict(msg.group_status)
                for gid, status in current_status.items():
                    if status.get("status") == "sending" or status.get("status") == "queued":
                        current_status[gid]["status"] = "failed"
                        current_status[gid]["error"] = "Process interrupted by server restart"
                msg.group_status = current_status
            
            db.add(msg)
            logger.warning(f"Marked stuck message {msg.id} as FAILED")
        
        db.commit()

    # --- Message Sending Methods ---
    
    def _check_daily_limit(self, db: Session) -> bool:
        """
        Check if daily message limit has been reached by counting actual DB records.
        """
        limit = settings_service.get_setting('daily_message_limit', 100)
        
        # Calculate start of today (local server time)
        today = datetime.now().date()
        start_of_day = datetime.combine(today, datetime.min.time())
        
        # Fetch all messages that have sent activity today
        # We look for messages sent_at >= today. 
        # Note: A message might have been started yesterday and finished today? 
        # For simplicity, we assume 'sent_at' is when the bulk batch started/finished.
        # Ideally we'd timestamp each individual send, but 'sent_at' is the batch timestamp.
        # This is the best approximation without a dedicated 'MessageDelivery' table.
        messages_today = db.query(Message).filter(
            Message.status.in_([MessageStatus.SENT, MessageStatus.SENDING]),
            Message.sent_at >= start_of_day
        ).all()
        
        sent_count = 0
        for msg in messages_today:
            # Count how many groups in this message actually have 'sent' status
            if msg.group_status:
                for target_id, info in msg.group_status.items():
                    if info.get("status") == "sent":
                        sent_count += 1
                        
        return sent_count < limit
    
    # _increment_daily_count is no longer needed as DB updates happen via message status change
    
    async def _apply_safety_delay(self):
        """Apply random delay between messages."""
        min_delay = settings_service.get_setting('min_delay_seconds')
        max_delay = settings_service.get_setting('max_delay_seconds')
        delay = random.randint(min_delay, max_delay)
        await asyncio.sleep(delay)

    async def send_message_to_groups(
        self,
        message_id: int,
        db: Session
    ) -> Dict[str, int]:
        """
        Send a message to all target groups with safety mechanisms.
        Returns: Dict with counts: sent, failed, skipped
        """
        # Fetch message from database
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            return {"sent": 0, "failed": 0, "skipped": 0}
        
        # Initialize status if empty
        if not message.group_status:
           initial_status = {}
           
           # Pre-fetch group titles to avoid "Unknown Group" in UI
           groups = db.query(Group.id, Group.title).filter(Group.id.in_(message.target_groups)).all()
           group_map = {g.id: g.title for g in groups}
           
           for gid in message.target_groups:
              g_title = group_map.get(gid, "Unknown Group")
              initial_status[str(gid)] = {
                  "status": "queued", 
                  "group_name": g_title,
                  "updated_at": datetime.now().isoformat()
              }
           message.group_status = initial_status
           message.total_count = len(message.target_groups)
           message.processed_count = 0
           db.commit()

        # Update status to sending
        message.status = MessageStatus.SENDING
        db.commit()
        
        # Get media path if media is attached
        media_path = None
        if message.media_id:
            media = db.query(Media).filter(Media.id == message.media_id).first()
            if media:
                media_path = media.filepath
        
        has_link = message.link is not None
        has_media = media_path is not None
        
        sent_count = 0
        failed_count = 0
        skipped_count = 0
        
        # Send to each target group
        for i, group_id in enumerate(message.target_groups):
            # Check daily limit
            if not self._check_daily_limit(db):
                print(f"Daily limit reached ({settings_service.get_setting('daily_message_limit')})")
                
                # Mark remaining as skipped
                remaining = message.target_groups[i:]
                current_status = dict(message.group_status) # Copy to mutate
                
                # Fetch group info for better reporting (bulk fetch would be better but simple iteration is fine for now)
                for rid in remaining:
                    group_info = db.query(Group.title).filter(Group.id == rid).first()
                    g_name = group_info[0] if group_info else "Unknown Group"
                    
                    current_status[str(rid)] = {
                        "status": "skipped", 
                        "reason": "daily_limit",
                        "group_name": g_name,
                        "updated_at": datetime.now().isoformat()
                    }
                message.group_status = current_status
                message.processed_count = len(message.target_groups)
                skipped_count += len(remaining)
                break
            
            # Fetch group from database
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group or not group.is_active:
                # Update status
                current_status = dict(message.group_status)
                current_status[str(group_id)] = {
                    "status": "skipped",
                    "reason": "inactive_or_not_found",
                    "updated_at": datetime.now().isoformat()
                }
                message.group_status = current_status
                message.processed_count += 1
                db.commit()
                
                skipped_count += 1
                continue
            
            # Update status to 'sending'
            current_status = dict(message.group_status)
            current_status[str(group_id)] = {
                "status": "sending",
                "group_name": group.title,
                "updated_at": datetime.now().isoformat()
            }
            message.group_status = current_status
            db.commit()

            # Validate content for this group
            is_valid, reason = validate_content_for_group(
                group.permission_type,
                has_link,
                has_media
            )
            
            if not is_valid:
                print(f"Skipping group {group.title}: {reason}")
                # Update status
                current_status = dict(message.group_status)
                current_status[str(group_id)] = {
                    "status": "skipped", 
                    "reason": reason,
                    "group_name": group.title,
                    "updated_at": datetime.now().isoformat()
                }
                message.group_status = current_status
                message.processed_count += 1
                db.commit()

                skipped_count += 1
                continue
            
            # Send message
            try:
                success = await telegram_service.send_message(
                    group.telegram_id,
                    message.text,
                    message.link,
                    media_path
                )
                
                if success:
                    sent_count += 1
                    # DB is automatically updated below
                    
                    # Update group stats
                    group.messages_sent += 1
                    group.last_message_at = datetime.now()
                    db.add(group)
                    
                    # Update message status
                    current_status = dict(message.group_status)
                    current_status[str(group_id)] = {
                        "status": "sent",
                        "group_name": group.title,
                        "updated_at": datetime.now().isoformat()
                    }
                    message.group_status = current_status
                    message.processed_count += 1
                    db.commit()

                    # Apply safety delay before next message
                    if i < len(message.target_groups) - 1:
                        # Update status to waiting
                        next_gid = message.target_groups[i+1]
                        current_status = dict(message.group_status)
                        current_status[str(next_gid)]["status"] = "waiting_delay"
                        message.group_status = current_status
                        db.commit()
                        
                        await self._apply_safety_delay()
                else:
                    # Update group stats
                    group.messages_failed += 1
                    db.add(group)
                    
                    # Update message status
                    current_status = dict(message.group_status)
                    current_status[str(group_id)] = {
                        "status": "failed",
                        "group_name": group.title,
                        "updated_at": datetime.now().isoformat()
                    }
                    message.group_status = current_status
                    message.processed_count += 1
                    db.commit()

                    failed_count += 1
                    
            except Exception as e:
                print(f"Error sending to group {group.title}: {e}")
                # Update group stats
                group.messages_failed += 1
                db.add(group)
                
                # Update message status
                current_status = dict(message.group_status)
                current_status[str(group_id)] = {
                    "status": "failed", 
                    "error": str(e),
                    "group_name": group.title,
                    "updated_at": datetime.now().isoformat()
                }
                message.group_status = current_status
                message.processed_count += 1
                db.commit()

                failed_count += 1
        
        # Update message status
        if sent_count > 0:
            message.status = MessageStatus.SENT
            message.sent_at = datetime.now()
        else:
            message.status = MessageStatus.FAILED
        
        db.commit()
        
        return {
            "sent": sent_count,
            "failed": failed_count,
            "skipped": skipped_count
        }

# Global instance
message_service = MessageService()
