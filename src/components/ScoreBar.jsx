/* ====================================================================
   SCOREBOARD (fixed bottom bar; tappable when awarding)
   --------------------------------------------------------------------
   When `active`, tapping a player applies the signed `value` (the sign
   comes from the +/- toggle, shown only when `allowNegative`). The
   `awarded` map stores the signed delta per player, so a second tap
   cleanly reverses it.
   ==================================================================== */

import { Check, Minus, Plus } from "lucide-react";
import { FOCUS, Avatar, colorAt } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

const fmtDelta = (n) => `${n < 0 ? "−" : "+"}${Math.abs(n)}`;

/** Fixed bottom score bar. */
export default function ScoreBar({
  players,
  active,
  value,
  awarded,
  onAward,
  allowNegative = false,
  sign = 1,
  onSignChange,
}) {
  const { t } = useI18n();
  const signed = sign * value;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/90 backdrop-blur transition-colors dark:border-stone-800 dark:bg-stone-900/90">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {active && (
          <div className="mb-2 flex items-center justify-center gap-3">
            {allowNegative && (
              <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-xs font-semibold dark:border-stone-700">
                <button
                  onClick={() => onSignChange?.(1)}
                  className={`flex items-center gap-1 px-2.5 py-1 transition ${FOCUS} ${
                    sign > 0 ? "bg-indigo-600 text-white" : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <Plus size={12} /> {value}
                </button>
                <button
                  onClick={() => onSignChange?.(-1)}
                  className={`flex items-center gap-1 px-2.5 py-1 transition ${FOCUS} ${
                    sign < 0 ? "bg-red-600 text-white" : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <Minus size={12} /> {value}
                </button>
              </div>
            )}
            <p
              className={`text-center text-xs font-medium uppercase tracking-wide ${
                signed < 0 ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400"
              }`}
            >
              {t("play.tapToScore", { delta: fmtDelta(signed) })}
            </p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {players.map((p, i) => {
            const delta = awarded ? awarded[p.id] : undefined;
            const got = delta != null;
            const neg = got && delta < 0;
            return (
              <button
                key={p.id}
                disabled={!active}
                onClick={() => onAward(p.id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition active:scale-95 ${FOCUS} ${
                  got
                    ? neg
                      ? "border-red-600 bg-red-600 text-white"
                      : "border-indigo-600 bg-indigo-600 text-white"
                    : active
                      ? "border-indigo-200 bg-indigo-50 text-stone-900 hover:border-indigo-400 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-stone-100"
                      : "border-stone-200 bg-white text-stone-900 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                }`}
              >
                {active && i < 9 && (
                  <span className={`text-xs font-bold ${got ? "text-white/60" : "text-stone-300 dark:text-stone-600"}`}>
                    {i + 1}
                  </span>
                )}
                <Avatar color={p.color || colorAt(i)} emoji={p.emoji} name={p.name} size={20} />
                <span className="font-medium">{p.name}</span>
                <span className={`font-bold tabular-nums ${got ? "text-white" : "text-stone-500 dark:text-stone-400"}`}>
                  {p.score}
                </span>
                {active &&
                  (got ? (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold">
                      <Check size={14} /> {fmtDelta(delta)}
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-semibold ${signed < 0 ? "text-red-600 dark:text-red-400" : "text-indigo-600 dark:text-indigo-400"}`}
                    >
                      {fmtDelta(signed)}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
