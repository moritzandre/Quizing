/* ====================================================================
   NFL ROUND GENERATORS (pure; data-parameterized; framework-free)
   --------------------------------------------------------------------
   Every function takes the snapshot `data` (the parsed nfl.stats.json)
   explicitly, so the SAME code runs in the browser (bound to the bundled
   snapshot by data/nfl.js for the Builder wizard) and under node
   (scripts/nfl-refresh.mjs bakes the built-in "NFL Night" showcase quiz
   from a fresh snapshot). Question text is produced through the caller's
   i18n `t` at generation time — the strings are baked into the round in
   whatever language the author was using (quiz content is never live-
   translated, same contract as every other authored round). Generated
   rounds are ordinary quiz data: nothing depends on this module at play
   time, and everything survives export/import like hand-written rounds.
   ==================================================================== */

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

/** Seasons in a snapshot (ascending). */
export const seasons = (data) => (Array.isArray(data?.seasons) ? data.seasons : []).slice().sort((a, b) => a - b);

/**
 * The latest season with a FULL set of stats — the running season only has a
 * few weeks in it until February, so "leaders of {season}" questions come from
 * the last completed one (a passing leader north of 3,500 yds = a full season).
 */
export function latestFullSeason(data) {
  const all = seasons(data);
  for (let i = all.length - 1; i >= 0; i--) {
    const top = data?.boards?.[String(all[i])]?.passYd?.[0]?.[1] || 0;
    if (top >= 3500) return all[i];
  }
  return all[all.length - 1] ?? null;
}

/** ESPN headshot ("face db") URL for a player record, else the nflverse one. */
export function face(p) {
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
export function valueLabel(cat, v) {
  const unit = NFL_CATS[cat]?.unit || "";
  return unit ? `${group(v)} ${unit}` : group(v);
}

/**
 * One season × category leaderboard, as rich rows (rank 1 = the leader).
 * @returns {Array<{rank:number,id:string,name:string,pos:string,team:string,value:number,valueLabel:string,face:string}>}
 */
export function board(data, season, cat) {
  const raw = data?.boards?.[String(season)]?.[cat];
  if (!Array.isArray(raw)) return [];
  return raw.map(([id, value], i) => {
    const p = data.players?.[id] || {};
    return {
      rank: i + 1,
      id,
      name: p.n || "?",
      pos: p.p || "",
      team: p.t || "",
      value,
      valueLabel: valueLabel(cat, value),
      face: face(p),
    };
  });
}

/**
 * Is "the Nth most" unambiguous on this board? True when the value at rank n
 * is strictly between its neighbours (no tie muddying what "Nth" means).
 */
export function rankUnambiguous(rows, n) {
  const at = rows[n - 1];
  if (!at) return false;
  const above = rows[n - 2];
  const below = rows[n];
  return (!above || above.value > at.value) && (!below || at.value > below.value);
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

/**
 * Accepted spellings for a player answer: the bare last name — only when no
 * OTHER player in `context` shares it (two Allens on one board = "Allen"
 * alone matches neither). Suffixes (Jr./II/…) are stripped.
 */
export function aliases(name, context = []) {
  const last = lastNameOf(name);
  if (!last || normText(last) === normText(name)) return [];
  const clash = context.some((r) => r.name !== name && normText(lastNameOf(r.name)) === normText(last));
  return clash ? [] : [last];
}

/** Search a snapshot's players by (normalized) name fragment — most exact first. */
export function playerSearch(data, text, limit = 12) {
  const q = normText(text);
  if (!q) return [];
  const out = [];
  for (const [id, p] of Object.entries(data?.players || {}))
    if (normText(p.n).includes(q)) out.push({ id, name: p.n, pos: p.p || "", team: p.t || "", face: face(p) });
  return out.sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name)).slice(0, limit);
}

/** Every board appearance of a player: [{season, cat, rank, value, valueLabel}]. */
export function playerFinds(data, id) {
  const finds = [];
  for (const [season, cats] of Object.entries(data?.boards || {})) {
    for (const [cat, rows] of Object.entries(cats)) {
      const i = rows.findIndex(([pid]) => pid === id);
      if (i >= 0)
        finds.push({ season: +season, cat, rank: i + 1, value: rows[i][1], valueLabel: valueLabel(cat, rows[i][1]) });
    }
  }
  return finds.sort((a, b) => a.rank - b.rank || b.season - a.season);
}

/* ---- round generators ---- */

/** English ordinal for question text: 1→"1st", 8→"8th" (the de strings use "{n}."). */
const ord = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

/** The shared text vars for a season × category (+ extras). */
const vars = (t, season, cat, extra = {}) => ({ season, cat: t(NFL_CATS[cat]?.label || cat), ...extra });

/** "Who led …" for rank 1, "who had the Nth-most …" otherwise. */
const rankQuestion = (t, season, cat, r) =>
  r === 1 ? t("nfl.q.rank1", vars(t, season, cat)) : t("nfl.q.rankN", vars(t, season, cat, { n: r, nth: ord(r) }));

/** A Top-List (Tenable board) round: the top `n` of a leaderboard. */
export function toplistRound(data, t, { season, cat, n = 10, points = 10 }) {
  const rows = board(data, season, cat).slice(0, n);
  return {
    type: "toplist",
    title: t("nfl.round.toplistTitle", vars(t, season, cat)),
    questions: [
      {
        q: t("nfl.q.toplist", vars(t, season, cat, { n: rows.length })),
        points,
        entries: rows.map((r) => ({ name: r.name, aliases: aliases(r.name, rows), value: r.valueLabel })),
      },
    ],
  };
}

/**
 * Type-It rank questions ("who had the 8th-most …?"), auto-graded on phones.
 * Tie-ambiguous ranks are dropped so "Nth" always has one answer.
 */
export function rankTypeitRound(data, t, { season, cat, ranks = [1, 3, 5, 8], points = 10 }) {
  const rows = board(data, season, cat);
  const questions = ranks
    .filter((r) => rankUnambiguous(rows, r))
    .map((r) => {
      const row = rows[r - 1];
      return { q: rankQuestion(t, season, cat, r), answer: row.name, accept: aliases(row.name, rows), points };
    });
  return { type: "typeit", title: t("nfl.round.rankTitle", vars(t, season, cat)), questions };
}

/** Multiple choice: the same rank questions, distractors = the nearest ranks (era-correct traps). */
export function choiceRound(data, t, { season, cat, ranks = [1, 3, 5, 8], points = 10 }) {
  const rows = board(data, season, cat);
  const questions = ranks
    .filter((r) => rankUnambiguous(rows, r))
    .map((r) => {
      const row = rows[r - 1];
      const pool = rows.filter((x) => x.rank !== r).sort((a, b) => Math.abs(a.rank - r) - Math.abs(b.rank - r));
      const options = pool.slice(0, 3).map((x) => x.name);
      const correct = (r + 3) % 4; // deterministic slot, varies per question
      options.splice(correct, 0, row.name);
      return { q: rankQuestion(t, season, cat, r), options, correct, points };
    });
  return { type: "choice", title: t("nfl.round.rankTitle", vars(t, season, cat)), questions };
}

/** A faces round: "who is this?" pictures of the top `n` players (skips anyone without a headshot). */
export function facesRound(data, t, { season, cat, n = 6, points = 10 }) {
  const rows = board(data, season, cat).filter((r) => r.face);
  return {
    type: "image",
    title: t("nfl.round.facesTitle", vars(t, season, cat)),
    questions: rows.slice(0, n).map((r) => ({
      url: r.face,
      q: t("nfl.q.face", vars(t, season, cat)),
      a: `${r.name} (${r.team}${r.pos ? ` · ${r.pos}` : ""})`,
      points,
    })),
  };
}

/**
 * Higher / Lower: "X had N {cat} in {season} — did Y have higher or lower?"
 * `pairs` are [statedRank, askedRank]; pairs with equal values are skipped.
 * correct 0 = Higher, 1 = Lower (the binary-round contract); the note carries Y's number.
 */
export function higherLowerRound(
  data,
  t,
  {
    season,
    cat,
    pairs = [
      [3, 1],
      [2, 5],
      [6, 4],
      [8, 2],
      [5, 9],
    ],
    points = 10,
  },
) {
  const rows = board(data, season, cat);
  const questions = pairs
    .filter(([a, b]) => rows[a - 1] && rows[b - 1] && rows[a - 1].value !== rows[b - 1].value)
    .map(([a, b]) => {
      const x = rows[a - 1];
      const y = rows[b - 1];
      return {
        q: t("nfl.q.higherLower", vars(t, season, cat, { x: x.name, xv: x.valueLabel, y: y.name })),
        correct: y.value > x.value ? 0 : 1,
        note: t("nfl.q.higherLowerNote", { y: y.name, yv: y.valueLabel, n: y.rank }),
        points,
      };
    });
  return { type: "higherlower", title: t("nfl.round.higherLowerTitle", vars(t, season, cat)), questions };
}

/** Closest guess: "how many {cat} did X have in {season}?" — phones submit a number, nearest wins. */
export function numberRound(data, t, { season, cat, ranks = [1, 2, 4], points = 10 }) {
  const rows = board(data, season, cat);
  const questions = ranks
    .filter((r) => rows[r - 1])
    .map((r) => ({
      q: t("nfl.q.number", vars(t, season, cat, { x: rows[r - 1].name })),
      answer: rows[r - 1].value,
      unit: NFL_CATS[cat]?.unit || "",
      points,
    }));
  return { type: "number", title: t("nfl.round.numberTitle", vars(t, season, cat)), questions };
}

/**
 * True / False: "X led the NFL in {cat} in {season}." — true for the actual
 * leader, false for the other `subjects` (with the real leader in the note).
 * correct 0 = True, 1 = False (the binary-round contract).
 */
export function trueFalseRound(data, t, { season, cat, subjects = [1, 3, 2, 6], points = 10 }) {
  const rows = board(data, season, cat);
  const leader = rows[0];
  if (!leader) return { type: "truefalse", title: t("nfl.round.trueFalseTitle", vars(t, season, cat)), questions: [] };
  const questions = subjects
    .filter((r) => rows[r - 1] && (r === 1 || rows[r - 1].value < leader.value))
    .map((r) => {
      const x = rows[r - 1];
      const isLeader = r === 1;
      return {
        q: t("nfl.q.trueFalse", vars(t, season, cat, { x: x.name })),
        correct: isLeader ? 0 : 1,
        note: isLeader
          ? t("nfl.q.tfTrueNote", { xv: x.valueLabel })
          : t("nfl.q.tfFalseNote", {
              leader: leader.name,
              lv: leader.valueLabel,
              x: x.name,
              xv: x.valueLabel,
              n: x.rank,
            }),
        points,
      };
    });
  return { type: "truefalse", title: t("nfl.round.trueFalseTitle", vars(t, season, cat)), questions };
}

/** Who Knows More: auction "name players in the top {n} for {cat}, {season}" (ranked answer list). */
export function whoknowsRound(data, t, { season, cat, n = 10, points = 1 }) {
  const rows = board(data, season, cat).slice(0, n);
  return {
    type: "whoknows",
    title: t("nfl.round.whoknowsTitle", vars(t, season, cat)),
    timer: 20,
    questions: [
      {
        q: t("nfl.q.whoknows", vars(t, season, cat, { n: rows.length })),
        answers: rows.map((r) => `${r.name} (${r.valueLabel})`),
        ordered: true,
        points,
      },
    ],
  };
}

/**
 * A Jeopardy board: one category per stat (clues by rank, 100…500) plus a
 * "Faces" category whose clues are headshot MEDIA (the jeopardy clue-media
 * feature) — "who is this?" for the top players of `facesCat`.
 */
export function jeopardyRound(
  data,
  t,
  { season, cats = ["passYd", "rushYd", "recYd"], facesCat = "recYd", ranks = [1, 2, 3, 4, 5] },
) {
  const categories = cats.map((cat) => {
    const rows = board(data, season, cat);
    return {
      name: t("nfl.jeop.cat", vars(t, season, cat)),
      questions: ranks
        .filter((r) => rows[r - 1])
        .map((r, i) => ({
          clue: t("nfl.jeop.clue", vars(t, season, cat, { n: r, nth: ord(r), v: rows[r - 1].valueLabel })),
          answer: rows[r - 1].name,
          points: (i + 1) * 100,
        })),
    };
  });
  const faces = board(data, season, facesCat).filter((r) => r.face);
  if (faces.length)
    categories.push({
      name: t("nfl.jeop.faces", { season }),
      questions: faces.slice(0, ranks.length).map((r, i) => ({
        clue: t("nfl.q.facePlain"),
        media: { type: "image", url: r.face },
        answer: `${r.name} (${r.team}${r.pos ? ` · ${r.pos}` : ""})`,
        points: (i + 1) * 100,
      })),
    });
  return { type: "jeopardy", title: t("nfl.round.jeopardyTitle", { season }), categories };
}

/* ---- the built-in showcase quiz ---- */

/** Stamp deterministic ids so the baked quiz diffs cleanly between refreshes. */
function stampIds(quiz) {
  quiz.rounds.forEach((r, ri) => {
    r.id = `nfl-r${ri + 1}`;
    (r.questions || []).forEach((q, qi) => (q.id = `${r.id}q${qi + 1}`));
    (r.categories || []).forEach((c, ci) => {
      c.id = `${r.id}c${ci + 1}`;
      c.questions.forEach((q, qi) => (q.id = `${c.id}q${qi + 1}`));
    });
  });
  return quiz;
}

/**
 * "NFL Night — Stats & Faces": one round per NFL-capable format, built from
 * the freshest full season plus a few classics, so the whole integration can be
 * played end to end. Baked by the refresh script into src/data/nflQuiz.json.
 */
export function showcaseQuiz(data, t) {
  const S = latestFullSeason(data);
  const all = seasons(data);
  const has = (y) => all.includes(y);
  const pick = (y, fallback) => (has(y) ? y : fallback);
  const y21 = pick(2021, S);
  const y22 = pick(2022, S);
  const y23 = pick(2023, S);
  const y24 = pick(2024, S);
  const rounds = [
    toplistRound(data, t, { season: S, cat: "passYd", n: 10, points: 10 }),
    rankTypeitRound(data, t, { season: y21, cat: "passYd", ranks: [1, 2, 3, 5, 8], points: 10 }),
    higherLowerRound(data, t, { season: S, cat: "rushYd", points: 10 }),
    numberRound(data, t, { season: S, cat: "recYd", ranks: [1, 2, 4], points: 10 }),
    trueFalseRound(data, t, { season: y23, cat: "sacks", points: 10 }),
    { ...choiceRound(data, t, { season: y22, cat: "recTd", ranks: [1, 3, 5, 8], points: 10 }), reveal: "end" },
    facesRound(data, t, { season: S, cat: "rushYd", n: 6, points: 10 }),
    jeopardyRound(data, t, { season: S }),
    whoknowsRound(data, t, { season: y24, cat: "rec", n: 10, points: 2 }),
  ].filter((r) => (r.questions || []).length || (r.categories || []).length);
  return stampIds({ id: "nfl", sample: true, title: "NFL Night — Stats & Faces", rounds });
}
