import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleMarker, MapContainer, Polyline, TileLayer, ZoomControl } from "react-leaflet";
import { compareRoutes, geocodeAddress } from "../api.js";

// Predefined demo routes for fast 1-click testing
const PRESETS = [
  {
    name: "Delhi: Connaught Place to India Gate (Demo Track)",
    origin: { lat: 28.6304, lng: 77.2177, label: "Connaught Place" },
    dest: { lat: 28.6129, lng: 77.2295, label: "India Gate" },
  },
  {
    name: "Delhi Track Corridor (Direct demo hazards)",
    origin: { lat: 28.608, lng: 77.21, label: "South End" },
    dest: { lat: 28.62, lng: 77.21, label: "North End" },
  },
  {
    name: "Bengaluru: Koramangala to Indiranagar",
    origin: { lat: 12.9352, lng: 77.6245, label: "Koramangala" },
    dest: { lat: 12.9719, lng: 77.6412, label: "Indiranagar" },
  },
];

export default function RoutePage() {
  const navigate = useNavigate();

  const [originText, setOriginText] = useState("Connaught Place, Delhi");
  const [destText, setDestText] = useState("India Gate, Delhi");
  const [originCoord, setOriginCoord] = useState(PRESETS[0].origin);
  const [destCoord, setDestCoord] = useState(PRESETS[0].dest);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [compareResult, setCompareResult] = useState(null);

  // Auto compare on initial load with default preset
  useEffect(() => {
    runCompare(PRESETS[0].origin, PRESETS[0].dest);
  }, []);

  const runCompare = async (fromPt, toPt) => {
    setLoading(true);
    setError("");
    try {
      const data = await compareRoutes({
        from: { lat: fromPt.lat, lng: fromPt.lng },
        to: { lat: toPt.lat, lng: toPt.lng },
      });
      setCompareResult(data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          err.message ||
          "Unable to compute route comparison. Please try another pair of points."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let fromPt = originCoord;
      let toPt = destCoord;

      if (!fromPt) {
        const res = await geocodeAddress({ q: originText });
        if (!res.length) throw new Error(`Could not find location for: ${originText}`);
        fromPt = { lat: res[0].lat, lng: res[0].lng, label: res[0].display_name };
        setOriginCoord(fromPt);
      }

      if (!toPt) {
        const res = await geocodeAddress({ q: destText });
        if (!res.length) throw new Error(`Could not find location for: ${destText}`);
        toPt = { lat: res[0].lat, lng: res[0].lng, label: res[0].display_name };
        setDestCoord(toPt);
      }

      await runCompare(fromPt, toPt);
    } catch (err) {
      setError(err.message || "Failed to search locations");
      setLoading(false);
    }
  };

  const handleSelectPreset = (p) => {
    setOriginText(p.origin.label);
    setDestText(p.dest.label);
    setOriginCoord(p.origin);
    setDestCoord(p.dest);
    runCompare(p.origin, p.dest);
  };

  // Convert GeoJSON [lng, lat] coordinates to Leaflet [lat, lng]
  const fastestCoords =
    compareResult?.fastest?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];
  const smoothestCoords =
    compareResult?.smoothest?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];

  const mapCenter = originCoord ? [originCoord.lat, originCoord.lng] : [28.61, 77.21];

  return (
    <div className="flex-1 flex flex-col md:flex-row bg-slate-100 overflow-hidden relative">
      {/* SIDEBAR / TOP PANEL CONTROLS */}
      <div className="w-full md:w-96 bg-white border-b md:border-b-0 md:border-r border-slate-200 z-[900] flex flex-col max-h-[50vh] md:max-h-full overflow-y-auto p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>🧭</span>
              <span>Route Planner</span>
            </h1>
            <p className="text-[11px] text-slate-500">Fastest vs. Smoothest comparison</p>
          </div>
          {compareResult?.summary?.has_demo && (
            <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded-full">
              Demo Data
            </span>
          )}
        </div>

        {/* Quick Presets */}
        <div className="py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            Quick Demos
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-2.5 py-1 rounded-lg transition text-left"
              >
                {p.name.split(":")[0]}
              </button>
            ))}
          </div>
        </div>

        {/* Search Inputs */}
        <form onSubmit={handleSearch} className="space-y-2 py-2">
          <div>
            <label className="text-[11px] font-bold text-slate-600">Origin (From)</label>
            <input
              type="text"
              value={originText}
              onChange={(e) => {
                setOriginText(e.target.value);
                setOriginCoord(null);
              }}
              placeholder="Enter start location..."
              className="w-full mt-0.5 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Destination (To)</label>
            <input
              type="text"
              value={destText}
              onChange={(e) => {
                setDestText(e.target.value);
                setDestCoord(null);
              }}
              placeholder="Enter destination..."
              className="w-full mt-0.5 text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-2 mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>Compare Routes</span>
                <span>⚡</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <div className="p-3 my-2 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {/* COMPARISON RESULTS CARD */}
        {compareResult && (
          <div className="mt-3 space-y-3">
            {/* Recommendation Highlight */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-start gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <div className="text-xs font-bold text-emerald-900">
                    {compareResult.summary.avoided_hazards > 0
                      ? `Smoothest route avoids ${compareResult.summary.avoided_hazards} hazards`
                      : "Both routes have equal hazard count"}
                  </div>
                  <div className="text-[11px] text-emerald-700 mt-0.5">
                    {compareResult.summary.extra_minutes > 0
                      ? `Takes only +${compareResult.summary.extra_minutes} min longer`
                      : "Same travel time"}
                  </div>
                </div>
              </div>
            </div>

            {/* Route Cards */}
            <div className="space-y-2">
              {/* Smoothest Route Card */}
              <div className="border-2 border-emerald-500 bg-emerald-500/5 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Smoothest Route
                  </span>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                    Recommended
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center py-1 bg-white rounded-lg border border-emerald-200/60">
                  <div>
                    <div className="text-[10px] text-slate-400">Duration</div>
                    <div className="text-xs font-bold text-slate-800">
                      {Math.round(compareResult.smoothest.duration_s / 60)} min
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Distance</div>
                    <div className="text-xs font-bold text-slate-800">
                      {(compareResult.smoothest.distance_m / 1000).toFixed(1)} km
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Hazards</div>
                    <div className="text-xs font-black text-emerald-600">
                      {compareResult.smoothest.counts.total}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fastest Route Card */}
              <div className="border border-blue-300 bg-blue-50/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Fastest Route
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center py-1 bg-white rounded-lg border border-blue-200/60">
                  <div>
                    <div className="text-[10px] text-slate-400">Duration</div>
                    <div className="text-xs font-bold text-slate-800">
                      {Math.round(compareResult.fastest.duration_s / 60)} min
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Distance</div>
                    <div className="text-xs font-bold text-slate-800">
                      {(compareResult.fastest.distance_m / 1000).toFixed(1)} km
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Hazards</div>
                    <div className="text-xs font-black text-red-500">
                      {compareResult.fastest.counts.total}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Ride Button */}
            <button
              type="button"
              onClick={() => navigate("/ride")}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <span>Start Ride with Hazard Alerts</span>
              <span>🏍️</span>
            </button>
          </div>
        )}
      </div>

      {/* MAP VIEW */}
      <div className="flex-1 h-full min-h-[300px] w-full relative">
        <MapContainer
          center={mapCenter}
          zoom={13}
          zoomControl={false}
          className="h-full w-full"
        >
          <ZoomControl position="bottomright" />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* Fastest Polyline (Blue) */}
          {fastestCoords.length > 0 && (
            <Polyline
              positions={fastestCoords}
              pathOptions={{
                color: "#3b82f6",
                weight: 5,
                opacity: 0.7,
                dashArray: "8, 6",
              }}
            />
          )}

          {/* Smoothest Polyline (Emerald Green) */}
          {smoothestCoords.length > 0 && (
            <Polyline
              positions={smoothestCoords}
              pathOptions={{
                color: "#10b981",
                weight: 6,
                opacity: 0.9,
              }}
            />
          )}

          {/* Origin Marker */}
          {originCoord && (
            <CircleMarker
              center={[originCoord.lat, originCoord.lng]}
              radius={8}
              pathOptions={{
                fillColor: "#059669",
                fillOpacity: 1,
                color: "#ffffff",
                weight: 2,
              }}
            />
          )}

          {/* Destination Marker */}
          {destCoord && (
            <CircleMarker
              center={[destCoord.lat, destCoord.lng]}
              radius={8}
              pathOptions={{
                fillColor: "#dc2626",
                fillOpacity: 1,
                color: "#ffffff",
                weight: 2,
              }}
            />
          )}
        </MapContainer>

        {/* Map Legend Floating Tag */}
        <div className="absolute top-3 right-3 z-[1000] bg-white/90 backdrop-blur border border-slate-200/80 rounded-xl px-3 py-2 shadow-sm text-[11px] space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-emerald-500 rounded-full inline-block" />
            <span className="font-semibold text-slate-800">Smoothest route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 border-t-2 border-dashed border-blue-500 inline-block" />
            <span className="font-semibold text-slate-600">Fastest route</span>
          </div>
        </div>
      </div>
    </div>
  );
}
