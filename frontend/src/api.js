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

export async function createReport({ file, lat, lng, accuracy_m }) {
  const form = new FormData();
  form.append("image", file);
  form.append("lat", String(lat));
  form.append("lng", String(lng));
  if (accuracy_m != null && accuracy_m !== "") {
    form.append("accuracy_m", String(accuracy_m));
  }
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

export function exportCsvUrl() {
  return `${API_URL}/api/export.csv`;
}
