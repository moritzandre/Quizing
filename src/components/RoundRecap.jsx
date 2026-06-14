/* ====================================================================
   ROUND RECAP — animated points progression shown between rounds
   --------------------------------------------------------------------
   Each entity's score counts up from its total at the START of the round
   to its total at the END, bars grow at their own pace, and a +N badge
   shows what the round added. Pure props; used by the host overlay and
   the TV presenter. Honors prefers-reduced-motion (jumps to final).
   ==================================================================== */

import { useEffect, useState } from "react";
import { Avatar } from "./ui.jsx";

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/**
 * @param {object} props
 * @param {Array<{id:string,name:string,color?:string,emoji?:string,photo?:string,from:number,to:number}>} props.entities
 * @param {boolean} [props.present] Larger sizing for the TV.
 */
export default function RoundRecap({ entities = [], present = false }) {
  const [t, setT] = useState(() => (reduceMotion() ? 1 : 0));

  useEffect(() => {
    if (reduceMotion()) return setT(1);
    let raf;
    let start;
    const dur = 1500;
    const tick = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / dur);
      setT(easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sorted = [...entities].sort((a, b) => b.to - a.to);
  const maxTo = Math.max(1, ...sorted.map((e) => e.to));
  if (!sorted.length) return null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-2">
      {sorted.map((e) => {
        const cur = Math.round(e.from + (e.to - e.from) * t);
        const delta = e.to - e.from;
        const barPct = e.to > 0 ? Math.round((cur / maxTo) * 100) : 0;
        return (
          <div
            key={e.id}
            className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white/80 px-3 py-2 dark:border-stone-800 dark:bg-stone-900/70"
          >
            <Avatar color={e.color} emoji={e.emoji} photo={e.photo} name={e.name} size={present ? 40 : 30} />
            <div className="min-w-0 flex-1">
              <div className={`truncate font-semibold ${present ? "text-xl" : "text-sm"}`}>{e.name}</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${barPct}%`, backgroundColor: e.color || "#6366f1" }}
                />
              </div>
            </div>
            {delta !== 0 && (
              <span
                className={`shrink-0 text-sm font-semibold tabular-nums ${
                  delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {delta > 0 ? "+" : "−"}
                {Math.abs(delta)}
              </span>
            )}
            <span className={`w-12 shrink-0 text-right font-bold tabular-nums ${present ? "text-3xl" : "text-lg"}`}>
              {cur}
            </span>
          </div>
        );
      })}
    </div>
  );
}
