from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from backend.database import get_db
from backend.schemas import GroupResponse, GroupUpdate, GroupSyncResponse, GroupPaginatedResponse
from backend.services import telegram_service
from backend.models import Group, PermissionType
from backend.models.user import User
from backend.utils.auth import get_current_user
from typing import List, Optional
import math
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/groups", tags=["Groups"])


@router.get("/all", response_model=List[GroupResponse])
async def list_all_active_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all active groups for selection dropdowns (lightweight)."""
    groups = db.query(Group).filter(
        Group.user_id == current_user.id,
        Group.is_active == True
    ).order_by(Group.title).all()
    return groups


@router.get("/", response_model=GroupPaginatedResponse)
async def list_groups(
    current_user: User = Depends(get_current_user),
    q: Optional[str] = Query(None, description="Search query for group title"),
    permission_type: Optional[PermissionType] = None,
    is_active: Optional[bool] = None,
    sort_by: str = Query("title", description="Field to sort by: title, created_at"),
    sort_order: str = Query("asc", description="Sort order: asc or desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db)
):
    """List groups with pagination, filtering, and sorting."""
    query = db.query(Group).filter(Group.user_id == current_user.id)
    
    # Search
    if q:
        query = query.filter(Group.title.ilike(f"%{q}%"))
    
    # Filters
    if permission_type:
        query = query.filter(Group.permission_type == permission_type)
    
    if is_active is not None:
        query = query.filter(Group.is_active == is_active)
    
    # Sorting
    sort_field = getattr(Group, sort_by, Group.title)
    if sort_order == "desc":
        query = query.order_by(desc(sort_field))
    else:
        query = query.order_by(asc(sort_field))
    
    # Pagination
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


@router.post("/sync", response_model=GroupSyncResponse)
async def sync_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch groups from Telegram and update database.
    Marks groups not found in Telegram as inactive (user left).
    """
    is_loaded = await telegram_service.load_session_from_db(db, current_user.id)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    telegram_groups = await telegram_service.get_dialogs()
    
    new_count = 0
    synced_count = len(telegram_groups)
    active_telegram_ids = set()
    
    for tg_group in telegram_groups:
        active_telegram_ids.add(tg_group["telegram_id"])
        
        # Check if group already exists
        existing = db.query(Group).filter(
            Group.user_id == current_user.id,
            Group.telegram_id == tg_group["telegram_id"]
        ).first()
        
        if existing:
            # Update properties
            if existing.title != tg_group["title"]:
                existing.title = tg_group["title"]
            
            # Update stats/metadata
            existing.member_count = tg_group.get("member_count", 0)
            existing.username = tg_group.get("username")
            existing.is_admin = tg_group.get("is_admin", False)
            existing.slow_mode_delay = tg_group.get("slow_mode_delay", 0)
            existing.has_media_restriction = tg_group.get("has_media_restriction", False)
            existing.has_link_restriction = tg_group.get("has_link_restriction", False)

            # Reactivate if it was inactive
            if not existing.is_active:
                existing.is_active = True
        else:
            # Create new group
            new_group = Group(
                user_id=current_user.id,
                telegram_id=tg_group["telegram_id"],
                title=tg_group["title"],
                member_count=tg_group.get("member_count", 0),
                username=tg_group.get("username"),
                is_admin=tg_group.get("is_admin", False),
                slow_mode_delay=tg_group.get("slow_mode_delay", 0),
                has_media_restriction=tg_group.get("has_media_restriction", False),
                has_link_restriction=tg_group.get("has_link_restriction", False),
                permission_type=PermissionType.ALL,
                is_active=True
            )
            db.add(new_group)
            new_count += 1
    
    # Mark groups not in Telegram as inactive (stale)
    if active_telegram_ids:
        db.query(Group).filter(
            Group.user_id == current_user.id,
            Group.telegram_id.notin_(active_telegram_ids),
            Group.is_active == True
        ).update({Group.is_active: False}, synchronize_session=False)
    
    db.commit()
    
    return GroupSyncResponse(
        success=True,
        message=f"Synced {synced_count} groups, {new_count} new",
        synced_count=synced_count,
        new_count=new_count
    )


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    update_data: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update group permission type or active status."""
    group = db.query(Group).filter(
        Group.user_id == current_user.id,
        Group.id == group_id
    ).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if update_data.permission_type is not None:
        group.permission_type = update_data.permission_type
    
    if update_data.is_active is not None:
        group.is_active = update_data.is_active
    
    db.commit()
    db.refresh(group)
    return group


@router.post("/bulk-update")
async def bulk_update_groups(
    group_ids: List[int],
    update_data: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update multiple groups at once."""
    if not group_ids:
        raise HTTPException(status_code=400, detail="No group IDs provided")
    
    query = db.query(Group).filter(
        Group.user_id == current_user.id,
        Group.id.in_(group_ids)
    )
    update_values = {}
    
    if update_data.permission_type is not None:
        update_values[Group.permission_type] = update_data.permission_type
    
    if update_data.is_active is not None:
        update_values[Group.is_active] = update_data.is_active
        
    if update_values:
        query.update(update_values, synchronize_session=False)
        db.commit()
        
    return {
        "success": True,
        "message": f"Updated {len(group_ids)} groups",
        "updated_count": len(group_ids)
    }


@router.get("/analytics")
async def get_group_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get analytics data using optimized database aggregations.
    """
    total_groups = db.query(func.count(Group.id)).filter(Group.user_id == current_user.id).scalar()
    active_groups = db.query(func.count(Group.id)).filter(
        Group.user_id == current_user.id,
        Group.is_active == True
    ).scalar()
    
    # Aggregations for messages
    stats = db.query(
        func.sum(Group.messages_sent).label('sent'),
        func.sum(Group.messages_failed).label('failed')
    ).filter(Group.user_id == current_user.id).first()
    
    total_sent = stats.sent or 0
    total_failed = stats.failed or 0
    total_messages = total_sent + total_failed
    
    overall_success_rate = 0
    if total_messages > 0:
        overall_success_rate = round((total_sent / total_messages) * 100, 1)
    
    # Top 5 most active groups (using DB sort)
    top_groups = db.query(Group).filter(
        Group.user_id == current_user.id,
        Group.messages_sent > 0
    ).order_by(desc(Group.messages_sent)).limit(5).all()
    
    # Groups with issues (DB filtering for success rate < 80%)
    # Note: Complex math in WHERE clause can be slow, but better than loading all.
    # We select groups with failures and check rate in python for simplicity on small datasets,
    # or rely on Sent/Total ratio if supported by DB dialect.
    # Here we stick to Python filter for the specific "problem" logic but on a reduced set if possible.
    # For now, fetching groups with failures is a good start.
    groups_with_failures = db.query(Group).filter(
        Group.user_id == current_user.id,
        Group.messages_failed > 0
    ).all()
    problem_groups = [
        g for g in groups_with_failures 
        if g.success_rate < 80
    ][:10]
    
    # Inactive groups (30+ days)
    thirty_days_ago = datetime.now() - timedelta(days=30)
    inactive_groups = db.query(Group).filter(
        Group.user_id == current_user.id,
        (Group.last_message_at == None) | (Group.last_message_at < thirty_days_ago)
    ).limit(10).all()
    
    return {
        "overview": {
            "total_groups": total_groups,
            "active_groups": active_groups,
            "total_messages_sent": total_sent,
            "total_messages_failed": total_failed,
            "overall_success_rate": overall_success_rate
        },
        "top_groups": [
            {
                "id": g.id,
                "title": g.title,
                "messages_sent": g.messages_sent,
                "success_rate": g.success_rate
            } for g in top_groups
        ],
        "problem_groups": [
            {
                "id": g.id,
                "title": g.title,
                "success_rate": g.success_rate,
                "total_attempts": g.messages_sent + g.messages_failed
            } for g in problem_groups
        ],
        "inactive_groups": [
            {
                "id": g.id,
                "title": g.title,
                "last_message_at": g.last_message_at.isoformat() if g.last_message_at else None
            } for g in inactive_groups
        ]
    }


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove group if safe."""
    group = db.query(Group).filter(
        Group.user_id == current_user.id,
        Group.id == group_id
    ).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Safety check: Don't delete if it has message history
    if group.messages_sent > 0 or group.messages_failed > 0:
         raise HTTPException(
             status_code=400, 
             detail="Cannot delete group with message history. Deactivate it instead."
         )
    
    db.delete(group)
    db.commit()
    
    return {"success": True, "message": "Group deleted"}
