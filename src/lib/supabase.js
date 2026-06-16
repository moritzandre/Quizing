/* ====================================================================
   SUPABASE CLIENT (optional shared "playerbase" backend)
   --------------------------------------------------------------------
   A thin, framework-free wrapper. The whole layer is OPTIONAL: with no
   VITE_SUPABASE_* env it stays dormant (isSupabaseConfigured === false)
   and never loads the SDK, so the app behaves exactly as before.

   When configured, players are a SHARED, login-free directory: anyone can
   read the list, create a player, or pick an existing one — optionally
   gated by a numeric PIN. Identity is decoupled from the (invisible)
   anonymous auth session. PIN checks + result writes go through
   SECURITY DEFINER RPCs (the pin hash is never sent to clients). Every
   call here is best-effort — failures resolve to null/[]/false and never
   throw, so persistence can never block a join. React bindings live in
   components/usePlayerbase.js (this file imports no React).
   ==================================================================== */

const URL = import.meta.env?.VITE_SUPABASE_URL || "";
const ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

/** True when both env vars are set — the single gate for the whole feature. */
export const isSupabaseConfigured = !!(URL && ANON_KEY);

let clientPromise = null;

/**
 * Lazily create (once) the Supabase client. The SDK is dynamic-imported only
 * here and only when configured, so it stays out of the home/host bundle.
 * @returns {Promise<object|null>} the client, or null if unconfigured/unavailable.
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js")
      .then(({ createClient }) =>
        createClient(URL, ANON_KEY, {
          // detectSessionInUrl:false — the app routes off window.location.hash, and
          // admins sign in with email+password (no magic-link/OAuth redirect), so we
          // must NOT let the SDK consume/rewrite the hash and disrupt routing.
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        }),
      )
      .catch(() => null);
  }
  return clientPromise;
}

/**
 * Ensure an anonymous auth session exists (an invisible, login-free session so
 * RLS has an authenticated role). The PLAYER identity is separate from this uid.
 * @returns {Promise<{id:string}|null>} the auth user, or null on failure.
 */
export async function ensureAnonSession() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    if (data?.session?.user) return data.session.user;
    const { data: signed, error } = await sb.auth.signInAnonymously();
    if (error) return null;
    return signed?.user || null;
  } catch {
    return null;
  }
}

/** The shared player directory (the pin-free view). Returns an array (never throws). */
export async function listPlayers() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb.from("profiles_public").select("*").order("name");
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Create a new shared player, optionally locked with a numeric PIN.
 * @param {{name:string,emoji?:string,color?:string,photo?:string,pin?:string}} p
 * @returns {Promise<object|null>} the created player row (no hash), or null.
 */
export async function createPlayer(p) {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc("create_player", {
      p_name: p?.name ?? "",
      p_emoji: p?.emoji ?? null,
      p_color: p?.color ?? null,
      p_photo: p?.photo ?? null,
      p_pin: p?.pin || null,
    });
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/** Edit a player's name/avatar (PIN required if it's locked). Returns the row or null. */
export async function updatePlayer(id, pin, fields) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return null;
    const { data, error } = await sb.rpc("update_player", {
      p_id: id,
      p_pin: pin || null,
      p_name: fields?.name ?? null,
      p_emoji: fields?.emoji ?? null,
      p_color: fields?.color ?? null,
      p_photo: fields?.photo ?? null,
    });
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/** True if the PIN is correct (or the player is unlocked). Never reveals the hash. */
export async function verifyPin(id, pin) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return false;
    const { data, error } = await sb.rpc("verify_pin", { p_id: id, p_pin: pin || "" });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Set / change / clear a player's PIN (current PIN required if already locked). */
export async function setPin(id, currentPin, newPin) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return false;
    const { data, error } = await sb.rpc("set_pin", {
      p_id: id,
      p_current_pin: currentPin || "",
      p_new_pin: newPin || "",
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/**
 * Record one finished-game result for a player (idempotent server-side).
 * @param {object} row { profile_id, game_id, quiz_title, score, won, team_name?, room_code? }
 * @returns {Promise<boolean>}
 */
export async function recordResult(row) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !row?.profile_id || !row?.game_id) return false;
    const { data, error } = await sb.rpc("record_result", {
      p_profile_id: row.profile_id,
      p_game_id: row.game_id,
      p_quiz_title: row.quiz_title ?? "",
      p_score: row.score ?? 0,
      p_won: !!row.won,
      p_team_name: row.team_name ?? null,
      p_room_code: row.room_code ?? null,
    });
    return !error && data === true;
  } catch {
    return false;
  }
}

/* ====================================================================
   ADMIN AUTH (optional "ultimate admin" gate)
   --------------------------------------------------------------------
   Unlike the invisible anonymous player session, an ADMIN signs in with
   a real email/password. Their auth user must be listed in public.admins
   (server-side allow-list) to host or to create players. One client = one
   session: an admin login replaces the anon session on the host device,
   which is fine — the host isn't a player and every RPC works as the
   `authenticated` role. signOutAdmin() returns the device to anon mode.
   All best-effort: failures resolve to null/false and never throw.
   ==================================================================== */

/** The current auth user ({ id, email } or null). Distinguishes an admin login from the anon session. */
export async function getAuthUser() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data?.session?.user || null;
  } catch {
    return null;
  }
}

/** Sign in as an admin with email/password. Returns the user or null. */
export async function signInAdmin(email, password) {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.signInWithPassword({ email: String(email || "").trim(), password: password || "" });
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

/** Create an admin auth account (first-time setup). Returns the user or null. */
export async function signUpAdmin(email, password) {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return null;
    const { data, error } = await sb.auth.signUp({ email: String(email || "").trim(), password: password || "" });
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

/** Sign out of the admin account and return the device to an anonymous player session. */
export async function signOutAdmin() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return false;
    await sb.auth.signOut();
    await ensureAnonSession();
    return true;
  } catch {
    return false;
  }
}

/** True if the current auth session belongs to an admin (server-checked). */
export async function isAdmin() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return false;
    const { data, error } = await sb.rpc("is_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Bootstrap: claim the protected ultimate-admin slot (only works while the allow-list is empty). */
export async function claimFirstAdmin() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return false;
    const { data, error } = await sb.rpc("claim_first_admin");
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Admin-only: add another admin by email (the target must have signed up once). */
export async function grantAdmin(email) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !email) return false;
    const { data, error } = await sb.rpc("grant_admin", { p_email: String(email).trim() });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Admin-only: remove an admin by auth user id (protected/last admin refused server-side). */
export async function revokeAdmin(userId) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !userId) return false;
    const { data, error } = await sb.rpc("revoke_admin", { p_user_id: userId });
    return !error && data === true;
  } catch {
    return false;
  }
}

/* ---- admin player management (admin-gated server-side; see 0005) ---- */

/** Admin: edit any player's name + avatar (no PIN). Returns the row or null. */
export async function adminUpdatePlayer(id, fields) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return null;
    const { data, error } = await sb.rpc("admin_update_player", {
      p_id: id,
      p_name: fields?.name ?? null,
      p_emoji: fields?.emoji ?? null,
      p_color: fields?.color ?? null,
    });
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/** Admin: set/clear any player's PIN (empty newPin = unlock). Returns true on success. */
export async function adminSetPin(id, newPin) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return false;
    const { data, error } = await sb.rpc("admin_set_pin", { p_id: id, p_new_pin: newPin || "" });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Admin: delete a player (their results cascade). Returns true on success. */
export async function adminDeletePlayer(id) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return false;
    const { data, error } = await sb.rpc("admin_delete_player", { p_id: id });
    return !error && data === true;
  } catch {
    return false;
  }
}

/** Recent result rows across the whole playerbase, newest first (for the admin "past games" view). */
export async function loadRecentResults(limit = 400) {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb
      .from("results")
      .select("*")
      .order("played_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** A player's own result rows, newest first. Returns an array (never throws). */
export async function loadPlayerStats(id) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return [];
    const { data, error } = await sb
      .from("results")
      .select("*")
      .eq("profile_id", id)
      .order("played_at", { ascending: false })
      .limit(500);
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/** The global all-time leaderboard (one row per player with games). Array (never throws). */
export async function loadGlobalLeaderboard() {
  try {
    const sb = await getSupabaseClient();
    if (!sb) return [];
    const { data, error } = await sb.from("player_leaderboard").select("*");
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
