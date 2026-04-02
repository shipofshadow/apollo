from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from time_utils import now_utc8

router = APIRouter(prefix="/handoff", tags=["handoff"])


@router.post("/{session_id}", response_model=schemas.HandoffOut)
def toggle_handoff(session_id: str, db: Session = Depends(get_db)):
    """Toggle a conversation between bot and human mode."""
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if conversation.status == "bot":
        conversation.status = "human"
        message = "Conversation handed off to human agent."
    elif conversation.status == "human":
        conversation.status = "bot"
        message = "Conversation returned to bot."
    elif conversation.status == "closed":
        raise HTTPException(
            status_code=400,
            detail="Cannot toggle handoff on a closed conversation.",
        )
    else:
        raise HTTPException(status_code=400, detail="Unknown conversation status.")

    conversation.updated_at = now_utc8()
    db.commit()

    return schemas.HandoffOut(
        session_id=session_id,
        status=conversation.status,
        message=message,
    )


@router.get("/pending", response_model=List[schemas.ConversationOut])
def get_pending_handoffs(db: Session = Depends(get_db)):
    """Return all conversations currently waiting for a human agent."""
    return (
        db.query(models.Conversation)
        .filter_by(status="human")
        .order_by(models.Conversation.updated_at.asc())
        .all()
    )
