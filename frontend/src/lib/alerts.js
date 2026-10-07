import { haversineM, hazardLabel, isAhead } from "./geo.js";

export const ALERT_BANDS_M = [500, 200, 100];

export function alertKey(id, band) {
  return id + ":" + band;
}

export function speakAlert(text) {
  try {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.lang = "en-IN";
    window.speechSynthesis.speak(u);
  } catch {
    /* speech optional */
  }
}

export function vibrateAlert() {
  try {
    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
  } catch {
    /* vibration optional */
  }
}

export function sendNotification(title, body) {
  try {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "smartgully-hazard",
        renotify: true,
      });
    }
  } catch {
    /* notification optional */
  }
}

export function pickAlert(pos, hazards, spoken) {
  if (!pos || !hazards || !hazards.length) return null;
  const here = { lat: pos.lat, lng: pos.lng };
  let best = null;
  for (const hz of hazards) {
    const dist = haversineM(here, { lat: hz.lat, lng: hz.lng });
    if (!isAhead(pos.heading, here, hz)) continue;
    for (const band of ALERT_BANDS_M) {
      if (dist <= band && dist > (band === 100 ? 0 : band === 200 ? 100 : 200)) {
        const key = alertKey(hz.id, band);
        if (spoken.has(key)) continue;
        const cand = { hazard: hz, band, distance_m: Math.round(dist), key };
        if (!best || cand.band < best.band || (cand.band === best.band && cand.distance_m < best.distance_m)) {
          best = cand;
        }
      }
    }
  }
  if (!best) return null;
  const label = hazardLabel(best.hazard.hazard_type);
  best.message = label + " ahead in " + best.band + " metres. Slow down.";
  return best;
}

export function markPassed(pos, hazards, already) {
  if (!pos) return already;
  const here = { lat: pos.lat, lng: pos.lng };
  const next = new Map(already);
  for (const hz of hazards || []) {
    if (next.has(hz.id)) continue;
    const dist = haversineM(here, { lat: hz.lat, lng: hz.lng });
    if (dist <= 40) next.set(hz.id, hz);
  }
  return next;
}

export function getNearestAheadHazard(pos, hazards, maxDist = 600) {
  if (!pos || !hazards || !hazards.length) return null;
  const here = { lat: pos.lat, lng: pos.lng };
  let nearest = null;
  for (const hz of hazards) {
    const dist = haversineM(here, { lat: hz.lat, lng: hz.lng });
    if (dist <= maxDist && isAhead(pos.heading, here, hz)) {
      if (!nearest || dist < nearest.distance_m) {
        nearest = { hazard: hz, distance_m: Math.round(dist) };
      }
    }
  }
  return nearest;
}
