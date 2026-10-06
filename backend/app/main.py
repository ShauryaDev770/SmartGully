from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import FRONTEND_ORIGIN, UPLOAD_DIR
from app.db import Base, engine
from app.models import Report  # noqa: F401
from app.routes.reports import router as reports_router
from app.routes.stats import router as stats_router
from app.routes.geocode import router as geocode_router
from app.schemas import HealthResponse

app = FastAPI(title="SmartGully")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
Base.metadata.create_all(bind=engine)

app.include_router(reports_router, prefix="/api")
app.include_router(stats_router, prefix="/api")
app.include_router(geocode_router, prefix="/api")
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


@app.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(ok=True)
