import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.models import Group, Media, Message, MessageStatus
from backend.services.telegram_client import telegram_service
from backend.utils.validators import validate_content_for_group
from backend.services import settings_service
from typing import Dict, List


class MessageSenderService:
    """Service for sending messages with safety mechanisms."""
    
    def __init__(self):
        self.daily_count = 0
        self.last_reset = datetime.now()
    
    def _check_daily_limit(self) -> bool:
        """Check if daily message limit has been reached."""
        # Reset counter if it's a new day
        if datetime.now().date() > self.last_reset.date():
            self.daily_count = 0
            self.last_reset = datetime.now()
        
        return self.daily_count < settings_service.get_setting('daily_message_limit')
    
    def _increment_daily_count(self):
        """Increment daily message counter."""
        self.daily_count += 1
    
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
        
        Returns:
            Dict with counts: sent, failed, skipped
        """
        # Fetch message from database
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            return {"sent": 0, "failed": 0, "skipped": 0}
        
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
        for group_id in message.target_groups:
            # Check daily limit
            if not self._check_daily_limit():
                print(f"Daily limit reached ({settings_service.get_setting('daily_message_limit')})")
                skipped_count += len(message.target_groups) - (sent_count + failed_count + skipped_count)
                break
            
            # Fetch group from database
            group = db.query(Group).filter(Group.id == group_id).first()
            if not group or not group.is_active:
                skipped_count += 1
                continue
            
            # Validate content for this group
            is_valid, reason = validate_content_for_group(
                group.permission_type,
                has_link,
                has_media
            )
            
            if not is_valid:
                print(f"Skipping group {group.title}: {reason}")
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
                    self._increment_daily_count()
                    
                    # Update group stats
                    group.messages_sent += 1
                    group.last_message_at = datetime.now()
                    db.add(group)
                    
                    # Apply safety delay before next message
                    if sent_count < len(message.target_groups):
                        await self._apply_safety_delay()
                else:
                    # Update group stats
                    group.messages_failed += 1
                    db.add(group)
                    
                    failed_count += 1
                    
            except Exception as e:
                print(f"Error sending to group {group.title}: {e}")
                # Update group stats
                group.messages_failed += 1
                db.add(group)
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
message_sender = MessageSenderService()
