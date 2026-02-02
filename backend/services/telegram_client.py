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
        """Fetch user's Telegram groups only (excludes channels)."""
        try:
            if not self.client or not await self.client.is_user_authorized():
                return []
            
            dialogs = await self.client.get_dialogs()
            groups = []
            
            for dialog in dialogs:
                # Only include groups (not channels)
                if dialog.is_group:
                    entity = dialog.entity
                    
                    # Extract basic metadata
                    member_count = getattr(entity, 'participants_count', 0) or 0
                    username = getattr(entity, 'username', None)
                    
                    # Admin status (admin_rights is not None OR creator=True)
                    is_admin = getattr(entity, 'admin_rights', None) is not None or getattr(entity, 'creator', False)
                    
                    # Slow mode
                    slow_mode_delay = getattr(entity, 'slowmode_seconds', 0) or 0
                    
                    # Security flags
                    is_scam = getattr(entity, 'scam', False)
                    is_fake = getattr(entity, 'fake', False)
                    
                    # Group type
                    is_megagroup = getattr(entity, 'megagroup', False)
                    
                    # Profile picture
                    has_photo = getattr(entity, 'photo', None) is not None
                    
                    # Activity metrics
                    unread_count = dialog.unread_count if hasattr(dialog, 'unread_count') else 0
                    
                    # Permission Detection - Check BOTH global AND user-specific restrictions
                    # default_banned_rights = what's banned for everyone
                    # participant rights = what's banned/allowed for YOU specifically
                    
                    # Permission Detection - ACCURATE (checks both layers)
                    # Layer 1: default_banned_rights = what's banned for everyone
                    # Layer 2: user permissions = what's banned/allowed for YOU specifically
                    # This is slower but much more accurate!
                    
                    default_banned = getattr(entity, 'default_banned_rights', None)
                    
                    # Get YOUR specific permissions in this group
                    try:
                        participant = await self.client.get_permissions(entity)
                    except Exception as e:
                        # If we can't fetch permissions, fallback to group-wide only
                        participant = None
                    
                    # Helper: Check if action is ALLOWED
                    # Action is allowed ONLY if: NOT banned group-wide AND you have permission
                    def can_do(action_name):
                        # Check group-wide ban first
                        globally_banned = getattr(default_banned, action_name, False) if default_banned else False
                        
                        # Check if YOU specifically have this permission
                        if participant:
                            # IMPORTANT: In Telethon, participant permissions are INVERTED!
                            # participant.send_media = True means "BANNED" (you CANNOT)
                            # participant.send_media = False means "ALLOWED" (you CAN)
                            user_banned = getattr(participant, action_name, False)
                            user_can = not user_banned  # Invert it!
                        else:
                            # Fallback: if we can't get your permissions, assume you follow group rules
                            user_can = not globally_banned
                        
                        # Final decision: Can do ONLY if NOT globally banned AND you have permission
                        return (not globally_banned) and user_can
                    
                    # Check all permissions
                    can_send_messages = can_do('send_messages')
                    can_send_media = can_do('send_media')
                    can_embed_links = can_do('embed_links')
                    can_send_polls = can_do('send_polls')
                    can_send_stickers = can_do('send_stickers')



                    groups.append({
                        "telegram_id": str(dialog.id),
                        "title": dialog.title,
                        "member_count": member_count,
                        "username": username,
                        "is_admin": is_admin,
                        "slow_mode_delay": slow_mode_delay,
                        # New permission flags (inverted logic for clarity)
                        "can_send_messages": can_send_messages,
                        "can_send_media": can_send_media,
                        "can_embed_links": can_embed_links,
                        "can_send_polls": can_send_polls,
                        "can_send_stickers": can_send_stickers,
                        # Security flags
                        "is_scam": is_scam,
                        "is_fake": is_fake,
                        # Group characteristics
                        "is_megagroup": is_megagroup,
                        "has_photo": has_photo,
                        "unread_count": unread_count
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
