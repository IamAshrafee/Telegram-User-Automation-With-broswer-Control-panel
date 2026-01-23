from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.errors import SessionPasswordNeededError
from sqlalchemy.orm import Session
from backend.config import settings
from backend.models import TelegramSession
from typing import Optional, List, Dict
import os


class TelegramClientService:
    """Service for managing Telegram client operations using Telethon."""
    
    def __init__(self):
        self.client: Optional[TelegramClient] = None
        self._session_string: Optional[str] = None
    
    async def initialize_client(self, session_string: Optional[str] = None):
        """Initialize Telegram client with session."""
        if session_string:
            self._session_string = session_string
            session = StringSession(session_string)
        else:
            session = StringSession()
        
        self.client = TelegramClient(
            session,
            settings.telegram_api_id,
            settings.telegram_api_hash
        )
        await self.client.connect()
    
    async def send_code_request(self, phone_number: str) -> bool:
        """Send OTP code to phone number."""
        try:
            if not self.client:
                await self.initialize_client()
            
            await self.client.send_code_request(phone_number)
            return True
        except Exception as e:
            print(f"Error sending code: {e}")
            return False
    
    async def sign_in(self, phone_number: str, code: str, password: Optional[str] = None, db: Session = None, user_id: int = None) -> tuple[bool, str]:
        """Sign in with phone and OTP code, save session to database."""
        try:
            if not self.client:
                await self.initialize_client()
            
            try:
                await self.client.sign_in(phone_number, code)
            except SessionPasswordNeededError:
                # 2FA is enabled, need password
                if not password:
                    return False, "2FA_REQUIRED"
                await self.client.sign_in(password=password)
            
            # Save session to database
            session_string = self.client.session.save()
            
            # Check if session exists for this user
            existing_session = db.query(TelegramSession).filter(
                TelegramSession.user_id == user_id,
                TelegramSession.phone_number == phone_number
            ).first()
            
            if existing_session:
                existing_session.session_string = session_string
                existing_session.is_active = True
            else:
                new_session = TelegramSession(
                    user_id=user_id,
                    phone_number=phone_number,
                    session_string=session_string,
                    is_active=True
                )
                db.add(new_session)
            
            db.commit()
            return True, "Successfully authenticated"
            
        except Exception as e:
            return False, f"Authentication failed: {str(e)}"
    
    async def load_session_from_db(self, db: Session, user_id: int = None) -> bool:
        """Load active session from database for a specific user."""
        try:
            query = db.query(TelegramSession).filter(
                TelegramSession.is_active == True
            )
            if user_id:
                query = query.filter(TelegramSession.user_id == user_id)
            
            session = query.first()
            
            if session:
                await self.initialize_client(session.session_string)
                return await self.client.is_user_authorized()
            return False
        except Exception as e:
            print(f"Error loading session: {e}")
            return False
    
    async def get_dialogs(self) -> List[Dict]:
        """Fetch user's groups/channels from Telegram."""
        try:
            if not self.client or not await self.client.is_user_authorized():
                return []
            
            dialogs = await self.client.get_dialogs()
            groups = []
            
            for dialog in dialogs:
                # Only include groups and channels
                if dialog.is_group or dialog.is_channel:
                    groups.append({
                        "telegram_id": str(dialog.id),
                        "title": dialog.title,
                    })
            
            return groups
        except Exception as e:
            print(f"Error fetching dialogs: {e}")
            return []
    
    async def send_message(
        self,
        group_id: str,
        text: str,
        link: Optional[str] = None,
        media_path: Optional[str] = None
    ) -> bool:
        """Send message to a specific group."""
        try:
            if not self.client or not await self.client.is_user_authorized():
                return False
            
            # Construct message text
            message_text = text
            if link:
                message_text += f"\n\n{link}"
            
            # Send message with or without media
            if media_path and os.path.exists(media_path):
                await self.client.send_file(
                    int(group_id),
                    media_path,
                    caption=message_text
                )
            else:
                await self.client.send_message(int(group_id), message_text)
            
            return True
        except Exception as e:
            print(f"Error sending message to {group_id}: {e}")
            return False
    
    async def disconnect(self):
        """Disconnect Telegram client."""
        if self.client:
            await self.client.disconnect()


# Global instance
telegram_service = TelegramClientService()
