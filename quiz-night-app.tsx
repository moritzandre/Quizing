/* ====================================================================
   QUIZ NIGHT — host-led party quiz app (single-file React)
   ====================================================================

   Runs in TWO environments, auto-detected at startup:
     • Claude artifact → persists via window.storage (Claude's storage)
     • Standalone      → persists via localStorage (in-memory fallback)

   ------------------------------------------------------------------
   STANDALONE SETUP (Vite + Tailwind v4)
   ------------------------------------------------------------------
     npm create vite@latest quiz-night -- --template react
     cd quiz-night
     npm install lucide-react tailwindcss @tailwindcss/vite

     vite.config.js:
       import tailwindcss from "@tailwindcss/vite";
       export default defineConfig({ plugins: [react(), tailwindcss()] });

     src/index.css (replace contents):
       @import "tailwindcss";

     Then replace src/App.jsx with THIS file and run: npm run dev

   ------------------------------------------------------------------
   SUGGESTED FILE SPLIT as the project grows
   ------------------------------------------------------------------
     src/lib/storage.js     ← section 2 (storage adapter)
     src/lib/model.js       ← sections 3–4 (utils + data model)
     src/data/sample.js     ← section 6 (sample quiz)
     src/components/*.jsx   ← sections 5, 7–11 (map, primitives, views)
     src/App.jsx            ← section 12 (app shell)

   ------------------------------------------------------------------
   MOVING DATA BETWEEN ENVIRONMENTS
   ------------------------------------------------------------------
   Quizzes can be exported/imported as .quiz.json files (home screen).
   Use this to carry quizzes between the Claude version and your
   local build — the file format is identical in both.
   ==================================================================== */

import { Component, useState, useEffect, useRef } from "react";
import {
  Play, Plus, Trash2, X, ChevronUp, ChevronDown, ChevronLeft, MapPin, Video,
  LayoutGrid, Lightbulb, MessageSquare, Pencil, Copy, Trophy, Eye, ArrowRight,
  RotateCcw, Check, Users, Download, Upload, AlertTriangle,
} from "lucide-react";

/* ====================================================================
   1. CONFIG & CONSTANTS
   ==================================================================== */

const APP_VERSION = "1.0.0";
const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = "quiznight.";

/** Round-type metadata: label, icon, accent dot, and host instructions. */
const TYPES = {
  classic:  { label: "Classic",     icon: MessageSquare, dot: "bg-stone-400",   desc: "Read the question aloud, reveal the answer, then tap whoever got it right to award the points." },
  jeopardy: { label: "Jeopardy",    icon: LayoutGrid,    dot: "bg-indigo-500",  desc: "Players take turns picking tiles — higher value, harder question. Award the tile's points to whoever answers." },
  hints:    { label: "Hint Ladder", icon: Lightbulb,     dot: "bg-amber-500",   desc: "The answer starts at full value. Every extra hint lowers it. Reveal when someone calls it out." },
  video:    { label: "Video",       icon: Video,         dot: "bg-rose-500",    desc: "Watch the clip together, then reveal the answer and award the points." },
  map:      { label: "Map",         icon: MapPin,        dot: "bg-emerald-500", desc: "Everyone guesses where in the world it is. Reveal the pin and award the closest guess." },
};

/* ====================================================================
   2. STORAGE ADAPTER
   --------------------------------------------------------------------
   Uniform async key-value API over three backends, picked at startup:
   "claude" (artifact), "local" (browser), "memory" (last resort).
   ==================================================================== */

function detectBackend() {
  // 1) Claude artifact persistent storage
  if (typeof window !== "undefined" && window.storage && typeof window.storage.get === "function") {
    return {
      name: "claude",
      async get(k) { try { const r = await window.storage.get(k); return r?.value ?? null; } catch { return null; } },
      async set(k, v) { try { await window.storage.set(k, v); } catch {} },
      async del(k) { try { await window.storage.delete(k); } catch {} },
    };
  }
  // 2) Browser localStorage (standalone build)
  try {
    const t = STORAGE_PREFIX + "__test__";
    window.localStorage.setItem(t, "1");
    window.localStorage.removeItem(t);
    return {
      name: "local",
      async get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
      async set(k, v) { try { window.localStorage.setItem(k, v); } catch {} },
      async del(k) { try { window.localStorage.removeItem(k); } catch {} },
    };
  } catch {}
  // 3) In-memory fallback (no persistence)
  const mem = new Map();
  return {
    name: "memory",
    async get(k) { return mem.has(k) ? mem.get(k) : null; },
    async set(k, v) { mem.set(k, v); },
    async del(k) { mem.delete(k); },
  };
}

const storage = detectBackend();

/** Load a versioned JSON payload; tolerates legacy/corrupt data. */
async function loadJSON(key, fallback) {
  const raw = await storage.get(STORAGE_PREFIX + key);
  if (raw == null) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.v === SCHEMA_VERSION) return parsed.data;
    if (Array.isArray(parsed) || typeof parsed === "object") return parsed; // pre-versioned data
    return fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, data) {
  storage.set(STORAGE_PREFIX + key, JSON.stringify({ v: SCHEMA_VERSION, data }));
}

function removeKey(key) {
  storage.del(STORAGE_PREFIX + key);
}

/** One-time migration from keys used by the first artifact version. */
async function loadWithLegacy(key, legacyKey, fallback) {
  const current = await loadJSON(key, null);
  if (current != null) return current;
  const legacy = await storage.get(legacyKey);
  if (legacy != null) {
    try { return JSON.parse(legacy); } catch {}
  }
  return fallback;
}

/* ====================================================================
   3. UTILITIES
   ==================================================================== */

const uid = () => Math.random().toString(36).slice(2, 9);
const deepClone = (x) => JSON.parse(JSON.stringify(x));
const str = (v, d = "") => (typeof v === "string" ? v : d);
const num = (v, d) => (Number.isFinite(+v) ? +v : d);
const numOrNull = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(+v) ? null : +v);

/** Extract a YouTube video ID from any common URL shape (or a raw ID). */
function ytId(url = "") {
  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  if (m) return m[1];
  const t = String(url).trim();
  return /^[\w-]{11}$/.test(t) ? t : null;
}

/* ====================================================================
   4. DATA MODEL
   --------------------------------------------------------------------
   Factories, validation/normalization (protects against corrupt
   storage and bad imports), and quiz/game helpers.
   ==================================================================== */

function makeQuestion(type) {
  switch (type) {
    case "classic": return { id: uid(), q: "", a: "", points: 10 };
    case "hints":   return { id: uid(), answer: "", hints: ["", "", ""] };
    case "video":   return { id: uid(), url: "", q: "Name what you see or hear.", a: "", points: 10 };
    case "map":     return { id: uid(), q: "", name: "", lat: null, lng: null, points: 10 };
    default:        return { id: uid() };
  }
}

function makeCategory() {
  return { id: uid(), name: "", questions: [100, 200, 300].map((p) => ({ id: uid(), clue: "", answer: "", points: p })) };
}

function makeRound(type) {
  return type === "jeopardy"
    ? { id: uid(), type, title: "", categories: [makeCategory()] }
    : { id: uid(), type, title: "", questions: [makeQuestion(type)] };
}

/** Coerce unknown data into a valid quiz, or return null if hopeless. */
function normalizeQuiz(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.rounds)) return null;
  const rounds = raw.rounds
    .map((r) => {
      if (!r || !TYPES[r.type]) return null;
      const base = { id: str(r.id) || uid(), type: r.type, title: str(r.title) };
      if (r.type === "jeopardy") {
        base.categories = (Array.isArray(r.categories) ? r.categories : []).map((c) => ({
          id: str(c?.id) || uid(),
          name: str(c?.name),
          questions: (Array.isArray(c?.questions) ? c.questions : []).map((q) => ({
            id: str(q?.id) || uid(), clue: str(q?.clue), answer: str(q?.answer), points: num(q?.points, 100),
          })),
        }));
      } else {
        base.questions = (Array.isArray(r.questions) ? r.questions : []).map((q) => {
          const it = { id: str(q?.id) || uid() };
          if (r.type === "classic") Object.assign(it, { q: str(q?.q), a: str(q?.a), points: num(q?.points, 10) });
          if (r.type === "hints")   Object.assign(it, { answer: str(q?.answer), hints: (Array.isArray(q?.hints) ? q.hints : [""]).map((h) => str(h)) });
          if (r.type === "video")   Object.assign(it, { url: str(q?.url), q: str(q?.q), a: str(q?.a), points: num(q?.points, 10) });
          if (r.type === "map")     Object.assign(it, { q: str(q?.q), name: str(q?.name), lat: numOrNull(q?.lat), lng: numOrNull(q?.lng), points: num(q?.points, 10) });
          return it;
        });
      }
      return base;
    })
    .filter(Boolean);
  return { id: str(raw.id) || uid(), title: str(raw.title) || "Untitled quiz", sample: !!raw.sample, rounds };
}

/** Coerce unknown data into a valid in-progress game, or null. */
function normalizeGame(raw) {
  if (!raw || typeof raw !== "object") return null;
  const quiz = normalizeQuiz(raw.quiz);
  if (!quiz || !Array.isArray(raw.players) || raw.players.length === 0) return null;
  return {
    quiz,
    players: raw.players.map((p) => ({ id: str(p?.id) || uid(), name: str(p?.name) || "Player", score: num(p?.score, 0) })),
    ri: num(raw.ri, 0),
    qi: num(raw.qi, 0),
    stage: ["intro", "question", "board", "end"].includes(raw.stage) ? raw.stage : "intro",
    revealed: !!raw.revealed,
    hintsShown: Math.max(1, num(raw.hintsShown, 1)),
    awarded: raw.awarded && typeof raw.awarded === "object" ? raw.awarded : {},
    used: raw.used && typeof raw.used === "object" ? raw.used : {},
    tile: raw.tile && Number.isFinite(+raw.tile.ci) && Number.isFinite(+raw.tile.qi) ? { ci: +raw.tile.ci, qi: +raw.tile.qi } : null,
  };
}

const roundHasContent = (r) =>
  r.type === "jeopardy"
    ? (r.categories || []).some((c) => (c.questions || []).length > 0)
    : (r.questions || []).length > 0;

function nextNonEmpty(quiz, from) {
  for (let i = from; i < quiz.rounds.length; i++) if (roundHasContent(quiz.rounds[i])) return i;
  return -1;
}

const countQuestions = (quiz) =>
  quiz.rounds.reduce(
    (n, r) =>
      n +
      (r.type === "jeopardy"
        ? (r.categories || []).reduce((m, c) => m + (c.questions || []).length, 0)
        : (r.questions || []).length),
    0
  );

/* ---- export / import (.quiz.json) ---- */

function exportQuiz(quiz) {
  const payload = JSON.stringify({ app: "quiz-night", v: SCHEMA_VERSION, quiz }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(quiz.title || "quiz").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "quiz"}.quiz.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ====================================================================
   5. WORLD MAP (minimalist dot grid, equirectangular projection)
   --------------------------------------------------------------------
   72×36 grid of 5° cells. LAND lists, per row, the column ranges that
   are land. Pin placement uses exact lat/lng. Pass onPick to make the
   map clickable (used by the builder to place pins).
   ==================================================================== */

const LAND = [
  [1, [[16, 19], [25, 31]]],
  [2, [[14, 21], [24, 32], [39, 40], [47, 48], [54, 55]]],
  [3, [[11, 22], [25, 32], [41, 41], [46, 59], [63, 71]]],
  [4, [[3, 22], [25, 32], [37, 71]]],
  [5, [[3, 16], [21, 23], [26, 27], [31, 32], [37, 71]]],
  [6, [[5, 16], [20, 24], [34, 35], [37, 38], [40, 64], [67, 68]]],
  [7, [[10, 24], [34, 34], [35, 63], [64, 64], [67, 67]]],
  [8, [[11, 24], [35, 45], [47, 63], [64, 64]]],
  [9, [[11, 22], [34, 41], [44, 45], [47, 62], [64, 64]]],
  [10, [[11, 20], [34, 35], [38, 40], [41, 45], [47, 61], [63, 64]]],
  [11, [[12, 20], [34, 34], [36, 60], [62, 63]]],
  [12, [[13, 16], [19, 19], [33, 45], [47, 60]]],
  [13, [[14, 16], [19, 20], [32, 47], [50, 57], [60, 60]]],
  [14, [[15, 18], [21, 22], [32, 46], [50, 52], [54, 57], [60, 60]]],
  [15, [[17, 19], [21, 23], [32, 46], [51, 52], [55, 57], [60, 61]]],
  [16, [[20, 25], [33, 45], [51, 52], [56, 57], [58, 61]]],
  [17, [[20, 26], [33, 45], [55, 56], [57, 61]]],
  [18, [[20, 27], [37, 44], [56, 57], [58, 60], [62, 65]]],
  [19, [[20, 28], [38, 44], [57, 58], [63, 65]]],
  [20, [[20, 28], [38, 44], [61, 62], [64, 64]]],
  [21, [[21, 28], [38, 43], [44, 45], [60, 65]]],
  [22, [[22, 28], [38, 43], [44, 45], [58, 66]]],
  [23, [[22, 26], [39, 42], [58, 66]]],
  [24, [[21, 25], [39, 42], [59, 66]]],
  [25, [[21, 24], [64, 66], [70, 71]]],
  [26, [[21, 23], [65, 65], [69, 70]]],
  [27, [[21, 22], [69, 69]]],
  [28, [[21, 23]]],
];

const DOTS = [];
LAND.forEach(([row, ranges]) =>
  ranges.forEach(([a, b]) => {
    for (let c = a; c <= b; c++) DOTS.push([c, row]);
  })
);

function WorldMap({ pin, onPick, className = "" }) {
  const ref = useRef(null);
  const CW = 1000 / 72;
  const CH = 500 / 36;
  const toXY = (lat, lng) => [((lng + 180) / 360) * 1000, ((90 - lat) / 180) * 500];

  const handleClick = (e) => {
    if (!onPick || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 1000;
    const y = ((e.clientY - r.top) / r.height) * 500;
    onPick(Math.round((90 - (y / 500) * 180) * 100) / 100, Math.round(((x / 1000) * 360 - 180) * 100) / 100);
  };

  let px = null, py = null;
  if (pin && pin.lat != null && pin.lng != null) [px, py] = toXY(pin.lat, pin.lng);
  const labelX = px == null ? 0 : Math.min(Math.max(px, 90), 910);

  return (
    <svg
      ref={ref}
      viewBox="0 0 1000 500"
      role="img"
      aria-label={pin?.label ? `World map showing ${pin.label}` : "World map"}
      onClick={handleClick}
      className={`w-full rounded-2xl border border-stone-200 bg-white ${onPick ? "cursor-crosshair" : ""} ${className}`}
    >
      {DOTS.map(([c, r], i) => (
        <circle key={i} cx={(c + 0.5) * CW} cy={(r + 0.5) * CH} r="4.6" className="fill-stone-300" />
      ))}
      {px != null && (
        <g>
          <circle cx={px} cy={py} r="16" className="animate-pulse fill-indigo-500 opacity-20" />
          <circle cx={px} cy={py} r="7.5" className="fill-indigo-600" />
          <circle cx={px} cy={py} r="2.8" className="fill-white" />
          {pin.label && (
            <text
              x={labelX}
              y={Math.max(py - 18, 16)}
              textAnchor="middle"
              fontSize="20"
              fontWeight="700"
              className="fill-stone-900"
              stroke="white"
              strokeWidth="5"
              paintOrder="stroke"
            >
              {pin.label}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/* ====================================================================
   6. SAMPLE QUIZ (read-only; "Edit" creates a copy)
   ==================================================================== */

const SAMPLE = {
  id: "sample",
  sample: true,
  title: "Friday Night Sampler",
  rounds: [
    {
      id: "s1", type: "classic", title: "Warm-Up",
      questions: [
        { id: "s1a", q: "What is the capital of Australia?", a: "Canberra", points: 10 },
        { id: "s1b", q: "Which chemical element has the symbol O?", a: "Oxygen", points: 10 },
        { id: "s1c", q: "How many strings does a standard guitar have?", a: "Six", points: 10 },
        { id: "s1d", q: "Which planet is known as the Red Planet?", a: "Mars", points: 10 },
      ],
    },
    {
      id: "s2", type: "jeopardy", title: "The Board",
      categories: [
        { id: "c1", name: "Movies", questions: [
          { id: "j1", clue: "This boy wizard has a lightning-shaped scar.", answer: "Harry Potter", points: 100 },
          { id: "j2", clue: "1997 blockbuster about a ship and an iceberg.", answer: "Titanic", points: 200 },
          { id: "j3", clue: "Director of Jaws, E.T. and Jurassic Park.", answer: "Steven Spielberg", points: 300 },
        ]},
        { id: "c2", name: "Science", questions: [
          { id: "j4", clue: "The everyday name for H₂O.", answer: "Water", points: 100 },
          { id: "j5", clue: "The closest star to Earth.", answer: "The Sun", points: 200 },
          { id: "j6", clue: "Subatomic particle with a negative charge.", answer: "The electron", points: 300 },
        ]},
        { id: "c3", name: "Music", questions: [
          { id: "j7", clue: "Liverpool band behind “Hey Jude”.", answer: "The Beatles", points: 100 },
          { id: "j8", clue: "Queen's six-minute epic: “Bohemian ___”.", answer: "Rhapsody", points: 200 },
          { id: "j9", clue: "This instrument has 88 keys.", answer: "The piano", points: 300 },
        ]},
      ],
    },
    {
      id: "s3", type: "hints", title: "Who or What Am I?",
      questions: [
        { id: "h1", answer: "Leonardo da Vinci", hints: [
          "I was born in Italy in 1452.",
          "I was left-handed and wrote in mirror script.",
          "I sketched flying machines centuries before flight.",
          "I painted The Last Supper.",
          "My most famous portrait hangs in the Louvre.",
        ]},
        { id: "h2", answer: "The Eiffel Tower", hints: [
          "I was completed in 1889.",
          "I was only meant to stand for 20 years.",
          "I'm built from about 18,000 iron parts.",
          "I was the world's tallest structure for 41 years.",
          "You'll find me in Paris.",
        ]},
      ],
    },
    {
      id: "s4", type: "video", title: "Watch Closely",
      questions: [
        { id: "v1", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", q: "Name the artist and the song.", a: "Rick Astley – Never Gonna Give You Up", points: 10 },
        { id: "v2", url: "https://www.youtube.com/watch?v=9bZkp7q19f0", q: "Which song (and artist) is this?", a: "PSY – Gangnam Style", points: 10 },
      ],
    },
    {
      id: "s5", type: "map", title: "Where in the World?",
      questions: [
        { id: "m1", q: "Where is Machu Picchu?", name: "Machu Picchu, Peru", lat: -13.16, lng: -72.55, points: 10 },
        { id: "m2", q: "Where is the Great Pyramid of Giza?", name: "Giza, Egypt", lat: 29.98, lng: 31.13, points: 10 },
        { id: "m3", q: "Where were the 2000 Summer Olympics held?", name: "Sydney, Australia", lat: -33.87, lng: 151.21, points: 10 },
      ],
    },
  ],
};

/* ====================================================================
   7. UI PRIMITIVES
   ==================================================================== */

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";
const inputCls = `w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none`;

function Button({ variant = "dark", className = "", children, ...props }) {
  const variants = {
    dark: "bg-stone-900 text-white hover:bg-stone-700",
    accent: "bg-indigo-600 text-white hover:bg-indigo-500",
    outline: "border border-stone-300 text-stone-900 hover:bg-stone-100",
    ghost: "text-stone-500 hover:bg-stone-100 hover:text-stone-700",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-30 ${FOCUS} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function IconButton({ label, className = "", children, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 ${FOCUS} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function TypeBadge({ type }) {
  const t = TYPES[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600">
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

/** Two-tap delete button: first tap arms it ("Sure?"), second confirms. */
function ConfirmDelete({ onConfirm, label = "Delete" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      aria-label={armed ? `Confirm: ${label}` : label}
      title={label}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${FOCUS} ${
        armed ? "bg-red-600 text-white" : "text-stone-400 hover:bg-stone-100 hover:text-red-600"
      }`}
    >
      <Trash2 size={14} />
      {armed ? "Sure?" : ""}
    </button>
  );
}

/* ====================================================================
   8. ERROR BOUNDARY
   ==================================================================== */

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6 font-sans">
          <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center">
            <AlertTriangle className="mx-auto mb-3 text-amber-500" size={32} />
            <h2 className="text-lg font-bold text-stone-900">Something went wrong</h2>
            <p className="mt-2 text-sm text-stone-500">{String(this.state.error?.message || this.state.error)}</p>
            <Button className="mt-6" onClick={() => this.setState({ error: null })}>
              <RotateCcw size={16} /> Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ====================================================================
   9. SCOREBOARD (fixed bottom bar; tappable when awarding)
   ==================================================================== */

function ScoreBar({ players, active, value, awarded, onAward }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {active && (
          <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-indigo-600">
            Tap a player to award +{value}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {players.map((p, i) => {
            const got = awarded && awarded[p.id] != null;
            return (
              <button
                key={p.id}
                disabled={!active}
                onClick={() => onAward(p.id)}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${FOCUS} ${
                  got
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : active
                    ? "border-indigo-200 bg-indigo-50 text-stone-900 hover:border-indigo-400"
                    : "border-stone-200 bg-white text-stone-900"
                }`}
              >
                {active && i < 9 && <span className={`text-xs font-bold ${got ? "text-indigo-200" : "text-stone-300"}`}>{i + 1}</span>}
                <span className="font-medium">{p.name}</span>
                <span className={`font-bold tabular-nums ${got ? "text-white" : "text-stone-500"}`}>{p.score}</span>
                {active && (got ? <Check size={14} /> : <span className="text-xs font-semibold text-indigo-600">+{value}</span>)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   10. PLAY VIEW (round intro → questions/board → final scores)
   ==================================================================== */

function PlayView({ game, setGame, onExit }) {
  const quiz = game.quiz;
  const round = quiz.rounds[game.ri];
  const upd = (patch) => setGame({ ...game, ...patch });

  /* current question value (points at stake) */
  const value = (() => {
    if (!round) return 0;
    if (round.type === "jeopardy") {
      if (!game.tile) return 0;
      const q = round.categories[game.tile.ci]?.questions[game.tile.qi];
      return q?.points || 100;
    }
    const q = round.questions[game.qi];
    if (!q) return 0;
    if (round.type === "hints") return Math.max(1, q.hints.length - game.hintsShown + 1) * 10;
    return q.points || 10;
  })();

  const toggleAward = (pid) => {
    const a = { ...(game.awarded || {}) };
    let players;
    if (a[pid] != null) {
      players = game.players.map((p) => (p.id === pid ? { ...p, score: p.score - a[pid] } : p));
      delete a[pid];
    } else {
      a[pid] = value;
      players = game.players.map((p) => (p.id === pid ? { ...p, score: p.score + value } : p));
    }
    upd({ players, awarded: a });
  };

  const beginRound = () =>
    upd({ stage: round.type === "jeopardy" ? "board" : "question", qi: 0, revealed: false, hintsShown: 1, awarded: {}, tile: null });

  const goNextRound = () => {
    const j = nextNonEmpty(quiz, game.ri + 1);
    if (j === -1) upd({ stage: "end" });
    else upd({ ri: j, stage: "intro", qi: 0, revealed: false, hintsShown: 1, awarded: {}, tile: null });
  };

  const nextQuestion = () => {
    if (game.qi + 1 < round.questions.length) upd({ qi: game.qi + 1, revealed: false, hintsShown: 1, awarded: {} });
    else goNextRound();
  };

  const backToBoard = () => {
    const key = `${game.ri}-${game.tile.ci}-${game.tile.qi}`;
    upd({ used: { ...game.used, [key]: true }, tile: null, stage: "board", revealed: false, awarded: {} });
  };

  const isJeop = round?.type === "jeopardy";
  const advance = isJeop ? backToBoard : nextQuestion;
  const scoreActive = game.stage === "question" && game.revealed;

  /* host keyboard shortcuts: R reveal · H hint · N/→ next · 1–9 award */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (game.stage !== "question" || !round) return;
      const k = e.key.toLowerCase();
      const q = isJeop ? round.categories[game.tile?.ci]?.questions[game.tile?.qi] : round.questions[game.qi];
      if (!q) return;
      if (k === "r" && !game.revealed) upd({ revealed: true });
      else if ((k === "n" || k === "arrowright") && game.revealed) advance();
      else if (k === "h" && !game.revealed && round.type === "hints" && game.hintsShown < q.hints.length)
        upd({ hintsShown: game.hintsShown + 1 });
      else if (game.revealed && /^[1-9]$/.test(e.key)) {
        const p = game.players[+e.key - 1];
        if (p) toggleAward(p.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const Header = (
    <div className="mb-8 flex items-center justify-between">
      <button onClick={onExit} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
        <ChevronLeft size={16} /> Exit
      </button>
      {round && game.stage !== "end" && (
        <p className="text-sm text-stone-500">
          Round {game.ri + 1} / {quiz.rounds.length} · <span className="font-medium text-stone-700">{TYPES[round.type].label}</span>
        </p>
      )}
      <span className="w-14" />
    </div>
  );

  /* ---- final scores ---- */
  if (game.stage === "end") {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    const playAgain = () =>
      setGame({
        ...game,
        players: game.players.map((p) => ({ ...p, score: 0 })),
        ri: Math.max(nextNonEmpty(quiz, 0), 0),
        qi: 0, stage: "intro", revealed: false, hintsShown: 1, awarded: {}, used: {}, tile: null,
      });
    return (
      <div className="mx-auto max-w-xl px-6 pb-16 pt-10 text-center">
        <Trophy className="mx-auto mb-4 text-amber-500" size={44} />
        <h2 className="text-3xl font-bold tracking-tight">Final scores</h2>
        <p className="mt-1 text-stone-500">{quiz.title}</p>
        <div className="mt-8 space-y-2">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${i === 0 ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${i === 0 ? "text-amber-600" : "text-stone-400"}`}>{i + 1}</span>
                <span className="text-lg font-medium">{p.name}</span>
                {i === 0 && <span className="text-xl">🏆</span>}
              </div>
              <span className="text-xl font-bold tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={playAgain}><RotateCcw size={16} /> Play again</Button>
          <Button variant="outline" onClick={onExit}>Done</Button>
        </div>
      </div>
    );
  }

  if (!round) return null;

  /* ---- round intro ---- */
  if (game.stage === "intro") {
    const T = TYPES[round.type];
    const Icon = T.icon;
    return (
      <div className="mx-auto max-w-2xl px-6 pb-32 pt-6">
        {Header}
        <div className="mt-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <Icon size={28} className="text-stone-700" />
          </div>
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Round {game.ri + 1}</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight">{round.title || T.label}</h2>
          <p className="mx-auto mt-4 max-w-md text-stone-500">{T.desc}</p>
          <Button className="mt-8 px-6 py-3.5 text-base" onClick={beginRound}>
            Start round <ArrowRight size={18} />
          </Button>
        </div>
        <ScoreBar players={game.players} active={false} value={0} awarded={{}} onAward={() => {}} />
      </div>
    );
  }

  /* ---- jeopardy board ---- */
  if (game.stage === "board") {
    const boardDone = round.categories.every((c, ci) => c.questions.every((_, qi) => game.used[`${game.ri}-${ci}-${qi}`]));
    const maxRows = Math.max(...round.categories.map((c) => c.questions.length), 0);
    return (
      <div className="mx-auto max-w-3xl px-6 pb-32 pt-6">
        {Header}
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{round.title || "Pick a tile"}</h2>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${round.categories.length}, minmax(0,1fr))` }}>
          {round.categories.map((c) => (
            <div key={c.id} className="flex items-center justify-center rounded-xl bg-stone-900 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white md:text-sm">
              {c.name || "—"}
            </div>
          ))}
          {Array.from({ length: maxRows }).map((_, qi) =>
            round.categories.map((c, ci) => {
              const q = c.questions[qi];
              if (!q) return <div key={c.id + "-" + qi} />;
              const used = game.used[`${game.ri}-${ci}-${qi}`];
              return (
                <button
                  key={c.id + "-" + qi}
                  disabled={used}
                  onClick={() => upd({ tile: { ci, qi }, stage: "question", revealed: false, awarded: {} })}
                  className={`flex h-16 items-center justify-center rounded-xl border text-xl font-bold transition md:h-20 md:text-2xl ${FOCUS} ${
                    used
                      ? "border-stone-100 bg-stone-50 text-stone-200"
                      : "border-stone-200 bg-white text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
                >
                  {used ? "" : q.points}
                </button>
              );
            })
          )}
        </div>
        {boardDone && (
          <div className="mt-8 text-center">
            <Button className="px-6 py-3.5 text-base" onClick={goNextRound}>
              Continue <ArrowRight size={18} />
            </Button>
          </div>
        )}
        <ScoreBar players={game.players} active={false} value={0} awarded={{}} onAward={() => {}} />
      </div>
    );
  }

  /* ---- question stage ---- */
  const q = isJeop ? round.categories[game.tile.ci].questions[game.tile.qi] : round.questions[game.qi];

  const RevealBtn = (
    <Button className="px-6 py-3.5 text-base" onClick={() => upd({ revealed: true })}>
      <Eye size={18} /> Reveal answer
    </Button>
  );
  const NextBtn = (
    <Button className="px-6 py-3.5 text-base" onClick={advance}>
      {isJeop ? "Back to board" : "Next"} <ArrowRight size={18} />
    </Button>
  );
  const Progress = !isJeop && (
    <p className="mb-3 text-center text-sm text-stone-400">
      Question {game.qi + 1} / {round.questions.length}
    </p>
  );
  const Shortcuts = (
    <p className="mt-8 hidden text-center text-xs text-stone-300 md:block">
      Shortcuts: R reveal{round.type === "hints" ? " · H hint" : ""} · N next · 1–9 award
    </p>
  );

  let body = null;

  if (round.type === "classic" || isJeop) {
    body = (
      <div className="text-center">
        {Progress}
        {isJeop && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-600">
            {round.categories[game.tile.ci].name || "Category"} · {q.points}
          </p>
        )}
        <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-snug tracking-tight md:text-5xl">{isJeop ? q.clue : q.q}</h2>
        <div className="mt-10" style={{ minHeight: 80 }}>
          {game.revealed ? <p className="text-2xl font-bold text-indigo-600 md:text-4xl">{isJeop ? q.answer : q.a}</p> : RevealBtn}
        </div>
        {game.revealed && <div className="mt-8">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "hints") {
    const shown = q.hints.slice(0, game.hintsShown);
    body = (
      <div className="text-center">
        {Progress}
        <div className="mb-4 flex items-center justify-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Who or what is it?</h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">worth {value}</span>
        </div>
        <div className="mx-auto max-w-xl space-y-2 text-left">
          {shown.map((h, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <span className="mt-0.5 text-xs font-bold text-stone-400">{i + 1}</span>
              <p className="text-base md:text-lg">{h || <span className="text-stone-300">…</span>}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!game.revealed && game.hintsShown < q.hints.length && (
            <Button variant="outline" className="px-5 py-3 text-base" onClick={() => upd({ hintsShown: game.hintsShown + 1 })}>
              <Lightbulb size={18} /> Next hint <span className="text-sm text-stone-400">(−10)</span>
            </Button>
          )}
          {!game.revealed && RevealBtn}
        </div>
        {game.revealed && (
          <>
            <p className="mt-8 text-2xl font-bold text-indigo-600 md:text-4xl">{q.answer}</p>
            <div className="mt-8">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "video") {
    const vid = ytId(q.url);
    body = (
      <div className="text-center">
        {Progress}
        <div className="mx-auto max-w-2xl">
          {vid ? (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-stone-200 bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${vid}`}
                title="Quiz clip"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400">
              No valid video link
            </div>
          )}
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight md:text-3xl">{q.q}</h2>
        <div className="mt-6" style={{ minHeight: 64 }}>
          {game.revealed ? <p className="text-2xl font-bold text-indigo-600 md:text-3xl">{q.a}</p> : RevealBtn}
        </div>
        {game.revealed && <div className="mt-6">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "map") {
    body = (
      <div className="text-center">
        {Progress}
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{q.q}</h2>
        <div className="mx-auto mt-6 max-w-2xl">
          <WorldMap pin={game.revealed ? { lat: q.lat, lng: q.lng, label: q.name } : null} />
        </div>
        <div className="mt-6">
          {game.revealed ? (
            NextBtn
          ) : (
            <Button className="px-6 py-3.5 text-base" onClick={() => upd({ revealed: true })}>
              <MapPin size={18} /> Reveal location
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-36 pt-6">
      {Header}
      {body}
      {Shortcuts}
      <ScoreBar players={game.players} active={scoreActive} value={value} awarded={game.awarded || {}} onAward={toggleAward} />
    </div>
  );
}

/* ====================================================================
   11. SETUP & BUILDER VIEWS
   ==================================================================== */

function SetupView({ quiz, defaults, onStart, onBack }) {
  const [names, setNames] = useState(defaults.length ? defaults : ["", ""]);
  const valid = names.some((n) => n.trim());
  return (
    <div className="mx-auto max-w-md px-6 pb-16 pt-6">
      <button onClick={onBack} className={`mb-8 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
        <ChevronLeft size={16} /> Back
      </button>
      <div className="mb-2 flex items-center gap-2 text-stone-400">
        <Users size={18} />
        <span className="text-sm font-medium uppercase tracking-wide">Players or teams</span>
      </div>
      <h2 className="text-3xl font-bold tracking-tight">{quiz.title}</h2>
      <div className="mt-1 flex flex-wrap gap-1.5 pt-2">
        {quiz.rounds.map((r) => <TypeBadge key={r.id} type={r.type} />)}
      </div>
      <div className="mt-8 space-y-2">
        {names.map((n, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              placeholder={`Player ${i + 1}`}
              value={n}
              onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {names.length > 1 && (
              <IconButton label="Remove player" onClick={() => setNames(names.filter((_, j) => j !== i))} className="hover:text-red-600">
                <X size={16} />
              </IconButton>
            )}
          </div>
        ))}
        <button onClick={() => setNames([...names, ""])} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
          <Plus size={15} /> Add player
        </button>
      </div>
      <Button className="mt-8 w-full px-6 py-3.5 text-base" disabled={!valid} onClick={() => onStart(names.map((n) => n.trim()).filter(Boolean))}>
        <Play size={18} /> Start game
      </Button>
    </div>
  );
}

function Builder({ initial, note, onSave, onCancel }) {
  const [quiz, setQuiz] = useState(initial);
  const [picker, setPicker] = useState(false);

  const setRound = (rid, patch) => setQuiz({ ...quiz, rounds: quiz.rounds.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });
  const moveRound = (idx, dir) => {
    const rounds = [...quiz.rounds];
    const j = idx + dir;
    if (j < 0 || j >= rounds.length) return;
    [rounds[idx], rounds[j]] = [rounds[j], rounds[idx]];
    setQuiz({ ...quiz, rounds });
  };
  const addRound = (type) => {
    setQuiz({ ...quiz, rounds: [...quiz.rounds, makeRound(type)] });
    setPicker(false);
  };
  const qRow = (r, item, patch) => setRound(r.id, { questions: r.questions.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) });
  const qDel = (r, item) => setRound(r.id, { questions: r.questions.filter((x) => x.id !== item.id) });
  const setCat = (r, cid, patch) => setRound(r.id, { categories: r.categories.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
  const setCatQ = (r, c, item, patch) => setCat(r, c.id, { questions: c.questions.map((y) => (y.id === item.id ? { ...y, ...patch } : y)) });

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <button onClick={onCancel} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
          <ChevronLeft size={16} /> Cancel
        </button>
        <Button className="px-5 py-2.5" onClick={() => onSave({ ...quiz, title: quiz.title.trim() || "Untitled quiz" })}>
          Save quiz
        </Button>
      </div>
      {note && <p className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{note}</p>}
      <input
        className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight placeholder-stone-300 focus:outline-none"
        placeholder="Quiz title…"
        value={quiz.title}
        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
      />

      <div className="mt-8 space-y-6">
        {quiz.rounds.map((r, idx) => {
          const T = TYPES[r.type];
          return (
            <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <TypeBadge type={r.type} />
                <input
                  className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1 font-semibold placeholder-stone-300 focus:outline-none"
                  placeholder={`${T.label} round title…`}
                  value={r.title}
                  onChange={(e) => setRound(r.id, { title: e.target.value })}
                />
                <IconButton label="Move round up" onClick={() => moveRound(idx, -1)}><ChevronUp size={15} /></IconButton>
                <IconButton label="Move round down" onClick={() => moveRound(idx, 1)}><ChevronDown size={15} /></IconButton>
                <ConfirmDelete label="Delete round" onConfirm={() => setQuiz({ ...quiz, rounds: quiz.rounds.filter((x) => x.id !== r.id) })} />
              </div>

              {/* classic */}
              {r.type === "classic" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => (
                    <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                        <span>Question {i + 1}</span>
                        <ConfirmDelete label="Delete question" onConfirm={() => qDel(r, item)} />
                      </div>
                      <input className={inputCls} placeholder="Question" value={item.q} onChange={(e) => qRow(r, item, { q: e.target.value })} />
                      <div className="mt-2 flex gap-2">
                        <input className={inputCls} placeholder="Answer" value={item.a} onChange={(e) => qRow(r, item, { a: e.target.value })} />
                        <input type="number" aria-label="Points" className={`${inputCls} w-20`} title="Points" value={item.points} onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })} />
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("classic")] })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
                    <Plus size={15} /> Add question
                  </button>
                </div>
              )}

              {/* jeopardy */}
              {r.type === "jeopardy" && (
                <div className="space-y-4">
                  {r.categories.map((c) => (
                    <div key={c.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <input className={inputCls} placeholder="Category name" value={c.name} onChange={(e) => setCat(r, c.id, { name: e.target.value })} />
                        <ConfirmDelete label="Delete category" onConfirm={() => setRound(r.id, { categories: r.categories.filter((x) => x.id !== c.id) })} />
                      </div>
                      <div className="space-y-2">
                        {c.questions.map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center gap-2">
                            <input type="number" aria-label="Points" className={`${inputCls} w-20`} value={item.points} onChange={(e) => setCatQ(r, c, item, { points: +e.target.value || 0 })} />
                            <input className={`${inputCls} min-w-32 flex-1`} placeholder="Clue" value={item.clue} onChange={(e) => setCatQ(r, c, item, { clue: e.target.value })} />
                            <input className={`${inputCls} min-w-28 flex-1`} placeholder="Answer" value={item.answer} onChange={(e) => setCatQ(r, c, item, { answer: e.target.value })} />
                            <ConfirmDelete label="Delete clue" onConfirm={() => setCat(r, c.id, { questions: c.questions.filter((y) => y.id !== item.id) })} />
                          </div>
                        ))}
                        <button
                          onClick={() => setCat(r, c.id, { questions: [...c.questions, { id: uid(), clue: "", answer: "", points: (c.questions.length + 1) * 100 }] })}
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                        >
                          <Plus size={13} /> Add clue
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setRound(r.id, { categories: [...r.categories, makeCategory()] })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
                    <Plus size={15} /> Add category
                  </button>
                </div>
              )}

              {/* hints */}
              {r.type === "hints" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => (
                    <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                        <span>Item {i + 1}</span>
                        <ConfirmDelete label="Delete item" onConfirm={() => qDel(r, item)} />
                      </div>
                      <input className={inputCls} placeholder="The answer (who/what is it?)" value={item.answer} onChange={(e) => qRow(r, item, { answer: e.target.value })} />
                      <textarea
                        rows={4}
                        className={`${inputCls} mt-2`}
                        placeholder={"One hint per line — hardest first…"}
                        value={item.hints.join("\n")}
                        onChange={(e) => qRow(r, item, { hints: e.target.value.split("\n") })}
                      />
                      <p className="mt-1 text-xs text-stone-400">
                        {item.hints.filter((h) => h.trim()).length || 0} hints · starts at {(item.hints.length || 1) * 10} pts, −10 per extra hint
                      </p>
                    </div>
                  ))}
                  <button onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("hints")] })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
                    <Plus size={15} /> Add item
                  </button>
                </div>
              )}

              {/* video */}
              {r.type === "video" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => {
                    const ok = ytId(item.url);
                    return (
                      <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                          <span>Clip {i + 1}</span>
                          <ConfirmDelete label="Delete clip" onConfirm={() => qDel(r, item)} />
                        </div>
                        <input className={inputCls} placeholder="YouTube link (e.g. https://youtu.be/…)" value={item.url} onChange={(e) => qRow(r, item, { url: e.target.value })} />
                        <p className={`mt-1 text-xs ${item.url ? (ok ? "text-emerald-600" : "text-red-500") : "text-stone-400"}`}>
                          {item.url ? (ok ? "✓ Video link recognised" : "Couldn't read a video ID from that link") : "Paste any YouTube URL"}
                        </p>
                        <input className={`${inputCls} mt-2`} placeholder="Question (read after the clip)" value={item.q} onChange={(e) => qRow(r, item, { q: e.target.value })} />
                        <div className="mt-2 flex gap-2">
                          <input className={inputCls} placeholder="Answer" value={item.a} onChange={(e) => qRow(r, item, { a: e.target.value })} />
                          <input type="number" aria-label="Points" className={`${inputCls} w-20`} title="Points" value={item.points} onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })} />
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("video")] })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
                    <Plus size={15} /> Add clip
                  </button>
                </div>
              )}

              {/* map */}
              {r.type === "map" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => (
                    <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                        <span>Place {i + 1}</span>
                        <ConfirmDelete label="Delete place" onConfirm={() => qDel(r, item)} />
                      </div>
                      <input className={inputCls} placeholder="Question (e.g. Where is Machu Picchu?)" value={item.q} onChange={(e) => qRow(r, item, { q: e.target.value })} />
                      <input className={`${inputCls} mt-2`} placeholder="Location label shown on reveal" value={item.name} onChange={(e) => qRow(r, item, { name: e.target.value })} />
                      <div className="mt-2">
                        <WorldMap
                          pin={item.lat != null ? { lat: item.lat, lng: item.lng, label: item.name } : null}
                          onPick={(lat, lng) => qRow(r, item, { lat, lng })}
                        />
                        <p className="mt-1 text-xs text-stone-400">
                          {item.lat != null ? `Pinned at ${item.lat}, ${item.lng} — click the map to move it` : "Click the map to place the pin"}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("map")] })} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
                    <Plus size={15} /> Add place
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        {picker ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-stone-500">Choose a round format</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPES).map(([key, t]) => {
                const Icon = t.icon;
                return (
                  <button key={key} onClick={() => addRound(key)} className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium hover:border-stone-400 ${FOCUS}`}>
                    <Icon size={16} className="text-stone-500" /> {t.label}
                  </button>
                );
              })}
              <button onClick={() => setPicker(false)} className={`rounded-xl px-3 py-2.5 text-sm text-stone-400 hover:bg-stone-100 ${FOCUS}`}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setPicker(true)} className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-4 font-medium text-stone-500 hover:border-stone-400 hover:text-stone-700 ${FOCUS}`}>
            <Plus size={18} /> Add round
          </button>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   12. APP SHELL (routing, persistence, home screen)
   ==================================================================== */

function App() {
  const [view, setView] = useState({ name: "home" });
  const [quizzes, setQuizzes] = useState([]);
  const [game, setGame] = useState(null);
  const [lastPlayers, setLastPlayers] = useState(["", ""]);
  const [loaded, setLoaded] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  /* initial load (with migration from the first artifact version's keys) */
  useEffect(() => {
    (async () => {
      const qs = await loadWithLegacy("quizzes", "quiznight-quizzes", []);
      setQuizzes((Array.isArray(qs) ? qs : []).map(normalizeQuiz).filter(Boolean));
      const g = await loadJSON("game", null);
      setGame(normalizeGame(g));
      const p = await loadWithLegacy("players", "quiznight-players", ["", ""]);
      if (Array.isArray(p) && p.length) setLastPlayers(p.map((x) => str(x)));
      setLoaded(true);
    })();
  }, []);

  const persistQuizzes = (list) => { setQuizzes(list); saveJSON("quizzes", list); };
  const persistGame = (g) => {
    setGame(g);
    if (g && g.stage !== "end") saveJSON("game", g);
    else removeKey("game");
  };

  const allQuizzes = [SAMPLE, ...quizzes];

  const startGame = (quiz, names) => {
    setLastPlayers(names);
    saveJSON("players", names);
    const ri = nextNonEmpty(quiz, 0);
    persistGame({
      quiz: deepClone(quiz),
      players: names.map((n) => ({ id: uid(), name: n, score: 0 })),
      ri: Math.max(ri, 0),
      qi: 0,
      stage: ri === -1 ? "end" : "intro",
      revealed: false, hintsShown: 1, awarded: {}, used: {}, tile: null,
    });
    setView({ name: "play" });
  };

  const editQuiz = (quiz) => {
    if (quiz.sample) {
      const copy = deepClone(quiz);
      copy.id = uid(); copy.sample = false; copy.title = quiz.title + " (copy)";
      setView({ name: "builder", draft: copy, note: "The sample quiz is read-only — you're editing your own copy of it." });
    } else {
      setView({ name: "builder", draft: deepClone(quiz) });
    }
  };

  const duplicateQuiz = (quiz) => {
    const copy = deepClone(quiz);
    copy.id = uid(); copy.sample = false; copy.title = quiz.title + " (copy)";
    persistQuizzes([...quizzes, copy]);
  };

  const saveQuiz = (q) => {
    const exists = quizzes.some((x) => x.id === q.id);
    persistQuizzes(exists ? quizzes.map((x) => (x.id === q.id ? q : x)) : [...quizzes, q]);
    setView({ name: "home" });
  };

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const quiz = normalizeQuiz(parsed?.quiz ?? parsed);
        if (!quiz || !quiz.rounds.length) throw new Error("invalid");
        quiz.id = uid();
        quiz.sample = false;
        persistQuizzes([...quizzes, quiz]);
        setImportError("");
      } catch {
        setImportError("That file doesn't look like a Quiz Night export (.quiz.json).");
        setTimeout(() => setImportError(""), 5000);
      }
    };
    reader.readAsText(file);
  };

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center bg-stone-50 font-sans text-stone-400">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
      {view.name === "home" && (
        <div className="mx-auto max-w-2xl px-6 pb-16 pt-12">
          <h1 className="text-5xl font-bold tracking-tight">
            Quiz Night<span className="text-indigo-600">.</span>
          </h1>
          <p className="mt-2 text-stone-500">One screen, one host, five round formats. You read, friends shout, you tap to score.</p>

          {game && game.stage !== "end" && (
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-indigo-700">Game in progress</p>
                <p className="text-sm text-indigo-900/70">
                  {game.quiz.title} · Round {game.ri + 1} of {game.quiz.rounds.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="accent" className="px-4 py-2" onClick={() => setView({ name: "play" })}>
                  <Play size={15} /> Resume
                </Button>
                <IconButton label="Discard game" className="text-indigo-400 hover:text-red-600" onClick={() => persistGame(null)}>
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400">Quizzes</h2>
            <button onClick={() => fileRef.current?.click()} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}>
              <Upload size={15} /> Import
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportFile} />
          </div>
          {importError && <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{importError}</p>}

          <div className="mt-3 space-y-3">
            {allQuizzes.map((q) => (
              <div key={q.id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{q.title}</h3>
                    <p className="mt-0.5 text-sm text-stone-400">
                      {q.rounds.length} rounds · {countQuestions(q)} questions{q.sample ? " · sample" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.rounds.map((r) => <TypeBadge key={r.id} type={r.type} />)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label="Edit quiz" onClick={() => editQuiz(q)}><Pencil size={15} /></IconButton>
                    <IconButton label="Duplicate quiz" onClick={() => duplicateQuiz(q)}><Copy size={15} /></IconButton>
                    <IconButton label="Export quiz as file" onClick={() => exportQuiz(q)}><Download size={15} /></IconButton>
                    {!q.sample && <ConfirmDelete label="Delete quiz" onConfirm={() => persistQuizzes(quizzes.filter((x) => x.id !== q.id))} />}
                  </div>
                </div>
                <Button className="mt-4 px-5 py-2.5" onClick={() => setView({ name: "setup", quiz: q })}>
                  <Play size={15} /> Play
                </Button>
              </div>
            ))}
            <button
              onClick={() => setView({ name: "builder", draft: { id: uid(), title: "", rounds: [] } })}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-5 font-medium text-stone-500 hover:border-stone-400 hover:text-stone-700 ${FOCUS}`}
            >
              <Plus size={18} /> New quiz
            </button>
          </div>

          <p className="mt-10 text-center text-xs text-stone-300">
            v{APP_VERSION} ·{" "}
            {storage.name === "claude" && "saving to your Claude storage"}
            {storage.name === "local" && "saving to this browser"}
            {storage.name === "memory" && <span className="font-medium text-amber-500">no persistent storage available — changes last only for this session</span>}
          </p>
        </div>
      )}

      {view.name === "setup" && (
        <SetupView quiz={view.quiz} defaults={lastPlayers} onBack={() => setView({ name: "home" })} onStart={(names) => startGame(view.quiz, names)} />
      )}

      {view.name === "play" && game && (
        <PlayView
          game={game}
          setGame={persistGame}
          onExit={() => {
            if (game.stage === "end") persistGame(null);
            setView({ name: "home" });
          }}
        />
      )}

      {view.name === "builder" && (
        <Builder initial={view.draft} note={view.note} onSave={saveQuiz} onCancel={() => setView({ name: "home" })} />
      )}
    </div>
  );
}

export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
