from fastapi import APIRouter, HTTPException, Query
import httpx
from pydantic import BaseModel

from app.config import (
    INDIA_LAT_MAX,
    INDIA_LAT_MIN,
    INDIA_LNG_MAX,
    INDIA_LNG_MIN,
)

router = APIRouter()


class GeocodeItem(BaseModel):
    lat: float
    lng: float
    display_name: str
    type: str | None = None
    importance: float | None = None


@router.get("/geocode", response_model=list[GeocodeItem])
async def geocode(
    address: str | None = Query(default=None),
    city: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    parts = []
    if q and q.strip():
        parts.append(q.strip())
    else:
        if address and address.strip():
            parts.append(address.strip())
        if city and city.strip():
            parts.append(city.strip())

    if not parts:
        raise HTTPException(status_code=400, detail="Please provide an address or city to geocode.")

    search_query = ", ".join(parts)
    if "india" not in search_query.lower():
        search_query += ", India"

    headers = {
        "User-Agent": "SmartGully/1.0 (civic-road-app; contact: support@smartgully.local)"
    }
    params = {
        "q": search_query,
        "format": "json",
        "limit": 5,
        "countrycodes": "in",
        "addressdetails": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params=params,
                headers=headers,
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail="Upstream geocoding service error.")
            data = resp.json()
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to reach geocoding service: {str(exc)}")

    results = []
    for item in data:
        try:
            lat = float(item["lat"])
            lng = float(item["lon"])
            if INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LNG_MIN <= lng <= INDIA_LNG_MAX:
                results.append(
                    GeocodeItem(
                        lat=lat,
                        lng=lng,
                        display_name=item.get("display_name", ""),
                        type=item.get("type"),
                        importance=item.get("importance"),
                    )
                )
        except (ValueError, KeyError):
            continue

    return results
