from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.geo import bbox_for_radius, haversine_m
from app.models import Report

router = APIRouter()


@router.get("/hazards/nearby")
def nearby_hazards(
    lat: float = Query(...),
    lng: float = Query(...),
    radius_m: float = Query(1000, ge=50, le=5000),
    db: Session = Depends(get_db),
):
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise HTTPException(status_code=422, detail="Invalid coordinates.")
    min_lng, min_lat, max_lng, max_lat = bbox_for_radius(lat, lng, radius_m)
    rows = db.scalars(
        select(Report).where(
            Report.status == "processed",
            Report.category.in_(("red", "yellow")),
            Report.lat >= min_lat,
            Report.lat <= max_lat,
            Report.lng >= min_lng,
            Report.lng <= max_lng,
        )
    ).all()
    out = []
    for r in rows:
        if (r.gone_count or 0) >= 2:
            continue
        dist = haversine_m(lat, lng, r.lat, r.lng)
        if dist > radius_m:
            continue
        out.append(
            {
                "id": r.id,
                "lat": r.lat,
                "lng": r.lng,
                "category": r.category,
                "hazard_type": r.hazard_type or "pothole",
                "distance_m": round(dist),
                "confirmations": r.confirmations or 0,
                "is_demo": bool(r.is_demo),
                "reason": r.reason,
            }
        )
    out.sort(key=lambda h: h["distance_m"])
    return {"hazards": out}
