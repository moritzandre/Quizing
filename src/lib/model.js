/* ====================================================================
   DATA MODEL & UTILITIES
   --------------------------------------------------------------------
   Pure logic only — no React imports. Factories, validation /
   normalization (protects against corrupt storage and bad imports),
   quiz/game helpers, geo math, and export logic.
   ==================================================================== */

import { SCHEMA_VERSION } from "./storage.js";

/** Canonical round-type keys. Must stay in sync with TYPES in components/ui.jsx. */
export const ROUND_TYPES = [
  "classic",
  "jeopardy",
  "hints",
  "connect",
  "video",
  "clip",
  "image",
  "morph",
  "fusion",
  "map",
  "choice",
  "truefalse",
  "higherlower",
  "number",
  "whoknows",
];

/** Round types that reuse the phone "choice" machinery (auto-scored fixed options). */
export const BINARY_TYPES = ["choice", "truefalse", "higherlower"];

/** Between-rounds recap minigame skins; the host picks one at random per round. */
export const RECAP_VARIANTS = ["invaders", "race", "stacker", "pellet", "bricks"];

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
      return { type: "audio", url: "", start: null, end: null };
    case "video":
      return { type: "video", url: "", start: null, end: null };
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
  if (type === "image") return { type: "image", url: str(h.url) };
  // audio / video: keep an optional trim window (start/end seconds)
  return { type, url: str(h.url), start: numOrNull(h.start), end: numOrNull(h.end) };
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
 * Build an embeddable Mapillary street-view URL from whatever the author pastes
 * (a /app share URL with pKey, an /embed URL with image_key, or a raw id). The
 * /embed endpoint is the only Mapillary page that allows iframing.
 * @param {string} street Mapillary URL or image id.
 * @returns {string|null} An https://www.mapillary.com/embed?... URL, or null.
 */
export function mapillaryEmbedUrl(street) {
  const s = str(street).trim();
  if (!s) return null;
  const m = s.match(/(?:^|[?&])(?:image_key|image_id|pKey|id)=([^&\s]+)/i);
  const key = m ? m[1] : /^[\w-]+$/.test(s) ? s : null;
  return key ? `https://www.mapillary.com/embed?image_key=${encodeURIComponent(key)}&style=photo` : null;
}

/**
 * Extract a YouTube video ID from any common URL shape (or a raw ID).
 * @param {string} url YouTube URL or bare 11-character ID.
 * @returns {string|null} The video ID, or null if none found.
 */
export function ytId(url = "") {
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
  if (m) return m[1];
  const t = String(url).trim();
  return /^[\w-]{11}$/.test(t) ? t : null;
}

/** Video file extensions played via a native <video> element. */
const VIDEO_EXTS = ["mp4", "m4v", "mov", "webm", "ogv"];
/** Audio file extensions played via a native <audio> element. */
const AUDIO_EXTS = ["mp3", "m4a", "aac", "ogg", "oga", "opus", "wav", "flac"];

/**
 * Classify a clip/video URL into a playable media source. Lets a clip play from
 * YouTube, Spotify, or a direct audio/video file — Spotify and direct files
 * dodge YouTube's "embedding disabled" wall (common for music). The source is
 * derived purely from the URL string, so nothing new has to be stored.
 * @param {string} url A URL (or bare YouTube id).
 * @returns {{kind:"youtube",id:string}|{kind:"spotify",id:string,spType:string,uri:string,embedUrl:string}|{kind:"file",url:string,media:"audio"|"video"}|null}
 */
export function mediaSource(url = "") {
  const s = String(url).trim();
  if (!s) return null;
  // Spotify track/episode: open.spotify.com/(intl-xx/)track/ID, or spotify:track:ID
  const sp = s.match(
    /(?:open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|episode)\/|spotify:(track|episode):)([A-Za-z0-9]+)/,
  );
  if (sp) {
    const spType = sp[1] || sp[2];
    const id = sp[3];
    return {
      kind: "spotify",
      id,
      spType,
      uri: `spotify:${spType}:${id}`,
      embedUrl: `https://open.spotify.com/embed/${spType}/${id}`,
    };
  }
  // Direct media file by extension (allowing a trailing ?query/#hash) or data: URL
  const ext = s.match(/\.([a-z0-9]+)(?:[?#]|$)/i);
  const isData = /^data:(audio|video)\//i.test(s);
  if (isData || (ext && [...VIDEO_EXTS, ...AUDIO_EXTS].includes(ext[1].toLowerCase()))) {
    const e = isData ? (/^data:video/i.test(s) ? "mp4" : "mp3") : ext[1].toLowerCase();
    return { kind: "file", url: s, media: VIDEO_EXTS.includes(e) ? "video" : "audio" };
  }
  // Fall back to YouTube (the most permissive matcher) last.
  const yt = ytId(s);
  if (yt) return { kind: "youtube", id: yt };
  return null;
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
export function fileToDataUrl(file, { maxDim = 1600, keepBelow = 300 * 1024, quality = 0.86 } = {}) {
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
    case "connect":
      return { id: uid(), answer: "", clues: ["", "", ""] };
    case "video":
      return {
        id: uid(),
        url: "",
        q: "Name what you see or hear.",
        a: "",
        points: 10,
        audioOnly: false,
        start: null,
        end: null,
      };
    case "clip":
      // Clip ladder: a short slice the host extends step by step for fewer
      // points. Defaults to a working 0–30s window so the ladder is live out
      // of the box (the author trims it to the real clip).
      return {
        id: uid(),
        url: "",
        q: "Name what you see or hear.",
        a: "",
        points: 10,
        audioOnly: false,
        start: 0,
        end: 30,
        steps: 4,
      };
    case "image":
      return { id: uid(), url: "", q: "What do you see?", a: "", points: 10 };
    case "morph":
      return { id: uid(), url: "", a: "", points: 30, effect: "blur", steps: 4 };
    case "fusion":
      return { id: uid(), urlA: "", urlB: "", a: "", points: 40, steps: 4 };
    case "choice":
      return { id: uid(), q: "", options: ["", "", "", ""], correct: 0, points: 10 };
    case "truefalse":
      // correct: 0 = True, 1 = False. note: optional fact shown on reveal.
      return { id: uid(), q: "", correct: 0, points: 10, note: "" };
    case "higherlower":
      // correct: 0 = Higher, 1 = Lower. note: optional fact shown on reveal.
      return { id: uid(), q: "", correct: 0, points: 10, note: "" };
    case "number":
      return { id: uid(), q: "", answer: null, unit: "", points: 10 };
    case "map":
      return { id: uid(), q: "", name: "", lat: null, lng: null, points: 10, tileLayer: "map", street: "" };
    case "whoknows":
      // "Who Knows More": a category the host auctions; the winner must name
      // at least as many correct answers as they claimed. `answers` is the full
      // list (for clicking + showcase); `ordered` shows them numbered on reveal.
      return { id: uid(), q: "", answers: ["", "", "", "", ""], ordered: false };
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
          if (r.type === "connect")
            Object.assign(it, {
              answer: str(q?.answer),
              clues: (Array.isArray(q?.clues) ? q.clues : [""]).map(normalizeHint),
            });
          if (r.type === "video")
            Object.assign(it, {
              url: str(q?.url),
              q: str(q?.q),
              a: str(q?.a),
              points: num(q?.points, 10),
              audioOnly: !!q?.audioOnly,
              start: numOrNull(q?.start),
              end: numOrNull(q?.end),
            });
          if (r.type === "clip")
            Object.assign(it, {
              url: str(q?.url),
              q: str(q?.q),
              a: str(q?.a),
              points: num(q?.points, 10),
              audioOnly: !!q?.audioOnly,
              start: numOrNull(q?.start),
              end: numOrNull(q?.end),
              steps: Math.max(1, Math.min(8, num(q?.steps, 4))),
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
          if (r.type === "choice") {
            // Cap at 6 options — the UI labels them A–F (Builder caps at 6 too).
            const options = (Array.isArray(q?.options) ? q.options.slice(0, 6) : ["", "", "", ""]).map((o) => str(o));
            Object.assign(it, {
              q: str(q?.q),
              options,
              correct: Math.max(0, Math.min(options.length - 1, num(q?.correct, 0))),
              points: num(q?.points, 10),
            });
          }
          if (r.type === "truefalse" || r.type === "higherlower")
            Object.assign(it, {
              q: str(q?.q),
              correct: num(q?.correct, 0) === 1 ? 1 : 0, // 0 = True/Higher, 1 = False/Lower
              points: num(q?.points, 10),
              note: str(q?.note),
            });
          if (r.type === "number")
            Object.assign(it, {
              q: str(q?.q),
              answer: numOrNull(q?.answer),
              unit: str(q?.unit),
              points: num(q?.points, 10),
            });
          if (r.type === "whoknows")
            Object.assign(it, {
              q: str(q?.q),
              answers: (Array.isArray(q?.answers) ? q.answers : [])
                .map((a) => (typeof a === "number" ? String(a) : str(a)))
                .filter((a) => a.trim() !== ""),
              ordered: !!q?.ordered,
            });
          if (r.type === "map")
            Object.assign(it, {
              q: str(q?.q),
              name: str(q?.name),
              lat: numOrNull(q?.lat),
              lng: numOrNull(q?.lng),
              points: num(q?.points, 10),
              tileLayer: q?.tileLayer === "satellite" ? "satellite" : "map",
              street: str(q?.street),
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
  const g = {
    id: str(raw.id) || uid(),
    mode: raw.mode === "teams" ? "teams" : "solo",
    quiz,
    players: raw.players.map((p) => {
      const player = { id: str(p?.id) || uid(), name: str(p?.name) || "Player", score: num(p?.score, 0) };
      // deviceIds links a scoring entity (solo player or team) to phone(s) in the room.
      const ids = Array.isArray(p?.deviceIds) ? p.deviceIds.map((d) => str(d)).filter(Boolean) : [];
      if (!ids.length && p?.deviceId) ids.push(str(p.deviceId)); // migrate single-device players
      if (ids.length) player.deviceIds = ids;
      if (Array.isArray(p?.members)) player.members = p.members.map((m) => ({ name: str(m?.name) || "Player" }));
      if (p?.color) player.color = str(p.color);
      if (p?.emoji) player.emoji = str(p.emoji);
      if (p?.profileId) player.profileId = str(p.profileId); // links the entity to a persistent player profile
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
    // Per-entity totals captured at the start of the current round, so the
    // between-rounds recap can animate from start-of-round to end-of-round.
    roundStartScores: scoreMap(raw.roundStartScores),
  };
  // Coherence guard: a jeopardy question needs an open tile. A corrupted/edited
  // save with stage "question" but no tile would crash the question render, so
  // fall back to the board.
  if (g.quiz.rounds[g.ri]?.type === "jeopardy" && g.stage === "question" && !g.tile) g.stage = "board";
  return g;
}

/** Coerce an untrusted {id: score} object to a clean {id: number} map. */
function scoreMap(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter(([, v]) => Number.isFinite(+v))
      .map(([k, v]) => [str(k), +v]),
  );
}

/**
 * Extract normalized rounds from arbitrary imported JSON: an array of rounds, a
 * quiz, a `{quiz}` wrapper, or a single round object. Returns [] if none valid.
 * @param {*} parsed Parsed JSON (untrusted).
 */
export function roundsFromImport(parsed) {
  let rounds = null;
  if (Array.isArray(parsed)) rounds = parsed;
  else if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.rounds)) rounds = parsed.rounds;
    else if (parsed.quiz && Array.isArray(parsed.quiz.rounds)) rounds = parsed.quiz.rounds;
    else if (typeof parsed.type === "string") rounds = [parsed];
  }
  if (!rounds) return [];
  const q = normalizeQuiz({ rounds });
  return q ? q.rounds : [];
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

/**
 * Video/audio "clip ladder": the host plays a short slice of the trimmed
 * [start,end] window and extends it step by step (like the hint ladder),
 * awarding fewer points each extension. Active only when `steps` > 0 and the
 * trim window is real (end past start).
 * @param {object} q A video question.
 */
export const clipLadderActive = (q) => num(q?.steps, 0) > 0 && q?.end != null && q.end > num(q?.start, 0);

/**
 * Out-point (in seconds) of the clip for the current ladder step. Step 0 plays
 * the first 1/(steps+1) of the window; the final step plays to `end`. Returns
 * the question's plain `end` when the ladder isn't active.
 * @param {object} q A video question.
 * @param {number} step Current ladder step (0-based).
 */
export const clipEnd = (q, step) => {
  if (!clipLadderActive(q)) return q?.end ?? null;
  const lo = num(q.start, 0);
  const steps = num(q.steps, 0);
  const span = q.end - lo;
  return lo + (span * Math.min(num(step, 0) + 1, steps + 1)) / (steps + 1);
};

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

/* ---- persistent player profiles (optional Supabase backend) ----
   All untrusted (a row from Supabase, or a cached profile) — coerced here so
   nothing downstream trusts raw data. The backend layer is in lib/supabase.js. */

/**
 * Validate a player profile (from Supabase or local cache). Requires an id.
 * @param {*} raw
 * @returns {{id:string,name:string,emoji:string|null,color:string|null,locked:boolean}|null} (emoji = a pixel-sprite key)
 */
export function normalizeProfile(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = str(raw.id);
  if (!id) return null;
  return {
    id,
    name: str(raw.name),
    emoji: typeof raw.emoji === "string" ? raw.emoji : null, // a pixel-sprite key
    color: typeof raw.color === "string" ? raw.color : null,
    locked: !!raw.locked,
  };
}

/** Validate a row from the shared player directory (profiles_public view). */
export function normalizePlayers(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => normalizeProfile(r)).filter(Boolean);
}

/** Validate the global leaderboard view rows into UI-friendly aggregates. */
export function normalizeLeaderboard(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      id: str(r?.id),
      name: str(r?.name) || "Player",
      emoji: typeof r?.emoji === "string" ? r.emoji : null,
      color: typeof r?.color === "string" ? r.color : null,
      games: Math.max(0, num(r?.games, 0)),
      wins: Math.max(0, num(r?.wins, 0)),
      totalScore: num(r?.total_score, 0),
      bestScore: num(r?.best_score, 0),
    }))
    .filter((e) => e.id)
    .sort((a, b) => b.wins - a.wins || b.totalScore - a.totalScore || b.bestScore - a.bestScore);
}

/**
 * Build the result row a phone writes for ITSELF at game end, from the standings
 * it already mirrors (the phone has no `game` object — only `state.scores`). The
 * phone finds its own entity by deviceId. Returns null if it isn't in the game.
 * The caller adds `profile_id` (its own current player — correct in team mode,
 * where the team entity is shared by several phones/players).
 * @param {Array} scores normalizePhoneScores output (each has deviceIds[]).
 * @param {string} deviceId The phone's device id.
 * @param {{gameId?:string,quizTitle?:string,mode?:string,roomCode?:string}} meta
 */
export function buildResultRow(scores, deviceId, meta = {}) {
  const list = Array.isArray(scores) ? scores : [];
  const me = list.find((e) => (e.deviceIds || []).includes(deviceId));
  if (!me || !str(meta.gameId)) return null;
  const max = list.reduce((m, e) => Math.max(m, num(e.score, 0)), -Infinity);
  const min = list.reduce((m, e) => Math.min(m, num(e.score, 0)), Infinity);
  const decided = list.length > 1 && max > min;
  return {
    game_id: str(meta.gameId),
    quiz_title: str(meta.quizTitle) || "Untitled quiz",
    score: num(me.score, 0),
    won: decided && num(me.score, 0) === max,
    team_name: meta.mode === "teams" ? str(me.name) : null,
    room_code: str(meta.roomCode) || null,
  };
}

/**
 * Validate a list of stored result rows (from Supabase) for the stats view.
 * @param {*} rows
 */
export function normalizeResults(rows) {
  return (Array.isArray(rows) ? rows : []).slice(0, 500).map((r) => ({
    game_id: str(r?.game_id),
    quiz_title: str(r?.quiz_title) || "Untitled quiz",
    score: num(r?.score, 0),
    won: !!r?.won,
    team_name: typeof r?.team_name === "string" ? r.team_name : null,
    room_code: typeof r?.room_code === "string" ? r.room_code : null,
    played_at: str(r?.played_at),
  }));
}

/** Aggregate result rows into headline stats (games/wins/best/total). */
export function summarizeResults(rows) {
  const list = normalizeResults(rows);
  return {
    games: list.length,
    wins: list.reduce((n, r) => n + (r.won ? 1 : 0), 0),
    totalScore: list.reduce((n, r) => n + r.score, 0),
    bestScore: list.reduce((m, r) => Math.max(m, r.score), 0),
    recent: list.slice(0, 10),
  };
}

/**
 * Group raw `results` rows into games (for the admin "past games" view). Each
 * game aggregates its player entries; the caller joins profile_id → name via the
 * player directory. Returns games newest-first. Pure.
 * @param {Array<object>} rows raw result rows (profile_id, game_id, quiz_title, score, won, team_name, room_code, played_at)
 */
export function summarizeGamesFromResults(rows) {
  const byGame = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const gameId = str(r?.game_id);
    if (!gameId) continue;
    const playedAt = str(r?.played_at);
    let g = byGame.get(gameId);
    if (!g) {
      g = { gameId, quizTitle: str(r?.quiz_title), roomCode: str(r?.room_code), playedAt, entries: [] };
      byGame.set(gameId, g);
    }
    g.entries.push({
      profileId: str(r?.profile_id),
      score: num(r?.score, 0),
      won: !!r?.won,
      teamName: r?.team_name ? str(r.team_name) : null,
    });
    if (!g.quizTitle && r?.quiz_title) g.quizTitle = str(r.quiz_title);
    if (playedAt > g.playedAt) g.playedAt = playedAt; // latest write wins as the game's timestamp
  }
  return [...byGame.values()]
    .map((g) => ({ ...g, entries: g.entries.sort((a, b) => b.score - a.score) }))
    .sort((a, b) => (a.playedAt < b.playedAt ? 1 : a.playedAt > b.playedAt ? -1 : 0));
}

/**
 * Build the result row a phone writes for ITSELF at game end. Finds the phone's
 * scoring entity via its deviceId; returns null if it isn't part of the game.
 * The caller adds profile_id + room_code (which the phone knows from its URL).
 * @param {object} game A finished game.
 * @param {string} deviceId The phone's device id.
 * @returns {{game_id:string,quiz_title:string,score:number,won:boolean,team_name:string|null}|null}
 */
export function summarizeForProfile(game, deviceId) {
  const players = Array.isArray(game?.players) ? game.players : [];
  const entity = players.find((p) => (p.deviceIds || []).includes(deviceId));
  if (!entity) return null;
  const max = players.reduce((m, p) => Math.max(m, num(p.score, 0)), -Infinity);
  const min = players.reduce((m, p) => Math.min(m, num(p.score, 0)), Infinity);
  const decided = players.length > 1 && max > min;
  return {
    game_id: str(game.id),
    quiz_title: str(game.quiz?.title) || "Untitled quiz",
    score: num(entity.score, 0),
    won: decided && num(entity.score, 0) === max,
    team_name: game.mode === "teams" ? str(entity.name) : null,
  };
}

/* ---- presenter (TV) payloads ----
   The host streams a clean, read-only mirror of the game to a TV opened at
   #/present/<code> over two retained MQTT topics:
     present  heavy + static-per-question (media, question text, options)
     live     light + frequently-changing (reveal, step, timer, standings)
   Answers and map coordinates live in `live` and are only sent once revealed,
   so the TV can never leak them (and map pins stay hidden until reveal). */

/** Static, per-question display fields for the TV (never includes the answer). */
function presentQ(type, q) {
  switch (type) {
    case "classic":
      return { q: str(q.q), points: num(q.points, 10) };
    case "jeopardy":
      return { clue: str(q.clue), points: num(q.points, 100) };
    case "hints":
      return { hints: (Array.isArray(q.hints) ? q.hints : []).map(normalizeHint) };
    case "connect":
      return { clues: (Array.isArray(q.clues) ? q.clues : []).map(normalizeHint) };
    case "video":
      return {
        q: str(q.q),
        url: str(q.url),
        audioOnly: !!q.audioOnly,
        start: numOrNull(q.start),
        end: numOrNull(q.end),
      };
    case "clip":
      return {
        q: str(q.q),
        url: str(q.url),
        audioOnly: !!q.audioOnly,
        start: numOrNull(q.start),
        end: numOrNull(q.end),
        steps: num(q.steps, 4),
      };
    case "image":
      return { q: str(q.q), url: str(q.url), points: num(q.points, 10) };
    case "morph":
      return { url: str(q.url), effect: MORPH_EFFECTS.includes(q.effect) ? q.effect : "blur", steps: num(q.steps, 4) };
    case "fusion":
      return { urlA: str(q.urlA), urlB: str(q.urlB), steps: num(q.steps, 4) };
    case "map":
      return { q: str(q.q), tileLayer: q.tileLayer === "satellite" ? "satellite" : "map", street: str(q.street) };
    case "choice":
      return { q: str(q.q), options: (Array.isArray(q.options) ? q.options : []).map(str) };
    case "truefalse":
    case "higherlower":
      // Options are fixed UI labels (synthesized per locale); the answer/note stay in revealData.
      return { q: str(q.q) };
    case "number":
      return { q: str(q.q), unit: str(q.unit) };
    case "whoknows":
      // The full answer list is NEVER sent here (it would leak); the picked /
      // showcased answers travel in the live payload (whoknows) instead.
      return { q: str(q.q), total: (Array.isArray(q.answers) ? q.answers : []).length, ordered: !!q.ordered };
    default:
      return {};
  }
}

/**
 * Validate/sanitize the live state of a "Who Knows More" round (host → TV).
 * Used both when the host builds the payload and when the TV parses it. The
 * full answer list is only carried once the host showcases it (showAll).
 */
function normalizeWhoknows(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const w = raw.winner;
  return {
    phase: ["auction", "answering", "done"].includes(raw.phase) ? raw.phase : "auction",
    winnerId: typeof raw.winnerId === "string" ? raw.winnerId : null,
    winner:
      w && typeof w === "object" && !Array.isArray(w)
        ? {
            name: str(w.name),
            color: typeof w.color === "string" ? w.color : null,
            emoji: typeof w.emoji === "string" ? w.emoji : null,
          }
        : null,
    claimed: Math.max(0, num(raw.claimed, 0)),
    picked: (Array.isArray(raw.picked) ? raw.picked : [])
      .slice(0, 100)
      .map((p) => ({ i: num(p?.i, 0), text: str(p?.text) })),
    result: ["deliver", "bust"].includes(raw.result) ? raw.result : "",
    showAll: !!raw.showAll,
    answers:
      raw.showAll && Array.isArray(raw.answers)
        ? raw.answers.map((a) => (typeof a === "number" ? String(a) : str(a))).slice(0, 200)
        : [],
    ordered: !!raw.ordered,
    total: Math.max(0, num(raw.total, 0)),
    secsLeft: Math.max(0, num(raw.secsLeft, 0)),
  };
}

/** The answer/reveal fields for the TV (only emitted once the host reveals). */
function revealData(type, q) {
  switch (type) {
    case "hints":
    case "jeopardy":
    case "connect":
      return { answer: str(q.answer) };
    case "classic":
    case "image":
    case "video":
    case "clip":
    case "morph":
    case "fusion":
      return { answer: str(q.a) };
    case "map":
      return { answer: { lat: numOrNull(q.lat), lng: numOrNull(q.lng), name: str(q.name) } };
    case "choice":
      return { correct: num(q.correct, 0), options: (Array.isArray(q.options) ? q.options : []).map(str) };
    case "truefalse":
    case "higherlower":
      return { correct: num(q.correct, 0) === 1 ? 1 : 0, note: str(q.note) };
    case "number":
      return { answer: numOrNull(q.answer), unit: str(q.unit) };
    default:
      return {};
  }
}

/** Current question for a game (jeopardy via the open tile), or null. */
function currentQuestion(game) {
  const round = game.quiz?.rounds?.[game.ri];
  if (!round) return null;
  return round.type === "jeopardy"
    ? round.categories?.[game.tile?.ci]?.questions?.[game.tile?.qi] || null
    : round.questions?.[game.qi] || null;
}

/**
 * Build the heavy, static-per-question presenter payload (topic: present).
 * @param {object} game A valid game.
 */
export function buildPresentQ(game) {
  const quiz = game.quiz;
  const round = quiz?.rounds?.[game.ri];
  const base = {
    v: 1,
    stage: ["intro", "question", "board", "end"].includes(game.stage) ? game.stage : "intro",
    ri: num(game.ri, 0),
    qi: num(game.qi, 0),
    total: Array.isArray(quiz?.rounds) ? quiz.rounds.length : 0,
    quizTitle: str(quiz?.title),
    roundType: round ? str(round.type) : null,
    roundTitle: round ? str(round.title) : "",
  };
  if (game.stage === "question" && round) {
    const q = currentQuestion(game);
    if (q) base.q = presentQ(round.type, q);
  }
  return base;
}

/**
 * Derive between-rounds commentary beats from the recap entities (pure; returns
 * i18n keys + vars, translated by the caller). `mid` is the single most
 * interesting mid-recap caption; `winner` is the round leader for the finale.
 * @param {Array<{id:string,name:string,from:number,to:number}>} entities
 * @returns {{mid: ({key:string, vars:object}|null), winner: ({key:string, vars:object}|null)}}
 */
export function recapStory(entities) {
  const list = Array.isArray(entities) ? entities.filter((e) => e && typeof e === "object") : [];
  if (!list.length) return { mid: null, winner: null };
  const nameOf = (e) => str(e?.name) || "Player";
  const byTo = [...list].sort((a, b) => num(b.to, 0) - num(a.to, 0));
  const byFrom = [...list].sort((a, b) => num(b.from, 0) - num(a.from, 0));

  // The ROUND winner is whoever scored the most THIS round (biggest positive
  // delta) — NOT the overall leader. Null if nobody gained points.
  const mover = list.reduce(
    (b, e) => (num(e.to, 0) - num(e.from, 0) > (b ? num(b.to, 0) - num(b.from, 0) : 0) ? e : b),
    null,
  );
  const moverDelta = mover ? num(mover.to, 0) - num(mover.from, 0) : 0;
  const winner =
    mover && moverDelta > 0 ? { key: "recapStory.winner", vars: { name: nameOf(mover), delta: moverDelta } } : null;

  // The mid-recap caption: a lead change, else a photo finish (else none).
  let mid = null;
  if (list.length >= 2 && byTo[0].id !== byFrom[0].id && num(byTo[0].to, 0) > num(byFrom[0].from, 0)) {
    mid = { key: "recapStory.overtake", vars: { name: nameOf(byTo[0]), prev: nameOf(byFrom[0]) } };
  } else if (list.length >= 2) {
    const gap = num(byTo[0].to, 0) - num(byTo[1].to, 0);
    const maxTo = Math.max(1, num(byTo[0].to, 0));
    if (gap <= Math.max(2, Math.round(maxTo * 0.04))) mid = { key: "recapStory.photoFinish", vars: {} };
  }
  return { mid, winner };
}

/**
 * Build the light, frequently-changing presenter payload (topic: live).
 * @param {object} game A valid game.
 * @param {{step?:number, showStandings?:boolean, value?:number, allowNegative?:boolean, recap?:boolean, recapFrom?:object, recapVariant?:string, recapRound?:number, recapTotal?:number, transport?:object, soundOnTv?:boolean}} [opts]
 */
export function buildLive(game, opts = {}) {
  const round = game.quiz?.rounds?.[game.ri];
  const standings = (Array.isArray(game.players) ? game.players : []).map((p) => ({
    id: str(p.id) || str(p.name) || "p",
    name: str(p.name) || "Player",
    score: num(p.score, 0),
    color: typeof p.color === "string" ? p.color : null,
    emoji: typeof p.emoji === "string" ? p.emoji : null,
  }));
  const live = {
    v: 1,
    stage: ["intro", "question", "board", "end"].includes(game.stage) ? game.stage : "intro",
    revealed: !!game.revealed,
    hintsShown: Math.max(1, num(game.hintsShown, 1)),
    step: Math.max(0, num(opts.step, 0)),
    showStandings: !!opts.showStandings,
    value: num(opts.value, 0),
    allowNegative: !!opts.allowNegative,
    showRecap: !!opts.recap,
    recapFrom: opts.recap ? scoreMap(opts.recapFrom) : null,
    recapVariant: RECAP_VARIANTS.includes(opts.recapVariant) ? opts.recapVariant : RECAP_VARIANTS[0],
    recapRound: opts.recap ? Math.max(0, Math.round(num(opts.recapRound, 0))) : 0,
    recapTotal: opts.recap ? Math.max(0, Math.round(num(opts.recapTotal, 0))) : 0,
    // Remote media transport (the TV/host followers play/pause/restart from this).
    transport:
      opts.transport && typeof opts.transport === "object"
        ? { n: num(opts.transport.n, 0), action: str(opts.transport.action) || "idle" }
        : { n: 0, action: "idle" },
    soundOnTv: !!opts.soundOnTv,
    volume: Math.max(0, Math.min(100, num(opts.volume, 100))),
    whoknows: opts.whoknows ? normalizeWhoknows(opts.whoknows) : null,
    standings,
  };
  if (game.revealed && game.stage === "question" && round) {
    const q = currentQuestion(game);
    if (q) live.reveal = revealData(round.type, q);
  }
  return live;
}

/** Validate an incoming present payload from the broker (untrusted). */
export function normalizePresent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {
    stage: ["intro", "question", "board", "end"].includes(raw.stage) ? raw.stage : "intro",
    ri: num(raw.ri, 0),
    qi: num(raw.qi, 0),
    total: num(raw.total, 0),
    quizTitle: str(raw.quizTitle),
    roundType: ROUND_TYPES.includes(raw.roundType) ? raw.roundType : null,
    roundTitle: str(raw.roundTitle),
  };
  if (raw.q && typeof raw.q === "object" && !Array.isArray(raw.q)) {
    const q = raw.q;
    const o = { audioOnly: !!q.audioOnly };
    for (const k of ["q", "clue", "url", "urlA", "urlB", "unit", "street"]) if (typeof q[k] === "string") o[k] = q[k];
    if (typeof q.effect === "string") o.effect = MORPH_EFFECTS.includes(q.effect) ? q.effect : "blur";
    if (typeof q.tileLayer === "string") o.tileLayer = q.tileLayer === "satellite" ? "satellite" : "map";
    if (q.steps != null) o.steps = num(q.steps, 4);
    if (q.points != null) o.points = num(q.points, 10);
    if (q.start != null) o.start = numOrNull(q.start);
    if (q.end != null) o.end = numOrNull(q.end);
    if (Array.isArray(q.options)) o.options = q.options.map(str).slice(0, 8);
    if (Array.isArray(q.hints)) o.hints = q.hints.map(normalizeHint);
    if (Array.isArray(q.clues)) o.clues = q.clues.map(normalizeHint);
    out.q = o;
  }
  return out;
}

/** Validate an incoming live payload from the broker (untrusted). */
export function normalizeLive(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  let reveal = null;
  if (raw.reveal && typeof raw.reveal === "object" && !Array.isArray(raw.reveal)) {
    const r = raw.reveal;
    reveal = {};
    if (typeof r.answer === "string" || typeof r.answer === "number") reveal.answer = r.answer;
    else if (r.answer && typeof r.answer === "object" && !Array.isArray(r.answer))
      reveal.answer = { lat: numOrNull(r.answer.lat), lng: numOrNull(r.answer.lng), name: str(r.answer.name) };
    if (r.correct != null) reveal.correct = num(r.correct, 0);
    if (Array.isArray(r.options)) reveal.options = r.options.map(str).slice(0, 8);
    if (typeof r.unit === "string") reveal.unit = r.unit;
    if (typeof r.note === "string") reveal.note = r.note; // true/false + higher/lower reveal fact
  }
  return {
    stage: ["intro", "question", "board", "end"].includes(raw.stage) ? raw.stage : "intro",
    revealed: !!raw.revealed,
    hintsShown: Math.max(1, num(raw.hintsShown, 1)),
    step: Math.max(0, num(raw.step, 0)),
    showStandings: !!raw.showStandings,
    value: num(raw.value, 0),
    allowNegative: !!raw.allowNegative,
    showRecap: !!raw.showRecap,
    recapFrom: raw.showRecap ? scoreMap(raw.recapFrom) : null,
    recapVariant: RECAP_VARIANTS.includes(raw.recapVariant) ? raw.recapVariant : RECAP_VARIANTS[0],
    recapRound: raw.showRecap ? Math.max(0, Math.round(num(raw.recapRound, 0))) : 0,
    recapTotal: raw.showRecap ? Math.max(0, Math.round(num(raw.recapTotal, 0))) : 0,
    transport:
      raw.transport && typeof raw.transport === "object"
        ? {
            n: num(raw.transport.n, 0),
            action: ["play", "pause", "restart"].includes(raw.transport.action) ? raw.transport.action : "idle",
          }
        : { n: 0, action: "idle" },
    soundOnTv: !!raw.soundOnTv,
    volume: Math.max(0, Math.min(100, num(raw.volume, 100))),
    whoknows: raw.whoknows ? normalizeWhoknows(raw.whoknows) : null,
    standings: (Array.isArray(raw.standings) ? raw.standings : []).slice(0, 50).map((p) => ({
      id: str(p?.id) || str(p?.name) || "p",
      name: str(p?.name) || "Player",
      score: num(p?.score, 0),
      color: typeof p?.color === "string" ? p.color : null,
      emoji: typeof p?.emoji === "string" ? p.emoji : null,
    })),
    reveal,
  };
}

/**
 * Build the HOST-ONLY aux payload (topic: host). Carries reveal aids the host
 * remote needs but the TV must never see — currently the full Who-Knows-More
 * answer list, so the host can tap each correct answer from their phone. The TV
 * presenter never subscribes to this topic, so present/live stay leak-free.
 * @param {object} game A valid game.
 * @returns {{v:number, whoknows:({answers:string[], ordered:boolean}|null)}}
 */
export function buildHostAux(game) {
  const round = game.quiz?.rounds?.[game.ri];
  const out = { v: 1, whoknows: null };
  if (game.stage === "question" && round?.type === "whoknows") {
    const q = currentQuestion(game);
    if (q)
      out.whoknows = {
        answers: (Array.isArray(q.answers) ? q.answers : []).map(str).slice(0, 200),
        ordered: !!q.ordered,
      };
  }
  return out;
}

/**
 * Validate the live standings pushed to PHONES on the state topic (untrusted).
 * Each entry carries its entity's deviceIds so a phone can find itself in the
 * list and show its own score + rank.
 * @param {*} raw
 * @returns {Array<{id:string,name:string,score:number,color:string|null,emoji:string|null,deviceIds:string[]}>}
 */
export function normalizePhoneScores(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((p) => ({
    id: str(p?.id) || str(p?.name) || "p",
    name: str(p?.name) || "Player",
    score: num(p?.score, 0),
    color: typeof p?.color === "string" ? p.color : null,
    emoji: typeof p?.emoji === "string" ? p.emoji : null,
    deviceIds: Array.isArray(p?.deviceIds)
      ? p.deviceIds
          .map((d) => str(d))
          .filter(Boolean)
          .slice(0, 20)
      : [],
  }));
}

/** Validate an incoming host-aux payload from the broker (untrusted). */
export function normalizeHostAux(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const wk = raw.whoknows;
  return {
    whoknows:
      wk && typeof wk === "object" && !Array.isArray(wk)
        ? {
            answers: (Array.isArray(wk.answers) ? wk.answers : [])
              .map((a) => (typeof a === "number" ? String(a) : str(a)))
              .slice(0, 200),
            ordered: !!wk.ordered,
          }
        : null,
  };
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
