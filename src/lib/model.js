/* ====================================================================
   DATA MODEL & UTILITIES
   --------------------------------------------------------------------
   Pure logic only — no React imports. Factories, validation /
   normalization (protects against corrupt storage and bad imports),
   quiz/game helpers, geo math, and export logic.
   ==================================================================== */

import { SCHEMA_VERSION } from "./storage.js";

/** Canonical round-type keys. Must stay in sync with TYPES in components/ui.jsx. */
export const ROUND_TYPES = ["classic", "jeopardy", "hints", "video", "image", "morph", "fusion", "map"];

/** Reveal effects for the morph round. */
export const MORPH_EFFECTS = ["blur", "pixelate", "tiles", "zoom", "slices"];

/** Media kinds a hint-ladder hint can be. Plain text hints stay as strings. */
export const HINT_TYPES = ["text", "image", "audio", "video", "map"];

/**
 * Create an empty hint of the given media type. Text hints are plain strings
 * (back-compatible with the original string-array format); others are objects.
 * @param {string} type One of HINT_TYPES.
 */
export function makeHint(type) {
  switch (type) {
    case "image":
      return { type: "image", url: "" };
    case "audio":
      return { type: "audio", url: "" };
    case "video":
      return { type: "video", url: "" };
    case "map":
      return { type: "map", lat: null, lng: null, name: "" };
    default:
      return "";
  }
}

/** Coerce one hint into a valid string (text) or typed media object. */
function normalizeHint(h) {
  if (typeof h === "string") return h;
  if (!h || typeof h !== "object") return "";
  const type = HINT_TYPES.includes(h.type) ? h.type : "text";
  if (type === "text") return str(h.text);
  if (type === "map") return { type: "map", lat: numOrNull(h.lat), lng: numOrNull(h.lng), name: str(h.name) };
  return { type, url: str(h.url) };
}

/** True if a hint actually carries content (used for the value ladder + display). */
export function hintHasContent(h) {
  if (typeof h === "string") return h.trim() !== "";
  if (!h || typeof h !== "object") return false;
  if (h.type === "map") return h.lat != null && h.lng != null;
  return str(h.url).trim() !== "";
}

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

/**
 * Move an array element from one index to another (returns a new array).
 * @param {Array} arr Source array (not mutated).
 * @param {number} from Index to take the element from.
 * @param {number} to Index to insert it at.
 */
export function moveItem(arr, from, to) {
  const copy = [...arr];
  const [it] = copy.splice(from, 1);
  copy.splice(to, 0, it);
  return copy;
}

/**
 * Great-circle distance between two coordinates in kilometres.
 * @param {number} lat1 @param {number} lng1 First point.
 * @param {number} lat2 @param {number} lng2 Second point.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Read an image file into a data URL, downscaling large images to keep
 * quiz exports and localStorage small (browser only).
 * @param {File} file Image file from an <input type="file">.
 * @param {object} [opts] maxDim (px), keepBelow (bytes kept untouched), quality (JPEG 0–1).
 * @returns {Promise<string>} data URL.
 */
export function fileToDataUrl(file, { maxDim = 1400, keepBelow = 300 * 1024, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.onload = () => {
      const raw = String(reader.result);
      if (file.size <= keepBelow) return resolve(raw);
      const img = new Image();
      img.onerror = () => reject(new Error("That file doesn't look like an image."));
      img.onload = () => {
        // This runs after the executor returned, so a throw here would not
        // reach reject() — catch it explicitly so the promise always settles.
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Couldn't process the image.");
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e instanceof Error ? e : new Error("Couldn't process the image."));
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
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
      return { id: uid(), url: "", q: "Name what you see or hear.", a: "", points: 10, audioOnly: false };
    case "image":
      return { id: uid(), url: "", q: "What do you see?", a: "", points: 10 };
    case "morph":
      return { id: uid(), url: "", a: "", points: 30, effect: "blur", steps: 4 };
    case "fusion":
      return { id: uid(), urlA: "", urlB: "", a: "", points: 40, steps: 4 };
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
    ? { id: uid(), type, title: "", timer: null, categories: [makeCategory()] }
    : { id: uid(), type, title: "", timer: null, questions: [makeQuestion(type)] };
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
      const base = { id: str(r.id) || uid(), type: r.type, title: str(r.title), timer: numOrNull(r.timer) };
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
              hints: (Array.isArray(q?.hints) ? q.hints : [""]).map(normalizeHint),
            });
          if (r.type === "video")
            Object.assign(it, {
              url: str(q?.url),
              q: str(q?.q),
              a: str(q?.a),
              points: num(q?.points, 10),
              audioOnly: !!q?.audioOnly,
            });
          if (r.type === "image")
            Object.assign(it, { url: str(q?.url), q: str(q?.q), a: str(q?.a), points: num(q?.points, 10) });
          if (r.type === "morph")
            Object.assign(it, {
              url: str(q?.url),
              a: str(q?.a),
              points: num(q?.points, 30),
              effect: MORPH_EFFECTS.includes(q?.effect) ? q.effect : "blur",
              steps: Math.max(1, Math.min(8, num(q?.steps, 4))),
            });
          if (r.type === "fusion")
            Object.assign(it, {
              urlA: str(q?.urlA),
              urlB: str(q?.urlB),
              a: str(q?.a),
              points: num(q?.points, 40),
              steps: Math.max(1, Math.min(8, num(q?.steps, 4))),
            });
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
    id: str(raw.id) || uid(),
    quiz,
    players: raw.players.map((p) => {
      const player = { id: str(p?.id) || uid(), name: str(p?.name) || "Player", score: num(p?.score, 0) };
      if (p?.deviceId) player.deviceId = str(p.deviceId); // links a player to a phone in the buzzer room
      if (p?.color) player.color = str(p.color);
      if (p?.emoji) player.emoji = str(p.emoji);
      return player;
    }),
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
    guesses:
      raw.guesses && typeof raw.guesses === "object"
        ? Object.fromEntries(
            Object.entries(raw.guesses)
              .filter(([, g]) => g && numOrNull(g.lat) != null && numOrNull(g.lng) != null)
              .map(([pid, g]) => [pid, { lat: +g.lat, lng: +g.lng }]),
          )
        : {},
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

/**
 * Points still at stake on a morph question at the current reveal step.
 * Full value when fully obscured (step 0), declining toward a floor as the
 * host demorphs (mirrors the hint ladder, but visual).
 * @param {number} points Full point value.
 * @param {number} steps Number of demorph steps.
 * @param {number} step Current step (0 = fully morphed).
 */
export const morphValue = (points, steps, step) =>
  Math.max(1, Math.round((num(points, 10) * (steps - step + 1)) / (steps + 1)));

/* ---- persistent leaderboard ---- */

/**
 * Summarise a finished game into a leaderboard record (no timestamp — the
 * caller stamps it). A win goes to the top scorer(s) only when the board
 * isn't fully tied.
 * @param {object} game A finished game.
 */
export function summarizeGame(game) {
  const players = game.players.map((p) => ({ name: p.name, score: num(p.score, 0) }));
  const max = players.reduce((m, p) => Math.max(m, p.score), -Infinity);
  const min = players.reduce((m, p) => Math.min(m, p.score), Infinity);
  const decided = players.length > 1 && max > min;
  return {
    quizTitle: str(game.quiz?.title) || "Untitled quiz",
    players: players.map((p) => ({ ...p, won: decided && p.score === max })),
  };
}

/**
 * Aggregate stored game records into per-player standings, sorted by wins
 * then total score. Names are matched case-insensitively.
 * @param {Array} results Stored leaderboard records.
 */
export function aggregateLeaderboard(results) {
  const map = new Map();
  for (const r of Array.isArray(results) ? results : []) {
    for (const p of Array.isArray(r?.players) ? r.players : []) {
      const key = str(p?.name).trim().toLowerCase();
      if (!key) continue;
      const e = map.get(key) || { name: str(p.name).trim(), games: 0, wins: 0, totalScore: 0, bestScore: -Infinity };
      e.games += 1;
      e.wins += p.won ? 1 : 0;
      e.totalScore += num(p.score, 0);
      e.bestScore = Math.max(e.bestScore, num(p.score, 0));
      map.set(key, e);
    }
  }
  return [...map.values()].sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore || b.bestScore - a.bestScore);
}

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
