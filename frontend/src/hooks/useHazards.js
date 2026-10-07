import { useEffect, useRef, useState } from "react";
import { fetchNearbyHazards } from "../api.js";
import { haversineM } from "../lib/geo.js";

export default function useHazards(pos, { enabled, radiusM = 1000 } = {}) {
  const [hazards, setHazards] = useState([]);
  const lastFetchRef = useRef({ ts: 0, lat: null, lng: null });

  useEffect(() => {
    if (!enabled || !pos) return undefined;
    const now = Date.now();
    const prev = lastFetchRef.current;
    const moved =
      prev.lat == null ? Infinity : haversineM(pos, { lat: prev.lat, lng: prev.lng });
    if (now - prev.ts < 10000 && moved < 150) return undefined;

    let cancelled = false;
    lastFetchRef.current = { ts: now, lat: pos.lat, lng: pos.lng };
    fetchNearbyHazards({ lat: pos.lat, lng: pos.lng, radius_m: radiusM })
      .then((data) => {
        if (!cancelled) setHazards(data.hazards || []);
      })
      .catch((err) => console.warn("nearby hazards", err));
    return () => {
      cancelled = true;
    };
  }, [enabled, pos, radiusM]);

  return hazards;
}
