from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, Date, ForeignKey
)
from sqlalchemy.dialects.mysql import INTEGER as _MUINT
from sqlalchemy.orm import relationship
from database import Base, MySQLMixin
from time_utils import now_utc8


def _now():
    return now_utc8()


class Conversation(MySQLMixin, Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), unique=True, index=True, nullable=False)
    status = Column(String(20), default="bot", nullable=False)  # bot | human | closed
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    user_session = relationship("UserSession", back_populates="conversation", uselist=False, cascade="all, delete-orphan")


class Message(MySQLMixin, Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender = Column(String(20), nullable=False)          # user | bot | human
    content = Column(Text, nullable=False)
    message_type = Column(String(30), default="text", nullable=False)  # text | quick_reply | card | button
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class Flow(MySQLMixin, Base):
    __tablename__ = "flows"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    flow_json = Column(Text, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)


class UserSession(MySQLMixin, Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), unique=True, index=True, nullable=False)
    variables_json = Column(Text, default="{}", nullable=False)
    current_node_id = Column(String(200), nullable=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    conversation = relationship("Conversation", back_populates="user_session")


class Service(MySQLMixin, Base):
    """Mirrors the production MariaDB `services` table."""
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    slug = Column(String(255), nullable=False, default="")
    description = Column(Text, nullable=False, default="")
    full_description = Column(Text, nullable=False, default="")
    icon = Column(String(50), nullable=False, default="Wrench")
    image_url = Column(String(500), nullable=False, default="")
    duration = Column(String(80), nullable=False, default="")
    starting_price = Column(String(80), nullable=False, default="")
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)

    variants = relationship("ServiceVariant", back_populates="service", cascade="all, delete-orphan")


class ServiceVariant(MySQLMixin, Base):
    """Mirrors the production MariaDB `service_variations` table."""
    __tablename__ = "service_variations"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    price = Column(String(100), nullable=False, default="")
    images = Column(Text, nullable=False, default="[]")
    specs = Column(Text, nullable=False, default="[]")
    colors = Column(Text, nullable=False, default="[]")
    color_images = Column(Text, nullable=False, default="{}")
    sort_order = Column(Integer, nullable=False, default=0)

    service = relationship("Service", back_populates="variants")


class CustomerProfile(MySQLMixin, Base):
    __tablename__ = "customer_profiles"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), unique=True, index=True, nullable=False)
    name = Column(String(200), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(30), nullable=True)
    vehicle_make = Column(String(100), nullable=True)
    vehicle_model = Column(String(100), nullable=True)
    vehicle_year = Column(String(10), nullable=True)
    vehicle_info = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)


class ConversationPresence(MySQLMixin, Base):
    __tablename__ = "conversation_presence"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), unique=True, index=True, nullable=False)
    customer_typing = Column(Boolean, default=False, nullable=False)
    agent_typing = Column(Boolean, default=False, nullable=False)
    customer_last_read_at = Column(DateTime, nullable=True)
    agent_last_read_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)


class ServiceAvailabilityRule(MySQLMixin, Base):
    __tablename__ = "service_availability_rules"

    id = Column(Integer, primary_key=True, index=True)
    service_id = Column(_MUINT(unsigned=True), ForeignKey("services.id"), nullable=False, index=True)
    day_of_week = Column(Integer, nullable=True)  # 0=Monday ... 6=Sunday
    start_hour = Column(Integer, nullable=True)   # 0-23
    end_hour = Column(Integer, nullable=True)     # 0-23
    is_available = Column(Boolean, default=True, nullable=False)
    note = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)


class AppointmentActionRequest(MySQLMixin, Base):
    __tablename__ = "appointment_action_requests"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(128), index=True, nullable=False)
    action = Column(String(30), nullable=False)  # reschedule | cancel
    requested_date = Column(String(20), nullable=True)
    requested_time = Column(String(20), nullable=True)
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending", nullable=False)  # pending | processed | rejected
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)


class TeamMember(MySQLMixin, Base):
    __tablename__ = "team_members"

    id = Column(_MUINT(unsigned=True), primary_key=True, index=True)
    user_id = Column(_MUINT(unsigned=True), nullable=True)
    name = Column(String(200), nullable=False)
    role = Column(String(200), nullable=False, default="")
    image_url = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    full_bio = Column(Text, nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    facebook = Column(String(500), nullable=True)
    instagram = Column(String(500), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=_now, nullable=False)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)


class Booking(MySQLMixin, Base):
    __tablename__ = "bookings"

    id = Column(String(36), primary_key=True, index=True)
    reference_number = Column(String(20), nullable=True, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(30), nullable=False, index=True)
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    internal_notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=_now, onupdate=_now, nullable=False)
