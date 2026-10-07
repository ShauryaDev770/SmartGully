import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import useGps from "../hooks/useGps.js";
import useHazards from "../hooks/useHazards.js";
import { useRideUi } from "../components/AppShell.jsx";
import {
  getNearestAheadHazard,
  markPassed,
  pickAlert,
  sendNotification,
  speakAlert,
  vibrateAlert,
} from "../lib/alerts.js";
import { hazardIcon, hazardLabel } from "../lib/geo.js";
import { compareRoutes, confirmReport, geocodeAddress, markGone } from "../api.js";

// Google Maps preset routes for instant testing
const PRESETS = [
  {
    id: "delhi-demo",
    name: "Delhi Demo Track (CP to India Gate)",
    origin: { lat: 28.6304, lng: 77.2177, label: "Connaught Place Start" },
    dest: { lat: 28.6129, lng: 77.2295, label: "India Gate End" },
    defaultSim: true,
  },
  {
    id: "delhi-corridor",
    name: "Delhi: Connaught Place to India Gate",
    origin: { lat: 28.6304, lng: 77.2177, label: "Connaught Place" },
    dest: { lat: 28.6129, lng: 77.2295, label: "India Gate" },
    defaultSim: false,
  },
  {
    id: "bengaluru",
    name: "Bengaluru: Koramangala to Indiranagar",
    origin: { lat: 12.9352, lng: 77.6245, label: "Koramangala" },
    dest: { lat: 12.9719, lng: 77.6412, label: "Indiranagar" },
    defaultSim: false,
  },
];

// Map controller to handle auto-resizing, fitting bounds, and vehicle tracking
function NavigationMapController({
  pos,
  navigating,
  followUser,
  routeBounds,
  onUserDrag,
}) {
  const map = useMap();

  // Fix for Leaflet grey/broken tiles: invalidateSize after mount & layout
  useEffect(() => {
    const triggerInvalidate = () => {
      try {
        map.invalidateSize();
      } catch {
        /* safe */
      }
    };

    triggerInvalidate();
    const t1 = setTimeout(triggerInvalidate, 100);
    const t2 = setTimeout(triggerInvalidate, 400);

    window.addEventListener("resize", triggerInvalidate);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", triggerInvalidate);
    };
  }, [map, navigating]);

  // Follow user position in navigation mode
  useEffect(() => {
    if (navigating && pos && followUser) {
      try {
        map.setView([pos.lat, pos.lng], 16, { animate: true });
      } catch {
        /* safe */
      }
    }
  }, [navigating, pos, followUser, map]);

  // Fit route bounds in preview mode
  useEffect(() => {
    if (!navigating && routeBounds && routeBounds.length === 2) {
      try {
        map.fitBounds(routeBounds, {
          padding: [60, 60],
          maxZoom: 15,
          animate: true,
        });
      } catch {
        /* safe */
      }
    }
  }, [navigating, routeBounds, map]);

  // Detect user dragging map to pause auto-follow
  useEffect(() => {
    const handleDrag = () => {
      onUserDrag();
    };
    map.on("dragstart", handleDrag);
    return () => {
      map.off("dragstart", handleDrag);
    };
  }, [map, onUserDrag]);

  return null;
}

export default function NavigatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setRideActive } = useRideUi();

  // URL state
  const isSimParam = params.get("sim") === "1";
  const startImmediate = params.get("start") === "1";

  // App mode: 'preview' (searching/comparing route) | 'navigating' (turn-by-turn HUD) | 'summary' (trip ended)
  const [mode, setMode] = useState(startImmediate ? "navigating" : "preview");
  const [isSim, setIsSim] = useState(isSimParam || true); // Default to true for demo track convenience

  // Route points
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [originText, setOriginText] = useState(PRESETS[0].origin.label);
  const [destText, setDestText] = useState(PRESETS[0].dest.label);
  const [originCoord, setOriginCoord] = useState(PRESETS[0].origin);
  const [destCoord, setDestCoord] = useState(PRESETS[0].dest);

  // Route comparison state
  const [selectedRouteType, setSelectedRouteType] = useState("smoothest"); // 'smoothest' | 'fastest'
  const [compareResult, setCompareResult] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState("");

  // Navigation live controls
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [followUser, setFollowUser] = useState(true);
  const [currentAheadAlert, setCurrentAheadAlert] = useState(null);

  // Stats & trip verification
  const [spokenKeys] = useState(() => new Set());
  const [warnedCount, setWarnedCount] = useState(0);
  const [passedHazards, setPassedHazards] = useState(() => new Map());
  const [confirmedIds, setConfirmedIds] = useState(() => new Set());
  const [goneIds, setGoneIds] = useState(() => new Set());

  // Refs
  const wakeLockRef = useRef(null);
  const mapRef = useRef(null);

  // Geometry parsing
  const activeRouteData =
    selectedRouteType === "smoothest"
      ? compareResult?.smoothest
      : compareResult?.fastest;

  const fastestCoords = useMemo(
    () => compareResult?.fastest?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [],
    [compareResult]
  );
  const smoothestCoords = useMemo(
    () => compareResult?.smoothest?.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [],
    [compareResult]
  );
  const activeRouteCoords = useMemo(
    () => (selectedRouteType === "smoothest" ? smoothestCoords : fastestCoords),
    [selectedRouteType, smoothestCoords, fastestCoords]
  );

  // Single shared GPS hook
  const isNavigating = mode === "navigating";
  const pos = useGps({
    enabled: isNavigating,
    sim: isSim,
    routePoints: activeRouteCoords,
  });

  // Hazards hook (monitors 1500m radius around user or route origin)
  const hazardCenter = pos || originCoord || { lat: 28.61, lng: 77.21 };
  const hazards = useHazards(hazardCenter, { enabled: true, radiusM: 1500 });

  // Update AppShell so tabs & header auto-hide during live navigation
  useEffect(() => {
    setRideActive(isNavigating);
    return () => setRideActive(false);
  }, [isNavigating, setRideActive]);

  // Load route comparison
  const fetchRoute = useCallback(async (fromPt, toPt) => {
    setLoadingRoute(true);
    setRouteError("");
    try {
      const data = await compareRoutes({
        from: { lat: fromPt.lat, lng: fromPt.lng },
        to: { lat: toPt.lat, lng: toPt.lng },
      });
      setCompareResult(data);
    } catch (err) {
      console.warn("Route comparison error", err);
      setRouteError(
        err.response?.data?.detail || "Unable to fetch driving route. Retrying demo corridor..."
      );
    } finally {
      setLoadingRoute(false);
    }
  }, []);

  // Fetch initial route on mount
  useEffect(() => {
    fetchRoute(PRESETS[0].origin, PRESETS[0].dest);
  }, [fetchRoute]);

  // Handle Search submit
  const handleSearchSubmit = async (e) => {
    e?.preventDefault();
    setLoadingRoute(true);
    setRouteError("");
    try {
      let fromPt = originCoord;
      let toPt = destCoord;

      if (!fromPt) {
        const res = await geocodeAddress({ q: originText });
        if (!res.length) throw new Error(`Location not found: ${originText}`);
        fromPt = { lat: res[0].lat, lng: res[0].lng, label: res[0].display_name };
        setOriginCoord(fromPt);
      }
      if (!toPt) {
        const res = await geocodeAddress({ q: destText });
        if (!res.length) throw new Error(`Location not found: ${destText}`);
        toPt = { lat: res[0].lat, lng: res[0].lng, label: res[0].display_name };
        setDestCoord(toPt);
      }

      await fetchRoute(fromPt, toPt);
    } catch (err) {
      setRouteError(err.message || "Failed to search location");
      setLoadingRoute(false);
    }
  };

  const handleSelectPreset = (p) => {
    setSelectedPreset(p);
    setOriginText(p.origin.label);
    setDestText(p.dest.label);
    setOriginCoord(p.origin);
    setDestCoord(p.dest);
    setIsSim(p.defaultSim);
    fetchRoute(p.origin, p.dest);
  };

  // Turn-by-Turn Alert Engine
  useEffect(() => {
    if (!isNavigating || !pos) return;

    // Track passed hazards within 40m
    setPassedHazards((prev) => markPassed(pos, hazards, prev));

    if (voiceEnabled) {
      // Check 500m, 200m, 100m distance bands
      const alert = pickAlert(pos, hazards, spokenKeys);
      if (alert) {
        spokenKeys.add(alert.key);
        setWarnedCount((c) => c + 1);

        // 1. Audio Speech
        speakAlert(alert.message);
        // 2. Haptic
        vibrateAlert();
        // 3. System Notification
        sendNotification(
          `⚠️ ${hazardLabel(alert.hazard.hazard_type)} Ahead`,
          `${alert.distance_m}m away. Slow down!`
        );
      }

      // Live nearest ahead hazard card
      const nearest = getNearestAheadHazard(pos, hazards, 600);
      setCurrentAheadAlert(nearest);
    } else {
      setCurrentAheadAlert(null);
    }
  }, [isNavigating, pos, hazards, voiceEnabled, spokenKeys]);

  // Start Navigation Button Handler (Iconic Google Maps "Start")
  const handleStartNavigation = async () => {
    setMode("navigating");
    setFollowUser(true);

    // Request screen wake-lock
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch {
      /* ignore */
    }

    // Request notification permission if not yet decided
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      /* ignore */
    }

    // Trigger map resize after layout changes
    if (mapRef.current) {
      setTimeout(() => {
        try {
          mapRef.current.invalidateSize();
        } catch {
          /* safe */
        }
      }, 150);
    }
  };

  // Exit Navigation Button Handler
  const handleExitNavigation = () => {
    setMode("summary");
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  // Confirm hazard still there
  const handleConfirmHazard = async (id) => {
    try {
      setConfirmedIds((prev) => new Set([...prev, id]));
      await confirmReport(id);
    } catch (err) {
      console.warn("Confirm failed", err);
    }
  };

  // Mark hazard gone / fixed
  const handleGoneHazard = async (id) => {
    try {
      setGoneIds((prev) => new Set([...prev, id]));
      await markGone(id);
    } catch (err) {
      console.warn("Mark gone failed", err);
    }
  };


  const routeBounds = useMemo(() => {
    if (!originCoord || !destCoord) return null;
    return [
      [Math.min(originCoord.lat, destCoord.lat), Math.min(originCoord.lng, destCoord.lng)],
      [Math.max(originCoord.lat, destCoord.lat), Math.max(originCoord.lng, destCoord.lng)],
    ];
  }, [originCoord, destCoord]);

  const speed = Math.round(pos?.speedKmh || 0);
  const mapCenter = originCoord ? [originCoord.lat, originCoord.lng] : [28.61, 77.21];

  const hasAlert = Boolean(currentAheadAlert);
  const isSevere = currentAheadAlert?.hazard?.category === "red";

  return (
    <div
      className={`relative w-full overflow-hidden select-none ${
        isNavigating
          ? "fixed inset-0 z-[1200] h-screen bg-slate-950"
          : "h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] bg-slate-100"
      }`}
    >
      {/* ======================================================== */}
      {/* 1. THE SINGLE FULL-SCREEN LEAFLET MAP (Never unmounts)   */}
      {/* ======================================================== */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapContainer
          ref={mapRef}
          center={mapCenter}
          zoom={14}
          zoomControl={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%", position: "absolute", inset: 0 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <NavigationMapController
            pos={pos}
            navigating={isNavigating}
            followUser={followUser}
            routeBounds={routeBounds}
            onUserDrag={() => setFollowUser(false)}
          />

          {/* Fastest Polyline (Blue dashed) */}
          {fastestCoords.length > 0 && selectedRouteType !== "fastest" && (
            <Polyline
              positions={fastestCoords}
              pathOptions={{
                color: "#64748b",
                weight: 5,
                opacity: 0.65,
                dashArray: "6, 6",
              }}
            />
          )}

          {/* Selected Route Polyline (Emerald Green or Blue) */}
          {activeRouteData?.geometry?.coordinates && (
            <Polyline
              positions={
                selectedRouteType === "smoothest" ? smoothestCoords : fastestCoords
              }
              pathOptions={{
                color: selectedRouteType === "smoothest" ? "#10b981" : "#1a73e8",
                weight: isNavigating ? 7 : 6,
                opacity: 0.95,
              }}
            />
          )}

          {/* Origin Marker (Preview Mode) */}
          {!isNavigating && originCoord && (
            <CircleMarker
              center={[originCoord.lat, originCoord.lng]}
              radius={8}
              pathOptions={{
                fillColor: "#1a73e8",
                fillOpacity: 1,
                color: "#ffffff",
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs font-bold">Start: {originCoord.label}</div>
              </Popup>
            </CircleMarker>
          )}

          {/* Destination Marker (Preview Mode) */}
          {!isNavigating && destCoord && (
            <CircleMarker
              center={[destCoord.lat, destCoord.lng]}
              radius={8}
              pathOptions={{
                fillColor: "#ea4335",
                fillOpacity: 1,
                color: "#ffffff",
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs font-bold">Destination: {destCoord.label}</div>
              </Popup>
            </CircleMarker>
          )}

          {/* Vehicle Position Marker (Navigation Mode) */}
          {isNavigating && pos && (
            <CircleMarker
              center={[pos.lat, pos.lng]}
              radius={10}
              pathOptions={{
                fillColor: "#1a73e8",
                fillOpacity: 1,
                color: "#ffffff",
                weight: 3,
              }}
            >
              <Popup>
                <div className="text-xs font-bold text-slate-800">
                  Your Location
                  <div className="text-[10px] text-slate-500 font-normal">
                    {speed} km/h • {pos.heading ? `${Math.round(pos.heading)}°` : "Stationary"}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )}

          {/* Hazards on Route */}
          {hazards.map((hz) => (
            <CircleMarker
              key={hz.id}
              center={[hz.lat, hz.lng]}
              radius={7}
              pathOptions={{
                fillColor: hz.category === "red" ? "#dc2626" : "#f59e0b",
                fillOpacity: 0.95,
                color: "#ffffff",
                weight: 2,
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 p-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{hazardIcon(hz.hazard_type)}</span>
                    <span>{hazardLabel(hz.hazard_type)}</span>
                  </div>
                  <div className="text-slate-600">{hz.reason}</div>
                  <div className="text-[10px] text-slate-400">
                    {hz.category === "red" ? "🔴 Urgent Pothole" : "🟡 Caution Area"}
                    {hz.is_demo && " • Demo"}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* ======================================================== */}
      {/* 2. PREVIEW MODE: FLOATING GOOGLE MAPS SEARCH & ROUTE CARD */}
      {/* ======================================================== */}
      {mode === "preview" && (
        <>
          {/* Floating Search & Directions Card (Docked on Left/Bottom) */}
          <div className="absolute top-4 left-4 right-4 sm:right-auto sm:w-[410px] z-[1000] max-h-[calc(100%-32px)] overflow-y-auto bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-4 space-y-3 pointer-events-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base font-bold shadow-sm">
                  🧭
                </span>
                <div>
                  <h1 className="text-sm font-black text-slate-900 tracking-tight leading-tight">
                    SmartGully Navigation
                  </h1>
                  <p className="text-[11px] text-slate-500">Google Maps with pothole voice alerts</p>
                </div>
              </div>
              {compareResult?.summary?.has_demo && (
                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  Demo Track
                </span>
              )}
            </div>

            {/* Quick Demo Routes */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Quick Routes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition text-left border ${
                      selectedPreset?.id === p.id
                        ? "bg-blue-50 text-blue-700 border-blue-200 font-bold"
                        : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                    }`}
                  >
                    {p.name.split(":")[0]}
                  </button>
                ))}
              </div>
            </div>

            {/* Origin & Destination inputs */}
            <form onSubmit={handleSearchSubmit} className="space-y-2">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block flex-shrink-0" />
                  <input
                    type="text"
                    value={originText}
                    onChange={(e) => {
                      setOriginText(e.target.value);
                      setOriginCoord(null);
                    }}
                    placeholder="Starting point..."
                    className="w-full text-xs bg-transparent focus:outline-none text-slate-800 font-medium"
                  />
                </div>
                <div className="border-t border-slate-200" />
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block flex-shrink-0" />
                  <input
                    type="text"
                    value={destText}
                    onChange={(e) => {
                      setDestText(e.target.value);
                      setDestCoord(null);
                    }}
                    placeholder="Destination..."
                    className="w-full text-xs bg-transparent focus:outline-none text-slate-800 font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={isSim}
                    onChange={(e) => setIsSim(e.target.checked)}
                    className="accent-blue-600 w-4 h-4 rounded"
                  />
                  <span className="text-[11px] font-medium">Replay Demo GPS Track</span>
                </label>

                <button
                  type="submit"
                  disabled={loadingRoute}
                  className="py-1.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5"
                >
                  {loadingRoute ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>Directions 🔍</span>
                  )}
                </button>
              </div>
            </form>

            {routeError && (
              <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {routeError}
              </div>
            )}

            {/* Route comparison options */}
            {compareResult && (
              <div className="space-y-2 pt-1">
                {/* Smoothest Route Option */}
                <div
                  onClick={() => setSelectedRouteType("smoothest")}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer ${
                    selectedRouteType === "smoothest"
                      ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      Smoothest Route
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                      Fewer Potholes
                    </span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-black text-slate-900">
                      {Math.round(compareResult.smoothest.duration_s / 60)} min
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({(compareResult.smoothest.distance_m / 1000).toFixed(1)} km)
                    </span>
                  </div>

                  <div className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                    <span>✨</span>
                    <span>
                      {compareResult.summary.avoided_hazards > 0
                        ? `Avoids ${compareResult.summary.avoided_hazards} road hazards`
                        : "Cleanest road quality corridor"}
                    </span>
                  </div>
                </div>

                {/* Fastest Route Option */}
                <div
                  onClick={() => setSelectedRouteType("fastest")}
                  className={`p-3 rounded-xl border-2 transition cursor-pointer ${
                    selectedRouteType === "fastest"
                      ? "border-blue-500 bg-blue-50/50 shadow-sm"
                      : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                      Fastest Route
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">Direct</span>
                  </div>

                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-xl font-bold text-slate-800">
                      {Math.round(compareResult.fastest.duration_s / 60)} min
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      ({(compareResult.fastest.distance_m / 1000).toFixed(1)} km)
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 mt-1">
                    {compareResult.fastest.counts.total} hazards along route
                  </div>
                </div>

                {/* The Iconic Google Maps "START" Button */}
                <button
                  type="button"
                  onClick={handleStartNavigation}
                  className="w-full py-4 bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.99] text-white font-black text-base rounded-2xl shadow-xl shadow-blue-500/25 transition flex items-center justify-center gap-3 tracking-wide"
                >
                  <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs">
                    ▲
                  </span>
                  <span>START NAVIGATION</span>
                </button>
              </div>
            )}
          </div>

          {/* Floating Map Legend Tag (Top Right) */}
          <div className="absolute top-4 right-4 z-[1000] bg-white/95 backdrop-blur border border-slate-200 rounded-xl px-3 py-2 shadow-sm text-[11px] space-y-1 pointer-events-auto">
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-emerald-500 rounded-full inline-block" />
              <span className="font-semibold text-slate-800">Smoothest route</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-1 bg-blue-500 rounded-full inline-block" />
              <span className="font-semibold text-slate-600">Fastest route</span>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* 3. NAVIGATION MODE: TURN-BY-TURN HUD (Google Maps Style) */}
      {/* ======================================================== */}
      {mode === "navigating" && (
        <>
          {/* Top Guidance Banner */}
          <div className="absolute top-0 inset-x-0 z-[1300] p-3 pointer-events-none">
            {hasAlert ? (
              /* Active Pothole Alert Card */
              <div
                className={`pointer-events-auto shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-3 border transition-all duration-300 animate-slide-down ${
                  isSevere
                    ? "bg-red-600 text-white border-red-400 shadow-red-950/60"
                    : "bg-amber-500 text-slate-950 border-amber-300 shadow-amber-950/60"
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="text-4xl filter drop-shadow">
                    {hazardIcon(currentAheadAlert.hazard.hazard_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black uppercase tracking-tight">
                        {hazardLabel(currentAheadAlert.hazard.hazard_type)}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                          isSevere ? "bg-white/20 text-white" : "bg-black/20 text-slate-900"
                        }`}
                      >
                        {isSevere ? "Urgent Pothole" : "Caution"}
                      </span>
                    </div>
                    <div
                      className={`text-xs font-semibold mt-0.5 line-clamp-1 ${
                        isSevere ? "text-white/90" : "text-slate-900/90"
                      }`}
                    >
                      {currentAheadAlert.hazard.reason || "Slow down for upcoming road hazard"}
                    </div>
                  </div>
                </div>

                <div className="text-right flex-shrink-0 pl-3 border-l border-white/20">
                  <div className="text-2xl font-black font-mono leading-none">
                    {currentAheadAlert.distance_m}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                    metres
                  </div>
                </div>
              </div>
            ) : (
              /* Clear Road Status Banner (Google Maps Green) */
              <div className="pointer-events-auto bg-[#0f9d58] text-white shadow-xl rounded-2xl p-3.5 flex items-center justify-between border border-emerald-400/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
                    🛣️
                  </div>
                  <div>
                    <div className="text-sm font-black tracking-tight">Road ahead is clear</div>
                    <div className="text-[11px] text-emerald-100 font-medium">
                      Voice pothole warnings active
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase font-bold text-emerald-200">Warned</div>
                  <div className="text-sm font-black font-mono">{warnedCount}</div>
                </div>
              </div>
            )}
          </div>

          {/* Speedometer Widget (Bottom-Left) */}
          <div className="absolute bottom-24 left-4 z-[1100] pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-2xl px-4 py-3 shadow-xl flex flex-col items-center min-w-[76px]">
              <span className="text-3xl font-black font-mono text-white leading-none">
                {speed}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
                km/h
              </span>
            </div>
          </div>

          {/* Right Floating Actions (Sound Toggle & Recenter) */}
          <div className="absolute bottom-24 right-4 z-[1100] flex flex-col gap-2.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              title={voiceEnabled ? "Mute Voice Alerts" : "Unmute Voice Alerts"}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xl transition backdrop-blur-md border ${
                voiceEnabled
                  ? "bg-emerald-600/90 text-white border-emerald-400"
                  : "bg-slate-900/90 text-slate-400 border-slate-700"
              }`}
            >
              {voiceEnabled ? "🔊" : "🔇"}
            </button>

            <button
              type="button"
              onClick={() => {
                setFollowUser(true);
                if (mapRef.current && pos) {
                  mapRef.current.setView([pos.lat, pos.lng], 16, { animate: true });
                }
              }}
              title="Recenter Location"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xl transition backdrop-blur-md border ${
                followUser
                  ? "bg-blue-600/90 text-white border-blue-400"
                  : "bg-slate-900/90 text-white border-slate-700"
              }`}
            >
              🎯
            </button>
          </div>

          {/* Bottom Bar with ETA and Exit Button */}
          <div className="absolute bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 z-[1300] flex items-center justify-between gap-4 pointer-events-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl border border-emerald-500/30">
                🧭
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>SmartGully Navigation</span>
                  {isSim && (
                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-mono">
                      Sim
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  {activeRouteData?.duration_s
                    ? `~${Math.round(activeRouteData.duration_s / 60)} min • ${(activeRouteData.distance_m / 1000).toFixed(1)} km`
                    : "Live tracking active"}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExitNavigation}
              className="px-5 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-red-950/50 flex items-center gap-2"
            >
              <span>✕</span>
              <span>Exit</span>
            </button>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* 4. SUMMARY MODE: POST-NAVIGATION FEEDBACK OVERLAY        */}
      {/* ======================================================== */}
      {mode === "summary" && (
        <div className="absolute inset-0 z-[1400] bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center pointer-events-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 max-w-md w-full shadow-2xl flex flex-col max-h-[85vh] text-white">
            <div className="text-center py-2">
              <div className="w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-2xl mx-auto mb-2 border border-emerald-500/30">
                🏁
              </div>
              <h2 className="text-xl font-black tracking-tight">Navigation Ended</h2>
              <p className="text-slate-400 text-xs mt-0.5">Route overview & hazard verification</p>
            </div>

            <div className="grid grid-cols-2 gap-3 my-3">
              <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-3 text-center">
                <div className="text-2xl font-black text-amber-400">{warnedCount}</div>
                <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Hazards Warned</div>
              </div>
              <div className="bg-slate-800 border border-slate-700/60 rounded-2xl p-3 text-center">
                <div className="text-2xl font-black text-emerald-400">{passedHazards.size}</div>
                <div className="text-[11px] text-slate-400 font-semibold mt-0.5">Hazards Passed</div>
              </div>
            </div>

            {/* Passed hazards verification */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-2">
              {passedHazards.size === 0 ? (
                <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-5 text-center text-slate-400 text-xs">
                  No reported hazards encountered on this trip. Safe roads! ✨
                </div>
              ) : (
                Array.from(passedHazards.values()).map((hz) => {
                  const isConfirmed = confirmedIds.has(hz.id);
                  const isGone = goneIds.has(hz.id);

                  return (
                    <div
                      key={hz.id}
                      className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{hazardIcon(hz.hazard_type)}</span>
                        <div>
                          <div className="font-bold text-xs text-slate-100">
                            {hazardLabel(hz.hazard_type)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {hz.category === "red" ? "🔴 Urgent pothole" : "🟡 Caution area"}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isConfirmed || isGone}
                          onClick={() => handleConfirmHazard(hz.id)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                            isConfirmed
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                              : "bg-amber-600 hover:bg-amber-500 text-white"
                          }`}
                        >
                          {isConfirmed ? "✓ Confirmed" : "⚠️ Still there"}
                        </button>
                        <button
                          type="button"
                          disabled={isConfirmed || isGone}
                          onClick={() => handleGoneHazard(hz.id)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition ${
                            isGone
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-700 hover:bg-slate-600 text-white"
                          }`}
                        >
                          {isGone ? "✓ Fixed" : "✅ Gone / Fixed"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setMode("preview")}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition shadow-lg mt-2"
            >
              Done & Return to Map
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
