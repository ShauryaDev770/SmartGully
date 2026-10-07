import { useEffect, useRef, useState } from "react";
import { deriveMotion, haversineM } from "../lib/geo.js";

// Interpolates points along route geometry to produce smooth road-aligned steps
function resamplePoints(rawPoints, stepM = 12) {
  if (!rawPoints || rawPoints.length < 2) return [];
  const normalized = rawPoints.map((p) =>
    Array.isArray(p) ? { lat: p[0], lng: p[1] } : { lat: p.lat, lng: p.lng }
  );

  const samples = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    const p1 = normalized[i];
    const p2 = normalized[i + 1];
    const dist = haversineM(p1, p2);
    const steps = Math.max(1, Math.round(dist / stepM));
    for (let s = 0; s < steps; s++) {
      const frac = s / steps;
      samples.push({
        lat: p1.lat + frac * (p2.lat - p1.lat),
        lng: p1.lng + frac * (p2.lng - p1.lng),
      });
    }
  }
  samples.push(normalized[normalized.length - 1]);
  return samples;
}

export default function useGps({ enabled, sim, routePoints }) {
  const [fix, setFix] = useState(null);
  const lastRef = useRef(null);
  const headingRef = useRef(null);
  const watchRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setFix(null);
      lastRef.current = null;
      return undefined;
    }

    const push = (raw) => {
      const derived = deriveMotion(raw, lastRef.current, headingRef.current);
      lastRef.current = derived;
      headingRef.current = derived.heading;
      setFix(derived);
    };

    if (sim) {
      let cancelled = false;
      let i = 0;

      const runTrack = (pts, interval = 1000) => {
        if (!pts || !pts.length) return;
        const tick = () => {
          if (cancelled || !pts.length) return;
          const p = pts[Math.min(i, pts.length - 1)];
          push({
            lat: p.lat,
            lng: p.lng,
            accuracy: 5,
            rawHeading: null,
            rawSpeed: null,
            ts: Date.now(),
          });
          if (i < pts.length - 1) {
            i += 1;
            timerRef.current = setTimeout(tick, interval);
          }
        };
        tick();
      };

      // 1. If routePoints provided from active route planner, smoothly drive along exact road geometry
      if (routePoints && routePoints.length >= 2) {
        const sampled = resamplePoints(routePoints, 12);
        runTrack(sampled, 900);
      } else {
        // 2. Otherwise load road-aligned demo track
        (async () => {
          try {
            const res = await fetch("/demo_track.json");
            const track = await res.json();
            if (!cancelled) {
              runTrack(track.points || [], track.interval_ms || 1000);
            }
          } catch (err) {
            console.error("demo track failed", err);
          }
        })();
      }

      return () => {
        cancelled = true;
        clearTimeout(timerRef.current);
      };
    }

    if (!("geolocation" in navigator)) return undefined;
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const c = pos.coords;
        push({
          lat: c.latitude,
          lng: c.longitude,
          accuracy: c.accuracy,
          rawHeading: c.heading,
          rawSpeed: c.speed,
          ts: pos.timestamp || Date.now(),
        });
      },
      (err) => console.warn("geolocation", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
    };
  }, [enabled, sim, routePoints]);

  return fix;
}
