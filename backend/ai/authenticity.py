from PIL import Image, ExifTags
from transformers import pipeline as hf_pipeline
import imagehash

from app.config import AI_GEN_MODEL, EDITED_EXIF_BUMP, PHASH_HAMMING_MAX

_classifier = hf_pipeline("image-classification", model=AI_GEN_MODEL)

_EDIT_HINTS = ("photoshop", "gimp", "lightroom", "snapseed", "picsart", "canva", "midjourney", "dall")


def _exif_software(img: Image.Image) -> str:
    try:
        exif = img.getexif()
        if not exif:
            return ""
        for tag_id, value in exif.items():
            name = ExifTags.TAGS.get(tag_id, "")
            if name == "Software":
                return str(value).lower()
    except Exception:
        return ""
    return ""


def analyse(image_path: str, existing_phashes: list[str]) -> dict:
    img = Image.open(image_path).convert("RGB")
    phash = str(imagehash.phash(img))
    current = imagehash.hex_to_hash(phash)
    is_duplicate = False
    for other in existing_phashes:
        if not other:
            continue
        try:
            dist = current - imagehash.hex_to_hash(other)
        except Exception:
            continue
        if dist <= PHASH_HAMMING_MAX:
            is_duplicate = True
            break

    ai_gen_score = 0.0
    try:
        preds = _classifier(img)
        for pred in preds:
            label = str(pred.get("label", "")).lower()
            if "ai" in label or "fake" in label or "generated" in label or "synthetic" in label:
                ai_gen_score = max(ai_gen_score, float(pred.get("score", 0.0)))
    except Exception:
        ai_gen_score = 0.0

    software = _exif_software(img)
    if software and any(hint in software for hint in _EDIT_HINTS):
        ai_gen_score = min(1.0, ai_gen_score + EDITED_EXIF_BUMP)

    return {
        "phash": phash,
        "is_duplicate": is_duplicate,
        "ai_gen_score": ai_gen_score,
    }
