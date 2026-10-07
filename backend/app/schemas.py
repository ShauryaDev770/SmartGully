from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    ok: bool = True


class ReportCreateResponse(BaseModel):
    id: str
    status: str


class ReportOut(BaseModel):
    id: str
    image_path: str
    lat: float
    lng: float
    accuracy_m: float | None
    created_at: datetime
    status: str
    category: str | None
    pothole_conf: float | None
    pothole_count: int | None
    area_ratio: float | None
    road_score: float | None
    ai_gen_score: float | None
    phash: str | None
    cluster_key: str
    confirmations: int
    reason: str | None
    image_url: str
    hazard_type: str | None = None
    source: str = "manual"
    is_demo: bool = False
    gone_count: int = 0

    class Config:
        from_attributes = True


class ClusterCount(BaseModel):
    cluster_key: str
    count: int


class StatsResponse(BaseModel):
    total: int
    red: int
    yellow: int
    green: int
    pending: int
    top_clusters: list[ClusterCount] = Field(default_factory=list)


class ConfirmResponse(BaseModel):
    id: str
    confirmations: int


class GoneResponse(BaseModel):
    id: str
    gone_count: int
    repaired: bool
