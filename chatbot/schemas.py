from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Message schemas
# ---------------------------------------------------------------------------

class MessageBase(BaseModel):
    sender: Literal["user", "bot", "human"]
    content: str = Field(min_length=0, max_length=4000)
    message_type: Literal["text", "quick_reply", "card", "button"] = "text"
    metadata_json: Optional[str] = None


class MessageCreate(MessageBase):
    conversation_id: int


class MessageOut(MessageBase):
    id: int
    conversation_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Conversation schemas
# ---------------------------------------------------------------------------

class ConversationOut(BaseModel):
    id: int
    session_id: str = Field(min_length=1, max_length=128)
    status: Literal["bot", "human", "closed"]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationOut):
    messages: List[MessageOut] = []


# ---------------------------------------------------------------------------
# Flow schemas
# ---------------------------------------------------------------------------

class FlowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    flow_json: str
    is_active: bool = False


class FlowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    flow_json: Optional[str] = None
    is_active: Optional[bool] = None


class FlowOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    flow_json: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# User session schemas
# ---------------------------------------------------------------------------

class UserSessionCreate(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    variables_json: str = "{}"
    current_node_id: Optional[str] = None
    conversation_id: int


class UserSessionOut(BaseModel):
    id: int
    session_id: str
    variables_json: str
    current_node_id: Optional[str]
    conversation_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Chat schemas
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    message: str = Field(default="", min_length=0, max_length=2000)
    message_type: Literal["text", "start"] = "text"
    display_message: Optional[str] = Field(default=None, max_length=2000)


class BotResponseMessage(BaseModel):
    content: str = Field(min_length=0, max_length=4000)
    message_type: Literal["text", "quick_reply", "card", "button"] = "text"
    metadata: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    messages: List[BotResponseMessage]
    status: Literal["bot", "human", "closed"]
    session_id: str


class NewConversationRequest(BaseModel):
    session_id: Optional[str] = Field(default=None, min_length=1, max_length=128)


class NewConversationResponse(BaseModel):
    session_id: str
    status: Literal["bot"]
    reset: bool


class ChatStateOut(BaseModel):
    session_id: str
    status: Literal["bot", "human", "closed"]
    updated_at: datetime


# ---------------------------------------------------------------------------
# Admin schemas
# ---------------------------------------------------------------------------

class AdminReply(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    agent_id: Optional[int] = None
    agent_name: Optional[str] = Field(default=None, min_length=1, max_length=80)


class ConversationSummary(BaseModel):
    id: int
    session_id: str
    status: Literal["bot", "human", "closed"]
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None
    last_message_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class DeleteConversationOut(BaseModel):
    session_id: str
    message: str


class TeamMemberOut(BaseModel):
    id: int
    name: str
    role: Optional[str] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Handoff schemas
# ---------------------------------------------------------------------------

class HandoffOut(BaseModel):
    session_id: str
    status: str
    message: str


# ---------------------------------------------------------------------------
# ManyChat gallery schemas
# ---------------------------------------------------------------------------

class ManyChatButton(BaseModel):
    type: str
    caption: str
    target: str
    payload: str


class ManyChatElement(BaseModel):
    title: str
    image_url: Optional[str]
    subtitle: Optional[str]
    buttons: List[ManyChatButton]


class ManyChatGalleryContent(BaseModel):
    type: str = "gallery"
    elements: List[ManyChatElement]


class ManyChatGalleryResponse(BaseModel):
    version: str = "v2"
    content: ManyChatGalleryContent


class VariantsRequest(BaseModel):
    service_id: int


# ---------------------------------------------------------------------------
# Customer ops (Phase 2)
# ---------------------------------------------------------------------------

class CustomerProfileUpsert(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    vehicle_make: Optional[str] = None
    vehicle_model: Optional[str] = None
    vehicle_year: Optional[str] = None
    vehicle_info: Optional[str] = None


class CustomerProfileOut(CustomerProfileUpsert):
    session_id: str
    updated_at: datetime


class PresenceUpdate(BaseModel):
    actor: Literal["customer", "agent"]
    typing: bool


class PresenceReadUpdate(BaseModel):
    actor: Literal["customer", "agent"]


class PresenceOut(BaseModel):
    session_id: str
    customer_typing: bool
    agent_typing: bool
    customer_last_read_at: Optional[datetime] = None
    agent_last_read_at: Optional[datetime] = None
    updated_at: datetime


class ServiceAvailabilityRuleOut(BaseModel):
    service_id: int
    day_of_week: Optional[int] = None
    start_hour: Optional[int] = None
    end_hour: Optional[int] = None
    is_available: bool
    note: Optional[str] = None


class ServiceAvailabilityOut(BaseModel):
    service_id: int
    is_available_now: bool
    rules: List[ServiceAvailabilityRuleOut]


class AppointmentActionCreate(BaseModel):
    booking_id: Optional[str] = None
    reference_number: Optional[str] = None
    requested_date: Optional[str] = None
    requested_time: Optional[str] = None
    reason: Optional[str] = None


class AppointmentActionOut(BaseModel):
    id: int
    session_id: str
    action: Literal["reschedule", "cancel"]
    requested_date: Optional[str] = None
    requested_time: Optional[str] = None
    reason: Optional[str] = None
    status: str
    created_at: datetime
