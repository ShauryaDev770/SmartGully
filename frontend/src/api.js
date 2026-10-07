import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: API_URL,
});

export function mediaUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

export async function fetchReports({ category, bbox, limit, status } = {}) {
  const params = {};
  if (category) params.category = category;
  if (bbox) params.bbox = bbox;
  if (limit) params.limit = limit;
  if (status) params.status = status;
  const { data } = await client.get("/api/reports", { params });
  return data;
}

export async function fetchReport(id) {
  const { data } = await client.get(`/api/reports/${id}`);
  return data;
}

export async function createReport({ file, lat, lng, accuracy_m, source }) {
  const form = new FormData();
  form.append("image", file);
  form.append("lat", String(lat));
  form.append("lng", String(lng));
  if (accuracy_m != null && accuracy_m !== "") {
    form.append("accuracy_m", String(accuracy_m));
  }
  if (source) form.append("source", source);
  const { data } = await client.post("/api/reports", form);
  return data;
}

export async function confirmReport(id) {
  const { data } = await client.post(`/api/reports/${id}/confirm`);
  return data;
}

export async function fetchStats() {
  const { data } = await client.get("/api/stats");
  return data;
}

export async function fetchNearbyHazards({ lat, lng, radius_m = 1000 }) {
  const { data } = await client.get("/api/hazards/nearby", {
    params: { lat, lng, radius_m },
  });
  return data;
}

export async function compareRoutes({ from, to }) {
  const { data } = await client.post("/api/routes/compare", {
    from,
    to,
  });
  return data;
}

export async function markGone(id) {
  const { data } = await client.post(`/api/reports/${id}/gone`);
  return data;
}

export async function geocodeAddress({ address, city, q } = {}) {
  // First attempt via backend proxy
  try {
    const params = {};
    if (address) params.address = address;
    if (city) params.city = city;
    if (q) params.q = q;
    const { data } = await client.get("/api/geocode", { params });
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn("Backend geocoding failed or unreachable, trying direct OSM Nominatim fallback...", err);
  }

  // Fallback direct to OpenStreetMap Nominatim
  const parts = [address, city, "India"].filter((p) => p && p.trim());
  const query = q || parts.join(", ");
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Unable to contact geocoding service.");
  }
  const items = await res.json();
  return items.map((item) => ({
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    display_name: item.display_name,
    type: item.type,
    importance: item.importance,
  }));
}

export function exportCsvUrl() {
  return `${API_URL}/api/export.csv`;
}

