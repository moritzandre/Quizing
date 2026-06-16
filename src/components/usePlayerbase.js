/* ====================================================================
   usePlayerbase — the shared, login-free player directory (optional)
   --------------------------------------------------------------------
   React binding over lib/supabase.js. When Supabase isn't configured,
   `configured` is false and `ready` is true immediately, so JoinView
   falls back to the classic type-a-name flow. When configured: lists the
   SHARED player directory, lets a device PICK an existing player (entering
   a numeric PIN if it's locked) or CREATE one, remembers the chosen player
   + which locked players this device has unlocked, and records results.
   Identity is decoupled from the (invisible) anonymous auth session.
   Never throws — any backend failure degrades to the classic flow.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import {
  isSupabaseConfigured,
  ensureAnonSession,
  listPlayers,
  createPlayer,
  verifyPin,
  setPin,
  recordResult,
  loadPlayerStats,
  loadGlobalLeaderboard,
} from "../lib/supabase.js";
import { normalizePlayers, normalizeProfile } from "../lib/model.js";
import { loadJSON, saveJSON } from "../lib/storage.js";

const PLAYER_KEY = "player"; // the player this device is currently being
const UNLOCKED_KEY = "unlocked"; // ids of locked players this device has unlocked

export function usePlayerbase() {
  const [configured] = useState(isSupabaseConfigured);
  const [ready, setReady] = useState(!isSupabaseConfigured); // unconfigured → ready at once
  const [players, setPlayers] = useState([]); // the shared directory
  const [current, setCurrent] = useState(null); // the player this device is being
  const unlockedRef = useRef(new Set());

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    (async () => {
      const cached = normalizeProfile(await loadJSON(PLAYER_KEY, null));
      if (cached && alive) setCurrent(cached);
      const cachedUnlocked = await loadJSON(UNLOCKED_KEY, []);
      if (Array.isArray(cachedUnlocked))
        unlockedRef.current = new Set(cachedUnlocked.filter((x) => typeof x === "string"));
      await ensureAnonSession();
      const list = normalizePlayers(await listPlayers());
      if (!alive) return;
      setPlayers(list);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [configured]);

  const persistUnlocked = () => saveJSON(UNLOCKED_KEY, [...unlockedRef.current]);

  /** Re-fetch the shared directory (e.g. after another device added a player). */
  const refresh = async () => {
    if (configured) setPlayers(normalizePlayers(await listPlayers()));
  };

  /**
   * Become an existing player. Locked players need the PIN the first time on
   * this device (then it's remembered). Returns true on success.
   */
  const select = async (player, pin) => {
    if (!player?.id) return false;
    if (player.locked && !unlockedRef.current.has(player.id)) {
      const ok = await verifyPin(player.id, pin);
      if (!ok) return false;
      unlockedRef.current.add(player.id);
      persistUnlocked();
    }
    const norm = normalizeProfile(player);
    setCurrent(norm);
    saveJSON(PLAYER_KEY, norm);
    return true;
  };

  /** Create a new shared player (optionally PIN-locked) and become it. */
  const create = async (fields) => {
    const row = normalizeProfile(await createPlayer(fields));
    if (!row) return null;
    if (fields?.pin) {
      // the creator is auto-unlocked on this device
      unlockedRef.current.add(row.id);
      persistUnlocked();
    }
    setPlayers((ps) => [...ps.filter((p) => p.id !== row.id), row]);
    setCurrent(row);
    saveJSON(PLAYER_KEY, row);
    return row;
  };

  /**
   * Become a player that was created elsewhere (e.g. relayed through the host
   * when the admin gate is on) — set + cache it WITHOUT calling the now
   * admin-only create_player RPC. Pass { unlock } to skip future PIN prompts.
   */
  const adopt = (profile, { unlock = false } = {}) => {
    const row = normalizeProfile(profile);
    if (!row) return null;
    if (unlock) {
      unlockedRef.current.add(row.id);
      persistUnlocked();
    }
    setPlayers((ps) => [...ps.filter((p) => p.id !== row.id), row]);
    setCurrent(row);
    saveJSON(PLAYER_KEY, row);
    return row;
  };

  /**
   * Lock a player with a numeric PIN AFTER creation, directly over TLS (so the
   * PIN never crosses the public broker). Auto-unlocks it on this device.
   */
  const lockWithPin = async (id, pin) => {
    if (!configured || !id || !pin) return false;
    const ok = await setPin(id, "", pin);
    if (ok) {
      unlockedRef.current.add(id);
      persistUnlocked();
    }
    return ok;
  };

  /** True if this device may use the player without a PIN prompt. */
  const isUnlocked = (id) => unlockedRef.current.has(id);

  /** Record a finished-game result for the current player. */
  const record = async (row) => (configured && row ? recordResult(row) : false);

  /** Stats for an explicit player id (defaults to the current one). */
  const statsFor = async (id) => {
    const pid = id || current?.id;
    return configured && pid ? loadPlayerStats(pid) : [];
  };
  const globalBoard = async () => (configured ? loadGlobalLeaderboard() : []);

  return {
    configured,
    ready,
    players,
    current,
    currentId: current?.id || null,
    select,
    create,
    adopt,
    lockWithPin,
    refresh,
    isUnlocked,
    recordResult: record,
    statsFor,
    globalBoard,
  };
}
