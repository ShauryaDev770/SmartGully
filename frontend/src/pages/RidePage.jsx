import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
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
import { confirmReport, markGone } from "../api.js";

// Helper component inside MapContainer to follow rider
function MapFollower({ pos, followUser, onUserDrag }) {
  const map = useMap();

  useEffect(() => {
    if (!pos || !followUser) return;
    map.setView([pos.lat, pos.lng], 16, { animate: true });
  }, [pos, followUser, map]);

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

export default function RidePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setRideActive } = useRideUi();

  const isSim = params.get("sim") === "1";
  const defaultAlerts = params.get("alerts") !== "0";

  // Navigation states
  const [alertsEnabled, setAlertsEnabled] = useState(defaultAlerts);
  const [active, setActive] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [followUser, setFollowUser] = useState(true);

  // In-app banner notification state
  const [bannerAlert, setBannerAlert] = useState(null);

  // Stats
  const [spokenKeys] = useState(() => new Set());
  const [warnedCount, setWarnedCount] = useState(0);
  const [passedHazards, setPassedHazards] = useState(() => new Map());
  const [confirmedIds, setConfirmedIds] = useState(() => new Set());
  const [goneIds, setGoneIds] = useState(() => new Set());

  // Active visual ahead hazard
  const [currentAheadHazard, setCurrentAheadHazard] = useState(null);

  // Refs
  const wakeLockRef = useRef(null);
  const mapRef = useRef(null);
  const bannerTimeoutRef = useRef(null);

  // Single shared GPS hook
  const pos = useGps({ enabled: active, sim: isSim });
  // Hazards hook (1000m radius around current location)
  const hazards = useHazards(pos, { enabled: active, radiusM: 1000 });

  // Update AppShell ride state (hides header and tab bar during navigation)
  useEffect(() => {
    setRideActive(active);
    return () => setRideActive(false);
  }, [active, setRideActive]);

  // Alert engine & tracking passed hazards
  useEffect(() => {
    if (!active || !pos) return;

    // Track passed hazards within 40m
    setPassedHazards((prev) => markPassed(pos, hazards, prev));

    if (alertsEnabled) {
      // Check for voice & notification trigger at 500m, 200m, 100m bands
      const alert = pickAlert(pos, hazards, spokenKeys);
      if (alert) {
        spokenKeys.add(alert.key);
        setWarnedCount((c) => c + 1);

        // 1. Voice alert
        speakAlert(alert.message);
        // 2. Vibration
        vibrateAlert();
        // 3. Web Notification (system push banner)
        sendNotification(
          `⚠️ ${hazardLabel(alert.hazard.hazard_type)} Ahead`,
          `${alert.distance_m}m away. Slow down!`
        );

        // 4. In-app popdown navigation banner
        if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
        setBannerAlert({
          type: alert.hazard.hazard_type,
          category: alert.hazard.category,
          distance_m: alert.distance_m,
          message: alert.message,
          reason: alert.hazard.reason,
        });
        bannerTimeoutRef.current = setTimeout(() => {
          setBannerAlert(null);
        }, 5000);
      }

      // Visual ahead hazard for navigation card
      const nearest = getNearestAheadHazard(pos, hazards, 600);
      setCurrentAheadHazard(nearest);
    } else {
      setCurrentAheadHazard(null);
    }
  }, [active, pos, hazards, alertsEnabled, spokenKeys]);

  // Start Navigation
  const handleStart = async () => {
    setStopped(false);
    setActive(true);
    setFollowUser(true);

    // Request screen wake lock so screen stays on during navigation
    try {
      if ("wakeLock" in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request("screen");
      }
    } catch (err) {
      console.warn("Wake lock denied or unavailable:", err);
    }

    // Request browser notification permission if default
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

  // Stop Navigation
  const handleStop = () => {
    setActive(false);
    setStopped(true);

    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
  };

  // Confirm hazard still there
  const handleConfirm = async (id) => {
    try {
      setConfirmedIds((prev) => new Set([...prev, id]));
      await confirmReport(id);
    } catch (err) {
      console.warn("Confirm failed", err);
    }
  };

  // Mark hazard gone / repaired
  const handleGone = async (id) => {
    try {
      setGoneIds((prev) => new Set([...prev, id]));
      await markGone(id);
    } catch (err) {
      console.warn("Mark gone failed", err);
    }
  };

  const handleRecenter = () => {
    setFollowUser(true);
    if (mapRef.current && pos) {
      mapRef.current.setView([pos.lat, pos.lng], 16, { animate: true });
    }
  };

  // ---------------- 1. POST-NAVIGATION SUMMARY SCREEN ----------------
  if (stopped) {
    const passedList = Array.from(passedHazards.values());

    return (
      <div className="flex-1 bg-slate-900 text-white p-4 sm:p-6 flex flex-col max-w-lg mx-auto w-full">
        <div className="text-center py-5">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-3 border border-emerald-500/30">
            🏁
          </div>
          <h1 className="text-2xl font-black tracking-tight">Navigation Ended</h1>
          <p className="text-slate-400 text-xs mt-1">Route overview and hazard verification</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 my-3">
          <div className="bg-slate-800/90 border border-slate-700/60 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-amber-400">{warnedCount}</div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Hazards Warned</div>
          </div>
          <div className="bg-slate-800/90 border border-slate-700/60 rounded-2xl p-4 text-center">
            <div className="text-3xl font-black text-emerald-400">{passedList.length}</div>
            <div className="text-xs text-slate-400 font-semibold mt-1">Hazards Passed</div>
          </div>
        </div>

        {/* Hazards Passed Verification List */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 my-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Verify Road Hazards
            </h2>
            <span className="text-[11px] text-slate-500">Help riders behind you</span>
          </div>

          {passedList.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-6 text-center text-slate-400 text-xs">
              No reported hazards passed on this trip. Safe roads! 🎉
            </div>
          ) : (
            passedList.map((hz) => {
              const isConfirmed = confirmedIds.has(hz.id);
              const isGone = goneIds.has(hz.id);

              return (
                <div
                  key={hz.id}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{hazardIcon(hz.hazard_type)}</span>
                      <div>
                        <div className="font-bold text-sm text-slate-100">
                          {hazardLabel(hz.hazard_type)}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{hz.category === "red" ? "🔴 Urgent pothole" : "🟡 Caution area"}</span>
                          {hz.is_demo && <span className="text-amber-400 font-semibold">• Demo data</span>}
                        </div>
                      </div>
                    </div>
                  </div>

                  {hz.reason && (
                    <div className="text-xs text-slate-300 bg-slate-900/70 px-3 py-1.5 rounded-lg border border-slate-700/50">
                      {hz.reason}
                    </div>
                  )}

                  {/* Verification action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isConfirmed || isGone}
                      onClick={() => handleConfirm(hz.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isConfirmed
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default"
                          : "bg-amber-600 hover:bg-amber-500 text-white shadow"
                      }`}
                    >
                      {isConfirmed ? "✓ Confirmed" : "⚠️ Still there"}
                    </button>
                    <button
                      type="button"
                      disabled={isConfirmed || isGone}
                      onClick={() => handleGone(hz.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isGone
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default"
                          : "bg-slate-700 hover:bg-slate-600 text-white shadow"
                      }`}
                    >
                      {isGone ? "✓ Marked Fixed" : "✅ Gone / Fixed"}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Return Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2"
          >
            <span>Return to Map</span>
            <span>🗺️</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------- 2. PRE-NAVIGATION SETUP SCREEN ----------------
  if (!active) {
    return (
      <div className="flex-1 bg-slate-950 text-white p-5 flex flex-col justify-between max-w-md mx-auto w-full">
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <span className="text-emerald-400">🧭</span>
              <span>Start Navigation</span>
            </h1>
            {isSim && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                Simulated Run
              </span>
            )}
          </div>

          <p className="text-slate-400 text-xs leading-relaxed">
            Turn-by-turn road hazard alerts. Mount your phone and drive with real-time voice warnings for potholes, speed bumps, and rough patches ahead.
          </p>

          {/* Voice alerts toggle */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <span>🔊</span>
                  <span>Voice & audio warnings</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Speaks hazard warnings at 500m, 200m, and 100m
                </div>
              </div>
              <input
                type="checkbox"
                checked={alertsEnabled}
                onChange={(e) => setAlertsEnabled(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Feature Highlights */}
          <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 space-y-3 text-xs text-slate-300">
            <div className="flex items-start gap-3">
              <span className="text-lg">🗺️</span>
              <div>
                <div className="font-bold text-white">Full-Screen Navigation Map</div>
                <div className="text-slate-400 text-[11px]">Real-time GPS tracking with nearby hazards</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">📢</span>
              <div>
                <div className="font-bold text-white">Smart Voice Guidance</div>
                <div className="text-slate-400 text-[11px]">&quot;Pothole ahead in 200 metres. Slow down.&quot;</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🔔</span>
              <div>
                <div className="font-bold text-white">In-App & System Notifications</div>
                <div className="text-slate-400 text-[11px]">High-visibility warning cards as you approach hazards</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">📱</span>
              <div>
                <div className="font-bold text-white">Screen Wake-Lock</div>
                <div className="text-slate-400 text-[11px]">Keeps your display awake while driving</div>
              </div>
            </div>
          </div>
        </div>

        {/* Big Start Navigation Button */}
        <div className="pb-6">
          <button
            type="button"
            onClick={handleStart}
            className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xl rounded-2xl transition shadow-xl shadow-emerald-500/25 active:scale-[0.98] flex items-center justify-center gap-3 tracking-wide"
          >
            <span>START NAVIGATION</span>
            <span className="text-lg">▶</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------------- 3. ACTIVE GOOGLE MAPS STYLE NAVIGATION ----------------
  const speed = Math.round(pos?.speedKmh || 0);
  const activeHazard = bannerAlert || (currentAheadHazard ? {
    type: currentAheadHazard.hazard.hazard_type,
    category: currentAheadHazard.hazard.category,
    distance_m: currentAheadHazard.distance_m,
    message: `${hazardLabel(currentAheadHazard.hazard.hazard_type)} ahead • Slow down`,
    reason: currentAheadHazard.hazard.reason,
  } : null);

  const isSevere = activeHazard?.category === "red";

  return (
    <div className="fixed inset-0 z-[1200] bg-slate-950 text-white flex flex-col select-none overflow-hidden">
      {/* ---------------- TOP NAVIGATION GUIDANCE BANNER (Google Maps Style) ---------------- */}
      <div className="absolute top-0 inset-x-0 z-[1300] p-3 pointer-events-none">
        {activeHazard ? (
          /* ACTIVE HAZARD WARNING BANNER */
          <div
            className={`pointer-events-auto shadow-2xl rounded-2xl p-4 flex items-center justify-between gap-3 border transition-all duration-300 animate-slide-down ${
              isSevere
                ? "bg-red-600 text-white border-red-400 shadow-red-950/60"
                : "bg-amber-500 text-slate-950 border-amber-300 shadow-amber-950/60"
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="text-4xl filter drop-shadow">
                {hazardIcon(activeHazard.type)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-black uppercase tracking-tight">
                    {hazardLabel(activeHazard.type)}
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      isSevere ? "bg-white/20 text-white" : "bg-black/20 text-slate-900"
                    }`}
                  >
                    {isSevere ? "Urgent Hazard" : "Caution Area"}
                  </span>
                </div>
                <div
                  className={`text-xs font-semibold mt-0.5 line-clamp-1 ${
                    isSevere ? "text-white/90" : "text-slate-900/90"
                  }`}
                >
                  {activeHazard.reason || activeHazard.message}
                </div>
              </div>
            </div>

            {/* Distance Callout */}
            <div className="text-right flex-shrink-0 pl-2 border-l border-white/20">
              <div className="text-2xl font-black font-mono leading-none">
                {activeHazard.distance_m}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">
                metres
              </div>
            </div>
          </div>
        ) : (
          /* IDLE GREEN NAVIGATION BANNER */
          <div className="pointer-events-auto bg-emerald-600 text-white shadow-xl rounded-2xl p-3.5 flex items-center justify-between border border-emerald-400/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">
                🛣️
              </div>
              <div>
                <div className="text-sm font-black tracking-tight">Road ahead is clear</div>
                <div className="text-[11px] text-emerald-100 font-medium">
                  Voice hazard guidance is active
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

      {/* ---------------- FULL-SCREEN LEAFLET NAVIGATION MAP ---------------- */}
      <div className="flex-1 w-full h-full relative">
        <MapContainer
          ref={mapRef}
          center={pos ? [pos.lat, pos.lng] : [28.61, 77.21]}
          zoom={16}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full"
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          <MapFollower
            pos={pos}
            followUser={followUser}
            onUserDrag={() => setFollowUser(false)}
          />

          {/* Rider GPS Position Marker with direction beam */}
          {pos && (
            <CircleMarker
              center={[pos.lat, pos.lng]}
              radius={9}
              pathOptions={{
                fillColor: "#3b82f6",
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

          {/* Road Hazards on Map */}
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
                <div className="text-xs text-slate-800 p-1 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>{hazardIcon(hz.hazard_type)}</span>
                    <span>{hazardLabel(hz.hazard_type)}</span>
                  </div>
                  <div className="text-[11px] text-slate-600">{hz.reason}</div>
                  <div className="text-[10px] text-slate-400">
                    {hz.category === "red" ? "🔴 Urgent" : "🟡 Caution"}
                    {hz.is_demo && " • Demo"}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* ---------------- FLOATING CONTROLS (Google Maps Layout) ---------------- */}

        {/* Left: Speedometer Widget */}
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

        {/* Right: Map Action Buttons */}
        <div className="absolute bottom-24 right-4 z-[1100] flex flex-col gap-2.5 pointer-events-auto">
          {/* Voice Mute / Unmute Toggle */}
          <button
            type="button"
            onClick={() => setAlertsEnabled((v) => !v)}
            title={alertsEnabled ? "Mute Voice Alerts" : "Unmute Voice Alerts"}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xl transition backdrop-blur-md border ${
              alertsEnabled
                ? "bg-emerald-600/90 text-white border-emerald-400"
                : "bg-slate-900/90 text-slate-400 border-slate-700"
            }`}
          >
            {alertsEnabled ? "🔊" : "🔇"}
          </button>

          {/* Recenter to User Location */}
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map"
            className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-xl transition backdrop-blur-md border ${
              followUser
                ? "bg-blue-600/90 text-white border-blue-400"
                : "bg-slate-900/90 text-white border-slate-700"
            }`}
          >
            🎯
          </button>
        </div>
      </div>

      {/* ---------------- BOTTOM NAVIGATION BAR (Google Maps Style) ---------------- */}
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 z-[1300] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-xl border border-slate-700">
            🧭
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>SmartGully Navigation</span>
              {isSim && (
                <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded">
                  Sim
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400">
              {hazards.length} hazards monitored within 1 km
            </div>
          </div>
        </div>

        {/* Red End Navigation Button */}
        <button
          type="button"
          onClick={handleStop}
          className="px-5 py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg shadow-red-950/50 flex items-center gap-2"
        >
          <span>✕</span>
          <span>End</span>
        </button>
      </div>
    </div>
  );
}
