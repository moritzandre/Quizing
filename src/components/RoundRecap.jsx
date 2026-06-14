/* ====================================================================
   ROUND RECAP — animated points progression shown between rounds
   --------------------------------------------------------------------
   Each entity's score counts up from its total at the START of the round
   to its total at the END; rows are positioned by their live (interpolated)
   rank so they slide past each other as scores cross (FLIP-lite), bars grow,
   a +N badge shows the round's gain, and the biggest gainer gets a callout.
   Pure props; used by the host overlay and the TV presenter. Honors
   prefers-reduced-motion (jumps to final, no slide).
   ==================================================================== */

import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Avatar, prefersReducedMotion } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/**
 * @param {object} props
 * @param {Array<{id:string,name:string,color?:string,emoji?:string,photo?:string,from:number,to:number}>} props.entities
 * @param {boolean} [props.present] Larger sizing for the TV.
 */
export default function RoundRecap({ entities = [], present = false }) {
  const { t } = useI18n();
  const [tt, setTt] = useState(() => (prefersReducedMotion() ? 1 : 0));

  useEffect(() => {
    if (prefersReducedMotion()) return setTt(1);
    let raf;
    let start;
    const dur = 1500;
    const tick = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / dur);
      setTt(easeOutCubic(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!entities.length) return null;

  const rowH = present ? 68 : 52;
  const gap = present ? 12 : 8;
  const maxTo = Math.max(1, ...entities.map((e) => e.to));
  // Biggest mover: the largest positive gain this round (ties → first).
  const topMover = entities.reduce((best, e) => (e.to - e.from > (best ? best.to - best.from : 0) ? e : best), null);
  const topMoverId = topMover && topMover.to - topMover.from > 0 ? topMover.id : null;

  // Sort by the *current* interpolated score so rows overtake as numbers climb.
  const ranked = entities
    .map((e) => ({ ...e, cur: Math.round(e.from + (e.to - e.from) * tt) }))
    .sort((a, b) => b.cur - a.cur);

  return (
    <div
      className="relative mx-auto w-full max-w-2xl"
      style={{ height: entities.length * rowH + (entities.length - 1) * gap }}
    >
      {ranked.map((e, rank) => {
        const delta = e.to - e.from;
        const barPct = e.to > 0 ? Math.round((e.cur / maxTo) * 100) : 0;
        return (
          <div
            key={e.id}
            className={`qn-climb-row absolute inset-x-0 flex items-center gap-3 rounded-2xl border px-3 ${
              e.id === topMoverId
                ? "border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10"
                : "border-stone-200 bg-white/80 dark:border-stone-800 dark:bg-stone-900/70"
            }`}
            style={{ height: rowH, transform: `translateY(${rank * (rowH + gap)}px)` }}
          >
            <Avatar color={e.color} emoji={e.emoji} photo={e.photo} name={e.name} size={present ? 40 : 30} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className={`truncate font-semibold ${present ? "text-xl" : "text-sm"}`}>{e.name}</span>
                {e.id === topMoverId && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-500 dark:text-amber-950">
                    <Star size={11} className="fill-current" /> {t("play.biggestMover")}
                  </span>
                )}
              </div>
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
              {e.cur}
            </span>
          </div>
        );
      })}
    </div>
  );
}
