import math

EARTH_M = 6371000.0


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_M * math.asin(min(1.0, math.sqrt(a)))


def bbox_for_radius(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    dlat = radius_m / 111320.0
    clat = math.cos(math.radians(lat))
    dlng = radius_m / (111320.0 * max(0.2, clat))
    return lng - dlng, lat - dlat, lng + dlng, lat + dlat


def heat_weight(category: str | None, confirmations: int | None, hazard_type: str | None = None) -> float:
    conf = confirmations or 0
    if hazard_type == "speed_bump":
        base = 0.5
    elif category == "red":
        base = 3.0
    elif category == "yellow":
        base = 1.0
    else:
        base = 0.5
    return min(9.0, base * (1 + 0.25 * conf))


def sample_polyline(coords: list[list[float]], step_m: float = 40.0) -> list[tuple[float, float]]:
    """GeoJSON coords are [lng, lat]. Returns [(lat, lng), ...]."""
    if not coords:
        return []
    out = [(coords[0][1], coords[0][0])]
    acc = 0.0
    for i in range(1, len(coords)):
        a_lng, a_lat = coords[i - 1]
        b_lng, b_lat = coords[i]
        seg = haversine_m(a_lat, a_lng, b_lat, b_lng)
        if seg <= 0:
            continue
        acc += seg
        while acc >= step_m:
            acc -= step_m
            out.append((b_lat, b_lng))
        out.append((b_lat, b_lng))
    return out
