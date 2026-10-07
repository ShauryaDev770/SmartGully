import { createContext, useContext, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const RideUiContext = createContext({ rideActive: false, setRideActive: () => {} });

export function useRideUi() {
  return useContext(RideUiContext);
}

const tabs = [
  { to: "/", label: "Explore", icon: "🗺️", end: true },
  { to: "/navigate", label: "Directions", icon: "🧭" },
  { to: "/gallery", label: "Gallery", icon: "📸" },
  { to: "/report", label: "Report", icon: "➕" },
];

export default function AppShell() {
  const [rideActive, setRideActive] = useState(false);
  const location = useLocation();
  const hideTabs = rideActive;
  const value = useMemo(() => ({ rideActive, setRideActive }), [rideActive]);

  return (
    <RideUiContext.Provider value={value}>
      <div className="min-h-screen flex flex-col bg-slate-100 font-sans antialiased text-slate-900">
        {!hideTabs && (
          <header className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between z-[1000] border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xl">🛣️</span>
              <span className="font-extrabold text-base tracking-tight">SmartGully</span>
              <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                One hazard layer
              </span>
            </div>
            <a
              href="/api/export.csv"
              download="smartgully-hazards.csv"
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <span>📥</span>
              <span>CSV Data</span>
            </a>
          </header>
        )}
        <main className={`flex-1 min-h-0 flex flex-col ${hideTabs ? "" : "pb-16"}`}>
          <Outlet />
        </main>
        {!hideTabs && (
          <nav className="fixed bottom-0 inset-x-0 z-[1100] bg-slate-900 text-white border-t border-slate-800 grid grid-cols-4">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 text-[11px] font-bold ${
                    isActive ? "text-emerald-300" : "text-white/70"
                  }`
                }
              >
                <span className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </RideUiContext.Provider>
  );
}
