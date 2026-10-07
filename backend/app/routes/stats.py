import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Report
from app.schemas import ClusterCount, StatsResponse

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).select_from(Report)) or 0
    red = db.scalar(select(func.count()).select_from(Report).where(Report.category == "red")) or 0
    yellow = db.scalar(select(func.count()).select_from(Report).where(Report.category == "yellow")) or 0
    green = db.scalar(select(func.count()).select_from(Report).where(Report.category == "green")) or 0
    pending = db.scalar(select(func.count()).select_from(Report).where(Report.status == "pending")) or 0

    cluster_rows = db.execute(
        select(Report.cluster_key, func.count().label("count"))
        .group_by(Report.cluster_key)
        .order_by(func.count().desc())
        .limit(10)
    ).all()
    top_clusters = [ClusterCount(cluster_key=row.cluster_key, count=row.count) for row in cluster_rows]
    return StatsResponse(
        total=total,
        red=red,
        yellow=yellow,
        green=green,
        pending=pending,
        top_clusters=top_clusters,
    )


@router.get("/export.csv")
def export_csv(db: Session = Depends(get_db)):
    rows = db.scalars(select(Report).where(Report.status == "processed")).all()
    buf = io.StringIO()
    fields = [
        "id",
        "lat",
        "lng",
        "accuracy_m",
        "created_at",
        "status",
        "category",
        "pothole_conf",
        "pothole_count",
        "area_ratio",
        "road_score",
        "ai_gen_score",
        "phash",
        "cluster_key",
        "confirmations",
        "reason",
        "image_path",
        "hazard_type",
        "source",
        "is_demo",
        "gone_count",
    ]
    writer = csv.DictWriter(buf, fieldnames=fields)
    writer.writeheader()
    for report in rows:
        writer.writerow({k: getattr(report, k) for k in fields})
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=smartgully-reports.csv"},
    )
