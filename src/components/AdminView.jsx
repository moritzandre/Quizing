/* ====================================================================
   ADMIN VIEW (#/admin) — console for a confirmed admin account
   --------------------------------------------------------------------
   Reachable only by a signed-in admin (the host shell already shows the
   locked landing to non-admins when Supabase is configured; this view also
   self-guards). Lets an admin browse the whole playerbase + edit any player
   (rename / avatar / remove PIN lock / delete), see per-player stats, and
   review past games. Edits go through admin-gated SECURITY DEFINER RPCs.
   ==================================================================== */

import { useEffect, useState } from "react";
import { ChevronLeft, Users, History, Pencil, BarChart3, Lock, Trophy, Loader2, X } from "lucide-react";
import {
  listPlayers,
  loadGlobalLeaderboard,
  loadRecentResults,
  loadPlayerStats,
  adminUpdatePlayer,
  adminSetPin,
  adminDeletePlayer,
} from "../lib/supabase.js";
import { normalizePlayers, normalizeLeaderboard, summarizeResults, summarizeGamesFromResults } from "../lib/model.js";
import {
  cardCls,
  inputCls,
  FOCUS,
  Button,
  IconButton,
  ConfirmDelete,
  Avatar,
  ThemeToggle,
  PLAYER_COLORS,
  PLAYER_SPRITES,
} from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

const modalWrap = "fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center";
const modalCard =
  "max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900";

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
};

/** Edit any player (admin-gated): name, avatar, remove PIN lock, delete. */
function EditPlayerModal({ player, onClose, onChanged, t }) {
  const [name, setName] = useState(player.name || "");
  const [emoji, setEmoji] = useState(player.emoji || PLAYER_SPRITES[0]);
  const [color, setColor] = useState(player.color || PLAYER_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(!!player.locked);
  const [err, setErr] = useState("");

  const save = async () => {
    setBusy(true);
    setErr("");
    const row = await adminUpdatePlayer(player.id, { name: name.trim(), emoji, color });
    setBusy(false);
    if (row) {
      onChanged();
      onClose();
    } else setErr(t("admin.saveFailed"));
  };
  const unlock = async () => {
    setBusy(true);
    setErr("");
    const ok = await adminSetPin(player.id, "");
    setBusy(false);
    if (ok) {
      setLocked(false);
      onChanged();
    } else setErr(t("admin.saveFailed"));
  };
  const remove = async () => {
    setBusy(true);
    const ok = await adminDeletePlayer(player.id);
    setBusy(false);
    if (ok) {
      onChanged();
      onClose();
    } else setErr(t("admin.saveFailed"));
  };

  return (
    <div className={modalWrap} onClick={onClose}>
      <div className={modalCard} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Pencil size={18} /> {t("admin.editTitle")}
          </h3>
          <IconButton label={t("common.cancel")} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>

        <div className="mb-4 flex items-center gap-3">
          <Avatar color={color} emoji={emoji} name={name} size={48} />
          <input
            className={`${inputCls}`}
            value={name}
            maxLength={24}
            placeholder={t("admin.name")}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <p className="mb-1.5 font-pixel text-[8px] uppercase tracking-widest text-stone-400">{t("admin.character")}</p>
        <div className="flex flex-wrap gap-1.5">
          {PLAYER_SPRITES.map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => setEmoji(key)}
              aria-label={key}
              aria-pressed={emoji === key}
              className={`rounded-xl p-0.5 transition active:scale-90 ${FOCUS} ${
                emoji === key
                  ? "bg-stone-900 ring-2 ring-stone-900 dark:bg-stone-100 dark:ring-stone-100"
                  : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700"
              }`}
            >
              <Avatar color={color} emoji={key} name="" size={32} />
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {PLAYER_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={color === c}
              style={{ backgroundColor: c }}
              className={`h-8 w-8 rounded-full transition active:scale-90 ${FOCUS} ${
                color === c
                  ? "ring-2 ring-stone-900 ring-offset-2 ring-offset-white dark:ring-stone-100 dark:ring-offset-stone-950"
                  : ""
              }`}
            />
          ))}
        </div>

        <div className="mt-4 flex items-center gap-2">
          {locked ? (
            <Button variant="outline" onClick={unlock} disabled={busy}>
              <Lock size={15} /> {t("admin.unlock")}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-stone-400">{t("admin.unlocked")}</span>
          )}
        </div>

        {err && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{err}</p>}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
          <ConfirmDelete label={t("admin.deletePlayer")} onConfirm={remove} />
          <Button onClick={save} disabled={busy || !name.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} {t("admin.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** A player's full stats + recent games (admin view). */
function PlayerStatsModal({ player, onClose, t }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let alive = true;
    loadPlayerStats(player.id).then((r) => alive && setRows(Array.isArray(r) ? r : []));
    return () => {
      alive = false;
    };
  }, [player.id]);
  const s = rows ? summarizeResults(rows) : null;
  const tile = (label, value) => (
    <div className="flex flex-col items-center rounded-xl border border-stone-200 bg-white px-2 py-3 dark:border-stone-800 dark:bg-stone-900">
      <span className="font-pixel text-lg text-stone-900 dark:text-stone-50">{value}</span>
      <span className="mt-1 font-pixel text-[8px] uppercase tracking-widest text-stone-400">{label}</span>
    </div>
  );
  return (
    <div className={modalWrap} onClick={onClose}>
      <div className={modalCard} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold">
            <Avatar color={player.color} emoji={player.emoji} name={player.name} size={32} />
            <span className="truncate">{player.name}</span>
          </h3>
          <IconButton label={t("common.done")} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        {!s ? (
          <div className="py-10 text-center font-pixel text-xs text-stone-400">…</div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {tile(t("stats.games"), s.games)}
              {tile(t("stats.wins"), s.wins)}
              {tile(t("stats.best"), s.bestScore)}
              {tile(t("stats.total"), s.totalScore)}
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
                      <span className="min-w-0 flex-1 truncate text-stone-600 dark:text-stone-300">{r.quiz_title}</span>
                      <span className="shrink-0 font-pixel text-xs tabular-nums">{r.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * @param {object} props
 * @param {object} props.admin The useAdmin() handle (gating).
 * @param {() => void} props.onBack
 */
export default function AdminView({ admin, onBack }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("players");
  const [players, setPlayers] = useState([]);
  const [boardById, setBoardById] = useState({});
  const [namesById, setNamesById] = useState({});
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [statsOf, setStatsOf] = useState(null);

  const ok = admin.configured && admin.isAdmin;

  const reload = async () => {
    const [dir, board, results] = await Promise.all([listPlayers(), loadGlobalLeaderboard(), loadRecentResults()]);
    const ps = normalizePlayers(dir);
    const names = {};
    ps.forEach((p) => (names[p.id] = p));
    const bById = {};
    normalizeLeaderboard(board).forEach((b) => (bById[b.id] = b));
    setPlayers(ps);
    setNamesById(names);
    setBoardById(bById);
    setGames(summarizeGamesFromResults(results));
    setLoading(false);
  };

  useEffect(() => {
    if (!admin.ready) return;
    if (!ok) {
      setLoading(false);
      return;
    }
    let alive = true;
    (async () => {
      await reload();
      if (!alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [admin.ready, ok]);

  const filtered = players
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => (boardById[b.id]?.games || 0) - (boardById[a.id]?.games || 0) || a.name.localeCompare(b.name));

  const tabBtn = (key, label, Icon) => (
    <button
      onClick={() => setTab(key)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-pixel text-[10px] uppercase tracking-wide transition ${FOCUS} ${
        tab === key
          ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
          : "text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );

  return (
    <div className="qn-app-bg min-h-screen px-6 pb-16 pt-8 font-sans text-stone-900 antialiased dark:text-stone-100">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={onBack}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
          >
            <ChevronLeft size={16} /> {t("common.back")}
          </button>
          <h1 className="font-pixel text-sm leading-tight">{t("admin.consoleTitle")}</h1>
          <ThemeToggle />
        </div>

        {!ok ? (
          <div className={`${cardCls} p-8 text-center text-stone-500 dark:text-stone-400`}>{t("admin.notAdmin")}</div>
        ) : loading ? (
          <div className="py-16 text-center font-pixel text-xs text-stone-400">…</div>
        ) : (
          <>
            <div className="mb-4 flex gap-2">
              {tabBtn("players", t("admin.tabPlayers"), Users)}
              {tabBtn("games", t("admin.tabGames"), History)}
            </div>

            {tab === "players" ? (
              <>
                <input
                  className={`${inputCls} mb-3`}
                  placeholder={t("admin.searchPlayers")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {filtered.length === 0 ? (
                  <div className={`${cardCls} p-8 text-center text-sm text-stone-500 dark:text-stone-400`}>
                    {t("admin.noPlayers")}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filtered.map((p) => {
                      const b = boardById[p.id];
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900`}
                        >
                          <Avatar color={p.color} emoji={p.emoji} name={p.name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                              {p.name}
                              {p.locked && <Lock size={12} className="shrink-0 text-stone-400" />}
                            </p>
                            <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400">
                              {b
                                ? `${b.games} ${t("stats.games")} · ${b.wins} ${t("stats.wins")}`
                                : t("admin.neverPlayed")}
                            </p>
                          </div>
                          <IconButton label={t("admin.stats")} onClick={() => setStatsOf(p)}>
                            <BarChart3 size={16} />
                          </IconButton>
                          <IconButton label={t("admin.edit")} onClick={() => setEditing(p)}>
                            <Pencil size={16} />
                          </IconButton>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : games.length === 0 ? (
              <div className={`${cardCls} p-8 text-center text-sm text-stone-500 dark:text-stone-400`}>
                {t("admin.noGames")}
              </div>
            ) : (
              <div className="space-y-2">
                {games.map((g) => {
                  const winner = g.entries.find((e) => e.won) || g.entries[0];
                  const wp = winner && namesById[winner.profileId];
                  return (
                    <div key={g.gameId} className={`${cardCls} p-3`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold">
                          {g.quizTitle || t("admin.untitledQuiz")}
                        </p>
                        <span className="shrink-0 font-pixel text-[8px] uppercase tracking-widest text-stone-400">
                          {fmtDate(g.playedAt)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                        <span className="inline-flex items-center gap-1">
                          <Users size={12} /> {t("admin.playersN", { n: g.entries.length })}
                        </span>
                        {g.roomCode && <span className="font-pixel text-[9px] tracking-widest">#{g.roomCode}</span>}
                        {winner && (
                          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                            <Trophy size={12} />
                            {wp ? <Avatar color={wp.color} emoji={wp.emoji} name={wp.name} size={16} /> : null}
                            <span className="font-medium">{wp ? wp.name : "—"}</span>
                            <span className="font-pixel text-[10px]">{winner.score}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {editing && <EditPlayerModal player={editing} t={t} onClose={() => setEditing(null)} onChanged={reload} />}
      {statsOf && <PlayerStatsModal player={statsOf} t={t} onClose={() => setStatsOf(null)} />}
    </div>
  );
}
