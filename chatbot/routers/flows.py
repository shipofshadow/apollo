import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from engine.flow_validation import validate_flow_json_text
from time_utils import now_utc8

router = APIRouter(prefix="/flows", tags=["flows"])


@router.get("", response_model=List[schemas.FlowOut])
def list_flows(db: Session = Depends(get_db)):
    return db.query(models.Flow).order_by(models.Flow.created_at.desc()).all()


@router.post("", response_model=schemas.FlowOut, status_code=201)
def create_flow(payload: schemas.FlowCreate, db: Session = Depends(get_db)):
    # Validate that flow_json is valid JSON
    try:
        json.loads(payload.flow_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid flow_json: {exc}")

    flow_errors = validate_flow_json_text(payload.flow_json)
    if flow_errors:
        raise HTTPException(status_code=422, detail={"message": "Flow validation failed.", "errors": flow_errors})

    # If this new flow is active, deactivate all others
    if payload.is_active:
        db.query(models.Flow).update(
            {"is_active": False, "updated_at": now_utc8()},
            synchronize_session="fetch",
        )

    flow = models.Flow(**payload.model_dump())
    db.add(flow)
    db.commit()
    db.refresh(flow)
    return flow


@router.get("/{flow_id}", response_model=schemas.FlowOut)
def get_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(models.Flow).filter_by(id=flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found.")
    return flow


@router.put("/{flow_id}", response_model=schemas.FlowOut)
def update_flow(flow_id: int, payload: schemas.FlowUpdate, db: Session = Depends(get_db)):
    flow = db.query(models.Flow).filter_by(id=flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found.")

    update_data = payload.model_dump(exclude_unset=True)

    if "flow_json" in update_data:
        try:
            json.loads(update_data["flow_json"])
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid flow_json: {exc}")
        flow_errors = validate_flow_json_text(update_data["flow_json"])
        if flow_errors:
            raise HTTPException(status_code=422, detail={"message": "Flow validation failed.", "errors": flow_errors})

    if update_data.get("is_active"):
        db.query(models.Flow).filter(models.Flow.id != flow_id).update(
            {"is_active": False, "updated_at": now_utc8()},
            synchronize_session="fetch",
        )

    for field, value in update_data.items():
        setattr(flow, field, value)

    flow.updated_at = now_utc8()
    db.commit()
    db.refresh(flow)
    return flow


@router.delete("/{flow_id}", status_code=204)
def delete_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(models.Flow).filter_by(id=flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found.")
    db.delete(flow)
    db.commit()


@router.post("/{flow_id}/activate", response_model=schemas.FlowOut)
def activate_flow(flow_id: int, db: Session = Depends(get_db)):
    flow = db.query(models.Flow).filter_by(id=flow_id).first()
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found.")

    # Deactivate all other flows
    db.query(models.Flow).filter(models.Flow.id != flow_id).update(
        {"is_active": False, "updated_at": now_utc8()},
        synchronize_session="fetch",
    )
    flow.is_active = True
    flow.updated_at = now_utc8()
    db.commit()
    db.refresh(flow)
    return flow
