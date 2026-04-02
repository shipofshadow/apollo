import json
import logging
from uuid import uuid4
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from engine import flow_engine
from time_utils import now_utc8

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

_PROFILE_FIELDS = [
    "name",
    "email",
    "phone",
    "vehicle_make",
    "vehicle_model",
    "vehicle_year",
    "vehicle_info",
]


def _get_or_create_conversation(session_id: str, db: Session) -> models.Conversation:
    conv = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conv:
        conv = models.Conversation(session_id=session_id, status="bot")
        db.add(conv)
        db.flush()
    return conv


def _get_or_create_user_session(
    session_id: str, conversation: models.Conversation, db: Session
) -> models.UserSession:
    us = db.query(models.UserSession).filter_by(session_id=session_id).first()
    if not us:
        us = models.UserSession(
            session_id=session_id,
            variables_json="{}",
            current_node_id=None,
            conversation_id=conversation.id,
        )
        db.add(us)
        db.flush()
    return us


def _reset_session_data(session_id: str, db: Session) -> bool:
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        return False

    db.query(models.Message).filter_by(conversation_id=conversation.id).delete(synchronize_session=False)

    user_session = db.query(models.UserSession).filter_by(session_id=session_id).first()
    if user_session:
        user_session.variables_json = "{}"
        user_session.current_node_id = None
        user_session.conversation_id = conversation.id
        user_session.updated_at = now_utc8()
    else:
        user_session = models.UserSession(
            session_id=session_id,
            variables_json="{}",
            current_node_id=None,
            conversation_id=conversation.id,
        )
        db.add(user_session)

    db.query(models.CustomerProfile).filter_by(session_id=session_id).delete(synchronize_session=False)
    db.query(models.ConversationPresence).filter_by(session_id=session_id).delete(synchronize_session=False)
    db.query(models.AppointmentActionRequest).filter_by(session_id=session_id).delete(synchronize_session=False)

    conversation.status = "bot"
    conversation.updated_at = now_utc8()
    return True


def _save_message(
    conversation_id: int,
    sender: str,
    content: str,
    message_type: str = "text",
    metadata: dict = None,
    db: Session = None,
) -> models.Message:
    msg = models.Message(
        conversation_id=conversation_id,
        sender=sender,
        content=content,
        message_type=message_type,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(msg)
    return msg


def _merge_profile_memory(variables: dict, session_id: str, db: Session) -> dict:
    profile = db.query(models.CustomerProfile).filter_by(session_id=session_id).first()
    if not profile:
        return variables

    merged = dict(variables)
    for field in _PROFILE_FIELDS:
        if not merged.get(field):
            value = getattr(profile, field)
            if value:
                merged[field] = value
    return merged


def _persist_profile_memory(variables: dict, session_id: str, db: Session) -> None:
    has_any = any(str(variables.get(field, "")).strip() for field in _PROFILE_FIELDS)
    if not has_any:
        return

    profile = db.query(models.CustomerProfile).filter_by(session_id=session_id).first()
    if not profile:
        profile = models.CustomerProfile(session_id=session_id)
        db.add(profile)

    for field in _PROFILE_FIELDS:
        value = variables.get(field)
        if value not in (None, ""):
            setattr(profile, field, str(value))

    profile.updated_at = now_utc8()


@router.post("/send", response_model=schemas.ChatResponse)
def send_message(payload: schemas.ChatMessage, db: Session = Depends(get_db)):
    try:
        is_start_message = payload.message_type == "start"
        if not is_start_message and not payload.message.strip():
            raise HTTPException(status_code=422, detail="Message cannot be empty.")

        conversation = _get_or_create_conversation(payload.session_id, db)
        user_session = _get_or_create_user_session(payload.session_id, conversation, db)

        # Persist only real user-entered messages, not bootstrap/start events.
        if not is_start_message:
            persisted_user_content = (payload.display_message or payload.message).strip()
            _save_message(
                conversation_id=conversation.id,
                sender="user",
                content=persisted_user_content,
                message_type="text",
                db=db,
            )

        # If conversation is under human control, don't run flow engine
        if conversation.status == "human":
            db.commit()
            return schemas.ChatResponse(
                messages=[
                    schemas.BotResponseMessage(
                        content="A human agent will be with you shortly.",
                        message_type="text",
                    )
                ],
                status="human",
                session_id=payload.session_id,
            )

        if conversation.status == "closed":
            db.commit()
            return schemas.ChatResponse(
                messages=[
                    schemas.BotResponseMessage(
                        content="This conversation is closed. Start a new chat to continue.",
                        message_type="text",
                    )
                ],
                status="closed",
                session_id=payload.session_id,
            )

        # Load active flow
        active_flow = db.query(models.Flow).filter_by(is_active=True).first()
        if not active_flow:
            db.commit()
            return schemas.ChatResponse(
                messages=[
                    schemas.BotResponseMessage(
                        content="No active flow configured. Please set up a flow.",
                        message_type="text",
                    )
                ],
                status=conversation.status,
                session_id=payload.session_id,
            )

        flow_dict = json.loads(active_flow.flow_json)
        variables = json.loads(user_session.variables_json or "{}")
        variables["session_id"] = payload.session_id
        variables = _merge_profile_memory(variables, payload.session_id, db)
        current_node_id = user_session.current_node_id

        # Run the flow engine
        flow_input = "start" if is_start_message else payload.message

        response_msgs, next_node_id, updated_vars, is_handoff = flow_engine.process_message(
            flow_json=flow_dict,
            user_input=flow_input,
            current_node_id=current_node_id,
            variables=variables,
        )

        should_close = bool(updated_vars.pop("__close_conversation", False))

        # Update session state
        updated_vars["session_id"] = payload.session_id
        user_session.variables_json = json.dumps(updated_vars)
        user_session.current_node_id = next_node_id
        user_session.updated_at = now_utc8()
        _persist_profile_memory(updated_vars, payload.session_id, db)

        if is_handoff:
            conversation.status = "human"
            conversation.updated_at = now_utc8()
            handoff_msg = {
                "content": "You're being connected to a human agent. Please wait...",
                "message_type": "text",
                "metadata": None,
            }
            response_msgs.append(handoff_msg)

        if should_close:
            conversation.status = "closed"
            conversation.updated_at = now_utc8()
            user_session.current_node_id = None

        # Persist bot response messages
        for msg in response_msgs:
            _save_message(
                conversation_id=conversation.id,
                sender="bot",
                content=msg["content"],
                message_type=msg.get("message_type", "text"),
                metadata=msg.get("metadata"),
                db=db,
            )

        conversation.updated_at = now_utc8()
        db.commit()

        return schemas.ChatResponse(
            messages=[
                schemas.BotResponseMessage(
                    content=m["content"],
                    message_type=m.get("message_type", "text"),
                    metadata=m.get("metadata"),
                )
                for m in response_msgs
            ],
            status=conversation.status,
            session_id=payload.session_id,
        )

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Chat send failed for session_id=%s", payload.session_id)
        raise HTTPException(status_code=500, detail="Internal server error.")


@router.post("/new", response_model=schemas.NewConversationResponse)
def new_conversation(payload: schemas.NewConversationRequest, db: Session = Depends(get_db)):
    try:
        if payload.session_id:
            did_reset = _reset_session_data(payload.session_id, db)
            if did_reset:
                db.commit()
                return schemas.NewConversationResponse(
                    session_id=payload.session_id,
                    status="bot",
                    reset=True,
                )

        new_session_id = str(uuid4())
        conversation = models.Conversation(session_id=new_session_id, status="bot")
        db.add(conversation)
        db.flush()

        user_session = models.UserSession(
            session_id=new_session_id,
            variables_json="{}",
            current_node_id=None,
            conversation_id=conversation.id,
        )
        db.add(user_session)
        db.commit()

        return schemas.NewConversationResponse(
            session_id=new_session_id,
            status="bot",
            reset=False,
        )
    except Exception:
        db.rollback()
        logger.exception("New conversation failed for session_id=%s", payload.session_id)
        raise HTTPException(status_code=500, detail="Internal server error.")


@router.get("/history/{session_id}", response_model=List[schemas.MessageOut])
def get_history(session_id: str, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Session not found.")
    return conversation.messages


@router.get("/state/{session_id}", response_model=schemas.ChatStateOut)
def get_state(session_id: str, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Session not found.")
    return schemas.ChatStateOut(
        session_id=conversation.session_id,
        status=conversation.status,
        updated_at=conversation.updated_at,
    )
