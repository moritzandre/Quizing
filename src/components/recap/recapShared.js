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

import { useCallback, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../ui.jsx";
import { playSound } from "../../lib/sound.js";

/** Ease-out cubic — fast start, gentle settle (used for the score count-up). */
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

/**
 * How long the whole recap runs (ms): a little slower overall, and scaled by how
 * many points were scored THIS round — a big round counts up over more time, a
 * quiet round is quick. Clamped to a sensible floor/ceiling.
 * @param {Array<{from?:number,to?:number}>} entities
 */
export function recapDuration(entities) {
  const points = (Array.isArray(entities) ? entities : []).reduce((sum, e) => {
    const d = Math.round((Number(e?.to) || 0) - (Number(e?.from) || 0));
    return sum + (d > 0 ? d : 0);
  }, 0);
  return Math.max(3500, Math.min(10000, 3000 + points * 140));
}

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
 * Stagger one entity's local 0→1 progress out of the shared clock so rows
 * resolve one-by-one for drama (instead of all at once). `resolveIndex` is the
 * order this entity should finish in (0 = first, n-1 = last); pass
 * `n - 1 - rank` to make the leader land last. `spread` (0..1) is how
 * sequential it feels (0 = simultaneous).
 * @param {number} p shared progress 0..1
 * @param {number} resolveIndex
 * @param {number} n entity count
 * @param {number} [spread]
 */
export const phaseFor = (p, resolveIndex, n, spread = 0.4) => {
  if (n <= 1) return p;
  const span = 1 - spread;
  const start = (Math.max(0, Math.min(n - 1, resolveIndex)) / (n - 1)) * spread;
  return Math.max(0, Math.min(1, (p - start) / span));
};

/**
 * A throttled per-event sound trigger for the recap minigames. Call with a
 * monotonically-increasing event count (e.g. total invaders destroyed) and it
 * plays `kind` once per new event, rate-limited so a big burst still sounds
 * like rapid arcade fire rather than a wall of noise. No-op when disabled
 * (used to keep audio on the host only, not the TV mirror).
 * @param {boolean} enabled
 * @returns {(count:number, kind:string) => void}
 */
export function useRecapSfx(enabled) {
  const seen = useRef(0);
  const lastAt = useRef(0);
  return useCallback(
    (count, kind) => {
      const c = Number.isFinite(count) ? count : 0;
      if (!enabled || c <= seen.current) {
        seen.current = c;
        return;
      }
      seen.current = c;
      const now = typeof performance !== "undefined" ? performance.now() : 0;
      if (now - lastAt.current < 55) return; // throttle rapid-fire blips
      lastAt.current = now;
      playSound(kind);
    },
    [enabled],
  );
}

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
