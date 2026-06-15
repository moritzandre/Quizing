/* ====================================================================
   RECAP MINIGAME SHARED HELPERS
   --------------------------------------------------------------------
   The between-rounds recap can play as one of several 8-bit minigame
   "skins" (Space Invaders, Rocket Race, …). They all animate the same
   data — each entity's score from its start-of-round total to its
   end-of-round total — so they share one rAF progress clock and a few
   pure helpers here. No JSX; the variant components live in sibling
   files and render the visuals.
   ==================================================================== */

import { useEffect, useState } from "react";
import { prefersReducedMotion } from "../ui.jsx";

/** Ease-out cubic — fast start, gentle settle (used for the score count-up). */
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/**
 * A 0→1 progress value over `duration` ms, driven by requestAnimationFrame.
 * Honors prefers-reduced-motion (starts and stays at 1, i.e. the final state).
 * @param {number} [duration]
 * @returns {number} progress, 0..1
 */
export function useRecapProgress(duration = 4200) {
  const [p, setP] = useState(() => (prefersReducedMotion() ? 1 : 0));
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf;
    let start;
    const tick = (now) => {
      if (start == null) start = now;
      const t = Math.min(1, (now - start) / duration);
      setP(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return p;
}

/**
 * Decorate + sort recap entities by final score (descending) and flag the
 * biggest positive mover. Shared by every variant so ranking is consistent.
 * @param {Array<{id:string,from:number,to:number}>} entities
 */
export function rankRecap(entities) {
  const topMover = entities.reduce((best, e) => (e.to - e.from > (best ? best.to - best.from : 0) ? e : best), null);
  const topMoverId = topMover && topMover.to - topMover.from > 0 ? topMover.id : null;
  const ranked = [...entities].sort((a, b) => b.to - a.to);
  const maxTo = Math.max(1, ...entities.map((e) => e.to));
  return { ranked, topMoverId, maxTo };
}

/** The interpolated score for an entity at progress `p` (eased), as an integer. */
export const scoreAt = (e, p) => Math.round(e.from + (e.to - e.from) * easeOutCubic(p));

/**
 * How many sprite "glyphs" to show for a round gain — one per point, but
 * capped so a big gain stays on screen (the real number is the count-up).
 * Returns 0 for a flat/negative round (nothing to destroy/collect).
 * @param {number} delta to - from
 * @param {number} [max]
 */
export const glyphsForDelta = (delta, max = 12) => {
  const d = Math.round(delta);
  return d <= 0 ? 0 : Math.max(1, Math.min(max, d));
};
