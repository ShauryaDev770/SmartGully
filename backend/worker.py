import logging
import sys
import time
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select

from ai.pipeline import process_report
from app.config import BACKEND_DIR as APP_BACKEND_DIR
from app.db import SessionLocal
from app.models import Report

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("smartgully.worker")


def _image_abs(image_path: str) -> Path:
    p = Path(image_path)
    if p.is_absolute():
        return p
    return APP_BACKEND_DIR / image_path


def run_once(db) -> bool:
    report = db.scalars(select(Report).where(Report.status == "pending").limit(1)).first()
    if not report:
        return False
    report.status = "processing"
    db.commit()
    try:
        hashes = list(
            db.scalars(
                select(Report.phash).where(
                    Report.phash.is_not(None),
                    Report.id != report.id,
                )
            )
        )
        result = process_report(
            _image_abs(report.image_path),
            report.lat,
            report.lng,
            report.accuracy_m,
            hashes,
            source=report.source or "manual",
        )
        if result["category"] == "green" and (report.source or "manual") == "auto":
            img = _image_abs(report.image_path)
            try:
                if img.exists():
                    img.unlink()
            except OSError:
                pass
            db.delete(report)
            db.commit()
            log.info("deleted green auto frame %s", report.id)
            return True
        report.category = result["category"]
        report.pothole_conf = result["pothole_conf"]
        report.pothole_count = result["pothole_count"]
        report.area_ratio = result["area_ratio"]
        report.road_score = result["road_score"]
        report.ai_gen_score = result["ai_gen_score"]
        report.phash = result["phash"]
        report.reason = result["reason"]
        report.hazard_type = result.get("hazard_type")
        report.status = "processed"
        db.commit()
        log.info("processed %s -> %s %s (%s)", report.id, report.category, report.hazard_type, report.reason)
    except Exception:
        log.exception("failed to process %s", report.id)
        report.status = "failed"
        db.commit()
    return True


def main():
    log.info("worker started")
    while True:
        db = SessionLocal()
        try:
            worked = run_once(db)
        finally:
            db.close()
        if not worked:
            time.sleep(3)


if __name__ == "__main__":
    main()
