from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas import GroupResponse, GroupUpdate, GroupSyncResponse
from backend.services import telegram_service
from backend.models import Group, PermissionType
from typing import List, Optional

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.get("/", response_model=List[GroupResponse])
async def list_groups(
    permission_type: Optional[PermissionType] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """List all groups with optional filters."""
    query = db.query(Group)
    
    if permission_type:
        query = query.filter(Group.permission_type == permission_type)
    
    if is_active is not None:
        query = query.filter(Group.is_active == is_active)
    
    groups = query.all()
    return groups


@router.post("/sync", response_model=GroupSyncResponse)
async def sync_groups(db: Session = Depends(get_db)):
    """Fetch groups from Telegram and update database."""
    # Ensure client is connected
    is_loaded = await telegram_service.load_session_from_db(db)
    if not is_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated with Telegram")
    
    # Fetch groups from Telegram
    telegram_groups = await telegram_service.get_dialogs()
    
    new_count = 0
    synced_count = len(telegram_groups)
    
    for tg_group in telegram_groups:
        # Check if group already exists
        existing = db.query(Group).filter(
            Group.telegram_id == tg_group["telegram_id"]
        ).first()
        
        if existing:
            # Update title if changed
            existing.title = tg_group["title"]
        else:
            # Create new group
            new_group = Group(
                telegram_id=tg_group["telegram_id"],
                title=tg_group["title"],
                permission_type=PermissionType.ALL,  # Default to all permissions
                is_active=True
            )
            db.add(new_group)
            new_count += 1
    
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
    db: Session = Depends(get_db)
):
    """Update group permission type or active status."""
    group = db.query(Group).filter(Group.id == group_id).first()
    
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
    db: Session = Depends(get_db)
):
    """
    Update multiple groups at once.
    Supports bulk permission changes and bulk activate/deactivate.
    """
    if not group_ids:
        raise HTTPException(status_code=400, detail="No group IDs provided")
    
    updated_count = 0
    
    for group_id in group_ids:
        group = db.query(Group).filter(Group.id == group_id).first()
        if group:
            if update_data.permission_type is not None:
                group.permission_type = update_data.permission_type
            if update_data.is_active is not None:
                group.is_active = update_data.is_active
            updated_count += 1
    
    db.commit()
    
    return {
        "success": True,
        "message": f"Updated {updated_count} groups",
        "updated_count": updated_count
    }


@router.get("/search", response_model=List[GroupResponse])
async def search_groups(
    q: Optional[str] = Query(None, description="Search query for group title"),
    permission_type: Optional[PermissionType] = None,
    is_active: Optional[bool] = None,
    sort_by: str = Query("title", description="Field to sort by: title, created_at, updated_at"),
    sort_order: str = Query("asc", description="Sort order: asc or desc"),
    db: Session = Depends(get_db)
):
    """
    Advanced search and filtering for groups.
    Supports search by title, filtering, and sorting.
    """
    from sqlalchemy import desc, asc
    
    query = db.query(Group)
    
    # Search by title
    if q:
        query = query.filter(Group.title.ilike(f"%{q}%"))
    
    # Filter by permission type
    if permission_type:
        query = query.filter(Group.permission_type == permission_type)
    
    # Filter by active status
    if is_active is not None:
        query = query.filter(Group.is_active == is_active)
    
    # Sorting
    sort_field = getattr(Group, sort_by, Group.title)
    if sort_order == "desc":
        query = query.order_by(desc(sort_field))
    else:
        query = query.order_by(asc(sort_field))
    
    groups = query.all()
    return groups


@router.get("/analytics")
async def get_group_analytics(db: Session = Depends(get_db)):
    """
    Get analytics data for all groups.
    Returns statistics like top performers, success rates, etc.
    """
    from sqlalchemy import func as sql_func
    
    groups = db.query(Group).all()
    
    # Calculate overall stats
    total_messages = sum(g.messages_sent + g.messages_failed for g in groups)
    total_sent = sum(g.messages_sent for g in groups)
    total_failed = sum(g.messages_failed for g in groups)
    
    overall_success_rate = 0
    if total_messages > 0:
        overall_success_rate = round((total_sent / total_messages) * 100, 1)
    
    # Top 5 most active groups
    top_groups = sorted(
        [g for g in groups if g.messages_sent > 0],
        key=lambda x: x.messages_sent,
        reverse=True
    )[:5]
    
    # Groups with issues (low success rate)
    problem_groups = [
        g for g in groups 
        if (g.messages_sent + g.messages_failed) > 0 and g.success_rate < 80
    ]
    
    # Inactive groups (no messages in 30+ days or never sent)
    from datetime import datetime, timedelta
    thirty_days_ago = datetime.now() - timedelta(days=30)
    inactive_groups = [
        g for g in groups
        if g.last_message_at is None or g.last_message_at < thirty_days_ago
    ]
    
    return {
        "overview": {
            "total_groups": len(groups),
            "active_groups": len([g for g in groups if g.is_active]),
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
            }
            for g in top_groups
        ],
        "problem_groups": [
            {
                "id": g.id,
                "title": g.title,
                "success_rate": g.success_rate,
                "total_attempts": g.messages_sent + g.messages_failed
            }
            for g in problem_groups
        ],
        "inactive_groups": [
            {
                "id": g.id,
                "title": g.title,
                "last_message_at": g.last_message_at.isoformat() if g.last_message_at else None
            }
            for g in inactive_groups[:10]  # Limit to 10
        ]
    }


@router.delete("/{group_id}")
async def delete_group(group_id: int, db: Session = Depends(get_db)):
    """Remove group from database."""
    group = db.query(Group).filter(Group.id == group_id).first()
    
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    db.delete(group)
    db.commit()
    
    return {"success": True, "message": "Group deleted"}
