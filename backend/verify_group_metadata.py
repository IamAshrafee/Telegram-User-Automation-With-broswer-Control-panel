"""
Verification Script: Test New Group Metadata Collection

This script tests the enhanced group metadata collection with:
1. New permission fields (can_send_messages, can_send_media, etc.)
2. Security flags (is_scam, is_fake)
3. Group characteristics (is_megagroup, has_photo, unread_count)
"""

import sys
from pathlib import Path
import asyncio

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from backend.services.telegram_client import telegram_service
from backend.database import SessionLocal
import json


async def test_group_metadata():
    """Test fetching and displaying enhanced group metadata."""
    db = SessionLocal()
    
    try:
        print("🔍 Testing Enhanced Group Metadata Collection\n")
        print("=" * 70)
        
        # Load session from database
        print("\n1️⃣  Loading Telegram session...")
        is_loaded = await telegram_service.load_session_from_db(db, user_id=None)
        
        if not is_loaded:
            print("❌ No active Telegram session found!")
            print("   Please authenticate first through the web app.")
            return
        
        print("✅ Session loaded successfully!\n")
        
        # Fetch groups
        print("2️⃣  Fetching groups from Telegram...")
        groups = await telegram_service.get_dialogs()
        
        if not groups:
            print("❌ No groups found!")
            return
        
        print(f"✅ Found {len(groups)} groups!\n")
        
        # Display first 3 groups with all metadata
        print("3️⃣  Sample Group Metadata:\n")
        for i, group in enumerate(groups[:3], 1):
            print(f"{'─' * 70}")
            print(f"Group #{i}: {group['title']}")
            print(f"{'─' * 70}")
            
            # Basic Info
            print(f"\n📊 Basic Info:")
            print(f"   • Telegram ID: {group['telegram_id']}")
            print(f"   • Members: {group['member_count']}")
            print(f"   • Username: @{group['username']}" if group['username'] else "   • Username: None")
            print(f"   • Admin: {'Yes ✅' if group['is_admin'] else 'No ❌'}")
            
            # Permissions
            print(f"\n🔐 Permissions:")
            print(f"   • Send Messages: {'✅' if group['can_send_messages'] else '❌'}")
            print(f"   • Send Media: {'✅' if group['can_send_media'] else '❌'}")
            print(f"   • Embed Links: {'✅' if group['can_embed_links'] else '❌'}")
            print(f"   • Send Polls: {'✅' if group['can_send_polls'] else '❌'}")
            print(f"   • Send Stickers: {'✅' if group['can_send_stickers'] else '❌'}")
            
            # Security & Characteristics
            print(f"\n🛡️  Security & Characteristics:")
            print(f"   • Scam Flag: {'⚠️  YES' if group['is_scam'] else '✅ No'}")
            print(f"   • Fake Flag: {'⚠️  YES' if group['is_fake'] else '✅ No'}")
            print(f"   • Megagroup: {'Yes' if group['is_megagroup'] else 'No'}")
            print(f"   • Has Photo: {'Yes' if group['has_photo'] else 'No'}")
            print(f"   • Unread: {group['unread_count']} messages")
            print(f"   • Slow Mode: {group['slow_mode_delay']}s delay" if group['slow_mode_delay'] > 0 else "   • Slow Mode: Disabled")
            
            print()
        
        # Summary statistics
        print(f"\n{'=' * 70}")
        print(f"📈 SUMMARY STATISTICS")
        print(f"{'=' * 70}\n")
        
        total = len(groups)
        megagroups = sum(1 for g in groups if g.get('is_megagroup', False))
        with_photo = sum(1 for g in groups if g.get('has_photo', False))
        admin_groups = sum(1 for g in groups if g.get('is_admin', False))
        restricted_media = sum(1 for g in groups if not g.get('can_send_media', True))
        restricted_links = sum(1 for g in groups if not g.get('can_embed_links', True))
        scam_groups = sum(1 for g in groups if g.get('is_scam', False))
        
        print(f"Total Groups: {total}")
        print(f"Megagroups: {megagroups} ({megagroups/total*100:.1f}%)")
        print(f"With Photo: {with_photo} ({with_photo/total*100:.1f}%)")
        print(f"Admin in: {admin_groups} ({admin_groups/total*100:.1f}%)")
        print(f"Media Restricted: {restricted_media} ({restricted_media/total*100:.1f}%)")
        print(f"Links Restricted: {restricted_links} ({restricted_links/total*100:.1f}%)")
        print(f"Scam Flagged: {scam_groups} ({scam_groups/total*100:.1f}%)")
        
        print(f"\n{'=' * 70}")
        print("✅ Verification Complete!")
        
    except Exception as e:
        print(f"\n❌ Error during verification: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        db.close()
        await telegram_service.disconnect()


if __name__ == "__main__":
    asyncio.run(test_group_metadata())
