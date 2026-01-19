from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import Message, MessageStatus
from backend.services.message_sender import message_sender
from backend.utils.logger import setup_logger
from datetime import datetime
from typing import Optional

logger = setup_logger(__name__)

class SchedulerService:
    """Background scheduler for executing scheduled messages."""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
    
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
        db = SessionLocal()
        try:
            logger.info(f"Executing scheduled message {message_id}")
            await message_sender.send_message_to_groups(message_id, db)
        except Exception as e:
            logger.error(f"Error executing scheduled message {message_id}: {e}")
        finally:
            db.close()
    
    def schedule_message(self, message_id: int, scheduled_at: datetime) -> str:
        """
        Schedule a message for future execution.
        
        Returns:
            Job ID
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


# Global instance
scheduler_service = SchedulerService()
