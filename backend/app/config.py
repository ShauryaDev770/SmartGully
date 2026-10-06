import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv():
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./smartgully.db")
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))
if not UPLOAD_DIR.is_absolute():
    UPLOAD_DIR = BACKEND_DIR / UPLOAD_DIR
YOLO_WEIGHTS = Path(os.getenv("YOLO_WEIGHTS", "models/pothole.pt"))
if not YOLO_WEIGHTS.is_absolute():
    YOLO_WEIGHTS = BACKEND_DIR / YOLO_WEIGHTS
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
USE_DUMMY_AI = os.getenv("USE_DUMMY_AI", "1") == "1"

MAX_IMAGE_BYTES = 8 * 1024 * 1024
INDIA_LAT_MIN, INDIA_LAT_MAX = 6.0, 37.0
INDIA_LNG_MIN, INDIA_LNG_MAX = 68.0, 98.0
UPLOADS_PER_HOUR = int(os.getenv("UPLOADS_PER_HOUR", "60"))
GEOJSON_DEFAULT_LIMIT = 1000
GEOJSON_DEFAULT_CATEGORIES = ("red", "yellow")

THRESH = {
    "road": 0.5,
    "pothole_min": 0.30,
    "pothole_strong": 0.55,
    "area_red": 0.05,
    "count_red": 2,
    "ai_suspect": 0.6,
    "acc_max": 100,
}

CLIP_MODEL = "openai/clip-vit-base-patch32"
AI_GEN_MODEL = "umm-maybe/AI-image-detector"
CLIP_PROMPTS = [
    "a photo of a road",
    "a photo of a road with a pothole",
    "a selfie",
    "a screenshot",
    "an indoor photo",
    "a photo of an animal or object",
]
ROAD_PROMPT_COUNT = 2
YOLO_COUNT_CONF = 0.30
PHASH_HAMMING_MAX = 5
EDITED_EXIF_BUMP = 0.2
RATE_WINDOW_SECONDS = 3600
