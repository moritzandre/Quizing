/* ====================================================================
   LEAFLET MAP (real slippy map via OpenStreetMap / Carto / Esri tiles)
   --------------------------------------------------------------------
   Shows an answer pin and per-player guess markers, draws guess→answer
   lines on reveal, and calls onPick(lat, lng) when clicked (builder +
   phone pin placement). tileLayer="satellite" uses keyless Esri World
   Imagery (and does NOT follow the light/dark theme); otherwise Carto
   tiles track the app theme. Optional `search` (OSM Nominatim) and
   `mapillary` (street-level link-out) overlays are builder-facing.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider.jsx";

const TILES = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
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

const round4 = (n) => Math.round(n * 1e4) / 1e4;
const wrapLng = (lng) => round4(((((lng + 180) % 360) + 360) % 360) - 180);

/**
 * @param {object} props
 * @param {{lat:number,lng:number,label?:string}} [props.answer] Answer/editable pin.
 * @param {Array<{lat:number,lng:number,label?:string,color?:string}>} [props.guesses] Guess markers.
 * @param {boolean} [props.showLines] Draw guess→answer lines and fit all into view.
 * @param {(lat:number,lng:number)=>void} [props.onPick] Click handler to place a pin.
 * @param {"map"|"satellite"} [props.tileLayer] Base layer; satellite ignores the theme.
 * @param {boolean} [props.search] Show a place-search box (sets the pin via onPick).
 * @param {(name:string)=>void} [props.onSearchName] Receives a chosen place's short name.
 * @param {boolean} [props.mapillary] Show a Mapillary street-level link-out button.
 * @param {string} [props.className] Sizing classes (must give the map a height).
 */
export default function LeafletMap({
  answer,
  guesses = [],
  showLines = false,
  onPick,
  tileLayer = "map",
  search = false,
  onSearchName,
  mapillary = false,
  className = "",
}) {
  const { t } = useI18n();
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const tileRef = useRef(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const tileLayerRef = useRef(tileLayer);
  tileLayerRef.current = tileLayer;
  const didCenterRef = useRef(false); // center once on mount; don't yank the view while picking

  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);

  // Choose the base layer: satellite is theme-independent; map follows light/dark.
  const applyTile = () => {
    const map = mapRef.current;
    if (!map) return;
    const key = tileLayerRef.current === "satellite" ? "satellite" : isDark() ? "dark" : "light";
    // Re-add even when the key matches if the tile isn't actually on THIS map
    // (StrictMode/remount leaves a stale ref pointing at a removed map's layer).
    if (tileRef.current && tileRef.current._qnKey === key && map.hasLayer(tileRef.current)) return;
    if (tileRef.current) tileRef.current.remove();
    const layer = L.tileLayer(TILES[key].url, { attribution: TILES[key].attribution, maxZoom: TILES[key].maxZoom });
    layer._qnKey = key;
    layer.addTo(map);
    tileRef.current = layer;
  };

  // init once
  useEffect(() => {
    const map = L.map(elRef.current, { worldCopyJump: true, zoomControl: true, attributionControl: true }).setView(
      [20, 0],
      2,
    );
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    applyTile();

    map.on("click", (e) => onPickRef.current?.(round4(e.latlng.lat), wrapLng(e.latlng.lng)));

    // swap tiles when the app theme toggles (no-op while on satellite)
    const obs = new MutationObserver(() => applyTile());
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const tm = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      obs.disconnect();
      clearTimeout(tm);
      map.remove();
      mapRef.current = null;
      tileRef.current = null; // so a remount re-adds the base layer instead of skipping it
    };
  }, []);

  // rebuild the base layer when the tileLayer prop changes
  useEffect(() => {
    applyTile();
  }, [tileLayer]);

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

  // Place search via the free OpenStreetMap Nominatim service (submit-driven to
  // respect the ~1 req/s usage policy; the browser sends a Referer for them).
  const runSearch = async (e) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    setBusy(true);
    setResults(null);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": typeof navigator !== "undefined" ? navigator.language || "en" : "en" } },
      );
      const data = await res.json();
      setResults(Array.isArray(data) ? data.slice(0, 5) : []);
    } catch {
      setResults([]);
    }
    setBusy(false);
  };
  const pickResult = (r) => {
    const lat = round4(+r.lat);
    const lng = round4(+r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    mapRef.current?.setView([lat, lng], 8);
    onPickRef.current?.(lat, lng);
    onSearchName?.(String(r.display_name || "").split(",")[0]);
    setResults(null);
    setQ("");
  };

  const openMapillary = () => {
    const c = mapRef.current?.getCenter();
    if (c) window.open(`https://www.mapillary.com/app/?lat=${c.lat}&lng=${c.lng}&z=15`, "_blank", "noopener");
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800 ${className}`}
    >
      <div ref={elRef} role="application" aria-label="Interactive map" className="h-full w-full" />

      {search && (
        <div className="absolute left-1/2 top-2 z-[1000] w-[min(20rem,calc(100%-1rem))] -translate-x-1/2">
          <form onSubmit={runSearch} className="flex gap-1.5">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("map.searchPlaceholder")}
              className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white/95 px-3 py-2 text-sm text-stone-900 shadow-sm backdrop-blur placeholder:text-stone-400 focus:outline-none dark:border-stone-700 dark:bg-stone-900/95 dark:text-stone-100"
            />
            <button
              type="submit"
              aria-label={t("map.search")}
              className="flex items-center justify-center rounded-xl bg-indigo-600 px-3 text-white shadow-sm hover:bg-indigo-500"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </form>
          {results && (
            <div className="mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white/95 shadow-lg backdrop-blur dark:border-stone-700 dark:bg-stone-900/95">
              {results.length === 0 ? (
                <p className="px-3 py-2 text-sm text-stone-400">{t("map.noResults")}</p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickResult(r)}
                    className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
                  >
                    {r.display_name}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {mapillary && (
        <button
          type="button"
          onClick={openMapillary}
          className="absolute right-2 top-2 z-[1000] inline-flex items-center gap-1 rounded-xl bg-white/95 px-2.5 py-1.5 text-xs font-medium text-stone-700 shadow-sm backdrop-blur hover:bg-white dark:bg-stone-900/95 dark:text-stone-200"
        >
          <ExternalLink size={13} /> {t("map.streetView")}
        </button>
      )}
    </div>
  );
}
