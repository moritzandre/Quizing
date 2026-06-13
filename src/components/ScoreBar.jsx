/* ====================================================================
   SCOREBOARD (fixed bottom bar; tappable when awarding)
   ==================================================================== */

import { Check } from "lucide-react";
import { FOCUS } from "./ui.jsx";

/** Fixed bottom score bar. When `active`, players are tappable to award `value` points. */
export default function ScoreBar({ players, active, value, awarded, onAward }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {active && (
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-indigo-600">
            Tap a player to award +{value}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {players.map((p, i) => {
            const got = awarded && awarded[p.id] != null;
            return (
              <button
                key={p.id}
                disabled={!active}
                onClick={() => onAward(p.id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${FOCUS} ${
                  got
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : active
                    ? "border-indigo-200 bg-indigo-50 text-stone-900 hover:border-indigo-400"
                    : "border-stone-200 bg-white text-stone-900"
                }`}
              >
                {active && i < 9 && <span className={`text-xs font-bold ${got ? "text-indigo-200" : "text-stone-300"}`}>{i + 1}</span>}
                <span className="font-medium">{p.name}</span>
                <span className={`font-bold tabular-nums ${got ? "text-white" : "text-stone-500"}`}>{p.score}</span>
                {active && (got ? <Check size={14} /> : <span className="text-xs font-semibold text-indigo-600">+{value}</span>)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
