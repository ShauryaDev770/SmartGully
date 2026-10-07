import json
from urllib.error import URLError
from urllib.request import urlopen

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.geo import bbox_for_radius, haversine_m, heat_weight, sample_polyline
from app.models import Report

router = APIRouter()
OSRM = "https://router.project-osrm.org/route/v1/driving"
CORRIDOR_M = 30.0


class LatLng(BaseModel):
    lat: float
    lng: float


class CompareBody(BaseModel):
    origin: LatLng = Field(alias="from")
    dest: LatLng = Field(alias="to")

    class Config:
        populate_by_name = True


def _osrm_routes(origin: LatLng, dest: LatLng) -> list[dict]:
    coords = f"{origin.lng},{origin.lat};{dest.lng},{dest.lat}"
    url = f"{OSRM}/{coords}?overview=full&geometries=geojson&alternatives=true"
    try:
        with urlopen(url, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=f"Routing service unavailable: {exc}") from exc
    if data.get("code") != "Ok" or not data.get("routes"):
        raise HTTPException(status_code=422, detail="No driving route found between these points.")
    return data["routes"]


def _load_hazards(db: Session, origin: LatLng, dest: LatLng) -> list[Report]:
    mid_lat = (origin.lat + dest.lat) / 2
    mid_lng = (origin.lng + dest.lng) / 2
    span = haversine_m(origin.lat, origin.lng, dest.lat, dest.lng)
    radius = max(2000.0, span / 2 + 1500.0)
    min_lng, min_lat, max_lng, max_lat = bbox_for_radius(mid_lat, mid_lng, radius)
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
    return [r for r in rows if (r.gone_count or 0) < 2]


def _score_route(geometry_coords: list[list[float]], hazards: list[Report]) -> dict:
    samples = sample_polyline(geometry_coords, 40.0)
    hit_ids = set()
    penalty = 0.0
    counts = {"red": 0, "yellow": 0, "total": 0}
    demo = False
    for hz in hazards:
        if hz.id in hit_ids:
            continue
        for lat, lng in samples:
            if haversine_m(lat, lng, hz.lat, hz.lng) <= CORRIDOR_M:
                hit_ids.add(hz.id)
                penalty += heat_weight(hz.category, hz.confirmations, hz.hazard_type)
                if hz.category == "red":
                    counts["red"] += 1
                else:
                    counts["yellow"] += 1
                counts["total"] += 1
                if hz.is_demo:
                    demo = True
                break
    return {"penalty": round(penalty, 2), "counts": counts, "has_demo": demo}


@router.post("/routes/compare")
def compare_routes(body: CompareBody, db: Session = Depends(get_db)):
    routes = _osrm_routes(body.origin, body.dest)
    hazards = _load_hazards(db, body.origin, body.dest)
    scored = []
    for r in routes:
        geom = r["geometry"]["coordinates"]
        info = _score_route(geom, hazards)
        scored.append(
            {
                "duration_s": round(r["duration"]),
                "distance_m": round(r["distance"]),
                "geometry": r["geometry"],
                **info,
            }
        )
    fastest = min(scored, key=lambda x: x["duration_s"])
    smoothest = min(scored, key=lambda x: (x["penalty"], x["duration_s"]))
    extra_s = max(0, smoothest["duration_s"] - fastest["duration_s"])
    avoided = max(0, fastest["counts"]["total"] - smoothest["counts"]["total"])
    return {
        "fastest": fastest,
        "smoothest": smoothest,
        "summary": {
            "avoided_hazards": avoided,
            "extra_seconds": extra_s,
            "extra_minutes": round(extra_s / 60, 1),
            "has_demo": fastest["has_demo"] or smoothest["has_demo"],
        },
    }
