/* ====================================================================
   LEADERBOARD VIEW — persistent standings across games on this device
   ==================================================================== */

import { ChevronLeft, Trophy, Medal } from "lucide-react";
import { aggregateLeaderboard } from "../lib/model.js";
import { FOCUS, cardCls, Button, ConfirmDelete } from "./ui.jsx";

const rankColor = (i) =>
  i === 0
    ? "text-amber-500"
    : i === 1
      ? "text-stone-400"
      : i === 2
        ? "text-orange-700 dark:text-orange-500"
        : "text-stone-300 dark:text-stone-600";

/**
 * @param {object} props
 * @param {Array} props.results Raw stored game records.
 * @param {() => void} props.onBack
 * @param {() => void} props.onClear Wipe the stored history.
 */
export default function LeaderboardView({ results, onBack, onClear }) {
  const board = aggregateLeaderboard(results);
  const games = Array.isArray(results) ? results.length : 0;

  return (
    <div className="mx-auto max-w-2xl px-6 pb-16 pt-6">
      <button
        onClick={onBack}
        className={`mb-8 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="flex items-center gap-3">
        <Trophy className="text-amber-500" size={28} />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Leaderboard</h2>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {games} {games === 1 ? "game" : "games"} played on this device
          </p>
        </div>
      </div>

      {board.length === 0 ? (
        <div className={`${cardCls} mt-8 p-8 text-center text-stone-500 dark:text-stone-400`}>
          <Medal className="mx-auto mb-3 text-stone-300 dark:text-stone-600" size={32} />
          No games finished yet. Play one and the standings will show up here.
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 dark:border-stone-800">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-400 dark:bg-stone-900 dark:text-stone-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">#</th>
                  <th className="px-2 py-2.5 text-left font-semibold">Player</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Wins</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Games</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Best</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {board.map((e, i) => (
                  <tr
                    key={e.name + i}
                    className="border-t border-stone-100 bg-white dark:border-stone-800 dark:bg-stone-900"
                  >
                    <td className={`px-4 py-3 font-bold tabular-nums ${rankColor(i)}`}>{i + 1}</td>
                    <td className="px-2 py-3 font-medium">{e.name}</td>
                    <td className="px-2 py-3 text-right font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                      {e.wins}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-stone-500 dark:text-stone-400">{e.games}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-stone-500 dark:text-stone-400">
                      {e.bestScore}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums">{e.totalScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <ConfirmDelete label="Clear leaderboard history" onConfirm={onClear} />
          </div>
        </>
      )}
    </div>
  );
}
