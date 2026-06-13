/* ====================================================================
   WORLD MAP (minimalist dot grid, equirectangular projection)
   --------------------------------------------------------------------
   72×36 grid of 5° cells. LAND lists, per row, the column ranges that
   are land. Pin placement uses exact lat/lng. Pass onPick to make the
   map clickable (used by the builder to place pins).
   ==================================================================== */

import { useRef } from "react";

const LAND = [
  [1, [[16, 19], [25, 31]]],
  [2, [[14, 21], [24, 32], [39, 40], [47, 48], [54, 55]]],
  [3, [[11, 22], [25, 32], [41, 41], [46, 59], [63, 71]]],
  [4, [[3, 22], [25, 32], [37, 71]]],
  [5, [[3, 16], [21, 23], [26, 27], [31, 32], [37, 71]]],
  [6, [[5, 16], [20, 24], [34, 35], [37, 38], [40, 64], [67, 68]]],
  [7, [[10, 24], [34, 34], [35, 63], [64, 64], [67, 67]]],
  [8, [[11, 24], [35, 45], [47, 63], [64, 64]]],
  [9, [[11, 22], [34, 41], [44, 45], [47, 62], [64, 64]]],
  [10, [[11, 20], [34, 35], [38, 40], [41, 45], [47, 61], [63, 64]]],
  [11, [[12, 20], [34, 34], [36, 60], [62, 63]]],
  [12, [[13, 16], [19, 19], [33, 45], [47, 60]]],
  [13, [[14, 16], [19, 20], [32, 47], [50, 57], [60, 60]]],
  [14, [[15, 18], [21, 22], [32, 46], [50, 52], [54, 57], [60, 60]]],
  [15, [[17, 19], [21, 23], [32, 46], [51, 52], [55, 57], [60, 61]]],
  [16, [[20, 25], [33, 45], [51, 52], [56, 57], [58, 61]]],
  [17, [[20, 26], [33, 45], [55, 56], [57, 61]]],
  [18, [[20, 27], [37, 44], [56, 57], [58, 60], [62, 65]]],
  [19, [[20, 28], [38, 44], [57, 58], [63, 65]]],
  [20, [[20, 28], [38, 44], [61, 62], [64, 64]]],
  [21, [[21, 28], [38, 43], [44, 45], [60, 65]]],
  [22, [[22, 28], [38, 43], [44, 45], [58, 66]]],
  [23, [[22, 26], [39, 42], [58, 66]]],
  [24, [[21, 25], [39, 42], [59, 66]]],
  [25, [[21, 24], [64, 66], [70, 71]]],
  [26, [[21, 23], [65, 65], [69, 70]]],
  [27, [[21, 22], [69, 69]]],
  [28, [[21, 23]]],
];

const DOTS = [];
LAND.forEach(([row, ranges]) =>
  ranges.forEach(([a, b]) => {
    for (let c = a; c <= b; c++) DOTS.push([c, row]);
  })
);

/**
 * Dot-grid world map. Shows a pin at { lat, lng, label } when given;
 * pass onPick(lat, lng) to make the map clickable.
 */
export default function WorldMap({ pin, onPick, className = "" }) {
  const ref = useRef(null);
  const CW = 1000 / 72;
  const CH = 500 / 36;
  const toXY = (lat, lng) => [((lng + 180) / 360) * 1000, ((90 - lat) / 180) * 500];

  const handleClick = (e) => {
    if (!onPick || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 1000;
    const y = ((e.clientY - r.top) / r.height) * 500;
    onPick(Math.round((90 - (y / 500) * 180) * 100) / 100, Math.round(((x / 1000) * 360 - 180) * 100) / 100);
  };

  let px = null, py = null;
  if (pin && pin.lat != null && pin.lng != null) [px, py] = toXY(pin.lat, pin.lng);
  const labelX = px == null ? 0 : Math.min(Math.max(px, 90), 910);

  return (
    <svg
      ref={ref}
      viewBox="0 0 1000 500"
      role="img"
      aria-label={pin?.label ? `World map showing ${pin.label}` : "World map"}
      onClick={handleClick}
      className={`w-full rounded-2xl border border-stone-200 bg-white ${onPick ? "cursor-crosshair" : ""} ${className}`}
    >
      {DOTS.map(([c, r], i) => (
        <circle key={i} cx={(c + 0.5) * CW} cy={(r + 0.5) * CH} r="4.6" className="fill-stone-300" />
      ))}
      {px != null && (
        <g>
          <circle cx={px} cy={py} r="16" className="animate-pulse fill-indigo-500 opacity-20" />
          <circle cx={px} cy={py} r="7.5" className="fill-indigo-600" />
          <circle cx={px} cy={py} r="2.8" className="fill-white" />
          {pin.label && (
            <text
              x={labelX}
              y={Math.max(py - 18, 16)}
              textAnchor="middle"
              fontSize="20"
              fontWeight="700"
              className="fill-stone-900"
              stroke="white"
              strokeWidth="5"
              paintOrder="stroke"
            >
              {pin.label}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
