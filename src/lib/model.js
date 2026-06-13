/* ====================================================================
   DATA MODEL & UTILITIES
   --------------------------------------------------------------------
   Pure logic only — no React imports. Factories, validation /
   normalization (protects against corrupt storage and bad imports),
   quiz/game helpers, and export logic.
   ==================================================================== */

import { SCHEMA_VERSION } from "./storage.js";

/** Canonical round-type keys. Must stay in sync with TYPES in components/ui.jsx. */
export const ROUND_TYPES = ["classic", "jeopardy", "hints", "video", "map"];

/** Generate a short random id. */
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Deep-clone a JSON-serializable value. */
export const deepClone = (x) => JSON.parse(JSON.stringify(x));

/** Coerce to string, with default. */
export const str = (v, d = "") => (typeof v === "string" ? v : d);

/** Coerce to finite number, with default. */
export const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/** Coerce to finite number, or null for empty/invalid input. */
export const numOrNull = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(+v) ? null : +v);

/**
 * Extract a YouTube video ID from any common URL shape (or a raw ID).
 * @param {string} url YouTube URL or bare 11-character ID.
 * @returns {string|null} The video ID, or null if none found.
 */
export function ytId(url = "") {
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (m) return m[1];
  const t = String(url).trim();
  return /^[\w-]{11}$/.test(t) ? t : null;
}

/* ---- factories ---- */

/**
 * Create an empty question for the given round type.
 * @param {string} type One of ROUND_TYPES (jeopardy uses makeCategory instead).
 */
export function makeQuestion(type) {
  switch (type) {
    case "classic":
      return { id: uid(), q: "", a: "", points: 10 };
    case "hints":
      return { id: uid(), answer: "", hints: ["", "", ""] };
    case "video":
      return { id: uid(), url: "", q: "Name what you see or hear.", a: "", points: 10 };
    case "map":
      return { id: uid(), q: "", name: "", lat: null, lng: null, points: 10 };
    default:
      return { id: uid() };
  }
}

/** Create an empty jeopardy category with three clues (100/200/300). */
export function makeCategory() {
  return {
    id: uid(),
    name: "",
    questions: [100, 200, 300].map((p) => ({ id: uid(), clue: "", answer: "", points: p })),
  };
}

/**
 * Create an empty round of the given type.
 * @param {string} type One of ROUND_TYPES.
 */
export function makeRound(type) {
  return type === "jeopardy"
    ? { id: uid(), type, title: "", categories: [makeCategory()] }
    : { id: uid(), type, title: "", questions: [makeQuestion(type)] };
}

/* ---- normalization ---- */

/**
 * Coerce unknown data into a valid quiz, or return null if hopeless.
 * @param {*} raw Untrusted data (storage, import file).
 * @returns {object|null} A valid quiz object, or null.
 */
export function normalizeQuiz(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.rounds)) return null;
  const rounds = raw.rounds
    .map((r) => {
      if (!r || !ROUND_TYPES.includes(r.type)) return null;
      const base = { id: str(r.id) || uid(), type: r.type, title: str(r.title) };
      if (r.type === "jeopardy") {
        base.categories = (Array.isArray(r.categories) ? r.categories : []).map((c) => ({
          id: str(c?.id) || uid(),
          name: str(c?.name),
          questions: (Array.isArray(c?.questions) ? c.questions : []).map((q) => ({
            id: str(q?.id) || uid(),
            clue: str(q?.clue),
            answer: str(q?.answer),
            points: num(q?.points, 100),
          })),
        }));
      } else {
        base.questions = (Array.isArray(r.questions) ? r.questions : []).map((q) => {
          const it = { id: str(q?.id) || uid() };
          if (r.type === "classic") Object.assign(it, { q: str(q?.q), a: str(q?.a), points: num(q?.points, 10) });
          if (r.type === "hints")
            Object.assign(it, {
              answer: str(q?.answer),
              hints: (Array.isArray(q?.hints) ? q.hints : [""]).map((h) => str(h)),
            });
          if (r.type === "video")
            Object.assign(it, { url: str(q?.url), q: str(q?.q), a: str(q?.a), points: num(q?.points, 10) });
          if (r.type === "map")
            Object.assign(it, {
              q: str(q?.q),
              name: str(q?.name),
              lat: numOrNull(q?.lat),
              lng: numOrNull(q?.lng),
              points: num(q?.points, 10),
            });
          return it;
        });
      }
      return base;
    })
    .filter(Boolean);
  return { id: str(raw.id) || uid(), title: str(raw.title) || "Untitled quiz", sample: !!raw.sample, rounds };
}

/**
 * Coerce unknown data into a valid in-progress game, or null.
 * @param {*} raw Untrusted data (storage).
 * @returns {object|null} A valid game object, or null.
 */
export function normalizeGame(raw) {
  if (!raw || typeof raw !== "object") return null;
  const quiz = normalizeQuiz(raw.quiz);
  if (!quiz || !Array.isArray(raw.players) || raw.players.length === 0) return null;
  return {
    quiz,
    players: raw.players.map((p) => ({
      id: str(p?.id) || uid(),
      name: str(p?.name) || "Player",
      score: num(p?.score, 0),
    })),
    ri: num(raw.ri, 0),
    qi: num(raw.qi, 0),
    stage: ["intro", "question", "board", "end"].includes(raw.stage) ? raw.stage : "intro",
    revealed: !!raw.revealed,
    hintsShown: Math.max(1, num(raw.hintsShown, 1)),
    awarded: raw.awarded && typeof raw.awarded === "object" ? raw.awarded : {},
    used: raw.used && typeof raw.used === "object" ? raw.used : {},
    tile:
      raw.tile && Number.isFinite(+raw.tile.ci) && Number.isFinite(+raw.tile.qi)
        ? { ci: +raw.tile.ci, qi: +raw.tile.qi }
        : null,
  };
}

/* ---- quiz/game helpers ---- */

/** True if a round has at least one question (or one jeopardy clue). */
export const roundHasContent = (r) =>
  r.type === "jeopardy"
    ? (r.categories || []).some((c) => (c.questions || []).length > 0)
    : (r.questions || []).length > 0;

/**
 * Index of the next round with content, starting at `from`, or -1.
 * @param {object} quiz A valid quiz.
 * @param {number} from Round index to start scanning at.
 */
export function nextNonEmpty(quiz, from) {
  for (let i = from; i < quiz.rounds.length; i++) if (roundHasContent(quiz.rounds[i])) return i;
  return -1;
}

/**
 * Total number of questions across all rounds of a quiz.
 * @param {object} quiz A valid quiz.
 */
export const countQuestions = (quiz) =>
  quiz.rounds.reduce(
    (n, r) =>
      n +
      (r.type === "jeopardy"
        ? (r.categories || []).reduce((m, c) => m + (c.questions || []).length, 0)
        : (r.questions || []).length),
    0,
  );

/* ---- export / import (.quiz.json) ---- */

/**
 * Download a quiz as a .quiz.json file (browser only).
 * @param {object} quiz A valid quiz.
 */
export function exportQuiz(quiz) {
  const payload = JSON.stringify({ app: "quiz-night", v: SCHEMA_VERSION, quiz }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${
    (quiz.title || "quiz")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "quiz"
  }.quiz.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
