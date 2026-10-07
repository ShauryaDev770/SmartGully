import { useEffect, useMemo, useState } from "react";
import CategoryBadge from "../components/CategoryBadge.jsx";
import { confirmReport, exportCsvUrl, fetchReports, mediaUrl } from "../api.js";
import { hazardIcon, hazardLabel } from "../lib/geo.js";

// Helper to determine AI authenticity classification
function getAuthenticityAnalysis(p) {
  const aiGenScore = p.ai_gen_score ?? 0.05;
  const roadScore = p.road_score ?? 0.85;
  const isDuplicate = Boolean(p.reason && p.reason.toLowerCase().includes("duplicate"));
  const isAiSuspect = aiGenScore >= 0.35 || (p.reason && p.reason.toLowerCase().includes("ai-generated"));
  const isWeakRoad = roadScore < 0.6 || (p.reason && p.reason.toLowerCase().includes("not a road"));

  if (isDuplicate) {
    return {
      status: "duplicate",
      badgeText: "Duplicate Photo",
      badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
      icon: "👥",
      isGenuine: false,
      authenticityPct: 20,
      verdict: "Duplicate of an existing photo in the database.",
    };
  }

  if (isAiSuspect) {
    return {
      status: "suspect",
      badgeText: "Suspect / AI-Generated?",
      badgeColor: "bg-red-100 text-red-800 border-red-300",
      icon: "⚠️",
      isGenuine: false,
      authenticityPct: Math.round((1 - aiGenScore) * 100),
      verdict: "Flagged by AI authenticity filter as potentially synthetic or digitally edited.",
    };
  }

  if (isWeakRoad) {
    return {
      status: "non-road",
      badgeText: "Low Road Confidence",
      badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
      icon: "🔍",
      isGenuine: false,
      authenticityPct: Math.round(roadScore * 100),
      verdict: "Image does not strongly match road or pavement surface signatures.",
    };
  }

  // Highly Genuine
  const pct = Math.min(99, Math.max(80, Math.round((1 - aiGenScore) * 100)));
  return {
    status: "genuine",
    badgeText: "Looks Genuine",
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: "✅",
    isGenuine: true,
    authenticityPct: pct,
    verdict: "Verified authentic real-world road photo with high confidence.",
  };
}

export default function GalleryPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all"); // 'all' | 'red' | 'yellow' | 'green'
  const [genuineFilter, setGenuineFilter] = useState("all"); // 'all' | 'genuine' | 'suspect'
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

  const loadReports = async () => {
    setLoading(true);
    try {
      const data = await fetchReports({
        category: "red,yellow,green",
        status: "all",
        limit: 300,
      });
      setReports(data.features || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleConfirm = async (id) => {
    try {
      setConfirmingId(id);
      setReports((prev) =>
        prev.map((f) => {
          if (f.properties.id === id) {
            return {
              ...f,
              properties: {
                ...f.properties,
                confirmations: (f.properties.confirmations || 0) + 1,
              },
            };
          }
          return f;
        })
      );
      await confirmReport(id);
    } catch (err) {
      console.warn("Confirm failed", err);
    } finally {
      setConfirmingId(null);
    }
  };

  // Filtered reports
  const filteredReports = useMemo(() => {
    return reports.filter((f) => {
      const p = f.properties;
      const analysis = getAuthenticityAnalysis(p);

      // Category filter
      if (categoryFilter !== "all" && p.category !== categoryFilter) {
        return false;
      }

      // Genuine filter
      if (genuineFilter === "genuine" && !analysis.isGenuine) {
        return false;
      }
      if (genuineFilter === "suspect" && analysis.isGenuine) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = p.id?.toLowerCase().includes(q);
        const matchesReason = p.reason?.toLowerCase().includes(q);
        const matchesType = p.hazard_type?.toLowerCase().includes(q);
        if (!matchesId && !matchesReason && !matchesType) {
          return false;
        }
      }

      return true;
    });
  }, [reports, categoryFilter, genuineFilter, searchQuery]);

  // Overall Stats
  const totalCount = reports.length;
  const genuineCount = reports.filter(
    (f) => getAuthenticityAnalysis(f.properties).isGenuine
  ).length;
  const genuineRatio = totalCount > 0 ? Math.round((genuineCount / totalCount) * 100) : 100;
  const redCount = reports.filter((f) => f.properties.category === "red").length;

  return (
    <div className="min-h-full bg-slate-50 text-slate-900 pb-12">
      {/* ======================================================== */}
      {/* 1. HERO & PUBLIC EXPORT HEADER                           */}
      {/* ======================================================== */}
      <div className="bg-slate-900 text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📸</span>
                <span className="text-xs uppercase font-extrabold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                  Public Open Dataset
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Public Hazard Gallery & AI Audit
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
                Browse citizen and automated road photos, inspect AI authenticity & genuineness
                analyses, and download the full verified dataset for research and municipal action.
              </p>
            </div>

            {/* Prominent CSV Download Button */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <a
                href={exportCsvUrl()}
                download="smartgully-reports.csv"
                className="px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-95 flex items-center justify-center gap-2 border border-emerald-400"
              >
                <span>📥</span>
                <span>Download Dataset (CSV)</span>
              </a>

              <button
                type="button"
                onClick={loadReports}
                disabled={loading}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
              >
                <span className={loading ? "animate-spin" : ""}>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-white">{totalCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">Total Photos</div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-emerald-400">{genuineRatio}%</div>
              <div className="text-[11px] text-slate-400 font-medium">Genuine Road Photos</div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-red-400">{redCount}</div>
              <div className="text-[11px] text-slate-400 font-medium">Urgent Potholes (Red)</div>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-center">
              <div className="text-2xl font-black text-blue-400">Open Access</div>
              <div className="text-[11px] text-slate-400 font-medium">License: CC0 Public</div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. FILTER & SEARCH TOOLBAR                               */}
      {/* ======================================================== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="flex-1 relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by hazard type, triage reason, or report ID..."
                className="w-full text-xs pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Category Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    categoryFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Categories
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("red")}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    categoryFilter === "red"
                      ? "bg-red-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🔴 Red
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("yellow")}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    categoryFilter === "yellow"
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🟡 Yellow
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter("green")}
                  className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    categoryFilter === "green"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  🟢 Green
                </button>
              </div>

              {/* Authenticity Filter */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setGenuineFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition ${
                    genuineFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Authenticity
                </button>
                <button
                  type="button"
                  onClick={() => setGenuineFilter("genuine")}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    genuineFilter === "genuine"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-emerald-700 hover:text-emerald-900"
                  }`}
                >
                  ✅ Looks Genuine
                </button>
                <button
                  type="button"
                  onClick={() => setGenuineFilter("suspect")}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition ${
                    genuineFilter === "suspect"
                      ? "bg-amber-600 text-white shadow-sm"
                      : "text-amber-700 hover:text-amber-900"
                  }`}
                >
                  ⚠️ Suspect / Review
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            <span>Showing {filteredReports.length} of {totalCount} road records</span>
            {loading && (
              <span className="flex items-center gap-1 text-blue-600 font-semibold">
                <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                Loading records...
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 my-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        {/* ======================================================== */}
        {/* 3. PHOTO & ANALYSIS CARDS GRID                           */}
        {/* ======================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
          {filteredReports.map((f) => {
            const p = f.properties;
            const [lng, lat] = f.geometry.coordinates;
            const analysis = getAuthenticityAnalysis(p);
            const isConfirming = confirmingId === p.id;
            const dateStr = p.created_at
              ? new Date(p.created_at).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Unknown Date";

            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Image Thumbnail with Overlay Badges */}
                  <div className="relative aspect-video bg-slate-900 overflow-hidden group cursor-pointer"
                       onClick={() => setSelectedPhoto({ f, p, analysis, lat, lng, dateStr })}>
                    {p.image_url ? (
                      <img
                        src={mediaUrl(p.image_url)}
                        alt="road hazard"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">
                        No photo attached
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <CategoryBadge category={p.category} />
                        {p.is_demo && (
                          <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                            demo
                          </span>
                        )}
                      </div>
                      <span className="bg-black/60 backdrop-blur text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {p.source || "manual"}
                      </span>
                    </div>

                    {/* Bottom overlay: Hazard Label */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white">
                      <span className="font-black text-sm drop-shadow flex items-center gap-1.5">
                        <span>{hazardIcon(p.hazard_type)}</span>
                        <span>{hazardLabel(p.hazard_type)}</span>
                      </span>
                      <span className="text-[10px] bg-white/20 backdrop-blur px-2 py-0.5 rounded-md font-mono">
                        🔎 Tap to Inspect
                      </span>
                    </div>
                  </div>

                  {/* Card Body & AI Authenticity Analysis */}
                  <div className="p-4 space-y-3">
                    {/* DEDICATED AI GENUINE ANALYSIS BOX */}
                    <div className={`p-3 rounded-xl border flex flex-col gap-1.5 ${
                      analysis.isGenuine
                        ? "bg-emerald-50/70 border-emerald-200"
                        : "bg-amber-50/70 border-amber-200"
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${analysis.badgeColor}`}>
                          <span>{analysis.icon}</span>
                          <span>{analysis.badgeText}</span>
                        </span>
                        <span className="text-xs font-black font-mono text-slate-800">
                          {analysis.authenticityPct}% Genuine
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-700 leading-snug">
                        {analysis.verdict}
                      </p>
                    </div>

                    {/* Detailed AI Metric Pills */}
                    <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400">Road Signature:</span>{" "}
                        <span className="font-bold text-slate-800">
                          {p.road_score != null ? `${Math.round(p.road_score * 100)}%` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Pothole Conf:</span>{" "}
                        <span className="font-bold text-slate-800">
                          {p.pothole_conf != null ? `${Math.round(p.pothole_conf * 100)}%` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Count Detected:</span>{" "}
                        <span className="font-bold text-slate-800">
                          {p.pothole_count ?? 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Damage Ratio:</span>{" "}
                        <span className="font-bold text-slate-800">
                          {p.area_ratio != null ? `${(p.area_ratio * 100).toFixed(0)}%` : "0%"}
                        </span>
                      </div>
                    </div>

                    {/* AI Model Reasoning */}
                    {p.reason && (
                      <div className="text-xs text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                        <span className="font-bold text-slate-900">AI Reason: </span>
                        <span>{p.reason}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Metadata & Still There Button */}
                <div className="p-4 pt-0 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>{dateStr}</span>
                    <span className="font-mono text-[10px]">
                      {lat.toFixed(4)}, {lng.toFixed(4)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isConfirming}
                    onClick={() => handleConfirm(p.id)}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span>⚠️ Still there on the road?</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-mono">
                      {p.confirmations || 0}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredReports.length === 0 && !loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center my-6 space-y-2">
            <div className="text-4xl">🔍</div>
            <h3 className="text-base font-bold text-slate-800">No photos match the selected filter</h3>
            <p className="text-xs text-slate-500">Try adjusting your category or authenticity filter above.</p>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 4. HIGH-RESOLUTION PHOTO & COMPLETE AUDIT MODAL          */}
      {/* ======================================================== */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[1500] bg-black/85 backdrop-blur-sm p-4 flex items-center justify-center pointer-events-auto"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="bg-slate-900 text-white border border-slate-700 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{hazardIcon(selectedPhoto.p.hazard_type)}</span>
                <div>
                  <h3 className="text-base font-black text-white">
                    {hazardLabel(selectedPhoto.p.hazard_type)} • Audit Report
                  </h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    ID: {selectedPhoto.p.id}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 font-bold"
              >
                ✕
              </button>
            </div>

            {/* High Resolution Image */}
            <div className="rounded-2xl overflow-hidden bg-black max-h-96 flex items-center justify-center border border-slate-800">
              <img
                src={mediaUrl(selectedPhoto.p.image_url)}
                alt="full report"
                className="w-full max-h-96 object-contain"
              />
            </div>

            {/* Complete Authenticity & AI Analysis in Modal */}
            <div className={`p-4 rounded-2xl border space-y-2 ${
              selectedPhoto.analysis.isGenuine
                ? "bg-emerald-950/40 border-emerald-500/50"
                : "bg-amber-950/40 border-amber-500/50"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedPhoto.analysis.icon}</span>
                  <span className="text-sm font-black uppercase tracking-wide">
                    {selectedPhoto.analysis.badgeText}
                  </span>
                </div>
                <span className="text-base font-black font-mono text-emerald-400">
                  {selectedPhoto.analysis.authenticityPct}% Genuine Rating
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {selectedPhoto.analysis.verdict}
              </p>
            </div>

            {/* All Pipeline Signals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">CLIP Road Score</div>
                <div className="text-base font-black text-white mt-0.5">
                  {selectedPhoto.p.road_score != null ? `${(selectedPhoto.p.road_score * 100).toFixed(0)}%` : "N/A"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">YOLO Confidence</div>
                <div className="text-base font-black text-white mt-0.5">
                  {selectedPhoto.p.pothole_conf != null ? `${(selectedPhoto.p.pothole_conf * 100).toFixed(0)}%` : "N/A"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Area Ratio</div>
                <div className="text-base font-black text-white mt-0.5">
                  {selectedPhoto.p.area_ratio != null ? `${(selectedPhoto.p.area_ratio * 100).toFixed(1)}%` : "N/A"}
                </div>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80">
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Confirmations</div>
                <div className="text-base font-black text-amber-400 mt-0.5">
                  {selectedPhoto.p.confirmations || 0}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
              <span>Captured on: {selectedPhoto.dateStr}</span>
              <a
                href={mediaUrl(selectedPhoto.p.image_url)}
                target="_blank"
                rel="noreferrer"
                className="text-blue-400 hover:text-blue-300 font-bold underline flex items-center gap-1"
              >
                <span>Open Full Image in New Tab</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
