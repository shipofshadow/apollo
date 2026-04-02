from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from time_utils import now_utc8

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{session_id}", response_model=schemas.UserSessionOut)
def get_user_session(session_id: str, db: Session = Depends(get_db)):
    user_session = db.query(models.UserSession).filter_by(session_id=session_id).first()
    if not user_session:
        raise HTTPException(status_code=404, detail="User session not found.")
    return user_session


@router.post("", response_model=schemas.UserSessionOut, status_code=201)
def upsert_user_session(payload: schemas.UserSessionCreate, db: Session = Depends(get_db)):
    user_session = db.query(models.UserSession).filter_by(session_id=payload.session_id).first()

    if user_session:
        user_session.variables_json = payload.variables_json
        user_session.current_node_id = payload.current_node_id
        user_session.conversation_id = payload.conversation_id
        user_session.updated_at = now_utc8()
    else:
        user_session = models.UserSession(**payload.model_dump())
        db.add(user_session)

    db.commit()
    db.refresh(user_session)
    return user_session
