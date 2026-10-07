import random
from pathlib import Path

from PIL import Image
import imagehash

from app.config import PHASH_HAMMING_MAX, USE_DUMMY_AI
from ai.rules import decide, decide_v2
from ai.vlm import get_vlm_opinion


def _check_duplicate(phash_str: str, existing_phashes: list[str]) -> bool:
    try:
        current = imagehash.hex_to_hash(phash_str)
    except Exception:
        return False
    for other in existing_phashes:
        if not other:
            continue
        try:
            dist = current - imagehash.hex_to_hash(other)
            if dist <= PHASH_HAMMING_MAX:
                return True
        except Exception:
            continue
    return False


def _compute_phash(path: Path) -> str:
    try:
        img = Image.open(path).convert("RGB")
        return str(imagehash.phash(img))
    except Exception:
        return "0000000000000000"


def _dummy_result(accuracy_m, is_duplicate: bool = False) -> dict:
    if is_duplicate:
        return {
            "category": "green",
            "pothole_conf": 0.0,
            "pothole_count": 0,
            "area_ratio": 0.0,
            "road_score": 0.8,
            "ai_gen_score": 0.0,
            "phash": None,
            "reason": "Duplicate of an existing image",
        }

    category = random.choice(["red", "yellow", "green"])
    reasons = {
        "red": "2 pothole(s), covers 8% of frame",
        "yellow": "Needs review: low detection confidence",
        "green": "No pothole detected",
    }
    return {
        "category": category,
        "pothole_conf": 0.72 if category == "red" else (0.41 if category == "yellow" else 0.12),
        "pothole_count": 2 if category == "red" else (1 if category == "yellow" else 0),
        "area_ratio": 0.08 if category == "red" else (0.02 if category == "yellow" else 0.0),
        "road_score": 0.81 if category != "green" else 0.22,
        "ai_gen_score": 0.1,
        "phash": None,
        "reason": reasons[category],
        "hazard_type": None if category == "green" else ("pothole" if category == "red" else random.choice(["rough_patch", "pothole", "speed_bump"])),
    }


def process_report(image_path, lat, lng, accuracy_m, existing_phashes, source="manual") -> dict:
    path = Path(image_path)
    if source == "bump":
        calc_phash = _compute_phash(path) if path.exists() else "bump"
        return {
            "category": "yellow",
            "pothole_conf": 0.0,
            "pothole_count": 0,
            "area_ratio": 0.0,
            "road_score": 0.8,
            "ai_gen_score": 0.0,
            "phash": calc_phash,
            "reason": "Motion bump detected",
            "hazard_type": "speed_bump",
        }
    if USE_DUMMY_AI or not path.exists():
        calc_phash = _compute_phash(path) if path.exists() else "dummy"
        is_dup = _check_duplicate(calc_phash, existing_phashes or [])
        result = _dummy_result(accuracy_m, is_duplicate=is_dup)
        result["phash"] = calc_phash
        if result["category"] == "yellow":
            vlm_text = get_vlm_opinion(str(path))
            if vlm_text:
                result["reason"] = f"{result['reason']} | VLM: {vlm_text}"
        return result

    from ai.authenticity import analyse
    from ai.clip_gate import road_score
    from ai.detector import detect

    road = road_score(str(path))
    det = detect(str(path))
    auth = analyse(str(path), existing_phashes or [])
    category, reason, hazard_type = decide_v2(
        road,
        det["pothole_conf"],
        det["pothole_count"],
        det["area_ratio"],
        auth["ai_gen_score"],
        auth["is_duplicate"],
        accuracy_m,
        source=source,
    )
    if category == "yellow":
        vlm_text = get_vlm_opinion(str(path))
        if vlm_text:
            reason = f"{reason} | VLM: {vlm_text}"

    return {
        "category": category,
        "pothole_conf": det["pothole_conf"],
        "pothole_count": det["pothole_count"],
        "area_ratio": det["area_ratio"],
        "road_score": road,
        "ai_gen_score": auth["ai_gen_score"],
        "phash": auth["phash"],
        "reason": reason,
        "hazard_type": hazard_type,
    }
