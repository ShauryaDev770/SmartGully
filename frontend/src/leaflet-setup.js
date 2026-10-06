import L from "leaflet";

// Ensure Leaflet is accessible globally for plugins like leaflet.heat
if (typeof window !== "undefined") {
  window.L = L;
}

export default L;
