/* ====================================================================
   NFL STATS DATA LAYER (framework-free; lazy-imported by the Builder)
   --------------------------------------------------------------------
   Reads the bundled nfl.stats.json snapshot (baked from nflverse's public
   per-season regular-season stats by `npm run nfl:refresh` — see
   scripts/nfl-refresh.mjs) and turns it into quiz rounds. Faces come from
   ESPN's headshot CDN via each player's espn_id (nflverse fallback URL
   when a player has no ESPN id). Everything here is pure data-in/data-out:
   the GENERATED rounds are ordinary quiz rounds with all content baked in,
   so games never depend on this module — or any NFL source — at play time.

   Question text is built through the caller-supplied `t` (i18n) at
   generation time: the strings are baked into the round in whatever
   language the builder UI was in (quiz content itself is never live-
   translated, same contract as every other authored round).
   ==================================================================== */

import DATA from "./nfl.stats.json";
import { normText } from "../lib/model.js";

/** Stat-category keys (as baked into the dataset) → i18n label key + unit. */
export const NFL_CATS = {
  passYd: { label: "nfl.cat.passYd", unit: "yds" },
  passTd: { label: "nfl.cat.passTd", unit: "TD" },
  rushYd: { label: "nfl.cat.rushYd", unit: "yds" },
  rushTd: { label: "nfl.cat.rushTd", unit: "TD" },
  recYd: { label: "nfl.cat.recYd", unit: "yds" },
  recTd: { label: "nfl.cat.recTd", unit: "TD" },
  rec: { label: "nfl.cat.rec", unit: "rec" },
  sacks: { label: "nfl.cat.sacks", unit: "sacks" },
  defInt: { label: "nfl.cat.defInt", unit: "INT" },
};

/** Seasons available in the bundled snapshot (ascending). */
export const NFL_SEASONS = (Array.isArray(DATA.seasons) ? DATA.seasons : []).slice().sort((a, b) => a - b);

/** The date the bundled snapshot was generated (shown in the wizard). */
export const NFL_GENERATED = DATA.generated || "";

/** ESPN headshot ("face db") URL for a player record, else the nflverse one. */
export function nflFace(p) {
  if (!p) return "";
  if (p.e) return `https://a.espncdn.com/i/headshots/nfl/players/full/${p.e}.png`;
  return p.h || "";
}

/** "5,316" with en-US thousands grouping (quiz content stays locale-stable). */
const group = (v) => {
  const n = Number(v) || 0;
  const s = Number.isInteger(n) ? String(n) : n.toFixed(1);
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

/** Human value label for a board cell, e.g. "5,316 yds" / "17.5 sacks". */
export function nflValueLabel(cat, v) {
  const unit = NFL_CATS[cat]?.unit || "";
  return unit ? `${group(v)} ${unit}` : group(v);
}

/**
 * One season × category leaderboard from the snapshot, as rich rows.
 * @param {number|string} season
 * @param {string} cat A NFL_CATS key.
 * @returns {Array<{rank:number,id:string,name:string,pos:string,team:string,value:number,valueLabel:string,face:string}>}
 */
export function nflBoard(season, cat) {
  const raw = DATA.boards?.[String(season)]?.[cat];
  if (!Array.isArray(raw)) return [];
  return raw.map(([id, value], i) => {
    const p = DATA.players?.[id] || {};
    return {
      rank: i + 1,
      id,
      name: p.n || "?",
      pos: p.p || "",
      team: p.t || "",
      value,
      valueLabel: nflValueLabel(cat, value),
      face: nflFace(p),
    };
  });
}

/**
 * Is "the Nth most" unambiguous on this board? True when the value at rank n
 * is strictly between its neighbours (no tie muddying what "Nth" means).
 * @param {ReturnType<typeof nflBoard>} board
 * @param {number} n 1-based rank.
 */
export function nflRankUnambiguous(board, n) {
  const at = board[n - 1];
  if (!at) return false;
  const above = board[n - 2];
  const below = board[n];
  return (!above || above.value > at.value) && (!below || at.value > below.value);
}

/**
 * Accepted spellings for a player answer: full name + bare last name — the
 * last name only when no OTHER player in `context` shares it (two Allens on
 * one board = "Allen" alone matches neither). Suffixes (Jr./II/…) stripped.
 * @param {string} name Full display name.
 * @param {Array<{name:string}>} [context] Rows the answer must be unique among.
 */
export function nflAliases(name, context = []) {
  const last = lastNameOf(name);
  if (!last || normText(last) === normText(name)) return [];
  const clash = context.some((r) => r.name !== name && normText(lastNameOf(r.name)) === normText(last));
  return clash ? [] : [last];
}

/** Last name of a display name, ignoring generational suffixes. */
function lastNameOf(name) {
  const SUFFIX = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter((w) => !SUFFIX.has(w.toLowerCase()));
  return parts.length > 1 ? parts.slice(1).join(" ") : "";
}

/** Search the snapshot's players by (normalized) name fragment. */
export function nflPlayerSearch(text, limit = 12) {
  const q = normText(text);
  if (!q) return [];
  const out = [];
  for (const [id, p] of Object.entries(DATA.players || {}))
    if (normText(p.n).includes(q)) out.push({ id, name: p.n, pos: p.p || "", team: p.t || "", face: nflFace(p) });
  // shortest (most exact) matches first, then alphabetically
  return out.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Every board appearance of a player: [{season, cat, rank, value, valueLabel}]. */
export function nflPlayerFinds(id) {
  const finds = [];
  for (const [season, cats] of Object.entries(DATA.boards || {})) {
    for (const [cat, rows] of Object.entries(cats)) {
      const i = rows.findIndex(([pid]) => pid === id);
      if (i >= 0)
        finds.push({
          season: +season,
          cat,
          rank: i + 1,
          value: rows[i][1],
          valueLabel: nflValueLabel(cat, rows[i][1]),
        });
    }
  }
  return finds.sort((a, b) => a.rank - b.rank || b.season - a.season);
}

/* ---- round generators (pure; text via the caller's i18n `t`) ---- */

/** Ordinal for question text: 1→"1st" … (English-style; de strings use "{n}."). */
const ord = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** Interpolate the shared question-text vars for a season × category. */
function qVars(t, season, cat, extra = {}) {
  return { season, cat: t(NFL_CATS[cat]?.label || cat), ...extra };
}

/**
 * A Top-List round from a leaderboard: "The top N: {cat}, {season}".
 * @returns {object} A plain toplist round (normalizeQuiz-ready, no ids).
 */
export function nflToplistRound(t, { season, cat, n = 10, points = 10 }) {
  const board = nflBoard(season, cat).slice(0, n);
  return {
    type: "toplist",
    title: t("nfl.round.toplistTitle", qVars(t, season, cat)),
    questions: [
      {
        q: t("nfl.q.toplist", qVars(t, season, cat, { n: board.length })),
        points,
        entries: board.map((r) => ({
          name: r.name,
          aliases: nflAliases(r.name, board),
          value: r.valueLabel,
        })),
      },
    ],
  };
}

/**
 * A Type-It round of "who had the {rank}. most {cat} in {season}?" questions —
 * auto-graded on phones; ambiguous (tied) ranks are skipped by the caller via
 * nflRankUnambiguous. Rank 1 gets the natural "who led …" phrasing.
 */
export function nflRankTypeitRound(t, { season, cat, ranks = [1, 3, 5, 8], points = 10 }) {
  const board = nflBoard(season, cat);
  const questions = ranks
    .filter((r) => board[r - 1])
    .map((r) => {
      const row = board[r - 1];
      return {
        q:
          r === 1
            ? t("nfl.q.rank1", qVars(t, season, cat))
            : t("nfl.q.rankN", qVars(t, season, cat, { n: r, nth: ord(r) })),
        answer: row.name,
        accept: nflAliases(row.name, board),
        points,
      };
    });
  return { type: "typeit", title: t("nfl.round.rankTitle", qVars(t, season, cat)), questions };
}

/**
 * A multiple-choice round: same rank questions, options = the right player +
 * three rank-neighbours from the same board (plausible, era-correct traps).
 */
export function nflChoiceRound(t, { season, cat, ranks = [1, 3, 5, 8], points = 10 }) {
  const board = nflBoard(season, cat);
  const questions = ranks
    .filter((r) => board[r - 1])
    .map((r) => {
      const row = board[r - 1];
      const pool = board.filter((x) => x.rank !== r);
      // nearest ranks first — the most confusable distractors
      pool.sort((a, b) => Math.abs(a.rank - r) - Math.abs(b.rank - r));
      const options = [row.name, ...pool.slice(0, 3).map((x) => x.name)];
      // deterministic-ish shuffle by rank so the correct slot varies per question
      const correctAt = (r + options.length) % options.length;
      const arranged = options.slice(1);
      arranged.splice(correctAt, 0, options[0]);
      return {
        q:
          r === 1
            ? t("nfl.q.rank1", qVars(t, season, cat))
            : t("nfl.q.rankN", qVars(t, season, cat, { n: r, nth: ord(r) })),
        options: arranged,
        correct: correctAt,
        points,
      };
    });
  return { type: "choice", title: t("nfl.round.rankTitle", qVars(t, season, cat)), questions };
}

/**
 * A faces round from ESPN's headshot db: "Who is this?" pictures of the top
 * `n` players of a board (skipping anyone without a face URL).
 */
export function nflFacesRound(t, { season, cat, n = 6, points = 10 }) {
  const board = nflBoard(season, cat).filter((r) => r.face);
  return {
    type: "image",
    title: t("nfl.round.facesTitle", qVars(t, season, cat)),
    questions: board.slice(0, n).map((r) => ({
      url: r.face,
      q: t("nfl.q.face", qVars(t, season, cat)),
      a: `${r.name} (${r.team}${r.pos ? ` · ${r.pos}` : ""})`,
      points,
    })),
  };
}
