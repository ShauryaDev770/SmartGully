export const HAZARD_LABELS = {
  pothole: "Pothole",
  broken_road: "Broken road",
  speed_bump: "Speed bump",
  rough_patch: "Rough patch",
};

export const HAZARD_ICONS = {
  pothole: "🕳️",
  broken_road: "🚧",
  speed_bump: "🛑",
  rough_patch: "⚠️",
};

export function hazardLabel(type) {
  return HAZARD_LABELS[type] || "Pothole";
}

export function hazardIcon(type) {
  return HAZARD_ICONS[type] || "⚠️";
}

function toRad(d) {
  return (d * Math.PI) / 180;
}

function toDeg(r) {
  return (r * 180) / Math.PI;
}

export function haversineM(a, b) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bearingDeg(a, b) {
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function angleDiffDeg(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function isAhead(heading, from, to, maxDeg = 60) {
  if (heading == null || Number.isNaN(heading)) return true;
  return angleDiffDeg(heading, bearingDeg(from, to)) <= maxDeg;
}

export function deriveMotion(curr, prev, lastHeading) {
  const dist = prev ? haversineM(prev, curr) : 0;
  const dt = prev && curr.ts > prev.ts ? (curr.ts - prev.ts) / 1000 : 0;
  let heading = lastHeading;
  if (typeof curr.rawHeading === "number" && !Number.isNaN(curr.rawHeading)) {
    heading = curr.rawHeading;
  } else if (prev && dist >= 5) {
    heading = bearingDeg(prev, curr);
  }
  let speedKmh = 0;
  if (typeof curr.rawSpeed === "number" && !Number.isNaN(curr.rawSpeed)) {
    speedKmh = curr.rawSpeed * 3.6;
  } else if (dt > 0) {
    speedKmh = (dist / dt) * 3.6;
  }
  return {
    lat: curr.lat,
    lng: curr.lng,
    accuracy: curr.accuracy ?? null,
    heading,
    speedKmh,
    ts: curr.ts,
  };
}
