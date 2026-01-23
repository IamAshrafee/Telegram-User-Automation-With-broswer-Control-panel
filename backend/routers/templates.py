from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db
from backend.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse, DraftResponse
from backend.models import MessageTemplate, MessageDraft
from typing import List
from backend.models.user import User
from backend.utils.auth import get_current_user

router = APIRouter(prefix="/api/templates", tags=["Templates"])


# ============================================
# DRAFT ENDPOINTS (MUST BE FIRST!)
# ============================================

@router.post("/draft", response_model=DraftResponse)
async def save_draft(
    draft_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Save or update draft (only one draft per user)"""
    # Get existing draft or create new
    draft = db.query(MessageDraft).filter(
        MessageDraft.user_id == current_user.id
    ).first()
    
    if draft:
        # Update existing
        draft.text = draft_data.get('text')
        draft.link = draft_data.get('link')
        draft.media_id = draft_data.get('media_id')
        draft.target_groups = draft_data.get('target_groups')
        draft.bulk_send = draft_data.get('bulk_send', 0)
        draft.bulk_permission = draft_data.get('bulk_permission')
    else:
        # Create new
        draft = MessageDraft(user_id=current_user.id, **draft_data)
        db.add(draft)
    
    db.commit()
    db.refresh(draft)
    return draft


@router.get("/draft", response_model=DraftResponse)
async def get_draft(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current draft"""
    draft = db.query(MessageDraft).filter(
        MessageDraft.user_id == current_user.id
    ).first()
    if not draft:
        raise HTTPException(status_code=404, detail="No draft found")
    return draft


@router.delete("/draft")
async def clear_draft(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear the draft"""
    draft = db.query(MessageDraft).filter(
        MessageDraft.user_id == current_user.id
    ).first()
    if draft:
        db.delete(draft)
        db.commit()
    return {"success": True, "message": "Draft cleared"}


# ============================================
# TEMPLATE ENDPOINTS
# ============================================

@router.post("/", response_model=TemplateResponse)
async def create_template(
    template_data: TemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new message template"""
    template = MessageTemplate(
        name=template_data.name,
        text=template_data.text,
        link=template_data.link,
        media_id=template_data.media_id,
        category=template_data.category,
        user_id=current_user.id
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/", response_model=List[TemplateResponse])
async def list_templates(
    category: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all templates, optionally filtered by category"""
    query = db.query(MessageTemplate).filter(
        MessageTemplate.user_id == current_user.id
    )
    if category:
        query = query.filter(MessageTemplate.category == category)
    templates = query.order_by(MessageTemplate.created_at.desc()).all()
    return templates


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific template"""
    template = db.query(MessageTemplate).filter(
        MessageTemplate.user_id == current_user.id,
        MessageTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int,
    template_data: TemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a template"""
    template = db.query(MessageTemplate).filter(
        MessageTemplate.user_id == current_user.id,
        MessageTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    if template_data.name is not None:
        template.name = template_data.name
    if template_data.text is not None:
        template.text = template_data.text
    if template_data.link is not None:
        template.link = template_data.link
    if template_data.media_id is not None:
        template.media_id = template_data.media_id
    if template_data.category is not None:
        template.category = template_data.category
    
    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a template"""
    template = db.query(MessageTemplate).filter(
        MessageTemplate.user_id == current_user.id,
        MessageTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db.delete(template)
    db.commit()
    return {"success": True, "message": "Template deleted"}
