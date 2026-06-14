/* ====================================================================
   PODIUM CLIMB — animated live standings (host overlay + TV presenter)
   --------------------------------------------------------------------
   Pure props: a `standings` array of { name, score, color, emoji }. Rows
   are absolutely positioned by rank and slide to their new spot as scores
   change (.qn-climb-row FLIP-lite); an avatar that just gained points
   hops (.qn-hop). Used by the host's standings overlay and PresenterView,
   so it must stay framework-light and import no game/room state.
   ==================================================================== */

import { useEffect, useRef } from "react";
import { Avatar } from "./ui.jsx";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * @param {object} props
 * @param {Array<{id?:string,name:string,score:number,color?:string,emoji?:string}>} props.standings
 * @param {boolean} [props.present] Larger sizing for across-the-room (TV) reading.
 */
const idOf = (s) => s.id || s.name; // stable per-entity key (names can collide)

export default function PodiumClimb({ standings = [], present = false }) {
  const sorted = [...standings].sort((a, b) => b.score - a.score);
  const prev = useRef({}); // id -> last score, to trigger a hop on a gain
  useEffect(() => {
    const m = {};
    for (const s of sorted) m[idOf(s)] = s.score;
    prev.current = m;
  });

  const rowH = present ? 76 : 56;
  const gap = present ? 12 : 8;
  const maxScore = Math.max(1, ...sorted.map((s) => s.score));
  const avatarSize = present ? 48 : 34;

  if (!sorted.length) return null;

  return (
    <div className="relative mx-auto w-full max-w-2xl" style={{ height: sorted.length * (rowH + gap) }}>
      {sorted.map((s, rank) => {
        const gained = (prev.current[idOf(s)] ?? s.score) < s.score;
        const barPct = s.score > 0 ? Math.round((s.score / maxScore) * 100) : 0;
        const top3 = rank < 3;
        return (
          <div
            key={idOf(s)}
            className={`qn-climb-row absolute inset-x-0 flex items-center gap-3 rounded-2xl border px-3 ${
              top3
                ? "border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10"
                : "border-stone-200 bg-white/80 dark:border-stone-800 dark:bg-stone-900/70"
            }`}
            style={{ top: rank * (rowH + gap), height: rowH }}
          >
            <span
              className={`w-8 shrink-0 text-center font-bold tabular-nums ${present ? "text-2xl" : "text-base"} ${
                top3 ? "text-amber-600 dark:text-amber-400" : "text-stone-400"
              }`}
            >
              {top3 ? MEDALS[rank] : rank + 1}
            </span>
            <Avatar
              color={s.color}
              emoji={s.emoji}
              name={s.name}
              size={avatarSize}
              className={gained ? "qn-hop" : ""}
            />
            <div className="min-w-0 flex-1">
              <div className={`truncate font-semibold ${present ? "text-2xl" : "text-base"}`}>{s.name}</div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: s.color || "#6366f1" }}
                />
              </div>
            </div>
            <span className={`shrink-0 font-bold tabular-nums ${present ? "text-3xl" : "text-lg"}`}>{s.score}</span>
          </div>
        );
      })}
    </div>
  );
}
