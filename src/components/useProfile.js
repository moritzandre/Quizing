/* ====================================================================
   useProfile — the device's persistent player profile (optional)
   --------------------------------------------------------------------
   React binding over lib/supabase.js. When Supabase isn't configured,
   `configured` is false and `ready` is true immediately, so JoinView
   falls back to the classic type-a-name flow. When configured, it signs
   the device in anonymously (a stable uid across reloads) and loads/
   creates the profile (name + avatar) that uid owns. Never throws —
   any backend failure degrades to the classic flow.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import {
  isSupabaseConfigured,
  ensureAnonSession,
  loadProfile,
  upsertProfile,
  recordResult,
  loadMyResults,
} from "../lib/supabase.js";
import { normalizeProfile } from "../lib/model.js";
import { loadJSON, saveJSON } from "../lib/storage.js";

const CACHE_KEY = "profile"; // last-known profile, for instant display + offline

export function useProfile() {
  const [configured] = useState(isSupabaseConfigured);
  const [ready, setReady] = useState(!isSupabaseConfigured); // unconfigured → ready at once
  const [profile, setProfile] = useState(null);
  const idRef = useRef(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    (async () => {
      // Show the cached profile immediately while the anon session resolves.
      const cached = normalizeProfile(await loadJSON(CACHE_KEY, null));
      if (cached && alive) setProfile(cached);
      const user = await ensureAnonSession();
      if (!alive) return;
      if (!user) return setReady(true); // sign-in failed → caller uses the classic flow
      idRef.current = user.id;
      const row = normalizeProfile(await loadProfile(user.id));
      if (!alive) return;
      if (row) {
        setProfile(row);
        saveJSON(CACHE_KEY, row);
      } else if (cached && cached.id !== user.id) {
        setProfile(null); // a stale cache from a different uid — ignore it
      }
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [configured]);

  /** Create or update this device's profile. Returns the saved profile or null. */
  const saveProfile = async (fields) => {
    if (!configured || !idRef.current) return null;
    const saved = normalizeProfile(await upsertProfile({ id: idRef.current, ...fields }));
    if (saved) {
      setProfile(saved);
      saveJSON(CACHE_KEY, saved);
    }
    return saved;
  };

  /** Write a finished-game result for this profile (Phase 3). `row` = summarizeForProfile + room_code. */
  const record = async (row) => {
    if (!configured || !idRef.current || !row) return false;
    return recordResult({ ...row, profile_id: idRef.current });
  };

  /** Load this profile's stored result rows (Phase 3). */
  const myResults = async () => (configured && idRef.current ? loadMyResults(idRef.current) : []);

  return {
    configured,
    ready,
    profile,
    profileId: profile?.id || idRef.current,
    saveProfile,
    recordResult: record,
    myResults,
  };
}
