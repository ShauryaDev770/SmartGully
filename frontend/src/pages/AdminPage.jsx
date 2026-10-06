import { useEffect, useState } from "react";
import CategoryBadge from "../components/CategoryBadge.jsx";
import { exportCsvUrl, fetchReports, fetchStats, mediaUrl } from "../api.js";

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const cats =
        categoryFilter === "all" ? "red,yellow,green" : categoryFilter;
      const [s, geo] = await Promise.all([
        fetchStats(),
        fetchReports({
          category: cats,
          status: statusFilter,
          limit: 100,
        }),
      ]);
      setStats(s);
      setRows(geo.features || []);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, statusFilter, categoryFilter]);

  const getStatusBadge = (status) => {
    const map = {
      pending: "bg-amber-100 text-amber-800 border-amber-300",
      processing: "bg-blue-100 text-blue-800 border-blue-300 animate-pulse",
      processed: "bg-emerald-100 text-emerald-800 border-emerald-300",
      failed: "bg-red-100 text-red-800 border-red-300",
    };
    const cls = map[status] || "bg-slate-100 text-slate-800 border-slate-300";
    return (
      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${cls}`}>
        {status || "unknown"}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & CSV Download */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Control Center</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Civic road triage monitoring, priority statistics, and raw data export.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span> Refresh
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-300 px-3 py-2.5 rounded-xl cursor-pointer shadow-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="accent-slate-900"
            />
            Auto (5s)
          </label>
          <a
            href={exportCsvUrl()}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow transition"
          >
            <span>📥</span> Download CSV
          </a>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}

      {/* KPI Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <div className="text-slate-500 text-xs font-semibold uppercase">Total Reports</div>
            <div className="text-3xl font-extrabold text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 border-l-red-500">
            <div className="text-red-700 text-xs font-semibold uppercase">Red (Urgent)</div>
            <div className="text-3xl font-extrabold text-red-600 mt-1">{stats.red}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 border-l-yellow-400">
            <div className="text-yellow-700 text-xs font-semibold uppercase">Yellow (Review)</div>
            <div className="text-3xl font-extrabold text-yellow-600 mt-1">{stats.yellow}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 border-l-green-500">
            <div className="text-green-700 text-xs font-semibold uppercase">Green (Ignored)</div>
            <div className="text-3xl font-extrabold text-green-600 mt-1">{stats.green}</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 border-l-4 border-l-amber-400">
            <div className="text-amber-700 text-xs font-semibold uppercase">Pending Worker</div>
            <div className="text-3xl font-extrabold text-amber-600 mt-1">{stats.pending}</div>
          </div>
        </div>
      )}

      {/* Top Hotspot Clusters */}
      {stats?.top_clusters?.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Top High-Density Road Cells (11m Clusters)
          </h2>
          <div className="flex flex-wrap gap-2">
            {stats.top_clusters.map((c) => (
              <span
                key={c.cluster_key}
                className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-700"
              >
                {c.cluster_key}: <b className="text-slate-900">{c.count} reports</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-bold text-slate-500 uppercase">Filter:</span>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg bg-white font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="processed">Processed</option>
              <option value="pending">Pending</option>
            </select>
          </div>
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg bg-white font-medium"
            >
              <option value="all">All Categories</option>
              <option value="red">Red Only</option>
              <option value="yellow">Yellow Only</option>
              <option value="green">Green Only</option>
            </select>
          </div>
        </div>
        <div className="text-xs text-slate-500 font-medium">Showing {rows.length} reports</div>
      </div>

      {/* Reports Table */}
      <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
        <table className="min-w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">Photo</th>
              <th className="p-3">Status</th>
              <th className="p-3">Category</th>
              <th className="p-3">AI Triage Reason</th>
              <th className="p-3">Scores</th>
              <th className="p-3">Reported At</th>
              <th className="p-3 text-center">Votes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400">
                  No reports matching filter
                </td>
              </tr>
            ) : (
              rows.map((f) => {
                const p = f.properties;
                const formattedDate = p.created_at ? new Date(p.created_at).toLocaleString() : "-";
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-2.5">
                      {p.image_url ? (
                        <img
                          src={mediaUrl(p.image_url)}
                          alt="thumbnail"
                          className="w-12 h-12 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition"
                          onClick={() => setSelectedPhoto(mediaUrl(p.image_url))}
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                          📷
                        </div>
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap">{getStatusBadge(p.status)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <CategoryBadge category={p.category} />
                    </td>
                    <td className="p-3 max-w-xs font-medium text-slate-800 leading-snug">
                      {p.reason || <span className="text-slate-400 italic">Awaiting AI worker</span>}
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-500">
                      {p.pothole_conf != null && p.pothole_conf > 0 ? (
                        <div className="space-y-0.5">
                          <div>Conf: {(p.pothole_conf * 100).toFixed(0)}%</div>
                          <div>Count: {p.pothole_count}</div>
                        </div>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-500">{formattedDate}</td>
                    <td className="p-3 text-center font-bold text-slate-700">{p.confirmations || 0}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal for full photo view */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-slate-900 rounded-2xl overflow-hidden p-2">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold hover:bg-black"
            >
              ✕
            </button>
            <img src={selectedPhoto} alt="Full view" className="max-h-[80vh] w-auto mx-auto rounded-xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
