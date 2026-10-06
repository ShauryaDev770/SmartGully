import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage.jsx";
import MapPage from "./pages/MapPage.jsx";
import ReportPage from "./pages/ReportPage.jsx";

const linkClass = ({ isActive }) =>
  `px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl transition ${
    isActive
      ? "bg-white text-slate-900 shadow-sm"
      : "text-white/80 hover:text-white hover:bg-white/10"
  }`;

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-100 font-sans antialiased text-slate-900">
      <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between z-[1000] border-b border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛣️</span>
          <div>
            <span className="font-extrabold text-base sm:text-lg tracking-tight">SmartGully</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              Civic AI
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-1 sm:gap-2">
          <NavLink to="/map" className={linkClass}>
            🗺️ <span className="ml-1">Map</span>
          </NavLink>
          <NavLink to="/report" className={linkClass}>
            📷 <span className="ml-1">Report</span>
          </NavLink>
          <NavLink to="/admin" className={linkClass}>
            ⚙️ <span className="ml-1">Admin</span>
          </NavLink>
        </nav>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/map" replace />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </main>
    </div>
  );
}
