/* ====================================================================
   LEAFLET MAP (real slippy map via OpenStreetMap / Carto tiles)
   --------------------------------------------------------------------
   Replaces the stylized dot grid for map rounds. Shows an answer pin and
   per-player guess markers, draws guess→answer lines on reveal, and calls
   onPick(lat, lng) when clicked (builder + phone pin placement). Tiles
   need internet; the layer switches with the app's light/dark theme.
   ==================================================================== */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const TILES = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
};

const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

const answerIcon = () =>
  L.divIcon({
    className: "",
    html: '<div style="width:18px;height:18px;border-radius:9999px;background:#4f46e5;border:3px solid #fff;box-shadow:0 0 0 3px rgba(79,70,229,.35)"></div>',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

/**
 * @param {object} props
 * @param {{lat:number,lng:number,label?:string}} [props.answer] Answer/editable pin.
 * @param {Array<{lat:number,lng:number,label?:string,color?:string}>} [props.guesses] Guess markers.
 * @param {boolean} [props.showLines] Draw guess→answer lines and fit all into view.
 * @param {(lat:number,lng:number)=>void} [props.onPick] Click handler to place a pin.
 * @param {string} [props.className] Sizing classes (must give the map a height).
 */
export default function LeafletMap({ answer, guesses = [], showLines = false, onPick, className = "" }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const didCenterRef = useRef(false); // center once on mount; don't yank the view while picking

  // init once
  useEffect(() => {
    const map = L.map(elRef.current, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView(
      [20, 0],
      2,
    );
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);

    const theme = isDark() ? "dark" : "light";
    tileRef.current = L.tileLayer(TILES[theme].url, { attribution: TILES[theme].attribution, maxZoom: 18 }).addTo(map);

    map.on("click", (e) =>
      onPickRef.current?.(
        Math.round(e.latlng.lat * 1e4) / 1e4,
        Math.round((((((e.latlng.lng + 180) % 360) + 360) % 360) - 180) * 1e4) / 1e4,
      ),
    );

    // swap tiles when the app theme toggles
    const obs = new MutationObserver(() => {
      const next = isDark() ? "dark" : "light";
      const cur = tileRef.current?._url === TILES.dark.url ? "dark" : "light";
      if (next !== cur && mapRef.current) {
        if (tileRef.current) tileRef.current.remove();
        tileRef.current = L.tileLayer(TILES[next].url, { attribution: TILES[next].attribution, maxZoom: 18 }).addTo(
          mapRef.current,
        );
      }
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    // container may have been sized after mount
    const t = setTimeout(() => map.invalidateSize(), 60);

    return () => {
      obs.disconnect();
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // keep the cursor/interaction hint in sync with whether picking is enabled
  useEffect(() => {
    const el = elRef.current;
    if (el) el.style.cursor = onPick ? "crosshair" : "";
  }, [onPick]);

  // redraw markers/lines when data changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const pts = [];
    const ans = answer && answer.lat != null && answer.lng != null ? [answer.lat, answer.lng] : null;

    guesses
      .filter((g) => g && g.lat != null && g.lng != null)
      .forEach((g) => {
        const ll = [g.lat, g.lng];
        pts.push(ll);
        L.circleMarker(ll, {
          radius: 8,
          color: "#ffffff",
          weight: 2.5,
          fillColor: g.color || "#78716c",
          fillOpacity: 1,
        })
          .addTo(layer)
          .bindTooltip(g.label || "", {
            permanent: true,
            direction: "top",
            offset: [0, -8],
            className: "qn-map-label",
          });
        if (showLines && ans) {
          L.polyline([ll, ans], { color: g.color || "#78716c", weight: 2, dashArray: "4 6", opacity: 0.6 }).addTo(
            layer,
          );
        }
      });

    if (ans) {
      pts.push(ans);
      // Non-interactive while picking, so tapping the pin itself relocates it.
      const m = L.marker(ans, { icon: answerIcon(), interactive: !onPickRef.current && !!answer.label }).addTo(layer);
      if (answer.label) m.bindTooltip(answer.label, { permanent: true, direction: "top", offset: [0, -10] });
    }

    // On reveal, frame all the points. Otherwise only center once (initial load)
    // so the view doesn't jump while the user pans or places pins.
    if (showLines && pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.3), { maxZoom: 6 });
      didCenterRef.current = true;
    } else if (!didCenterRef.current && pts.length) {
      map.setView(pts[0], Math.max(map.getZoom(), 4));
      didCenterRef.current = true;
    }
  }, [answer, guesses, showLines]);

  return (
    <div
      ref={elRef}
      role="application"
      aria-label="Interactive map"
      className={`w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 ${className}`}
    />
  );
}
