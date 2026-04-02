import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from auth import require_admin
from database import get_db
from time_utils import now_utc8

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _admin_user_id(payload: dict) -> int:
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(status_code=401, detail="Invalid token payload.")
    try:
        return int(str(raw_sub))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid token subject.") from exc


def _default_settings() -> schemas.AdminSettingsOut:
    return schemas.AdminSettingsOut(
        agent_color="#fdba74",
        sound_enabled=False,
        send_on_enter=True,
        polling_interval=3000,
        admin_kb_text="",
        updated_at=None,
    )


def _ensure_conversation(session_id: str, db: Session) -> models.Conversation:
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if conversation:
        return conversation

    conversation = models.Conversation(session_id=session_id, status="bot")
    db.add(conversation)
    db.flush()
    return conversation


def _ensure_user_session(
    session_id: str,
    conversation: models.Conversation,
    db: Session,
) -> models.UserSession:
    user_session = db.query(models.UserSession).filter_by(session_id=session_id).first()
    if user_session:
        return user_session

    user_session = models.UserSession(
        session_id=session_id,
        variables_json="{}",
        current_node_id=None,
        conversation_id=conversation.id,
    )
    db.add(user_session)
    db.flush()
    return user_session


@router.get("/conversations", response_model=List[schemas.ConversationSummary])
def list_conversations(db: Session = Depends(get_db)):
    conversations = (
        db.query(models.Conversation)
        .order_by(models.Conversation.updated_at.desc())
        .all()
    )
    results = []
    for conv in conversations:
        last_msg = (
            db.query(models.Message)
            .filter_by(conversation_id=conv.id)
            .order_by(models.Message.created_at.desc())
            .first()
        )
        results.append(
            schemas.ConversationSummary(
                id=conv.id,
                session_id=conv.session_id,
                status=conv.status,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at if last_msg else None,
            )
        )
    return results


@router.get("/team-members", response_model=List[schemas.TeamMemberOut])
def list_team_members(db: Session = Depends(get_db)):
    members = (
        db.query(models.TeamMember)
        .filter(models.TeamMember.is_active.is_(True))
        .order_by(models.TeamMember.sort_order.asc(), models.TeamMember.name.asc())
        .all()
    )
    return members


@router.get("/conversations/{session_id}", response_model=schemas.ConversationDetail)
def get_conversation(session_id: str, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation


@router.delete("/conversations/{session_id}", response_model=schemas.DeleteConversationOut)
def delete_conversation(session_id: str, db: Session = Depends(get_db)):
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    db.delete(conversation)
    db.commit()
    return schemas.DeleteConversationOut(
        session_id=session_id,
        message="Conversation deleted.",
    )


@router.post("/reply/{session_id}", response_model=schemas.MessageOut, status_code=201)
def human_reply(
    session_id: str,
    payload: schemas.AdminReply,
    db: Session = Depends(get_db),
):
    """Send a message as a human agent into a conversation."""
    conversation = _ensure_conversation(session_id, db)

    if conversation.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot reply to a closed conversation.")

    agent_name = (payload.agent_name or "").strip() or "Admin"

    metadata = {
        "agent_name": agent_name,
    }
    if payload.agent_id is not None:
        metadata["agent_id"] = payload.agent_id

    msg = models.Message(
        conversation_id=conversation.id,
        sender="human",
        content=payload.message,
        message_type="text",
        metadata_json=json.dumps(metadata),
    )
    db.add(msg)
    conversation.status = "human"
    conversation.updated_at = now_utc8()
    db.commit()
    db.refresh(msg)

    return msg


@router.post("/takeover/{session_id}", response_model=schemas.ConversationOut)
def takeover(session_id: str, db: Session = Depends(get_db)):
    """Admin takes over a conversation, switching it to human mode."""
    conversation = _ensure_conversation(session_id, db)

    if conversation.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot take over a closed conversation.")
    if conversation.status == "human":
        return conversation

    conversation.status = "human"
    conversation.updated_at = now_utc8()
    db.commit()
    db.refresh(conversation)
    return conversation


@router.post("/release/{session_id}", response_model=schemas.ConversationOut)
def release(session_id: str, db: Session = Depends(get_db)):
    """Release a conversation back to the bot."""
    conversation = _ensure_conversation(session_id, db)

    if conversation.status == "closed":
        raise HTTPException(status_code=400, detail="Cannot release a closed conversation.")
    if conversation.status == "bot":
        return conversation

    conversation.status = "bot"
    conversation.updated_at = now_utc8()

    # Reset the user session node so the bot re-greets
    user_session = _ensure_user_session(session_id, conversation, db)
    user_session.current_node_id = None
    user_session.updated_at = now_utc8()

    db.commit()
    db.refresh(conversation)
    return conversation


@router.post("/close/{session_id}", response_model=schemas.ConversationOut)
def close_conversation(session_id: str, db: Session = Depends(get_db)):
    """Close a conversation and reset flow progress for this session."""
    conversation = db.query(models.Conversation).filter_by(session_id=session_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    if conversation.status == "closed":
        return conversation

    user_session = db.query(models.UserSession).filter_by(session_id=session_id).first()
    if user_session:
        user_session.current_node_id = None
        user_session.variables_json = "{}"
        user_session.updated_at = now_utc8()

    conversation.status = "closed"
    conversation.updated_at = now_utc8()
    db.commit()
    db.refresh(conversation)
    return conversation


@router.get("/settings", response_model=schemas.AdminSettingsOut)
def get_admin_settings(
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user_id = _admin_user_id(payload)
    settings = db.query(models.ChatbotAdminSettings).filter_by(user_id=user_id).first()
    ai_settings = db.query(models.ChatbotAISettings).filter_by(user_id=user_id).first()
    if not settings:
        defaults = _default_settings()
        if ai_settings and ai_settings.admin_kb_text:
            defaults.admin_kb_text = ai_settings.admin_kb_text
            defaults.updated_at = ai_settings.updated_at
        return defaults

    return schemas.AdminSettingsOut(
        agent_color=settings.agent_color,
        sound_enabled=settings.sound_enabled,
        send_on_enter=settings.send_on_enter,
        polling_interval=settings.polling_interval,
        admin_kb_text=ai_settings.admin_kb_text if ai_settings else "",
        updated_at=max(
            [t for t in [settings.updated_at, ai_settings.updated_at if ai_settings else None] if t is not None],
            default=settings.updated_at,
        ),
    )


@router.put("/settings", response_model=schemas.AdminSettingsOut)
def upsert_admin_settings(
    body: schemas.AdminSettingsUpdate,
    payload: dict = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user_id = _admin_user_id(payload)
    settings = db.query(models.ChatbotAdminSettings).filter_by(user_id=user_id).first()
    ai_settings = db.query(models.ChatbotAISettings).filter_by(user_id=user_id).first()
    if not settings:
        defaults = _default_settings()
        settings = models.ChatbotAdminSettings(
            user_id=user_id,
            agent_color=defaults.agent_color,
            sound_enabled=defaults.sound_enabled,
            send_on_enter=defaults.send_on_enter,
            polling_interval=defaults.polling_interval,
        )
        db.add(settings)
        db.flush()

    if not ai_settings:
        ai_settings = models.ChatbotAISettings(user_id=user_id, admin_kb_text="")
        db.add(ai_settings)
        db.flush()

    if body.agent_color is not None:
        value = body.agent_color.strip()
        if value != "":
            settings.agent_color = value

    if body.sound_enabled is not None:
        settings.sound_enabled = bool(body.sound_enabled)

    if body.send_on_enter is not None:
        settings.send_on_enter = bool(body.send_on_enter)

    if body.polling_interval is not None:
        settings.polling_interval = int(body.polling_interval)

    if body.admin_kb_text is not None:
        ai_settings.admin_kb_text = body.admin_kb_text.strip()

    ai_settings.updated_at = now_utc8()

    settings.updated_at = now_utc8()
    db.commit()
    db.refresh(settings)
    db.refresh(ai_settings)

    return schemas.AdminSettingsOut(
        agent_color=settings.agent_color,
        sound_enabled=settings.sound_enabled,
        send_on_enter=settings.send_on_enter,
        polling_interval=settings.polling_interval,
        admin_kb_text=ai_settings.admin_kb_text,
        updated_at=max(
            [t for t in [settings.updated_at, ai_settings.updated_at] if t is not None],
            default=settings.updated_at,
        ),
    )


