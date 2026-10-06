import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMapEvents } from "react-leaflet";
import HeatLayer from "../components/HeatLayer.jsx";
import CategoryBadge from "../components/CategoryBadge.jsx";
import { confirmReport, fetchReports, mediaUrl } from "../api.js";

const INDIA_CENTER = [22.5, 79];

function boundsToBbox(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}

function MapEvents({ onMove }) {
  useMapEvents({
    moveend: (e) => onMove(e.target.getBounds()),
  });
  return null;
}

export default function MapPage() {
  const [showHeat, setShowHeat] = useState(true);
  const [cats, setCats] = useState({ red: true, yellow: true, green: false });
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmingId, setConfirmingId] = useState(null);
  const bboxRef = useRef(null);
  const timerRef = useRef(null);

  const categoryParam = useMemo(() => {
    const selected = Object.entries(cats)
      .filter(([, on]) => on)
      .map(([k]) => k);
    return selected.join(",") || "red,yellow";
  }, [cats]);

  const load = useCallback(
    async (bbox) => {
      setLoading(true);
      try {
        const data = await fetchReports({ category: categoryParam, bbox });
        setFeatures(data.features || []);
        setError("");
      } catch (err) {
        setError(err.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    },
    [categoryParam]
  );

  useEffect(() => {
    load(bboxRef.current);
  }, [load]);

  const onMove = (bounds) => {
    const bbox = boundsToBbox(bounds);
    bboxRef.current = bbox;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => load(bbox), 350);
  };

  const heatPoints = useMemo(
    () =>
      features
        .filter((f) => f.geometry?.coordinates?.length === 2)
        .map((f) => {
          const [lng, lat] = f.geometry.coordinates;
          return [lat, lng, f.properties.weight || 0.5];
        }),
    [features]
  );

  const onConfirm = async (id) => {
    try {
      setConfirmingId(id);
      // Optimistic update
      setFeatures((prev) =>
        prev.map((f) => {
          if (f.properties.id === id) {
            const nextCount = (f.properties.confirmations || 0) + 1;
            const base = f.properties.category === "red" ? 1.0 : 0.5;
            const nextWeight = Math.min(3.0, base * (1 + 0.25 * nextCount));
            return {
              ...f,
              properties: {
                ...f.properties,
                confirmations: nextCount,
                weight: nextWeight,
              },
            };
          }
          return f;
        })
      );
      await confirmReport(id);
    } catch (err) {
      console.error("Failed to confirm report", err);
    } finally {
      setConfirmingId(null);
    }
  };

  const getMarkerColor = (cat) => {
    if (cat === "red") return "#dc2626";
    if (cat === "green") return "#16a34a";
    return "#eab308";
  };

  return (
    <div className="relative h-[calc(100vh-56px)] w-full">
      {/* Map Filter & Layer Control Overlay */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200/80 p-4 space-y-3 w-64">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">View Mode</div>
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setShowHeat(true)}
              className={`py-1.5 text-xs font-bold rounded-lg transition ${
                showHeat ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              🔥 Heatmap
            </button>
            <button
              type="button"
              onClick={() => setShowHeat(false)}
              className={`py-1.5 text-xs font-bold rounded-lg transition ${
                !showHeat ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              📍 Markers
            </button>
          </div>
        </div>

        <div className="border-t border-slate-200/60 pt-2 space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</div>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={cats.red}
              onChange={(e) => setCats((c) => ({ ...c, red: e.target.checked }))}
              className="accent-red-600 w-4 h-4 rounded"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span>
            Red (Urgent potholes)
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={cats.yellow}
              onChange={(e) => setCats((c) => ({ ...c, yellow: e.target.checked }))}
              className="accent-yellow-500 w-4 h-4 rounded"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
            Yellow (Lower priority/review)
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={cats.green}
              onChange={(e) => setCats((c) => ({ ...c, green: e.target.checked }))}
              className="accent-green-600 w-4 h-4 rounded"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block"></span>
            Green (Not a road/no pothole)
          </label>
        </div>

        {error && <p className="text-red-600 text-xs bg-red-50 p-2 rounded">{error}</p>}

        <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-200/60 pt-2">
          <span>{features.length} reports in view</span>
          {loading && <span className="inline-block w-2.5 h-2.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span>}
        </div>
      </div>

      <MapContainer center={INDIA_CENTER} zoom={5} zoomControl={false} className="h-full w-full">
        <ZoomControl position="bottomright" />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onMove={onMove} />

        {showHeat ? (
          <HeatLayer points={heatPoints} />
        ) : (
          features.map((f) => {
            const [lng, lat] = f.geometry.coordinates;
            const p = f.properties;
            const color = getMarkerColor(p.category);
            const formattedDate = p.created_at ? new Date(p.created_at).toLocaleDateString() : "";
            const isConfirming = confirmingId === p.id;

            return (
              <CircleMarker
                key={p.id}
                center={[lat, lng]}
                radius={7}
                pathOptions={{
                  color: "#ffffff",
                  weight: 1.5,
                  fillColor: color,
                  fillOpacity: 0.9,
                }}
              >
                <Popup>
                  <div className="w-56 space-y-2 p-1 text-slate-800">
                    <div className="flex items-center justify-between gap-1">
                      <CategoryBadge category={p.category} />
                      {formattedDate && <span className="text-[11px] text-slate-500">{formattedDate}</span>}
                    </div>

                    {p.image_url && (
                      <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-h-32">
                        <img
                          src={mediaUrl(p.image_url)}
                          alt="report"
                          className="w-full h-32 object-cover"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      </div>
                    )}

                    <p className="text-xs font-medium text-slate-700 leading-snug">{p.reason}</p>

                    {p.pothole_conf != null && p.pothole_conf > 0 && (
                      <div className="text-[10px] text-slate-500 flex justify-between border-t border-slate-100 pt-1">
                        <span>Confidence: {(p.pothole_conf * 100).toFixed(0)}%</span>
                        <span>Count: {p.pothole_count}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={isConfirming}
                      className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      onClick={() => onConfirm(p.id)}
                    >
                      <span>Still there?</span>
                      <span className="bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
                        {p.confirmations || 0}
                      </span>
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })
        )}
      </MapContainer>
    </div>
  );
}
