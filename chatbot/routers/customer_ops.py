from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from time_utils import now_utc8

router = APIRouter(prefix="/customer", tags=["customer-ops"])


def _find_booking_for_action(
    session_id: str,
    payload: schemas.AppointmentActionCreate,
    db: Session,
) -> models.Booking | None:
    if payload.booking_id:
        return db.query(models.Booking).filter_by(id=payload.booking_id).first()

    if payload.reference_number:
        booking = db.query(models.Booking).filter_by(reference_number=payload.reference_number).first()
        if booking:
            return booking

    profile = db.query(models.CustomerProfile).filter_by(session_id=session_id).first()
    if not profile:
        return None

    q = db.query(models.Booking)
    if profile.email:
        q = q.filter(models.Booking.email == profile.email)
    if profile.phone:
        q = q.filter(models.Booking.phone == profile.phone)

    return q.order_by(models.Booking.updated_at.desc()).first()


def _ensure_presence(session_id: str, db: Session) -> models.ConversationPresence:
    presence = db.query(models.ConversationPresence).filter_by(session_id=session_id).first()
    if presence:
        return presence

    presence = models.ConversationPresence(
        session_id=session_id,
        customer_typing=False,
        agent_typing=False,
    )
    db.add(presence)
    db.flush()
    return presence


@router.get("/profile/{session_id}", response_model=schemas.CustomerProfileOut)
def get_profile(session_id: str, db: Session = Depends(get_db)):
    profile = db.query(models.CustomerProfile).filter_by(session_id=session_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found.")
    return schemas.CustomerProfileOut(
        session_id=profile.session_id,
        name=profile.name,
        email=profile.email,
        phone=profile.phone,
        vehicle_make=profile.vehicle_make,
        vehicle_model=profile.vehicle_model,
        vehicle_year=profile.vehicle_year,
        vehicle_info=profile.vehicle_info,
        updated_at=profile.updated_at,
    )


@router.put("/profile/{session_id}", response_model=schemas.CustomerProfileOut)
def upsert_profile(
    session_id: str,
    payload: schemas.CustomerProfileUpsert,
    db: Session = Depends(get_db),
):
    profile = db.query(models.CustomerProfile).filter_by(session_id=session_id).first()
    if not profile:
        profile = models.CustomerProfile(session_id=session_id)
        db.add(profile)

    profile.name = payload.name
    profile.email = payload.email
    profile.phone = payload.phone
    profile.vehicle_make = payload.vehicle_make
    profile.vehicle_model = payload.vehicle_model
    profile.vehicle_year = payload.vehicle_year
    profile.vehicle_info = payload.vehicle_info
    profile.updated_at = now_utc8()

    db.commit()
    db.refresh(profile)

    return schemas.CustomerProfileOut(
        session_id=profile.session_id,
        name=profile.name,
        email=profile.email,
        phone=profile.phone,
        vehicle_make=profile.vehicle_make,
        vehicle_model=profile.vehicle_model,
        vehicle_year=profile.vehicle_year,
        vehicle_info=profile.vehicle_info,
        updated_at=profile.updated_at,
    )


@router.post("/presence/{session_id}", response_model=schemas.PresenceOut)
def set_presence(
    session_id: str,
    payload: schemas.PresenceUpdate,
    db: Session = Depends(get_db),
):
    presence = _ensure_presence(session_id, db)

    if payload.actor == "customer":
        presence.customer_typing = payload.typing
    else:
        presence.agent_typing = payload.typing

    presence.updated_at = now_utc8()
    db.commit()
    db.refresh(presence)

    return schemas.PresenceOut(
        session_id=presence.session_id,
        customer_typing=presence.customer_typing,
        agent_typing=presence.agent_typing,
        customer_last_read_at=presence.customer_last_read_at,
        agent_last_read_at=presence.agent_last_read_at,
        updated_at=presence.updated_at,
    )


@router.post("/read/{session_id}", response_model=schemas.PresenceOut)
def mark_read(
    session_id: str,
    payload: schemas.PresenceReadUpdate,
    db: Session = Depends(get_db),
):
    presence = _ensure_presence(session_id, db)
    now = now_utc8()

    if payload.actor == "customer":
        presence.customer_last_read_at = now
    else:
        presence.agent_last_read_at = now

    presence.updated_at = now
    db.commit()
    db.refresh(presence)

    return schemas.PresenceOut(
        session_id=presence.session_id,
        customer_typing=presence.customer_typing,
        agent_typing=presence.agent_typing,
        customer_last_read_at=presence.customer_last_read_at,
        agent_last_read_at=presence.agent_last_read_at,
        updated_at=presence.updated_at,
    )


@router.get("/presence/{session_id}", response_model=schemas.PresenceOut)
def get_presence(session_id: str, db: Session = Depends(get_db)):
    presence = _ensure_presence(session_id, db)
    return schemas.PresenceOut(
        session_id=presence.session_id,
        customer_typing=presence.customer_typing,
        agent_typing=presence.agent_typing,
        customer_last_read_at=presence.customer_last_read_at,
        agent_last_read_at=presence.agent_last_read_at,
        updated_at=presence.updated_at,
    )


@router.get("/service-availability/{service_id}", response_model=schemas.ServiceAvailabilityOut)
def get_service_availability(service_id: int, db: Session = Depends(get_db)):
    rules: List[models.ServiceAvailabilityRule] = (
        db.query(models.ServiceAvailabilityRule)
        .filter_by(service_id=service_id)
        .order_by(models.ServiceAvailabilityRule.created_at.asc())
        .all()
    )

    now = now_utc8()
    day = now.weekday()
    hour = now.hour

    is_available_now = True
    if rules:
        matched = [
            r
            for r in rules
            if (r.day_of_week is None or r.day_of_week == day)
            and (r.start_hour is None or hour >= r.start_hour)
            and (r.end_hour is None or hour <= r.end_hour)
        ]
        if matched:
            is_available_now = all(r.is_available for r in matched)

    return schemas.ServiceAvailabilityOut(
        service_id=service_id,
        is_available_now=is_available_now,
        rules=[
            schemas.ServiceAvailabilityRuleOut(
                service_id=r.service_id,
                day_of_week=r.day_of_week,
                start_hour=r.start_hour,
                end_hour=r.end_hour,
                is_available=r.is_available,
                note=r.note,
            )
            for r in rules
        ],
    )


@router.post("/appointment/{session_id}/reschedule", response_model=schemas.AppointmentActionOut)
def request_reschedule(
    session_id: str,
    payload: schemas.AppointmentActionCreate,
    db: Session = Depends(get_db),
):
    if not payload.requested_date or not payload.requested_time:
        raise HTTPException(status_code=422, detail="requested_date and requested_time are required.")

    booking = _find_booking_for_action(session_id, payload, db)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found. Provide booking_id/reference_number or ensure profile email/phone matches.",
        )

    if booking.status in ("cancelled", "completed"):
        raise HTTPException(status_code=400, detail=f"Cannot reschedule booking with status '{booking.status}'.")

    try:
        booking.appointment_date = datetime.strptime(payload.requested_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="requested_date must be in YYYY-MM-DD format.")

    booking.appointment_time = payload.requested_time
    if booking.status == "awaiting_parts":
        booking.status = "confirmed"

    if payload.reason:
        note = f"[Reschedule request] {payload.reason.strip()}"
        booking.internal_notes = f"{booking.internal_notes}\n{note}" if booking.internal_notes else note

    booking.updated_at = now_utc8()

    req = models.AppointmentActionRequest(
        session_id=session_id,
        action="reschedule",
        requested_date=payload.requested_date,
        requested_time=payload.requested_time,
        reason=payload.reason,
        status="processed",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return schemas.AppointmentActionOut(
        id=req.id,
        session_id=req.session_id,
        action="reschedule",
        requested_date=req.requested_date,
        requested_time=req.requested_time,
        reason=req.reason,
        status=req.status,
        created_at=req.created_at,
    )


@router.post("/appointment/{session_id}/cancel", response_model=schemas.AppointmentActionOut)
def request_cancel(
    session_id: str,
    payload: schemas.AppointmentActionCreate,
    db: Session = Depends(get_db),
):
    booking = _find_booking_for_action(session_id, payload, db)
    if not booking:
        raise HTTPException(
            status_code=404,
            detail="Booking not found. Provide booking_id/reference_number or ensure profile email/phone matches.",
        )

    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Booking is already cancelled.")
    if booking.status == "completed":
        raise HTTPException(status_code=400, detail="Completed bookings cannot be cancelled.")

    booking.status = "cancelled"
    if payload.reason:
        note = f"[Cancel request] {payload.reason.strip()}"
        booking.internal_notes = f"{booking.internal_notes}\n{note}" if booking.internal_notes else note
    booking.updated_at = now_utc8()

    req = models.AppointmentActionRequest(
        session_id=session_id,
        action="cancel",
        requested_date=payload.requested_date,
        requested_time=payload.requested_time,
        reason=payload.reason,
        status="processed",
    )
    db.add(req)
    db.commit()
    db.refresh(req)

    return schemas.AppointmentActionOut(
        id=req.id,
        session_id=req.session_id,
        action="cancel",
        requested_date=req.requested_date,
        requested_time=req.requested_time,
        reason=req.reason,
        status=req.status,
        created_at=req.created_at,
    )


@router.get("/appointment/{session_id}/actions", response_model=List[schemas.AppointmentActionOut])
def list_appointment_actions(
    session_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    actions = (
        db.query(models.AppointmentActionRequest)
        .filter_by(session_id=session_id)
        .order_by(models.AppointmentActionRequest.created_at.desc())
        .limit(limit)
        .all()
    )

    return [
        schemas.AppointmentActionOut(
            id=a.id,
            session_id=a.session_id,
            action=a.action,
            requested_date=a.requested_date,
            requested_time=a.requested_time,
            reason=a.reason,
            status=a.status,
            created_at=a.created_at,
        )
        for a in actions
    ]
