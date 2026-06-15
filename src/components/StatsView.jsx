/* ====================================================================
   STATS VIEW (#/me) — a player's history + the global leaderboard
   --------------------------------------------------------------------
   Reads from the optional shared playerbase. Shows the device's current
   player's personal stats (games/wins/best/total + recent games) and the
   all-time global leaderboard across the whole playerbase. Standalone
   phone page; graceful empty states when unconfigured or no player chosen.
   ==================================================================== */

import { useEffect, useState } from "react";
import { ChevronLeft, Trophy, Medal, Gamepad2 } from "lucide-react";
import { usePlayerbase } from "./usePlayerbase.js";
import { summarizeResults, normalizeLeaderboard } from "../lib/model.js";
import { cardCls, FOCUS, Avatar, ThemeToggle } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

const rankColor = (i) =>
  i === 0
    ? "text-amber-500"
    : i === 1
      ? "text-stone-400"
      : i === 2
        ? "text-orange-700 dark:text-orange-500"
        : "text-stone-300 dark:text-stone-600";

export default function StatsView() {
  const { t } = useI18n();
  const pb = usePlayerbase();
  const [myRows, setMyRows] = useState([]);
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pb.ready) return;
    let alive = true;
    (async () => {
      const [rows, lb] = await Promise.all([pb.statsFor(), pb.globalBoard()]);
      if (!alive) return;
      setMyRows(Array.isArray(rows) ? rows : []);
      setBoard(normalizeLeaderboard(lb));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pb.ready, pb.currentId]);

  const me = pb.current;
  const s = summarizeResults(myRows);
  const back = () => (window.history.length > 1 ? window.history.back() : (window.location.hash = "#/"));

  const stat = (label, value) => (
    <div className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-2 py-3 dark:border-stone-800 dark:bg-stone-900">
      <span className="font-pixel text-lg text-stone-900 dark:text-stone-50">{value}</span>
      <span className="mt-1 font-pixel text-[8px] uppercase tracking-widest text-stone-400">{label}</span>
    </div>
  );

  return (
    <div className="qn-app-bg flex min-h-[100dvh] flex-col px-5 py-6 text-stone-900 antialiased dark:text-stone-100">
      <div className="mx-auto w-full max-w-md flex-1">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={back}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
          >
            <ChevronLeft size={16} /> {t("common.back")}
          </button>
          <h1 className="font-pixel text-sm leading-tight">{t("stats.title")}</h1>
          <ThemeToggle />
        </div>

        {!pb.configured ? (
          <div className={`${cardCls} p-8 text-center text-stone-500 dark:text-stone-400`}>
            <Gamepad2 className="mx-auto mb-3 text-stone-300 dark:text-stone-600" size={32} />
            {t("stats.unavailable")}
          </div>
        ) : loading ? (
          <div className="py-16 text-center font-pixel text-xs text-stone-400">…</div>
        ) : (
          <>
            {/* personal stats */}
            {me ? (
              <div className={`${cardCls} mb-6 p-4`}>
                <div className="mb-4 flex items-center gap-3">
                  <Avatar color={me.color} emoji={me.emoji} photo={me.photo} name={me.name} size={48} />
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold">{me.name}</p>
                    <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400">{t("stats.you")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {stat(t("stats.games"), s.games)}
                  {stat(t("stats.wins"), s.wins)}
                  {stat(t("stats.best"), s.bestScore)}
                  {stat(t("stats.total"), s.totalScore)}
                </div>
                {s.recent.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 font-pixel text-[8px] uppercase tracking-widest text-stone-400">
                      {t("stats.recent")}
                    </p>
                    <div className="space-y-1">
                      {s.recent.map((r, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {r.won ? (
                            <Trophy size={13} className="shrink-0 text-amber-500" />
                          ) : (
                            <span className="w-[13px] shrink-0" />
                          )}
                          <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">
                            {r.quiz_title}
                          </span>
                          <span className="shrink-0 font-pixel text-xs tabular-nums">{r.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className={`${cardCls} mb-6 p-6 text-center text-sm text-stone-500 dark:text-stone-400`}>
                {t("stats.noPlayer")}
              </div>
            )}

            <p className="mb-2 flex items-center gap-2 font-pixel text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
              <Trophy size={14} className="text-amber-500" /> {t("stats.global")}
            </p>
            {board.length === 0 ? (
              <div className={`${cardCls} p-6 text-center text-sm text-stone-500 dark:text-stone-400`}>
                <Medal className="mx-auto mb-2 text-stone-300 dark:text-stone-600" size={28} />
                {t("stats.empty")}
              </div>
            ) : (
              <div className="space-y-1.5">
                {board.map((e, i) => {
                  const mine = me && e.id === me.id;
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 ${
                        mine
                          ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                          : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
                      }`}
                    >
                      <span className={`w-6 shrink-0 text-center font-pixel text-xs ${rankColor(i)}`}>{i + 1}</span>
                      <Avatar color={e.color} emoji={e.emoji} photo={e.photo} name={e.name} size={28} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{e.name}</span>
                      <span className="shrink-0 text-right">
                        <span className="font-pixel text-xs text-amber-600 dark:text-amber-400">{e.wins}</span>
                        <span className="ml-1 font-pixel text-[8px] uppercase tracking-wide text-stone-400">
                          {t("stats.wins")}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
