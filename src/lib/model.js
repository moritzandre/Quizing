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
  "anythingle",
];

/** Round types that reuse the phone "choice" machinery (auto-scored fixed options). */
export const BINARY_TYPES = ["choice", "truefalse", "higherlower"];

/* ---- Anythingle (Wordle x Guess-Who) — fictional-character trait matrix ----
   A secret fictional character is broken down across a fixed, objective 8-column
   matrix; a guessed character is graded trait-by-trait against the secret. Every
   column except Debut Year is a CLOSED vocabulary (so a curated DB / a host
   manual-add can only ever produce comparable, deterministic values). Franchise
   is a normalized free string (curated canonical names) with "Standalone" the
   catch-all for one-off works. These tokens double as data + display (quiz
   content, not translated — like question text). */
export const ANY_SPECIES = [
  "Human",
  "Humanoid",
  "Animal",
  "Creature/Monster",
  "Robot/AI",
  "Cyborg/Augmented",
  "Alien",
  "Deity/Spirit",
  "Undead",
  "Object/Other",
];
export const ANY_GENDERS = ["Male", "Female", "Non-binary/Fluid", "None/Genderless"];
export const ANY_ALIGNMENTS = ["Hero/Good", "Villain/Evil", "Neutral/Anti-hero"];
export const ANY_POWERS = [
  "None",
  "Super strength",
  "Super speed",
  "Flight",
  "Magic/Sorcery",
  "Elemental",
  "Electric/Lightning",
  "Energy/Beams",
  "Telepathy/Mind",
  "Shapeshifting",
  "Healing/Regeneration",
  "Elasticity/Stretch",
  "Stealth/Invisibility",
  "Weapon mastery",
  "Martial arts",
  "Tech/Gadgets",
  "Immortality",
  "Summoning",
  "Size-change",
  "Peak human/Genius",
];
export const ANY_MEDIA = [
  "Stage/Theatre",
  "Novel/Prose",
  "Comic (Western)",
  "Manga",
  "Anime",
  "Animation/Cartoon",
  "Film/TV (live-action)",
  "Video game",
  "Mythology/Folklore",
  "Web/Other",
];
/** Occupation/role buckets (multi-value, set-overlap → yellow). */
export const ANY_ROLES = [
  "Warrior",
  "Royalty",
  "Leader",
  "Detective",
  "Mage",
  "Outlaw",
  "Scientist",
  "Student",
  "Soldier",
  "Adventurer",
  "Pilot",
  "Artist",
  "Healer",
  "Spy",
  "Monster",
  "Athlete",
  "Worker",
  "Politician",
  "Mystic",
  "Civilian",
];
/** Max abilities / roles per character so the set-overlap "yellow" stays meaningful. */
export const ANY_MAX_POWERS = 3;
export const ANY_MAX_ROLES = 3;
/** Debut-year window (years) that still tints the cell yellow ("right era"). */
export const ANY_CLOSE_BAND = 15;
/** Soft per-round guess cap (display only; the host reveals when ready). */
export const ANY_MAX_GUESSES = 8;
/** Wrong guesses after which the secret's colour-scheme hint (3 swatches) is shown. */
export const ANY_COLORS_AFTER = 5;
/** Wrong guesses after which the secret character's quote is revealed (later, stronger hint). */
export const ANY_QUOTE_AFTER = 10;

/**
 * The fixed 10-column comparison matrix. `type` drives both the editor control
 * and the grading: single = exact, multi = set-overlap (yellow on partial),
 * text = normalized exact (franchise/affiliation/origin — free strings, e.g. a
 * real nationality OR a fictional realm like "Hyrule"), number = higher/lower
 * arrow (debut year).
 */
export const ANYTHINGLE_TRAITS = [
  { key: "species", label: "Species", type: "single", values: ANY_SPECIES },
  { key: "gender", label: "Gender", type: "single", values: ANY_GENDERS },
  { key: "alignment", label: "Alignment", type: "single", values: ANY_ALIGNMENTS },
  { key: "role", label: "Role", type: "multi", values: ANY_ROLES, max: ANY_MAX_ROLES },
  { key: "powers", label: "Powers", type: "multi", values: ANY_POWERS, max: ANY_MAX_POWERS },
  { key: "franchise", label: "Franchise", type: "text" },
  { key: "affiliation", label: "Affiliation", type: "text" },
  { key: "origin", label: "Origin", type: "text" },
  { key: "medium", label: "Origin medium", type: "single", values: ANY_MEDIA },
  { key: "year", label: "Debut year", type: "number", band: ANY_CLOSE_BAND },
];

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

/* ---- Anythingle helpers (pure, unit-tested) ---- */

/** Fold a name to a match key: strip diacritics, lowercase, collapse whitespace. */
export const normText = (s) =>
  str(s)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Create an empty Anythingle character entry (one row of the matrix). */
export function makeAnyChar() {
  return {
    id: uid(),
    name: "",
    aliases: [],
    species: "Human",
    gender: "Male",
    alignment: "Hero/Good",
    role: [],
    powers: ["None"],
    franchise: "Standalone",
    affiliation: "",
    origin: "",
    medium: "Film/TV (live-action)",
    year: null,
    // A bilingual in-character quote, revealed as a hint after ANY_QUOTE_AFTER
    // wrong guesses. Not a graded trait.
    quote: { en: "", de: "" },
    // Up to 3 dominant hex colours (from an author-uploaded image), shown as a
    // palette hint after ANY_COLORS_AFTER wrong guesses. Not a graded trait.
    colors: [],
  };
}

/**
 * Coerce untrusted data into a valid Anythingle character, or null if nameless.
 * Every categorical is clamped to its closed vocabulary; powers de-duped, made
 * None-exclusive and capped; year coerced to an integer or null.
 * @param {*} raw
 * @returns {object|null}
 */
export function normalizeAnyChar(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = str(raw.name).trim();
  if (!name) return null;
  const pick = (v, set, d) => (set.includes(v) ? v : d);
  let powers = (Array.isArray(raw.powers) ? raw.powers : []).map((p) => str(p)).filter((p) => ANY_POWERS.includes(p));
  powers = [...new Set(powers)];
  if (!powers.length || powers.includes("None"))
    powers = ["None"]; // None is exclusive
  else powers = powers.slice(0, ANY_MAX_POWERS);
  const role = [
    ...new Set((Array.isArray(raw.role) ? raw.role : []).map((r) => str(r)).filter((r) => ANY_ROLES.includes(r))),
  ].slice(0, ANY_MAX_ROLES);
  return {
    id: str(raw.id) || uid(),
    name,
    aliases: (Array.isArray(raw.aliases) ? raw.aliases : [])
      .map((a) => str(a).trim())
      .filter(Boolean)
      .slice(0, 12),
    species: pick(str(raw.species), ANY_SPECIES, "Object/Other"),
    gender: pick(str(raw.gender), ANY_GENDERS, "None/Genderless"),
    alignment: pick(str(raw.alignment), ANY_ALIGNMENTS, "Neutral/Anti-hero"),
    role,
    powers,
    franchise: str(raw.franchise).trim() || "Standalone",
    // Free strings (real nationality OR fictional realm) — compared as normalized
    // exact match, so a blank never falsely greens.
    affiliation: str(raw.affiliation).trim(),
    origin: str(raw.origin).trim(),
    medium: pick(str(raw.medium), ANY_MEDIA, "Web/Other"),
    year: numOrNull(raw.year),
    quote: {
      en: str(raw.quote?.en).trim().slice(0, 300),
      de: str(raw.quote?.de).trim().slice(0, 300),
    },
    colors: (Array.isArray(raw.colors) ? raw.colors : [])
      .map((c) => str(c).trim().toLowerCase())
      .filter((c) => /^#[0-9a-f]{6}$/.test(c))
      .slice(0, 3),
  };
}

/**
 * Extract up to `n` dominant, reasonably-distinct hex colours from an image
 * (browser only — draws to a small canvas and buckets the pixels). Used by the
 * Builder to derive a character's colour-scheme hint from an uploaded image.
 * Resolves [] on any failure (load error, CORS-tainted canvas).
 * @param {string} src Image URL or data URL.
 * @param {number} [n] How many colours to return (default 3).
 * @param {number} [minDist] Min summed-RGB distance between kept colours (default
 *   80); lower it (e.g. 36) to surface a richer candidate palette for manual picking.
 * @returns {Promise<string[]>} Hex colours like "#rrggbb".
 */
export function extractColors(src, n = 3, minDist = 80) {
  return new Promise((resolve) => {
    if (!src) return resolve([]);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onerror = () => resolve([]);
    img.onload = () => {
      try {
        const W = 56;
        const H = Math.max(1, Math.round((img.height / Math.max(1, img.width)) * W));
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve([]);
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;
        const buckets = new Map(); // 3-bit-per-channel bucket -> {count, r, g, b}
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 125) continue; // skip transparent
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
          const e = buckets.get(key);
          if (e) {
            e.count++;
            e.r += r;
            e.g += g;
            e.b += b;
          } else buckets.set(key, { count: 1, r, g, b });
        }
        const ranked = [...buckets.values()]
          .map((e) => ({
            count: e.count,
            r: Math.round(e.r / e.count),
            g: Math.round(e.g / e.count),
            b: Math.round(e.b / e.count),
          }))
          .sort((a, b) => b.count - a.count);
        const hex = (c) =>
          "#" + [c.r, c.g, c.b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("");
        const picked = [];
        for (const c of ranked) {
          if (picked.length >= n) break;
          // skip near-duplicates so the palette reads as distinct colours
          if (picked.some((p) => Math.abs(p.r - c.r) + Math.abs(p.g - c.g) + Math.abs(p.b - c.b) < minDist)) continue;
          picked.push(c);
        }
        resolve(picked.map(hex));
      } catch {
        resolve([]); // tainted canvas / decode failure
      }
    };
    img.src = src;
  });
}

/** Find the pool entry whose name/alias matches a typed guess (accent/case-insensitive). */
export function matchAnyEntity(pool, name) {
  const key = normText(name);
  if (!key) return null;
  for (const e of Array.isArray(pool) ? pool : []) {
    if (normText(e?.name) === key) return e;
    if (Array.isArray(e?.aliases) && e.aliases.some((a) => normText(a) === key)) return e;
  }
  return null;
}

/**
 * Grade a guessed character against the secret across ANYTHINGLE_TRAITS.
 * @returns {Array<{key:string, result:"green"|"yellow"|"grey", dir?:"up"|"down", shared?:string[]}>}
 *   green = exact; yellow = partial overlap (multi) or within the close-band (year);
 *   grey = miss. dir on the numeric column: "up" = secret is higher/newer than the guess.
 */
export function gradeAnythingle(target, guess) {
  return ANYTHINGLE_TRAITS.map((t) => {
    const tv = target?.[t.key];
    const gv = guess?.[t.key];
    if (t.type === "multi") {
      const ts = new Set((Array.isArray(tv) ? tv : []).map((x) => str(x)));
      const gs = [...new Set((Array.isArray(gv) ? gv : []).map((x) => str(x)))];
      const shared = gs.filter((x) => ts.has(x));
      // Equal NON-EMPTY sets = green; two empties never green (nothing to match).
      if (ts.size > 0 && ts.size === gs.length && shared.length === ts.size) return { key: t.key, result: "green" };
      if (shared.length > 0) return { key: t.key, result: "yellow", shared };
      return { key: t.key, result: "grey" };
    }
    if (t.type === "number") {
      const a = numOrNull(tv);
      const b = numOrNull(gv);
      if (a == null || b == null) return { key: t.key, result: "grey" };
      if (a === b) return { key: t.key, result: "green" };
      const dir = a > b ? "up" : "down"; // up = secret newer/higher than the guess
      return { key: t.key, result: Math.abs(a - b) <= (t.band || ANY_CLOSE_BAND) ? "yellow" : "grey", dir };
    }
    // single + text (text normalized): exact match on non-empty values only
    const same =
      t.type === "text" ? normText(tv) !== "" && normText(tv) === normText(gv) : str(tv) !== "" && str(tv) === str(gv);
    return { key: t.key, result: same ? "green" : "grey" };
  });
}

/** Display text for one of a character's trait values (arrays joined, numbers stringified). */
export function anyCellValue(char, key) {
  const v = char?.[key];
  if (Array.isArray(v)) return v.join(", ");
  if (v == null) return "";
  return String(v);
}

/** True once a graded row is all-green (every trait matched). */
export const anyAllGreen = (cells) =>
  Array.isArray(cells) && cells.length > 0 && cells.every((c) => c.result === "green");

/** True if a guessed character IS the secret target (by id, name, or alias). */
export function isAnyTarget(target, guess) {
  if (!target || !guess) return false;
  if (target.id && guess.id && target.id === guess.id) return true;
  const k = normText(target.name);
  if (
    k &&
    (normText(guess.name) === k || (Array.isArray(guess.aliases) && guess.aliases.some((a) => normText(a) === k)))
  )
    return true;
  return Array.isArray(target.aliases) && target.aliases.some((a) => normText(a) === normText(guess.name));
}

/**
 * Turn order for an Anythingle round: trailing player (lowest score) first as a
 * comeback mechanic, tie-broken by seed index so host + TV agree without sync.
 * @param {Array<{id:string,score:number}>} players
 * @returns {string[]} ordered player ids
 */
export function anyTurnOrder(players) {
  return (Array.isArray(players) ? players : [])
    .map((p, i) => ({ id: str(p?.id), i, score: num(p?.score, 0) }))
    .filter((p) => p.id)
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((p) => p.id);
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
        reverse: false,
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
        reverse: false,
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
      return {
        id: uid(),
        q: "",
        name: "",
        lat: null,
        lng: null,
        points: 10,
        tileLayer: "map",
        phoneTileLayer: "map",
        street: "",
      };
    case "whoknows":
      // "Who Knows More": a category the host auctions; the winner must name
      // at least as many correct answers as they claimed. `answers` is the full
      // list (for clicking + showcase); `ordered` shows them numbered on reveal.
      return { id: uid(), q: "", answers: ["", "", "", "", ""], ordered: false };
    case "anythingle":
      // Wordle x Guess-Who: a secret fictional character (target) the room
      // narrows down by guessing other characters; `pool` is an optional seed
      // set of likely guesses (with traits) — players may still guess anything.
      return {
        id: uid(),
        q: "Guess the secret character.",
        target: makeAnyChar(),
        pool: [],
        points: 30,
        maxGuesses: ANY_MAX_GUESSES,
      };
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
              reverse: !!q?.reverse,
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
              reverse: !!q?.reverse,
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
              // separate layer for the players' phone pin-placement map
              phoneTileLayer: q?.phoneTileLayer === "satellite" ? "satellite" : "map",
              street: str(q?.street),
            });
          if (r.type === "anythingle")
            Object.assign(it, {
              q: str(q?.q) || "Guess the secret character.",
              target: normalizeAnyChar(q?.target) || makeAnyChar(),
              // pool is a comparison/warm-cache set, NOT a closed guess-list — empty is fine.
              pool: (Array.isArray(q?.pool) ? q.pool : []).map(normalizeAnyChar).filter(Boolean).slice(0, 300),
              points: num(q?.points, 30),
              maxGuesses: Math.max(1, Math.min(20, num(q?.maxGuesses, ANY_MAX_GUESSES))),
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
  // Anythingle round state (turn order + shared guess board). Additive/optional:
  // null on old saves so they load byte-for-byte.
  g.anythingle = normalizeAnyState(raw.anythingle, g.players);
  // Coherence guard: a jeopardy question needs an open tile. A corrupted/edited
  // save with stage "question" but no tile would crash the question render, so
  // fall back to the board.
  if (g.quiz.rounds[g.ri]?.type === "jeopardy" && g.stage === "question" && !g.tile) g.stage = "board";
  return g;
}

/**
 * Validate the persisted Anythingle round state (turn order + shared guess
 * board). Returns null when absent (old saves). Stores only name + grade + the
 * guessing player's id per guess — never the resolved traits (the board renders
 * from the precomputed cells).
 */
function normalizeAnyState(raw, players) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const ids = new Set((Array.isArray(players) ? players : []).map((p) => p.id));
  return {
    qKey: str(raw.qKey), // which question this board belongs to (so a reload keeps it)
    order: (Array.isArray(raw.order) ? raw.order : []).map(str).filter((id) => ids.has(id)),
    turn: Math.max(0, num(raw.turn, 0)),
    guesses: (Array.isArray(raw.guesses) ? raw.guesses : [])
      .slice(0, 80)
      .map((gss) => ({
        name: str(gss?.name),
        by: ids.has(str(gss?.by)) ? str(gss?.by) : null,
        cells: (Array.isArray(gss?.cells) ? gss.cells : []).slice(0, 12).map((c) => ({
          key: str(c?.key),
          result: ["green", "yellow", "grey"].includes(c?.result) ? c.result : "grey",
          val: str(c?.val).slice(0, 60),
          ...(c?.dir === "up" || c?.dir === "down" ? { dir: c.dir } : {}),
        })),
      }))
      .filter((gss) => gss.name),
    solvedBy: ids.has(str(raw.solvedBy)) ? str(raw.solvedBy) : null,
  };
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
 * Points for the continuous morph demorph: full value while fully morphed
 * (progress 0), decaying linearly to a floor of 1 as it clears (progress 1).
 * The earlier a player buzzes, the more it's worth.
 * @param {number} points Base points.
 * @param {number} progress 0 (morphed) → 1 (clear).
 */
export const morphValueAt = (points, progress) =>
  Math.max(1, Math.round(num(points, 10) * (1 - Math.max(0, Math.min(1, num(progress, 0))))));

/**
 * Video/audio "clip ladder": the host plays a short slice of the trimmed
 * [start,end] window and extends it step by step (like the hint ladder),
 * awarding fewer points each extension. Active only when `steps` > 0 and the
 * trim window is real (end past start).
 * @param {object} q A video question.
 */
export const clipLadderActive = (q) => num(q?.steps, 0) > 0 && q?.end != null && q.end > num(q?.start, 0);

/**
 * Out-point (in seconds) of the clip for the current ladder step. The reveal is
 * PROGRESSIVE (a power curve): the first slice is tiny (~half a second for a
 * typical clip) and each extension adds more than the last, with the final step
 * playing the whole window. Returns the question's plain `end` when the ladder
 * isn't active.
 * @param {object} q A video question.
 * @param {number} step Current ladder step (0-based).
 */
export const clipEnd = (q, step) => {
  if (!clipLadderActive(q)) return q?.end ?? null;
  const lo = num(q.start, 0);
  const steps = num(q.steps, 0);
  const span = q.end - lo;
  // played fraction = (k / (steps+1))^2 → small first slice, bigger later jumps;
  // k=steps+1 at the final step gives the whole window.
  const k = Math.min(num(step, 0) + 1, steps + 1);
  return lo + span * Math.pow(k / (steps + 1), 2);
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
        reverse: !!q.reverse,
        start: numOrNull(q.start),
        end: numOrNull(q.end),
      };
    case "clip":
      return {
        q: str(q.q),
        url: str(q.url),
        audioOnly: !!q.audioOnly,
        reverse: !!q.reverse,
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
    case "anythingle":
      // REVEAL-SAFE: only the prompt + pool size. The secret target + its traits
      // ride the host-only aux topic; the matrix columns are a shared constant
      // (ANYTHINGLE_TRAITS) so they need not be sent. Guesses + grades travel in live.
      return { q: str(q.q), poolSize: (Array.isArray(q.pool) ? q.pool : []).length };
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

/** Validate the live Anythingle sub-payload (host ↔ TV). Carries no trait values. */
function normalizeAnyLive(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const info = (x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? {
          name: str(x.name),
          color: typeof x.color === "string" ? x.color : null,
          emoji: typeof x.emoji === "string" ? x.emoji : null,
        }
      : null;
  return {
    turn: Math.max(0, num(raw.turn, 0)),
    active: info(raw.active),
    guesses: (Array.isArray(raw.guesses) ? raw.guesses : []).slice(0, 60).map((g) => ({
      name: str(g?.name),
      by: info(g?.by),
      cells: (Array.isArray(g?.cells) ? g.cells : []).slice(0, 12).map((c) => ({
        key: str(c?.key),
        result: ["green", "yellow", "grey"].includes(c?.result) ? c.result : "grey",
        val: str(c?.val).slice(0, 60),
        ...(c?.dir === "up" || c?.dir === "down" ? { dir: c.dir } : {}),
      })),
    })),
    solvedBy: info(raw.solvedBy),
    quote:
      raw.quote && typeof raw.quote === "object"
        ? { en: str(raw.quote.en).slice(0, 300), de: str(raw.quote.de).slice(0, 300) }
        : null,
    colors: Array.isArray(raw.colors)
      ? raw.colors
          .map((c) => str(c).toLowerCase())
          .filter((c) => /^#[0-9a-f]{6}$/.test(c))
          .slice(0, 3)
      : null,
    target: raw.target && typeof raw.target === "object" ? { name: str(raw.target.name) } : null,
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
    case "anythingle":
      return { answer: str(q.target?.name) };
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
/**
 * Build the Anythingle live sub-payload for the TV (host → present/live). Carries
 * the active player, the shared graded guess board (names + colour/arrow codes —
 * the public Wordle-tile information), and the solver. The secret target name is
 * included ONLY once the round is revealed. Never carries trait VALUES.
 */
function buildAnyLive(game, anyQuote) {
  const round = game.quiz?.rounds?.[game.ri];
  if (round?.type !== "anythingle" || !game.anythingle) return null;
  const a = game.anythingle;
  const players = Array.isArray(game.players) ? game.players : [];
  const info = (id) => {
    const p = players.find((x) => x.id === id);
    return p
      ? {
          name: str(p.name),
          color: typeof p.color === "string" ? p.color : null,
          emoji: typeof p.emoji === "string" ? p.emoji : null,
        }
      : null;
  };
  const order = Array.isArray(a.order) ? a.order : [];
  const q = currentQuestion(game);
  const guessCount = Array.isArray(a.guesses) ? a.guesses.length : 0;
  // The character's quote is a hint — only sent to the TV once enough wrong
  // guesses have been made (it would leak the answer if sent earlier). Prefer a
  // host-resolved quote (DB fallback for targets saved before quotes existed).
  const own = q?.target?.quote;
  const qt = anyQuote && (str(anyQuote.en) || str(anyQuote.de)) ? anyQuote : own;
  const quote =
    guessCount >= ANY_QUOTE_AFTER && qt && (str(qt.en) || str(qt.de)) ? { en: str(qt.en), de: str(qt.de) } : null;
  // Colour-scheme hint: 3 swatches, shown earlier than the quote (vaguer hint).
  const tc = Array.isArray(q?.target?.colors) ? q.target.colors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)) : [];
  const colors = guessCount >= ANY_COLORS_AFTER && tc.length ? tc.slice(0, 3) : null;
  return {
    turn: num(a.turn, 0),
    active: order.length ? info(order[num(a.turn, 0) % order.length]) : null,
    guesses: (Array.isArray(a.guesses) ? a.guesses : []).slice(-40).map((g) => ({
      name: str(g.name),
      by: info(g.by),
      cells: (Array.isArray(g.cells) ? g.cells : []).map((c) => ({
        key: str(c.key),
        result: ["green", "yellow", "grey"].includes(c.result) ? c.result : "grey",
        val: str(c.val).slice(0, 60),
        ...(c.dir === "up" || c.dir === "down" ? { dir: c.dir } : {}),
      })),
    })),
    solvedBy: info(a.solvedBy),
    quote,
    colors,
    target: game.revealed && q ? { name: str(q.target?.name) } : null,
  };
}

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
    // Which question this payload describes — the TV ignores a stale `reveal`
    // (from the retained `live` topic) once it no longer matches the current
    // `present` question, so e.g. a map never re-frames the previous answer.
    qKey: `${num(game.ri, 0)}-${num(game.qi, 0)}`,
    stage: ["intro", "question", "board", "end"].includes(game.stage) ? game.stage : "intro",
    revealed: !!game.revealed,
    hintsShown: Math.max(1, num(game.hintsShown, 1)),
    step: Math.max(0, num(opts.step, 0)),
    morphProgress: Math.max(0, Math.min(1, num(opts.morphProgress, 0))),
    morphRunning: !!opts.morphRunning, // mirror the auto-demorph clock so the host remote can label/toggle it
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
    anythingle: buildAnyLive(game, opts.anyQuote),
    standings,
  };
  if (game.revealed && game.stage === "question" && round) {
    const q = currentQuestion(game);
    if (q) live.reveal = revealData(round.type, q);
    // On a revealed map round, also send everyone's pins (coords are safe now)
    // so the TV can show where each player guessed + draw the lines.
    if (round.type === "map" && live.reveal) {
      const guesses = game.guesses && typeof game.guesses === "object" ? game.guesses : {};
      live.reveal.guesses = (Array.isArray(game.players) ? game.players : [])
        .map((p) => {
          const g = guesses[p?.id];
          return g && typeof g.lat === "number" && typeof g.lng === "number"
            ? { lat: g.lat, lng: g.lng, color: typeof p.color === "string" ? p.color : null, label: str(p.name) }
            : null;
        })
        .filter(Boolean);
    }
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
    if (Array.isArray(r.guesses))
      reveal.guesses = r.guesses
        .filter((g) => g && typeof g === "object")
        .map((g) => ({
          lat: numOrNull(g.lat),
          lng: numOrNull(g.lng),
          color: typeof g.color === "string" ? g.color : null,
          label: str(g.label),
        }))
        .filter((g) => g.lat != null && g.lng != null)
        .slice(0, 64); // the map round's revealed guess pins
  }
  return {
    qKey: str(raw.qKey),
    stage: ["intro", "question", "board", "end"].includes(raw.stage) ? raw.stage : "intro",
    revealed: !!raw.revealed,
    hintsShown: Math.max(1, num(raw.hintsShown, 1)),
    step: Math.max(0, num(raw.step, 0)),
    morphProgress: Math.max(0, Math.min(1, num(raw.morphProgress, 0))),
    morphRunning: !!raw.morphRunning,
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
    anythingle: normalizeAnyLive(raw.anythingle),
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
  const out = { v: 1, whoknows: null, anythingle: null };
  if (game.stage === "question" && round?.type === "whoknows") {
    const q = currentQuestion(game);
    if (q)
      out.whoknows = {
        answers: (Array.isArray(q.answers) ? q.answers : []).map(str).slice(0, 200),
        ordered: !!q.ordered,
      };
  }
  // Anythingle: the secret target + the traited pool ride the host-only topic so
  // the host remote can resolve/grade guesses; the TV never subscribes to it.
  if (game.stage === "question" && round?.type === "anythingle") {
    const q = currentQuestion(game);
    if (q)
      out.anythingle = {
        target: normalizeAnyChar(q.target),
        pool: (Array.isArray(q.pool) ? q.pool : []).map(normalizeAnyChar).filter(Boolean),
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
  const an = raw.anythingle;
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
    anythingle:
      an && typeof an === "object" && !Array.isArray(an)
        ? {
            target: normalizeAnyChar(an.target),
            pool: (Array.isArray(an.pool) ? an.pool : []).map(normalizeAnyChar).filter(Boolean),
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
