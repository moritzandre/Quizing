/* ====================================================================
   JOIN VIEW (phone) — pick/create a player, buzz, pin, answer, guess
   --------------------------------------------------------------------
   When the optional Supabase playerbase is configured, the pre-join step
   is a SHARED player picker (choose an existing player — entering a PIN if
   it's locked — or create one). Unconfigured, it's the classic type-a-name
   form. The in-game views (HUD/buzz/map/choice/number/leaderboard) are the
   same either way. Reconnects on reload; writes a stat row at game end.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import {
  Radio,
  Wifi,
  WifiOff,
  Check,
  MapPin,
  ListChecks,
  Hash,
  Loader2,
  X,
  Trophy,
  LogOut,
  Lock,
  Plus,
  BarChart3,
  ChevronLeft,
} from "lucide-react";
import { usePlayerRoom } from "./useRoom.js";
import { usePlayerbase } from "./usePlayerbase.js";
import { FOCUS, inputCls, Button, Avatar, AnimatedNumber, PLAYER_COLORS, PLAYER_SPRITES } from "./ui.jsx";
import { buildResultRow } from "../lib/model.js";
import { loadJSON, saveJSON, removeKey } from "../lib/storage.js";
import { playSound } from "../lib/sound.js";
import LeafletMap from "./LeafletMap.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

/** Stable small hash → spread default avatars so unconfigured phones still differ. */
const hashIdx = (s, n) => {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
};

/**
 * Standalone phone page reached via #/join/<code> (the host's QR).
 * @param {object} props
 * @param {string} props.code Room code from the URL.
 */
export default function JoinView({ code }) {
  const { t } = useI18n();
  const room = usePlayerRoom(code);
  const pb = usePlayerbase(); // optional shared playerbase (Supabase, gated)
  const [draftName, setDraftName] = useState("");
  const [teamId, setTeamId] = useState(null);
  const [pickedEmoji, setPickedEmoji] = useState(() => PLAYER_SPRITES[hashIdx(room.deviceId, PLAYER_SPRITES.length)]);
  const [pickedColor, setPickedColor] = useState(() => PLAYER_COLORS[hashIdx(room.deviceId, PLAYER_COLORS.length)]);
  const [joined, setJoined] = useState(false);
  const [lastJoin, setLastJoin] = useState(null); // cached join for reconnect-on-reload
  const [myPin, setMyPin] = useState(null);
  const [pinSent, setPinSent] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [answerSent, setAnswerSent] = useState(false);
  const [passInput, setPassInput] = useState(""); // room join passphrase the player types
  // playerbase pre-join flow
  const [reselect, setReselect] = useState(false); // show the picker even if a player is chosen
  const [creating, setCreating] = useState(false); // in the "new player" sub-form
  const [newPin, setNewPin] = useState(""); // optional PIN when creating
  const [createBusy, setCreateBusy] = useState(false); // awaiting the host's relayed creation
  const [guestNote, setGuestNote] = useState(false); // creation couldn't be saved → playing as guest
  const createTimerRef = useRef(null); // relay timeout (host offline / not admin)
  const pendingReqRef = useRef(null); // the reqId of the create we're awaiting
  const resolvedReqRef = useRef(null); // the reqId we've already finished (created or guest)
  const [pinFor, setPinFor] = useState(null); // a locked player awaiting its PIN
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [savedStats, setSavedStats] = useState(false);

  const phase = room.state?.phase || "idle";
  const qKey = room.state?.qKey;
  const lockedBy = room.state?.lockedBy || null;
  const teams = room.state?.teams || null;
  const options = room.state?.options || [];

  // Live standings mirrored from the host: find our own entity (by deviceId) to
  // show score + rank, and the sorted list for the between-questions leaderboard.
  const standings = room.state?.scores || [];
  const sorted = [...standings].sort((a, b) => b.score - a.score);
  const myEntity = standings.find((e) => (e.deviceIds || []).includes(room.deviceId)) || null;
  const myScore = myEntity ? myEntity.score : null;
  const myRank = myEntity ? sorted.findIndex((e) => e.id === myEntity.id) + 1 : null;

  // New question/round → clear our previous pin and answer.
  useEffect(() => {
    setMyPin(null);
    setPinSent(false);
    setAnswer(null);
    setAnswerSent(false);
  }, [qKey]);

  // Celebrate a points gain: float a "+N" and play a coin (or a climb if our rank
  // improved). Tracks the previous score/rank across renders.
  const prevRef = useRef({ score: null, rank: null });
  const gainKey = useRef(0);
  const [gain, setGain] = useState(null);
  useEffect(() => {
    if (myScore == null) return;
    const prev = prevRef.current;
    const climbed = prev.rank != null && myRank != null && myRank < prev.rank;
    if (prev.score != null && myScore > prev.score) {
      gainKey.current += 1;
      setGain({ delta: myScore - prev.score, key: gainKey.current });
      playSound(climbed ? "levelup" : "coin");
    }
    prevRef.current = { score: myScore, rank: myRank };
  }, [myScore, myRank]);

  // Tell the host we're gone when the tab/app closes, so the roster shrinks.
  const leaveRef = useRef(room.leave);
  leaveRef.current = room.leave;
  useEffect(() => {
    if (!joined) return;
    const onHide = () => leaveRef.current?.();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [joined]);

  // Remember the last successful join, so a reload can reconnect us silently.
  useEffect(() => {
    loadJSON("lastJoin", null).then((v) => v && setLastJoin(v));
  }, []);

  // Reconnect on reload: if we previously joined THIS room and it's still live,
  // rejoin silently with the saved identity (skip the picker). The persisted
  // deviceId re-links us to our existing scoring entity on the host side.
  const autoRef = useRef(false);
  useEffect(() => {
    if (autoRef.current || joined || !lastJoin || lastJoin.code !== code) return;
    if (!room.state) return; // wait for the host's retained state (= room alive)
    if (pb.configured && (!pb.ready || !pb.current)) return; // configured: need our chosen player loaded
    const teamsList = room.state.teams;
    if (teamsList && !(lastJoin.teamId && teamsList.some((tm) => tm.id === lastJoin.teamId))) return;
    autoRef.current = true;
    const cur = pb.configured ? pb.current : null;
    const name = (cur ? cur.name : lastJoin.name) || lastJoin.name || "";
    const av = cur ? { emoji: cur.emoji, color: cur.color } : { emoji: lastJoin.emoji, color: lastJoin.color };
    setDraftName(name);
    if (av.emoji) setPickedEmoji(av.emoji);
    if (av.color) setPickedColor(av.color);
    setTeamId(lastJoin.teamId || null);
    if (lastJoin.pass) setPassInput(lastJoin.pass); // so a re-prompt is prefilled if the pass changed
    room.join(name, lastJoin.teamId || null, teamsList ? null : av, cur ? cur.id : null, lastJoin.pass || null);
    setJoined(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.state, joined, lastJoin, pb.ready, pb.configured, pb.current, code]);

  // At game end, write this device's own stat row for its current player (once
  // per game). The phone has no `game` object — it builds the row from the
  // standings it mirrors + the host's end signal on the state topic.
  const recordedRef = useRef(null);
  useEffect(() => {
    if (!joined || !pb.configured) return;
    const st = room.state;
    if (!st?.ended || !st.gameId || recordedRef.current === st.gameId) return;
    const row = buildResultRow(st.scores || [], room.deviceId, {
      gameId: st.gameId,
      quizTitle: st.quizTitle,
      mode: st.mode,
      roomCode: code,
    });
    if (!row || !pb.currentId) return; // attribute to THIS phone's player (correct for teams too)
    recordedRef.current = st.gameId;
    pb.recordResult({ ...row, profile_id: pb.currentId }).then((ok) => ok && setSavedStats(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, pb.configured, pb.currentId, room.state, room.deviceId, code]);

  const iLocked = lockedBy && lockedBy === room.deviceId;
  const online = room.status === "connected";
  const needsTeam = !!teams;
  // Optional no-login join gate: the host set a passphrase; we must enter it.
  const needsPass = !!room.state?.needsPass;
  const admitted = (room.state?.admitted || []).includes(room.deviceId);
  const rejected = (room.state?.rejected || []).includes(room.deviceId);
  const canJoin = draftName.trim() && (!needsTeam || teamId) && (!needsPass || passInput.trim());

  const placePin = (lat, lng) => {
    setMyPin({ lat, lng });
    setPinSent(true);
    room.sendPin(lat, lng);
    playSound("select");
  };
  const pick = (value) => {
    setAnswer(value);
    setAnswerSent(true);
    room.sendAnswer(value);
    playSound("select");
  };
  const buzz = () => {
    room.buzz();
    playSound("buzz");
  };
  // Leave the room + forget the cached join. Configured ⇒ back to the picker.
  const switchPlayer = () => {
    removeKey("lastJoin");
    autoRef.current = false;
    recordedRef.current = null;
    setLastJoin(null);
    setSavedStats(false);
    room.leave();
    setJoined(false);
    if (pb.configured) setReselect(true);
  };

  // ---- playerbase pre-join handlers (configured only) ----
  const selectExisting = (player) => {
    if (player.locked && !pb.isUnlocked(player.id)) {
      setPinFor(player);
      setPinInput("");
      setPinError(false);
      return;
    }
    pb.select(player);
    setReselect(false);
  };
  const confirmPin = async () => {
    const ok = await pb.select(pinFor, pinInput);
    if (ok) {
      setPinFor(null);
      setReselect(false);
    } else setPinError(true);
  };
  // Become a freshly-created player (relayed through the host). Optionally lock
  // it with a PIN afterwards — that call goes straight to Supabase over TLS, so
  // the PIN never crosses the public broker.
  const finishCreated = async (id) => {
    pb.adopt(
      { id, name: draftName.trim(), emoji: pickedEmoji, color: pickedColor, locked: !!newPin },
      { unlock: true },
    );
    if (newPin && /^[0-9]{6,8}$/.test(newPin)) await pb.lockWithPin(id, newPin);
    setCreating(false);
    setReselect(false);
    setNewPin("");
    setCreateBusy(false);
  };
  // Creation couldn't be saved (host offline / not an admin / backend down) — never
  // block the join: play as a local guest (stats just won't be recorded).
  const finishGuest = () => {
    pb.adopt(
      {
        id: "guest-" + room.deviceId,
        name: draftName.trim() || "Player",
        emoji: pickedEmoji,
        color: pickedColor,
        locked: false,
      },
      { unlock: true },
    );
    setGuestNote(true);
    setCreating(false);
    setReselect(false);
    setCreateBusy(false);
  };
  // Players self-create exactly as before, but the actual DB write is RELAYED
  // through the admin-authed host (create_player is admin-only). The host replies
  // with the new id on the room state; a timeout falls back to a guest.
  const createNew = () => {
    if (!draftName.trim() || createBusy) return;
    setGuestNote(false);
    setCreateBusy(true);
    pendingReqRef.current = room.requestCreate({ name: draftName.trim(), emoji: pickedEmoji, color: pickedColor });
    resolvedReqRef.current = null;
    if (createTimerRef.current) clearTimeout(createTimerRef.current);
    // Backstop only: if no terminal reply arrives, play as a guest. Crucially we
    // do NOT mark the reqId resolved here, so a slow-but-successful relay that
    // lands AFTER the timeout can still upgrade the guest to the real profile
    // (as long as we haven't joined the game yet).
    createTimerRef.current = setTimeout(() => {
      createTimerRef.current = null;
      finishGuest();
    }, 8000);
  };

  // Resolve a relayed creation. The host only echoes a TERMINAL result back on
  // the state — a real { reqId, id } (success) or { reqId, failed:true }. A
  // transient null never arrives, so the only guest trigger is the timeout above
  // or an explicit failure; an unrelated state push can't bust us to guest.
  useEffect(() => {
    const c = room.created;
    if (!c || !c.reqId || c.reqId !== pendingReqRef.current) return;
    if (resolvedReqRef.current === c.reqId) return; // already handled this result
    if (c.id) {
      // Success. Adopt the real profile — even if the 8s timeout already dropped
      // us to a guest, upgrade as long as we haven't joined the game yet (so a
      // slow relay never strands an orphan DB row + a guest-only stat session).
      if (joined) return;
      resolvedReqRef.current = c.reqId;
      if (createTimerRef.current) {
        clearTimeout(createTimerRef.current);
        createTimerRef.current = null;
      }
      finishCreated(c.id);
    } else if (c.failed && createBusy) {
      // The host reported the create failed → guest now (don't wait out the timeout).
      resolvedReqRef.current = c.reqId;
      if (createTimerRef.current) {
        clearTimeout(createTimerRef.current);
        createTimerRef.current = null;
      }
      finishGuest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.created, createBusy, joined]);

  // Clear a pending relay timeout if the page unmounts mid-create (e.g. tapping
  // the #/me link) so finishGuest never fires on an unmounted component.
  useEffect(() => () => clearTimeout(createTimerRef.current), []);
  // Leave the "new player" sub-form, cancelling any in-flight relayed create.
  const cancelCreate = () => {
    clearTimeout(createTimerRef.current);
    createTimerRef.current = null;
    pendingReqRef.current = null; // a late relayed result for this create is now ignored
    setCreateBusy(false);
    setGuestNote(false);
    setCreating(false);
  };
  const pass = passInput.trim() || null;
  // Join as the chosen playerbase player.
  const joinAsCurrent = () => {
    const c = pb.current;
    if (!c || (needsTeam && !teamId) || (needsPass && !pass)) return;
    setDraftName(c.name);
    setPickedEmoji(c.emoji);
    setPickedColor(c.color);
    saveJSON("lastJoin", {
      code,
      name: c.name,
      teamId: needsTeam ? teamId : null,
      emoji: c.emoji,
      color: c.color,
      playerId: c.id,
      pass,
    });
    room.join(c.name, teamId, needsTeam ? null : { emoji: c.emoji, color: c.color }, c.id, pass);
    setJoined(true);
  };
  // Classic (unconfigured) join.
  const joinClassic = (e) => {
    e.preventDefault();
    if (!canJoin) return;
    saveJSON("lastJoin", {
      code,
      name: draftName.trim(),
      teamId: needsTeam ? teamId : null,
      emoji: pickedEmoji,
      color: pickedColor,
      pass,
    });
    room.join(draftName, teamId, needsTeam ? null : { emoji: pickedEmoji, color: pickedColor }, null, pass);
    setJoined(true);
  };
  // Re-send the join with the current passphrase (after a "wrong passphrase" reject).
  const retryPass = () => {
    if (!pass) return;
    const avatar = needsTeam ? null : { emoji: pickedEmoji, color: pickedColor };
    saveJSON("lastJoin", {
      code,
      name: room.name || draftName.trim(),
      teamId: needsTeam ? teamId : null,
      emoji: pickedEmoji,
      color: pickedColor,
      playerId: pb.configured ? pb.currentId : undefined,
      pass,
    });
    room.join(room.name || draftName.trim(), teamId, avatar, pb.configured ? pb.currentId : null, pass);
  };

  const letters = ["A", "B", "C", "D", "E", "F"];

  // ---- shared form fragments ----
  const avatarPicker = (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-3">
        <Avatar color={pickedColor} emoji={pickedEmoji} name={draftName} size={48} className="shadow-sm" />
        <p className="text-sm font-medium text-stone-600 dark:text-stone-300">{t("join.pickAvatar")}</p>
      </div>
      {/* pixel-character grid — each tile previews the sprite in the chosen colour */}
      <div className="flex flex-wrap gap-1.5">
        {PLAYER_SPRITES.map((key) => (
          <button
            type="button"
            key={key}
            onClick={() => setPickedEmoji(key)}
            aria-label={key}
            aria-pressed={pickedEmoji === key}
            className={`rounded-xl p-0.5 transition active:scale-90 ${FOCUS} ${
              pickedEmoji === key
                ? "bg-stone-900 ring-2 ring-stone-900 dark:bg-stone-100 dark:ring-stone-100"
                : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700"
            }`}
          >
            <Avatar color={pickedColor} emoji={key} name="" size={34} />
          </button>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {PLAYER_COLORS.map((c, i) => (
          <button
            type="button"
            key={c}
            onClick={() => setPickedColor(c)}
            aria-label={t("join.colorN", { n: i + 1 })}
            aria-pressed={pickedColor === c}
            style={{ backgroundColor: c }}
            className={`h-9 w-9 rounded-full transition active:scale-90 ${FOCUS} ${
              pickedColor === c
                ? "ring-2 ring-stone-900 ring-offset-2 ring-offset-white dark:ring-stone-100 dark:ring-offset-stone-950"
                : ""
            }`}
          />
        ))}
      </div>
    </div>
  );

  const teamPicker = (
    <div className="mt-4">
      <p className="mb-2 text-sm font-medium text-stone-600 dark:text-stone-300">{t("join.pickTeam")}</p>
      <div className="grid grid-cols-2 gap-2">
        {(teams || []).map((tm) => (
          <button
            type="button"
            key={tm.id}
            onClick={() => setTeamId(tm.id)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${FOCUS} ${
              teamId === tm.id
                ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
            }`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: tm.color || "#6366f1" }} />
            <span className="min-w-0 truncate">{tm.name}</span>
            {teamId === tm.id && <Check size={15} className="ml-auto shrink-0" />}
          </button>
        ))}
      </div>
    </div>
  );

  // optional room passphrase field (shown only when the host set one)
  const passField = needsPass && (
    <div className="mt-4">
      <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-stone-600 dark:text-stone-300">
        <Lock size={14} /> {t("join.passLabel")}
      </label>
      <input
        type="text"
        value={passInput}
        onChange={(e) => setPassInput(e.target.value)}
        placeholder={t("join.passPlaceholder")}
        className={`${inputCls} text-lg`}
      />
    </div>
  );

  // ---- the configured (playerbase) pre-join flow ----
  const renderPlayerbaseJoin = () => {
    if (pinFor) {
      return (
        <div className="flex flex-1 flex-col justify-center">
          <button
            onClick={() => setPinFor(null)}
            className={`mb-4 inline-flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-sm text-stone-500 ${FOCUS}`}
          >
            <ChevronLeft size={16} /> {t("playerbase.back")}
          </button>
          <div className="mb-4 flex items-center gap-3">
            <Avatar color={pinFor.color} emoji={pinFor.emoji} name={pinFor.name} size={44} />
            <h2 className="text-xl font-bold tracking-tight">{t("playerbase.enterPin", { name: pinFor.name })}</h2>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={8}
            autoFocus
            value={pinInput}
            onChange={(e) => {
              setPinInput(e.target.value.replace(/\D/g, ""));
              setPinError(false);
            }}
            className={`${inputCls} text-center font-pixel text-2xl tracking-[0.4em]`}
            placeholder="••••••"
          />
          {pinError && (
            <p className="mt-2 text-sm font-medium text-red-600 dark:text-red-400">{t("playerbase.wrongPin")}</p>
          )}
          <Button
            variant="accent"
            className="mt-4 w-full px-6 py-3.5 text-base"
            disabled={!pinInput}
            onClick={confirmPin}
          >
            <Lock size={16} /> {t("playerbase.unlock")}
          </Button>
        </div>
      );
    }

    if (pb.current && !reselect) {
      const c = pb.current;
      return (
        <div className="flex flex-1 flex-col justify-center">
          <div className="mb-2 flex items-center gap-2 text-stone-400">
            <Radio size={18} />
            <span className="text-sm font-medium uppercase tracking-wide">{t("join.joinRoom", { code })}</span>
          </div>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border-2 border-stone-200 bg-white/70 p-3 dark:border-stone-800 dark:bg-stone-900/60">
            <Avatar color={c.color} emoji={c.emoji} name={c.name} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400">
                {t("playerbase.playingAs")}
              </p>
              <p className="truncate text-lg font-bold">{c.name}</p>
            </div>
            <button
              onClick={() => setReselect(true)}
              className={`shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10 ${FOCUS}`}
            >
              {t("playerbase.change")}
            </button>
          </div>
          {guestNote && (
            <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {t("playerbase.guestFallback")}
            </p>
          )}
          {needsTeam && teamPicker}
          {passField}
          <Button
            variant="accent"
            className="mt-4 w-full px-6 py-3.5 text-base"
            disabled={(needsTeam && !teamId) || (needsPass && !passInput.trim())}
            onClick={joinAsCurrent}
          >
            {t("join.joinGame")}
          </Button>
        </div>
      );
    }

    if (creating || pb.players.length === 0) {
      return (
        <div className="flex flex-1 flex-col justify-center">
          {pb.players.length > 0 && (
            <button
              onClick={cancelCreate}
              className={`mb-3 inline-flex items-center gap-1 self-start rounded-lg px-2 py-1.5 text-sm text-stone-500 ${FOCUS}`}
            >
              <ChevronLeft size={16} /> {t("playerbase.back")}
            </button>
          )}
          <h2 className="mb-1 text-2xl font-bold tracking-tight">{t("playerbase.createTitle")}</h2>
          <input
            className={`${inputCls} text-lg`}
            placeholder={t("join.namePlaceholder")}
            value={draftName}
            autoFocus
            maxLength={24}
            onChange={(e) => setDraftName(e.target.value)}
          />
          {avatarPicker}
          <div className="mt-4">
            <p className="mb-1 text-sm font-medium text-stone-600 dark:text-stone-300">{t("playerbase.pinOptional")}</p>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
              className={`${inputCls} font-pixel tracking-[0.3em]`}
              placeholder={t("playerbase.pinPlaceholder")}
            />
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{t("playerbase.pinHint")}</p>
          </div>
          <Button
            variant="accent"
            className="mt-4 w-full px-6 py-3.5 text-base"
            disabled={!draftName.trim() || (!!newPin && !/^[0-9]{6,8}$/.test(newPin)) || !pb.ready || createBusy}
            onClick={createNew}
          >
            {createBusy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {t("playerbase.create")}
          </Button>
        </div>
      );
    }

    // directory of existing players
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex shrink-0 items-center gap-2 text-stone-400">
          <Radio size={18} />
          <span className="text-sm font-medium uppercase tracking-wide">{t("join.joinRoom", { code })}</span>
        </div>
        <h2 className="mb-4 shrink-0 text-2xl font-bold tracking-tight">{t("playerbase.whoPlaying")}</h2>
        <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto">
          {pb.players.map((p) => (
            <button
              key={p.id}
              onClick={() => selectExisting(p)}
              className={`flex items-center gap-2 rounded-xl border-2 border-stone-200 bg-white px-3 py-2.5 text-left transition active:scale-[.98] dark:border-stone-700 dark:bg-stone-900 ${FOCUS}`}
            >
              <Avatar color={p.color} emoji={p.emoji} name={p.name} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
              {p.locked && <Lock size={13} className="shrink-0 text-stone-400" />}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          className="mt-3 w-full shrink-0 px-6 py-3 text-base"
          onClick={() => {
            setDraftName("");
            setNewPin("");
            setCreating(true);
          }}
        >
          <Plus size={16} /> {t("playerbase.newPlayer")}
        </Button>
      </div>
    );
  };

  return (
    <div className="qn-app-bg flex h-[100dvh] flex-col overflow-hidden px-5 py-6 font-sans text-stone-900 antialiased dark:text-stone-100">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-pixel text-sm leading-tight text-stone-900 dark:text-stone-50">
            QUIZ<span className="text-indigo-600 dark:text-indigo-400"> NIGHT</span>
          </h1>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                online
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              }`}
            >
              {online ? <Wifi size={12} /> : <WifiOff size={12} />}
              {online ? t("join.connected") : t("join.connecting")}
            </span>
            {pb.configured && (
              <a
                href="#/me"
                aria-label={t("stats.title")}
                title={t("stats.title")}
                className={`rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 ${FOCUS}`}
              >
                <BarChart3 size={16} />
              </a>
            )}
            {joined && (
              <button
                onClick={switchPlayer}
                aria-label={t("profile.switch")}
                title={t("profile.switch")}
                className={`rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 ${FOCUS}`}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>

        {!joined ? (
          pb.configured ? (
            renderPlayerbaseJoin()
          ) : (
            <div className="flex flex-1 flex-col justify-center">
              <div className="mb-2 flex items-center gap-2 text-stone-400">
                <Radio size={18} />
                <span className="text-sm font-medium uppercase tracking-wide">{t("join.joinRoom", { code })}</span>
              </div>
              <h2 className="mb-4 text-3xl font-bold tracking-tight">{t("join.whatsYourName")}</h2>
              <form onSubmit={joinClassic}>
                <input
                  className={`${inputCls} text-lg`}
                  placeholder={t("join.namePlaceholder")}
                  value={draftName}
                  autoFocus
                  maxLength={24}
                  onChange={(e) => setDraftName(e.target.value)}
                />
                {!needsTeam && avatarPicker}
                {needsTeam && teamPicker}
                {passField}
                <Button
                  type="submit"
                  variant="accent"
                  className="mt-4 w-full px-6 py-3.5 text-base"
                  disabled={!canJoin}
                >
                  {t("join.joinGame")}
                </Button>
              </form>
            </div>
          )
        ) : needsPass && !admitted ? (
          // passphrase gate: we sent a join but the host hasn't admitted us yet
          // (wrong passphrase, or still checking). Let the player re-enter.
          <div className="flex flex-1 flex-col justify-center text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
              <Lock size={34} className={rejected ? "text-red-500" : "text-stone-400"} />
            </div>
            <p className="text-lg font-semibold">{rejected ? t("join.passWrong") : t("join.passChecking")}</p>
            <input
              type="text"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder={t("join.passPlaceholder")}
              className={`${inputCls} mt-4 text-center text-lg`}
            />
            <Button
              variant="accent"
              className="mt-3 w-full px-6 py-3.5 text-base"
              disabled={!passInput.trim()}
              onClick={retryPass}
            >
              {t("playerbase.unlock")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {/* persistent arcade HUD: avatar + name, plus live score + rank once
                the host has started scoring (a "+N" floats up on every gain) */}
            <div className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-stone-200 bg-white/70 px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-900/60">
              <Avatar
                color={myEntity?.color || pickedColor}
                emoji={needsTeam ? myEntity?.emoji : pickedEmoji}
                name={room.name}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800 dark:text-stone-100">{room.name}</p>
                <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  {t("join.score")}
                </p>
                {myScore != null ? (
                  <AnimatedNumber
                    value={myScore}
                    pop
                    className="font-pixel text-lg leading-tight text-stone-900 dark:text-stone-50"
                  />
                ) : (
                  <span className="font-pixel text-lg leading-tight text-stone-300 dark:text-stone-600">0</span>
                )}
              </div>
              {myRank != null && (
                <div className="shrink-0 text-right">
                  <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400 dark:text-stone-500">
                    {t("join.rank")}
                  </p>
                  <p className="font-pixel text-lg leading-tight text-indigo-600 dark:text-indigo-400">
                    {myRank}
                    <span className="text-[10px] text-stone-400">/{sorted.length}</span>
                  </p>
                </div>
              )}
              {gain && (
                <span
                  key={gain.key}
                  className="qn-float-up pointer-events-none absolute left-14 top-1.5 font-pixel text-sm text-emerald-500"
                >
                  +{gain.delta}
                </span>
              )}
            </div>

            {phase === "buzz" && (
              <div className="flex flex-1 flex-col items-center justify-center">
                {iLocked ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                      <Check size={56} />
                    </div>
                    <p className="text-2xl font-bold">{t("join.youreInFirst")}</p>
                    <p className="mt-1 text-stone-500 dark:text-stone-400">{t("join.answerOutLoud")}</p>
                  </div>
                ) : lockedBy ? (
                  <div className="text-center">
                    <p className="text-xl font-semibold text-stone-500 dark:text-stone-400">
                      {t("join.someoneBuzzed")}
                    </p>
                    <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">{t("join.waitNext")}</p>
                  </div>
                ) : (
                  <button
                    onClick={buzz}
                    className={`flex h-56 w-56 items-center justify-center rounded-full border-4 border-indigo-800 bg-indigo-600 font-pixel text-xl uppercase tracking-wider text-white shadow-[0_8px_0_0_#3730a3] transition hover:bg-indigo-500 active:translate-y-2 active:shadow-[0_2px_0_0_#3730a3] ${FOCUS} dark:border-indigo-300/40`}
                  >
                    <span className="qn-blink">{t("join.buzz")}</span>
                  </button>
                )}
              </div>
            )}

            {phase === "map" && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex shrink-0 items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <MapPin size={16} /> {t("join.tapMap")}
                </div>
                <div className="min-h-0 flex-1">
                  <LeafletMap
                    key={qKey}
                    answer={myPin ? { lat: myPin.lat, lng: myPin.lng, label: room.name } : undefined}
                    onPick={placePin}
                    className="h-full w-full"
                  />
                </div>
                <p
                  className={`mt-2 shrink-0 text-center text-sm ${pinSent ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}`}
                >
                  {pinSent ? t("join.pinSent") : t("join.noPin")}
                </p>
              </div>
            )}

            {phase === "choice" && (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <ListChecks size={16} /> {t("join.tapAnswer")}
                </div>
                <div className="grid gap-2.5">
                  {options.map((opt, oi) => {
                    const selected = answer === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => pick(oi)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-lg font-medium transition active:scale-[0.99] ${FOCUS} ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200"
                            : "border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-pixel text-xs ${
                            selected
                              ? "bg-indigo-600 text-white"
                              : "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-200"
                          }`}
                        >
                          {letters[oi]}
                        </span>
                        <span className="min-w-0 flex-1">{opt}</span>
                        {selected && <Check size={18} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <p
                  className={`mt-4 text-center text-sm ${answerSent ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}`}
                >
                  {answerSent ? t("join.submitted") : t("join.tapAnswer")}
                </p>
              </div>
            )}

            {phase === "number" && (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <Hash size={16} /> {t("join.enterNumber")}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = +answer;
                    if (answer === null || answer === "" || !Number.isFinite(v)) return;
                    pick(v);
                  }}
                >
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className={`${inputCls} text-center text-2xl font-bold`}
                    placeholder="0"
                    value={answer ?? ""}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setAnswerSent(false);
                    }}
                  />
                  <Button
                    type="submit"
                    variant="accent"
                    className="mt-4 w-full px-6 py-3.5 text-base"
                    disabled={answer === null || answer === "" || answerSent}
                  >
                    {answerSent ? t("join.submitted") : t("join.submit")}
                  </Button>
                </form>
              </div>
            )}

            {phase !== "buzz" &&
              phase !== "map" &&
              phase !== "choice" &&
              phase !== "number" &&
              (sorted.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-3 flex shrink-0 items-center justify-center gap-2 font-pixel text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
                    <Trophy size={14} className="text-amber-500" /> {t("join.leaderboard")}
                  </p>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                    {sorted.map((e, i) => {
                      const mine = myEntity && e.id === myEntity.id;
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 transition ${
                            mine
                              ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                              : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
                          }`}
                        >
                          <span
                            className={`w-6 shrink-0 text-center font-pixel text-xs ${
                              i === 0 ? "text-amber-500" : "text-stone-400 dark:text-stone-500"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <Avatar color={e.color} emoji={e.emoji} name={e.name} size={26} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                            {e.name}
                            {mine && <span className="ml-1 text-indigo-500">{t("join.youTag")}</span>}
                          </span>
                          <AnimatedNumber
                            value={e.score}
                            pop
                            className="shrink-0 font-pixel text-sm text-stone-700 dark:text-stone-200"
                          />
                        </div>
                      );
                    })}
                  </div>
                  {savedStats ? (
                    <a
                      href="#/me"
                      className="mt-3 inline-flex shrink-0 items-center justify-center gap-1 text-center text-xs font-medium text-indigo-600 dark:text-indigo-400"
                    >
                      <Check size={12} /> {t("stats.savedToStats")} · {t("stats.viewMine")}
                    </a>
                  ) : (
                    <p className="mt-3 shrink-0 text-center text-xs text-stone-400 dark:text-stone-500">
                      {t("join.watchScreen")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                    <Radio size={34} className="text-stone-400" />
                  </div>
                  <p className="text-lg font-semibold">{t("join.youreIn")}</p>
                  <p className="mt-1 text-stone-500 dark:text-stone-400">{t("join.watchScreen")}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
