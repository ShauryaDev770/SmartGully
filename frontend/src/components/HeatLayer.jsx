import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "../leaflet-setup.js";
import "leaflet.heat";

export default function HeatLayer({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !points || !L.heatLayer) return undefined;
    const validPoints = points.filter(
      (p) => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1])
    );
    if (validPoints.length === 0) return undefined;

    const layer = L.heatLayer(validPoints, {
      radius: 25,
      blur: 18,
      maxZoom: 17,
      minOpacity: 0.35,
    });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);

  return null;
}
