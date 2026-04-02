import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db


def _first_image(images_json: Optional[str]) -> Optional[str]:
    """Return the first URL from a JSON image array, or None."""
    try:
        imgs = json.loads(images_json or "[]")
        return imgs[0] if imgs else None
    except (json.JSONDecodeError, IndexError, TypeError):
        return None

router = APIRouter(prefix="/api/manychat", tags=["manychat"])


def _build_gallery(elements: list[schemas.ManyChatElement]) -> schemas.ManyChatGalleryResponse:
    return schemas.ManyChatGalleryResponse(
        version="v2",
        content=schemas.ManyChatGalleryContent(
            type="gallery",
            elements=elements,
        ),
    )


@router.get("/menu", response_model=schemas.ManyChatGalleryResponse)
def get_menu(db: Session = Depends(get_db)) -> schemas.ManyChatGalleryResponse:
    """Tier 1: Fetches parent services and formats them as a ManyChat Gallery."""
    services = db.query(models.Service).filter(models.Service.is_active.is_(True)).all()

    elements = [
        schemas.ManyChatElement(
            title=svc.title,
            image_url=svc.image_url or None,
            subtitle=svc.description or None,
            buttons=[
                schemas.ManyChatButton(
                    type="node",
                    caption="View Options",
                    target="Drill Down Trigger",
                    payload=json.dumps({"service_id": svc.id, "serviceId": svc.id}),
                )
            ],
        )
        for svc in services
    ]

    return _build_gallery(elements)


@router.post("/variants", response_model=schemas.ManyChatGalleryResponse)
def get_variants(
    body: schemas.VariantsRequest, db: Session = Depends(get_db)
) -> schemas.ManyChatGalleryResponse:
    """Tier 2: Fetches variants for a service and formats them as a ManyChat Gallery."""
    service = db.query(models.Service).filter(models.Service.id == body.service_id).first()
    if service is None:
        raise HTTPException(status_code=404, detail="Service not found")

    variants = (
        db.query(models.ServiceVariant)
        .filter(
            models.ServiceVariant.service_id == body.service_id,
        )
        .order_by(models.ServiceVariant.sort_order)
        .all()
    )

    elements = [
        schemas.ManyChatElement(
            title=v.name,
            image_url=_first_image(v.images),
            subtitle=v.description or None,
            buttons=[
                schemas.ManyChatButton(
                    type="node",
                    caption="Book Now",
                    target="Booking Trigger",
                    payload=json.dumps(
                        {
                            "service_id": service.id,
                            "serviceId": service.id,
                            "variant_id": v.id,
                            "variationId": v.id,
                            "variationName": v.title,
                        }
                    ),
                )
            ],
        )
        for v in variants
    ]

    return _build_gallery(elements)
