/* ====================================================================
   SUPABASE CLIENT (optional persistent-player backend)
   --------------------------------------------------------------------
   A thin, framework-free wrapper. The whole layer is OPTIONAL: with no
   VITE_SUPABASE_* env it stays dormant (isSupabaseConfigured === false)
   and never loads the SDK, so the app behaves exactly as before. When
   configured, each device signs in anonymously and owns one `profiles`
   row; phones write their own `results` rows at game end. Every call is
   best-effort — failures resolve to null/[]/false and never throw, so
   persistence can never block a join. React bindings live in
   components/useProfile.js (this file imports no React).
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
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        }),
      )
      .catch(() => null);
  }
  return clientPromise;
}

/**
 * Ensure an anonymous auth session exists (creating one on first use). The
 * session is persisted by the SDK, so a returning device keeps the same uid.
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

/** Load the caller's own profile row (by auth uid). Returns the row or null. */
export async function loadProfile(id) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !id) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Create or update the caller's profile. `id` must be the auth uid (RLS).
 * @param {{id:string,name?:string,emoji?:string,color?:string,photo?:string}} profile
 * @returns {Promise<object|null>} the saved row, or null on failure.
 */
export async function upsertProfile(profile) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !profile?.id) return null;
    const row = {
      id: profile.id,
      name: profile.name ?? "",
      emoji: profile.emoji ?? null,
      color: profile.color ?? null,
      photo: profile.photo ?? null,
    };
    const { data, error } = await sb.from("profiles").upsert(row).select().maybeSingle();
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

/**
 * Record one finished-game result for the caller's profile (idempotent: a
 * repeated (profile_id, game_id) is a unique-violation, treated as success).
 * @param {object} result { profile_id, game_id, quiz_title, score, won, team_name?, room_code? }
 * @returns {Promise<boolean>} true if stored (or already present).
 */
export async function recordResult(result) {
  try {
    const sb = await getSupabaseClient();
    if (!sb || !result?.profile_id || !result?.game_id) return false;
    const { error } = await sb.from("results").insert(result);
    if (!error) return true;
    return error.code === "23505"; // unique_violation = already recorded → success
  } catch {
    return false;
  }
}

/** Load the caller's own result rows, newest first. Returns an array (never throws). */
export async function loadMyResults(id) {
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
