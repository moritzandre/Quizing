/* ====================================================================
   STORAGE ADAPTER
   --------------------------------------------------------------------
   Uniform async key-value API over three backends, picked at startup:
   "claude" (artifact), "local" (browser), "memory" (last resort).
   ==================================================================== */

export const SCHEMA_VERSION = 1;
export const STORAGE_PREFIX = "quiznight.";

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

/** The storage backend detected at startup ({ name, get, set, del }). */
export const storage = detectBackend();

/**
 * Load a versioned JSON payload; tolerates legacy/corrupt data.
 * @param {string} key Storage key (without prefix).
 * @param {*} fallback Returned when the key is missing or unreadable.
 */
export async function loadJSON(key, fallback) {
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

/**
 * Save data under a prefixed key, wrapped in the versioned envelope.
 * @param {string} key Storage key (without prefix).
 * @param {*} data JSON-serializable payload.
 */
export function saveJSON(key, data) {
  storage.set(STORAGE_PREFIX + key, JSON.stringify({ v: SCHEMA_VERSION, data }));
}

/**
 * Remove a prefixed key from storage.
 * @param {string} key Storage key (without prefix).
 */
export function removeKey(key) {
  storage.del(STORAGE_PREFIX + key);
}

/**
 * One-time migration from keys used by the first artifact version.
 * @param {string} key Current storage key (without prefix).
 * @param {string} legacyKey Full legacy key (unprefixed format).
 * @param {*} fallback Returned when neither key holds data.
 */
export async function loadWithLegacy(key, legacyKey, fallback) {
  const current = await loadJSON(key, null);
  if (current != null) return current;
  const legacy = await storage.get(legacyKey);
  if (legacy != null) {
    try { return JSON.parse(legacy); } catch {}
  }
  return fallback;
}
