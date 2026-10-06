from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow():
    return datetime.now(timezone.utc)


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    image_path: Mapped[str] = mapped_column(String, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    accuracy_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    pothole_conf: Mapped[float | None] = mapped_column(Float, nullable=True)
    pothole_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    area_ratio: Mapped[float | None] = mapped_column(Float, nullable=True)
    road_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_gen_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    phash: Mapped[str | None] = mapped_column(String, nullable=True)
    cluster_key: Mapped[str] = mapped_column(String, nullable=False)
    confirmations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    reason: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        Index("ix_reports_status", "status"),
        Index("ix_reports_category", "category"),
        Index("ix_reports_cluster_key", "cluster_key"),
    )
