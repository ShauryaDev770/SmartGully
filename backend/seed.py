import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

from PIL import Image

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import UPLOAD_DIR
from app.db import Base, SessionLocal, engine
from app.models import Report

CITIES = [
    ("Delhi", 28.6139, 77.2090),
    ("Mumbai", 19.0760, 72.8777),
    ("Bengaluru", 12.9716, 77.5946),
    ("Chennai", 13.0827, 80.2707),
    ("Kolkata", 22.5726, 88.3639),
    ("Hyderabad", 17.3850, 78.4867),
    ("Pune", 18.5204, 73.8567),
    ("Ahmedabad", 23.0225, 72.5714),
    ("Jaipur", 26.9124, 75.7873),
    ("Lucknow", 26.8467, 80.9462),
    ("Bhopal", 23.2599, 77.4126),
    ("Patna", 25.5941, 85.1376),
    ("Surat", 21.1702, 72.8311),
    ("Nagpur", 21.1458, 79.0882),
    ("Kochi", 9.9312, 76.2673),
    ("Chandigarh", 30.7333, 76.7794),
    ("Indore", 22.7196, 75.8577),
    ("Visakhapatnam", 17.6868, 83.2185),
    ("Guwahati", 26.1445, 91.7362),
    ("Thiruvananthapuram", 8.5241, 76.9366),
]

CATEGORIES = (
    ["red"] * 80
    + ["yellow"] * 70
    + ["green"] * 40
    + ["pending"] * 10
)

REASONS = {
    "red": "2 pothole(s), covers 8% of frame",
    "yellow": "Needs review: low detection confidence",
    "green": "No pothole detected",
    "pending": None,
}

COLORS = {
    "red": (180, 40, 40),
    "yellow": (200, 170, 40),
    "green": (40, 140, 70),
    "pending": (90, 90, 90),
}


def jitter(lat, lng):
    return lat + random.uniform(-0.08, 0.08), lng + random.uniform(-0.08, 0.08)


def make_image(path: Path, color):
    img = Image.new("RGB", (64, 64), color)
    img.save(path, "JPEG", quality=80)


def main():
    random.seed(42)
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    db = SessionLocal()
    existing = db.query(Report).count()
    if existing:
        print(f"Database already has {existing} reports. Delete smartgully.db to reseed.")
        db.close()
        return

    cats = CATEGORIES[:]
    random.shuffle(cats)
    now = datetime.now(timezone.utc)
    for i, category in enumerate(cats):
        city, base_lat, base_lng = CITIES[i % len(CITIES)]
        lat, lng = jitter(base_lat, base_lng)
        report_id = str(uuid4())
        rel = f"uploads/{report_id}.jpg"
        make_image(UPLOAD_DIR / f"{report_id}.jpg", COLORS[category])
        status = "pending" if category == "pending" else "processed"
        db.add(
            Report(
                id=report_id,
                image_path=rel,
                lat=lat,
                lng=lng,
                accuracy_m=round(random.uniform(5, 40), 1),
                created_at=now - timedelta(hours=random.randint(1, 240)),
                status=status,
                category=None if status == "pending" else category,
                pothole_conf=0.7 if category == "red" else (0.4 if category == "yellow" else 0.1),
                pothole_count=2 if category == "red" else (1 if category == "yellow" else 0),
                area_ratio=0.08 if category == "red" else 0.02,
                road_score=0.8 if category != "green" else 0.2,
                ai_gen_score=0.1,
                phash=f"seed{i:04d}",
                cluster_key=f"{round(lat, 4)}_{round(lng, 4)}",
                confirmations=random.randint(0, 6) if category == "red" else random.randint(0, 2),
                reason=None if status == "pending" else f"[demo {city}] {REASONS[category]}",
            )
        )
    db.commit()
    db.close()
    print(f"Seeded {len(cats)} demo reports.")


if __name__ == "__main__":
    main()
