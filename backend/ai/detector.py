from ultralytics import YOLO

from app.config import YOLO_COUNT_CONF, YOLO_WEIGHTS

_model = YOLO(str(YOLO_WEIGHTS))


def detect(image_path: str) -> dict:
    results = _model(image_path, verbose=False)
    if not results:
        return {"pothole_conf": 0.0, "pothole_count": 0, "area_ratio": 0.0}

    result = results[0]
    boxes = result.boxes
    if boxes is None or len(boxes) == 0:
        return {"pothole_conf": 0.0, "pothole_count": 0, "area_ratio": 0.0}

    confs = [float(c) for c in boxes.conf]
    pothole_conf = max(confs) if confs else 0.0
    pothole_count = sum(1 for c in confs if c >= YOLO_COUNT_CONF)

    img_h, img_w = result.orig_shape[:2]
    img_area = max(img_h * img_w, 1)
    areas = []
    xyxy = boxes.xyxy
    for i in range(len(xyxy)):
        x1, y1, x2, y2 = (float(v) for v in xyxy[i])
        areas.append(max(0.0, (x2 - x1) * (y2 - y1)))
    area_ratio = (max(areas) / img_area) if areas else 0.0
    return {
        "pothole_conf": pothole_conf,
        "pothole_count": pothole_count,
        "area_ratio": area_ratio,
    }
