from collections import defaultdict, deque
from datetime import datetime, timezone
from time import time
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import (
    GEOJSON_DEFAULT_CATEGORIES,
    GEOJSON_DEFAULT_LIMIT,
    INDIA_LAT_MAX,
    INDIA_LAT_MIN,
    INDIA_LNG_MAX,
    INDIA_LNG_MIN,
    MAX_IMAGE_BYTES,
    RATE_WINDOW_SECONDS,
    UPLOAD_DIR,
    UPLOADS_PER_HOUR,
)
from app.db import get_db
from app.geo import heat_weight
from app.models import Report
from app.schemas import ConfirmResponse, GoneResponse, ReportCreateResponse, ReportOut

router = APIRouter()
_ip_hits: dict[str, deque] = defaultdict(deque)

ALLOWED_TYPES = {"image/jpeg", "image/jpg", "image/png"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png"}


def cluster_key(lat: float, lng: float) -> str:
    return f"{round(lat, 4)}_{round(lng, 4)}"


def image_url(image_path: str) -> str:
    name = image_path.replace("\\", "/").split("/")[-1]
    return f"/uploads/{name}"


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _rate_limit(ip: str) -> None:
    now = time()
    hits = _ip_hits[ip]
    while hits and now - hits[0] > RATE_WINDOW_SECONDS:
        hits.popleft()
    if len(hits) >= UPLOADS_PER_HOUR:
        raise HTTPException(status_code=429, detail="Too many uploads from this IP. Try again later.")
    hits.append(now)


def _validate_coords(lat: float, lng: float) -> None:
    if not (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LNG_MIN <= lng <= INDIA_LNG_MAX):
        raise HTTPException(
            status_code=422,
            detail=f"Coordinates must be in India (lat {INDIA_LAT_MIN}-{INDIA_LAT_MAX}, lng {INDIA_LNG_MIN}-{INDIA_LNG_MAX}).",
        )


def _report_to_out(report: Report) -> ReportOut:
    return ReportOut(
        id=report.id,
        image_path=report.image_path,
        lat=report.lat,
        lng=report.lng,
        accuracy_m=report.accuracy_m,
        created_at=report.created_at,
        status=report.status,
        category=report.category,
        pothole_conf=report.pothole_conf,
        pothole_count=report.pothole_count,
        area_ratio=report.area_ratio,
        road_score=report.road_score,
        ai_gen_score=report.ai_gen_score,
        phash=report.phash,
        cluster_key=report.cluster_key,
        confirmations=report.confirmations,
        reason=report.reason,
        image_url=image_url(report.image_path),
        hazard_type=report.hazard_type,
        source=report.source or "manual",
        is_demo=bool(report.is_demo),
        gone_count=report.gone_count or 0,
    )


@router.post("/reports", status_code=201, response_model=ReportCreateResponse)
async def create_report(
    request: Request,
    db: Session = Depends(get_db),
    image: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    accuracy_m: float | None = Form(default=None),
    source: str = Form(default="manual"),
):
    src = (source or "manual").strip().lower()
    if src not in {"manual", "auto", "bump"}:
        raise HTTPException(status_code=422, detail="source must be manual, auto, or bump.")
    if src == "manual":
        _rate_limit(_client_ip(request))
    _validate_coords(lat, lng)

    content_type = (image.content_type or "").lower()
    filename = (image.filename or "upload.jpg").lower()
    ext = "." + filename.rsplit(".", 1)[-1] if "." in filename else ""
    if content_type not in ALLOWED_TYPES and ext not in ALLOWED_EXT:
        raise HTTPException(status_code=422, detail="Image must be jpeg or png.")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty image file.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=422, detail="Image must be at most 8 MB.")

    report_id = str(uuid4())
    save_ext = ".png" if ext == ".png" or content_type == "image/png" else ".jpg"
    relative = f"uploads/{report_id}{save_ext}"
    dest = UPLOAD_DIR / f"{report_id}{save_ext}"
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)

    report = Report(
        id=report_id,
        image_path=relative,
        lat=lat,
        lng=lng,
        accuracy_m=accuracy_m,
        created_at=datetime.now(timezone.utc),
        status="pending",
        cluster_key=cluster_key(lat, lng),
        confirmations=0,
        source=src,
        is_demo=0,
        gone_count=0,
        hazard_type="speed_bump" if src == "bump" else None,
    )
    db.add(report)
    db.commit()
    return ReportCreateResponse(id=report_id, status="pending")


@router.get("/reports")
def list_reports(
    db: Session = Depends(get_db),
    category: str = "red,yellow",
    status: str = "processed",
    bbox: str | None = None,
    limit: int = GEOJSON_DEFAULT_LIMIT,
):
    cats = [c.strip() for c in category.split(",") if c.strip()]
    if not cats:
        cats = list(GEOJSON_DEFAULT_CATEGORIES)
    if limit < 1 or limit > 5000:
        raise HTTPException(status_code=422, detail="limit must be between 1 and 5000.")

    stmt = select(Report)
    if status == "all":
        stmt = stmt.where((Report.category.in_(cats)) | (Report.category.is_(None)))
    elif status:
        if status == "pending":
            stmt = stmt.where(Report.status == "pending")
        else:
            stmt = stmt.where(Report.status == status, Report.category.in_(cats))

    if bbox:
        parts = [p.strip() for p in bbox.split(",")]
        if len(parts) != 4:
            raise HTTPException(status_code=422, detail="bbox must be minLng,minLat,maxLng,maxLat.")
        try:
            min_lng, min_lat, max_lng, max_lat = (float(p) for p in parts)
        except ValueError:
            raise HTTPException(status_code=422, detail="bbox values must be numbers.")
        stmt = stmt.where(
            Report.lng >= min_lng,
            Report.lng <= max_lng,
            Report.lat >= min_lat,
            Report.lat <= max_lat,
        )
    stmt = stmt.order_by(Report.created_at.desc()).limit(limit)
    rows = db.scalars(stmt).all()

    features = []
    for report in rows:
        features.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [report.lng, report.lat]},
                "properties": {
                    "id": report.id,
                    "status": report.status,
                    "category": report.category,
                    "reason": report.reason,
                    "created_at": report.created_at.isoformat() if report.created_at else None,
                    "confirmations": report.confirmations,
                    "image_url": image_url(report.image_path),
                    "weight": heat_weight(report.category, report.confirmations, report.hazard_type),
                    "hazard_type": report.hazard_type or "pothole",
                    "source": report.source or "manual",
                    "is_demo": bool(report.is_demo),
                    "pothole_conf": report.pothole_conf,
                    "pothole_count": report.pothole_count,
                    "area_ratio": report.area_ratio,
                    "road_score": report.road_score,
                    "ai_gen_score": report.ai_gen_score,
                },
            }
        )
    return JSONResponse({"type": "FeatureCollection", "features": features})


@router.get("/reports/{report_id}", response_model=ReportOut)
def get_report(report_id: str, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    return _report_to_out(report)


@router.post("/reports/{report_id}/confirm", response_model=ConfirmResponse)
def confirm_report(report_id: str, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.confirmations = (report.confirmations or 0) + 1
    db.commit()
    db.refresh(report)
    return ConfirmResponse(id=report.id, confirmations=report.confirmations)


@router.post("/reports/{report_id}/gone", response_model=GoneResponse)
def mark_gone(report_id: str, db: Session = Depends(get_db)):
    report = db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found.")
    report.gone_count = (report.gone_count or 0) + 1
    repaired = report.gone_count >= 2
    if repaired:
        report.status = "repaired"
    db.commit()
    db.refresh(report)
    return GoneResponse(id=report.id, gone_count=report.gone_count, repaired=repaired)
