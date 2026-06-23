import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/** A purple map pin built as an inline SVG divIcon, so we don't depend on
 *  Leaflet's bundled marker PNGs (which break under bundlers without extra
 *  asset wiring). */
const pinIcon = L.divIcon({
  className: "uski-map-pin",
  html:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 22s7-6.4 7-12A7 7 0 1 0 5 10c0 5.6 7 12 7 12z" fill="#7c5cff" stroke="#ffffff" stroke-width="1.5"/>' +
    '<circle cx="12" cy="10" r="2.6" fill="#ffffff"/></svg>',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
});

interface SessionMapProps {
  lat: number;
  lon: number;
  /** Pre-escaped HTML for the marker popup. */
  popupHtml?: string;
  zoom?: number;
  className?: string;
  /** Open the popup on mount (used in the maximized view). */
  openPopup?: boolean;
  /** Allow wheel zoom (enabled in the maximized view). */
  scrollWheelZoom?: boolean;
}

/**
 * Leaflet + OpenStreetMap map with a single clickable marker. Each instance
 * owns its own map; cleaned up on unmount. Calls invalidateSize shortly after
 * mount so it lays out correctly inside dialogs/cards that size after render.
 */
export function SessionMap({
  lat,
  lon,
  popupHtml,
  zoom = 11,
  className,
  openPopup = false,
  scrollWheelZoom = false,
}: SessionMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, {
      center: [lat, lon],
      zoom,
      scrollWheelZoom,
      attributionControl: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const marker = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
    if (popupHtml) {
      marker.bindPopup(popupHtml);
      if (openPopup) marker.openPopup();
    }

    const t = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
    // Intentionally init-once; coord/view updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setView([lat, lon], zoom);
  }, [lat, lon, zoom]);

  return <div ref={elRef} className={className} aria-label="Location map" role="img" />;
}
