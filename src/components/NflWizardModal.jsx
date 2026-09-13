/* ====================================================================
   NFL ROUND WIZARD (Builder modal) — semi-automatic rounds from stats
   --------------------------------------------------------------------
   Builds ready-to-play rounds from the bundled nflverse snapshot
   (src/data/nfl.js, dynamic-imported here so the ~0.3 MB dataset only
   ever loads when the wizard opens): Top-List boards (Tenable-style),
   auto-graded Type-It rank questions ("who had the 8th-most passing
   yards in 2021?"), multiple choice with rank-neighbour distractors,
   and "who is this?" faces rounds from ESPN's headshot db — plus a
   player-search tab. Generated rounds are ordinary quiz data: the game
   never touches NFL sources at play time.
   ==================================================================== */

import { useEffect, useMemo, useState } from "react";
import {
  X,
  ListOrdered,
  Keyboard,
  ListChecks,
  Image as ImageIcon,
  Search,
  Plus,
  Check,
  ArrowUpDown,
  Hash,
  ToggleLeft,
  Gavel,
  LayoutGrid,
} from "lucide-react";
import { FOCUS, inputCls, Button } from "./ui.jsx";

const KINDS = [
  { key: "toplist", icon: ListOrdered, label: "nfl.kind.toplist" },
  { key: "typeit", icon: Keyboard, label: "nfl.kind.typeit" },
  { key: "choice", icon: ListChecks, label: "nfl.kind.choice" },
  { key: "number", icon: Hash, label: "nfl.kind.number" },
  { key: "higherlower", icon: ArrowUpDown, label: "nfl.kind.higherlower" },
  { key: "truefalse", icon: ToggleLeft, label: "nfl.kind.truefalse" },
  { key: "faces", icon: ImageIcon, label: "nfl.kind.faces" },
  { key: "whoknows", icon: Gavel, label: "nfl.kind.whoknows" },
  { key: "jeopardy", icon: LayoutGrid, label: "nfl.kind.jeopardy" },
];
const DEFAULT_RANKS = [1, 3, 5, 8];
/** Kinds whose question list is driven by the rank checkboxes. */
const RANK_KINDS = ["typeit", "choice", "number"];
/** Kinds that take a "how many entries" count. */
const COUNT_KINDS = ["toplist", "faces", "whoknows"];

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {(round: object) => void} props.onAdd Receives ONE generated (raw) round.
 * @param {(key: string, vars?: object) => string} props.t i18n.
 */
export default function NflWizardModal({ onClose, onAdd, t }) {
  const [nfl, setNfl] = useState(null); // the lazy-loaded data module
  const [tab, setTab] = useState("boards");
  const [season, setSeason] = useState(null);
  const [cat, setCat] = useState("passYd");
  const [kind, setKind] = useState("toplist");
  const [topN, setTopN] = useState(10);
  const [points, setPoints] = useState(10);
  const [ranks, setRanks] = useState(DEFAULT_RANKS);
  const [search, setSearch] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let on = true;
    import("../data/nfl.js").then((m) => {
      if (!on) return;
      setNfl(m);
      setSeason(m.NFL_SEASONS[m.NFL_SEASONS.length - 1] ?? null);
    });
    return () => {
      on = false;
    };
  }, []);
  useEffect(() => {
    if (!added) return;
    const id = setTimeout(() => setAdded(false), 1500);
    return () => clearTimeout(id);
  }, [added]);

  const board = useMemo(() => (nfl && season != null ? nfl.nflBoard(season, cat) : []), [nfl, season, cat]);
  const results = useMemo(() => (nfl ? nfl.nflPlayerSearch(search) : []), [nfl, search]);
  const player = useMemo(() => results.find((r) => r.id === playerId) || null, [results, playerId]);
  const finds = useMemo(() => (nfl && playerId ? nfl.nflPlayerFinds(playerId) : []), [nfl, playerId]);

  const add = (round) => {
    // jeopardy boards carry `categories`, every other kind `questions`
    if (!round || !((round.questions || []).length || (round.categories || []).length)) return;
    onAdd(round);
    setAdded(true);
  };
  const buildAndAdd = () => {
    if (!nfl) return;
    const opts = { season, cat, points };
    if (kind === "toplist") add(nfl.nflToplistRound(t, { ...opts, n: topN }));
    else if (kind === "typeit") add(nfl.nflRankTypeitRound(t, { ...opts, ranks: usableRanks }));
    else if (kind === "choice") add(nfl.nflChoiceRound(t, { ...opts, ranks: usableRanks }));
    else if (kind === "number") add(nfl.nflNumberRound(t, { ...opts, ranks: usableRanks }));
    else if (kind === "higherlower") add(nfl.nflHigherLowerRound(t, opts));
    else if (kind === "truefalse") add(nfl.nflTrueFalseRound(t, opts));
    else if (kind === "faces") add(nfl.nflFacesRound(t, { ...opts, n: topN }));
    else if (kind === "whoknows") add(nfl.nflWhoknowsRound(t, { ...opts, n: topN }));
    else if (kind === "jeopardy") add(nfl.nflJeopardyRound(t, { season, facesCat: cat }));
  };
  const usableRanks = useMemo(
    () => ranks.filter((r) => nfl && nfl.nflRankUnambiguous(board, r)).sort((a, b) => a - b),
    [ranks, board, nfl],
  );
  const toggleRank = (r) => setRanks((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const selCls = `${inputCls} w-auto`;
  const chipCls = (on, disabled) =>
    `rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${FOCUS} ${
      disabled
        ? "cursor-not-allowed border-stone-100 text-stone-300 dark:border-stone-800 dark:text-stone-600"
        : on
          ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-stone-200 text-stone-600 hover:border-stone-400 dark:border-stone-700 dark:text-stone-300"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-3xl bg-white p-5 shadow-2xl dark:bg-stone-900">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-lg font-bold">🏈 {t("nfl.title")}</h3>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className={`rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 ${FOCUS}`}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">{t("nfl.subtitle")}</p>

        {!nfl ? (
          <p className="py-10 text-center text-stone-400">{t("nfl.loading")}</p>
        ) : (
          <>
            <div className="mb-3 flex gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
              {[
                ["boards", "nfl.tabBoards"],
                ["players", "nfl.tabPlayers"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition ${FOCUS} ${
                    tab === key
                      ? "bg-white text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400"
                  }`}
                >
                  {t(label)}
                </button>
              ))}
            </div>

            <div className="qn-scroll min-h-0 flex-1 overflow-y-auto pr-1">
              {tab === "boards" && (
                <>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {t("nfl.season")}
                      <select
                        className={`${selCls} mt-1 block`}
                        value={season ?? ""}
                        onChange={(e) => setSeason(+e.target.value)}
                      >
                        {[...nfl.NFL_SEASONS].reverse().map((y) => (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {t("nfl.category")}
                      <select className={`${selCls} mt-1 block`} value={cat} onChange={(e) => setCat(e.target.value)}>
                        {Object.entries(nfl.NFL_CATS).map(([key, c]) => (
                          <option key={key} value={key}>
                            {t(c.label)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {COUNT_KINDS.includes(kind) && (
                      <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                        {t("nfl.topN")}
                        <input
                          type="number"
                          min="3"
                          max={kind === "faces" ? 12 : 15}
                          className={`${inputCls} mt-1 block w-20`}
                          value={topN}
                          onChange={(e) =>
                            setTopN(
                              Math.max(3, Math.min(kind === "faces" ? 12 : 15, Math.round(+e.target.value) || 10)),
                            )
                          }
                        />
                      </label>
                    )}
                    <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
                      {t("nfl.pointsPer")}
                      <input
                        type="number"
                        className={`${inputCls} mt-1 block w-20`}
                        value={points}
                        onChange={(e) => setPoints(Math.max(0, Math.round(+e.target.value) || 0))}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {KINDS.map(({ key, icon: Icon, label }) => (
                      <button key={key} onClick={() => setKind(key)} className={chipCls(kind === key, false)}>
                        <Icon size={14} className="mr-1 inline" />
                        {t(label)}
                      </button>
                    ))}
                  </div>

                  {RANK_KINDS.includes(kind) && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                        {t("nfl.ranksLabel")}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((r) => {
                          const ok = nfl.nflRankUnambiguous(board, r);
                          return (
                            <button
                              key={r}
                              disabled={!ok}
                              onClick={() => toggleRank(r)}
                              className={chipCls(ranks.includes(r), !ok)}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="mb-1.5 mt-4 text-xs font-medium text-stone-500 dark:text-stone-400">
                    {t("nfl.preview")}
                  </p>
                  {board.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400 dark:border-stone-700">
                      {t("nfl.empty")}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {(kind === "faces"
                        ? board.filter((r) => r.face).slice(0, topN)
                        : COUNT_KINDS.includes(kind)
                          ? board.slice(0, topN)
                          : RANK_KINDS.includes(kind)
                            ? usableRanks.map((r) => board[r - 1]).filter(Boolean)
                            : board.slice(0, 9)
                      ) // higher/lower, true/false, jeopardy draw on the top of the board
                        .map((row) => (
                          <div
                            key={row.rank}
                            className="flex items-center gap-2.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm dark:border-stone-800"
                          >
                            <span className="w-6 shrink-0 text-center font-pixel text-[10px] text-stone-400">
                              {row.rank}
                            </span>
                            {(kind === "faces" || kind === "jeopardy") && row.face && (
                              <img
                                src={row.face}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-full bg-stone-100 object-cover dark:bg-stone-700"
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                            <span className="shrink-0 text-xs text-stone-400">
                              {row.team}
                              {row.pos ? ` · ${row.pos}` : ""}
                            </span>
                            <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-stone-400">
                              {row.valueLabel}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}

              {tab === "players" && (
                <>
                  <div className="relative">
                    <Search
                      size={15}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      className={`${inputCls} pl-9`}
                      placeholder={t("nfl.searchPlaceholder")}
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPlayerId(null);
                      }}
                    />
                  </div>
                  <div className="mt-2 space-y-1">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setPlayerId(r.id)}
                        className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left text-sm transition ${FOCUS} ${
                          playerId === r.id
                            ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                            : "border-stone-200 hover:border-stone-400 dark:border-stone-800 dark:hover:border-stone-600"
                        }`}
                      >
                        {r.face ? (
                          <img
                            src={r.face}
                            alt=""
                            className="h-8 w-8 shrink-0 rounded-full bg-stone-100 object-cover dark:bg-stone-700"
                          />
                        ) : (
                          <span className="h-8 w-8 shrink-0 rounded-full bg-stone-100 dark:bg-stone-700" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                        <span className="shrink-0 text-xs text-stone-400">
                          {r.team}
                          {r.pos ? ` · ${r.pos}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>

                  {player && (
                    <div className="mt-3 rounded-xl border border-stone-200 p-3 dark:border-stone-800">
                      <Button
                        variant="outline"
                        className="w-full px-4 py-2 text-sm"
                        disabled={!player.face}
                        onClick={() =>
                          add({
                            type: "image",
                            title: `NFL — ${player.name}`,
                            questions: [
                              {
                                url: player.face,
                                q: t("nfl.q.facePlain"),
                                a: `${player.name} (${player.team}${player.pos ? ` · ${player.pos}` : ""})`,
                                points,
                              },
                            ],
                          })
                        }
                      >
                        <ImageIcon size={15} /> {t("nfl.addFaceRound")}
                      </Button>
                      <p className="mb-1.5 mt-3 text-xs font-medium text-stone-500 dark:text-stone-400">
                        {t("nfl.finds")}
                      </p>
                      {finds.length === 0 ? (
                        <p className="text-sm text-stone-400">{t("nfl.noFinds")}</p>
                      ) : (
                        <div className="space-y-1">
                          {finds.slice(0, 20).map((f) => (
                            <div
                              key={`${f.season}-${f.cat}`}
                              className="flex items-center gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5 text-sm dark:border-stone-800"
                            >
                              <span className="w-10 shrink-0 font-pixel text-[10px] text-stone-400">#{f.rank}</span>
                              <span className="min-w-0 flex-1 truncate">
                                {t(nfl.NFL_CATS[f.cat]?.label || f.cat)} · {f.season}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-stone-500">{f.valueLabel}</span>
                              <button
                                title={t("nfl.addRankQ")}
                                aria-label={t("nfl.addRankQ")}
                                onClick={() =>
                                  add(
                                    nfl.nflRankTypeitRound(t, {
                                      season: f.season,
                                      cat: f.cat,
                                      ranks: [f.rank],
                                      points,
                                    }),
                                  )
                                }
                                className={`shrink-0 rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 ${FOCUS}`}
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-t border-stone-100 pt-3 dark:border-stone-800">
              <p className="min-w-0 flex-1 truncate text-[11px] text-stone-400 dark:text-stone-500">
                {t("nfl.dataAsOf", {
                  date: nfl.NFL_GENERATED,
                  from: nfl.NFL_SEASONS[0],
                  to: nfl.NFL_SEASONS[nfl.NFL_SEASONS.length - 1],
                })}
              </p>
              {tab === "boards" &&
                (added ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check size={16} /> {t("nfl.added")}
                  </span>
                ) : (
                  <Button className="px-4 py-2.5 text-sm" onClick={buildAndAdd} disabled={board.length === 0}>
                    <Plus size={16} /> {t("nfl.addRound")}
                  </Button>
                ))}
              {tab === "players" && added && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check size={16} /> {t("nfl.added")}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
