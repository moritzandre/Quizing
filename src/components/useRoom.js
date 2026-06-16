/* ====================================================================
   ROOM HOOKS (React bindings over lib/realtime)
   --------------------------------------------------------------------
   useHostRoom: the host owns the room, is the single arbiter of who
   buzzed first, and collects phone-placed map pins.
   usePlayerRoom: a phone joins a room, buzzes, and submits a pin.
   Player id === deviceId, so buzz/pin events map straight onto game
   players seeded from the room roster.
   ==================================================================== */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectRoom, roomTopics, newRoomCode } from "../lib/realtime.js";
import { uid, str, normalizePresent, normalizeLive, normalizeHostAux, normalizePhoneScores } from "../lib/model.js";
import { createPlayer, isSupabaseConfigured } from "../lib/supabase.js";
import { PLAYER_COLORS, PLAYER_SPRITES } from "./ui.jsx";

/** Keep only a palette sprite-key/color from an (untrusted) phone join message. */
const safeSprite = (e) => (typeof e === "string" && PLAYER_SPRITES.includes(e) ? e : null);
const safeColor = (c) => (typeof c === "string" && PLAYER_COLORS.includes(c) ? c : null);

const joinLink = (code) => `${window.location.origin}${window.location.pathname}#/join/${code}`;

/** Persisted per-device id so a phone keeps its identity across reloads. */
function deviceId() {
  try {
    let id = localStorage.getItem("quiznight.deviceId");
    if (!id) {
      id = uid();
      localStorage.setItem("quiznight.deviceId", id);
    }
    return id;
  } catch {
    return uid();
  }
}

/** Host-side room: roster, first-buzz arbitration, pin collection. */
export function useHostRoom() {
  const [enabled, setEnabled] = useState(false);
  const [code, setCode] = useState(null);
  const [status, setStatus] = useState("idle");
  const [participants, setParticipants] = useState({}); // deviceId -> { name, teamId }
  const [buzz, setBuzz] = useState(null); // { deviceId, name } | null
  const [pins, setPins] = useState({}); // deviceId -> { lat, lng }
  const [answers, setAnswers] = useState({}); // deviceId -> value (choice index / number)
  const [commands, setCommands] = useState([]); // FIFO of { id, action, args } from a host-remote phone

  const connRef = useRef(null);
  const cmdIdRef = useRef(0);
  const leaveTimersRef = useRef({}); // deviceId -> pending-leave timer (grace period vs reload races)
  const phaseRef = useRef({ phase: "idle", qKey: null });
  const lockedRef = useRef(null);
  const scoresRef = useRef(null); // latest standings to mirror onto phones
  const endInfoRef = useRef(null); // {gameId, quizTitle, mode} while the game is over, for phone stat-writing
  const roomPassRef = useRef(null); // optional join passphrase (host-set, never broadcast)
  const admittedRef = useRef(new Set()); // deviceIds that passed the passphrase
  const rejectedRef = useRef(new Set()); // deviceIds that sent a wrong passphrase
  const createdRef = useRef({}); // deviceId -> { reqId, id } | { reqId, id:null, failed:true } — RESOLVED relayed creates
  const inFlightCreatesRef = useRef({}); // deviceId -> reqId currently mid-create (NOT broadcast, idempotency only)
  const participantsRef = useRef({});
  participantsRef.current = participants;

  const pushState = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    conn.publish(
      conn.topics.state,
      {
        ...phaseRef.current,
        lockedBy: lockedRef.current,
        ...(scoresRef.current ? { scores: scoresRef.current } : {}),
        ...(endInfoRef.current ? { ended: true, ...endInfoRef.current } : {}),
        // never broadcast the passphrase itself — only that one is required, plus
        // which devices have been admitted/rejected (random deviceIds, not sensitive).
        ...(roomPassRef.current
          ? { needsPass: true, admitted: [...admittedRef.current], rejected: [...rejectedRef.current] }
          : {}),
        // results of relayed player-creation, keyed by the requesting deviceId
        // (just { reqId, id } — no PII; the PIN never travels through the broker).
        ...(Object.keys(createdRef.current).length ? { created: createdRef.current } : {}),
      },
      { retain: true },
    );
  }, []);
  const pushStateRef = useRef(pushState);
  pushStateRef.current = pushState;
  // Mirror the live standings onto phones (so each player sees their own score
  // + rank). Re-asserts the retained state with the latest scores attached.
  const pushScores = useCallback((standings) => {
    scoresRef.current = Array.isArray(standings) ? standings : null;
    pushStateRef.current();
  }, []);
  // Flag the game as over on the retained state so phones can write their own
  // stat row (they have no `game` object). Pass null when leaving the end stage.
  const setEnded = useCallback((meta) => {
    endInfoRef.current =
      meta && meta.gameId
        ? {
            gameId: String(meta.gameId),
            quizTitle: String(meta.quizTitle || ""),
            mode: meta.mode === "teams" ? "teams" : "solo",
          }
        : null;
    pushStateRef.current();
  }, []);
  // Set/clear the optional join passphrase (a no-login gate). Resets who's been
  // admitted/rejected so everyone (re)enters against the new value.
  const setRoomPass = useCallback((pass) => {
    const p = (pass || "").trim();
    roomPassRef.current = p || null;
    admittedRef.current = new Set();
    rejectedRef.current = new Set();
    // Setting a passphrase mid-lobby: nobody is admitted any more, so clear the
    // roster too. Otherwise already-joined phones would linger as phantom entities
    // (SetupView still seeds them, the host roster still lists them) even though
    // their buzz/pin/answer are now ignored and they must re-enter the passphrase.
    // They re-appear when they re-join with the correct pass. (Clearing the pass
    // leaves the roster intact — already-joined players stay.)
    if (p) setParticipants({});
    pushStateRef.current();
  }, []);

  // Stream the clean TV mirror: present = heavy/per-question, live = light/frequent.
  const pushPresent = useCallback((payload) => {
    const conn = connRef.current;
    if (conn) conn.publish(conn.topics.present, payload, { retain: true });
  }, []);
  const pushLive = useCallback((payload) => {
    const conn = connRef.current;
    if (conn) conn.publish(conn.topics.live, payload, { retain: true });
  }, []);
  // Host-only aux (e.g. the Who-Knows-More answer list) — only the host remote
  // subscribes to this topic, never the TV, so present/live stay leak-free.
  const pushHost = useCallback((payload) => {
    const conn = connRef.current;
    if (conn) conn.publish(conn.topics.host, payload, { retain: true });
  }, []);

  const enable = useCallback(() => {
    if (connRef.current) return;
    const c = newRoomCode();
    setCode(c);
    setEnabled(true);
    setStatus("connecting");
    phaseRef.current = { phase: "idle", qKey: null };
    lockedRef.current = null;
    scoresRef.current = null;
    endInfoRef.current = null;
    roomPassRef.current = null;
    admittedRef.current = new Set();
    rejectedRef.current = new Set();
    createdRef.current = {};
    inFlightCreatesRef.current = {};
    setParticipants({});
    setBuzz(null);
    setPins({});
    setAnswers({});
    connRef.current = connectRoom({
      code: c,
      subscribe: [roomTopics(c).up],
      // If the host tab closes ungracefully, the broker clears the retained
      // state so late/returning phones don't see a dead question.
      will: { topic: roomTopics(c).state, payload: "" },
      onStatus: (s) => {
        setStatus(s);
        if (s === "connected") pushStateRef.current(); // (re)assert retained state once connected
      },
      onMessage: (_topic, msg) => {
        if (!msg || !msg.deviceId) return;
        // Optional passphrase gate: ignore player actions from devices that
        // haven't been admitted (joined with the correct passphrase).
        if (
          roomPassRef.current &&
          !admittedRef.current.has(msg.deviceId) &&
          (msg.type === "buzz" || msg.type === "pin" || msg.type === "answer")
        )
          return;
        if (msg.type === "join") {
          // Passphrase check: a wrong passphrase is rejected — drop from admitted
          // AND from the roster, so a device that lost access (e.g. the host
          // changed the passphrase) can't linger and get seeded as an entity.
          if (roomPassRef.current && str(msg.pass) !== roomPassRef.current) {
            admittedRef.current.delete(msg.deviceId);
            rejectedRef.current.add(msg.deviceId);
            setParticipants((p) => {
              if (!(msg.deviceId in p)) return p;
              const n = { ...p };
              delete n[msg.deviceId];
              return n;
            });
            pushStateRef.current();
            return;
          }
          if (roomPassRef.current) {
            admittedRef.current.add(msg.deviceId);
            rejectedRef.current.delete(msg.deviceId);
          }
          // A re-join (e.g. reload) cancels a just-fired `leave` for this device,
          // so a stale pagehide `leave` arriving after the new `join` can't drop us.
          if (leaveTimersRef.current[msg.deviceId]) {
            clearTimeout(leaveTimersRef.current[msg.deviceId]);
            delete leaveTimersRef.current[msg.deviceId];
          }
          setParticipants((p) => ({
            ...p,
            [msg.deviceId]: {
              name: str(msg.name) || "Player",
              teamId: msg.teamId ? str(msg.teamId) : null,
              emoji: safeSprite(msg.emoji),
              color: safeColor(msg.color),
              profileId: typeof msg.profileId === "string" ? msg.profileId : null,
            },
          }));
          pushStateRef.current();
        } else if (msg.type === "leave") {
          // Defer removal: a reload fires `leave` then immediately re-`join`s, so
          // a short grace period lets the re-join cancel the removal (above).
          if (leaveTimersRef.current[msg.deviceId]) clearTimeout(leaveTimersRef.current[msg.deviceId]);
          leaveTimersRef.current[msg.deviceId] = setTimeout(() => {
            delete leaveTimersRef.current[msg.deviceId];
            setParticipants((p) => {
              const n = { ...p };
              delete n[msg.deviceId];
              return n;
            });
            pushStateRef.current();
          }, 3000);
        } else if (msg.type === "buzz") {
          // The host is the single arbiter — first message wins, no clock sync.
          if (phaseRef.current.phase === "buzz" && !lockedRef.current) {
            lockedRef.current = msg.deviceId;
            const name = participantsRef.current[msg.deviceId]?.name || str(msg.name) || "Player";
            setBuzz({ deviceId: msg.deviceId, name });
            pushStateRef.current();
          }
        } else if (
          msg.type === "pin" &&
          typeof msg.lat === "number" &&
          typeof msg.lng === "number" &&
          Number.isFinite(msg.lat) &&
          Number.isFinite(msg.lng)
        ) {
          setPins((p) => ({ ...p, [msg.deviceId]: { lat: msg.lat, lng: msg.lng } }));
        } else if (msg.type === "answer" && typeof msg.value !== "undefined") {
          setAnswers((a) => ({ ...a, [msg.deviceId]: msg.value }));
        } else if (msg.type === "ctrl" && typeof msg.action === "string") {
          // A host-remote phone is driving the game; APPEND to a FIFO (bumped id so
          // repeated identical actions still re-fire). A queue — not a single slot —
          // so two commands delivered in the same tick (e.g. coalesced WS frames)
          // are both applied in order rather than the first being overwritten/lost.
          cmdIdRef.current += 1;
          const cmd = {
            id: cmdIdRef.current,
            action: msg.action,
            args: msg.args && typeof msg.args === "object" ? msg.args : {},
          };
          setCommands((cs) => [...cs, cmd].slice(-50)); // bounded so it can't grow unbounded
        } else if (msg.type === "createPlayer" && isSupabaseConfigured) {
          // Relay player creation through the host. create_player is admin-only
          // server-side, so this only ever succeeds because the host is signed in
          // as an admin — i.e. players can self-create, but only inside a room an
          // admin is hosting. The PIN is intentionally NOT relayed (it would cross
          // the public broker); the phone sets it afterwards directly over TLS.
          const reqId = str(msg.reqId);
          const dev = msg.deviceId;
          const resolved = createdRef.current[dev];
          const inflight = inFlightCreatesRef.current[dev];
          // Idempotent: ignore a repeat/redelivered request for a reqId that's
          // already in flight or already resolved (MQTT can redeliver) so one
          // logical create never inserts twice. A new reqId from the same device
          // (a genuine re-create) is still honoured.
          if (reqId && inflight !== reqId && !(resolved && resolved.reqId === reqId)) {
            // Track the in-flight reqId in a NON-broadcast ref. We must NOT put a
            // placeholder { id: null } into the broadcast `createdRef` here: any
            // unrelated state push (another phone joining, a buzz, pushScores…)
            // during the Supabase round-trip would echo that null and make the
            // phone give up to guest mode prematurely. Only a TERMINAL result
            // (real id, or an explicit failure) is ever broadcast.
            inFlightCreatesRef.current = { ...inFlightCreatesRef.current, [dev]: reqId };
            const fields = {
              name: str(msg.name).trim() || "Player",
              emoji: safeSprite(msg.emoji),
              color: safeColor(msg.color),
            };
            const settle = (id) => {
              if (inFlightCreatesRef.current[dev] === reqId) {
                const n = { ...inFlightCreatesRef.current };
                delete n[dev];
                inFlightCreatesRef.current = n;
              }
              createdRef.current = {
                ...createdRef.current,
                [dev]: id ? { reqId, id } : { reqId, id: null, failed: true },
              };
              pushStateRef.current();
            };
            createPlayer(fields).then(
              (profile) => settle(profile?.id || null),
              () => settle(null),
            );
          }
        }
      },
    });
  }, []);

  const disable = useCallback(() => {
    const conn = connRef.current;
    if (conn) {
      conn.clearRetained(conn.topics.state);
      conn.clearRetained(conn.topics.present);
      conn.clearRetained(conn.topics.live);
      conn.clearRetained(conn.topics.host);
      conn.close();
    }
    connRef.current = null;
    phaseRef.current = { phase: "idle", qKey: null };
    lockedRef.current = null;
    scoresRef.current = null;
    endInfoRef.current = null;
    roomPassRef.current = null;
    admittedRef.current = new Set();
    rejectedRef.current = new Set();
    createdRef.current = {};
    inFlightCreatesRef.current = {};
    Object.values(leaveTimersRef.current).forEach(clearTimeout);
    leaveTimersRef.current = {};
    setEnabled(false);
    setCode(null);
    setStatus("idle");
    setParticipants({});
    setBuzz(null);
    setPins({});
    setAnswers({});
    setCommands([]);
    cmdIdRef.current = 0;
  }, []);

  // Tear down on unmount — clear retained topics first so they don't strand phones/TVs.
  useEffect(
    () => () => {
      Object.values(leaveTimersRef.current).forEach(clearTimeout);
      const c = connRef.current;
      if (c) {
        c.clearRetained(c.topics.state);
        c.clearRetained(c.topics.present);
        c.clearRetained(c.topics.live);
        c.clearRetained(c.topics.host);
        c.close();
      }
    },
    [],
  );

  const arm = useCallback(
    (qKey) => {
      phaseRef.current = { phase: "buzz", qKey };
      lockedRef.current = null;
      setBuzz(null);
      pushState();
    },
    [pushState],
  );
  const resetBuzz = useCallback(() => {
    lockedRef.current = null;
    setBuzz(null);
    pushState();
  }, [pushState]);
  const collectPins = useCallback(
    (qKey) => {
      phaseRef.current = { phase: "map", qKey };
      setPins({});
      pushState();
    },
    [pushState],
  );
  const clearPins = useCallback(() => setPins({}), []);
  // Collect typed phone answers (choice index / number); `opts` may carry the
  // phase ("choice"|"number") and the option labels phones should render.
  const collectAnswers = useCallback(
    (qKey, opts = {}) => {
      phaseRef.current = { phase: opts.phase || "choice", qKey, options: opts.options || null };
      setAnswers({});
      pushState();
    },
    [pushState],
  );
  // Publish the lobby (optionally with a team list phones can pick from).
  const lobby = useCallback(
    (teams) => {
      phaseRef.current = { phase: "idle", qKey: null, teams: teams || null };
      pushState();
    },
    [pushState],
  );
  const idle = useCallback(() => {
    phaseRef.current = { phase: "idle", qKey: null, teams: phaseRef.current.teams || null };
    lockedRef.current = null;
    setBuzz(null);
    pushState();
  }, [pushState]);

  return {
    enabled,
    code,
    link: code ? joinLink(code) : "",
    status,
    participants,
    buzz,
    pins,
    answers,
    commands,
    enable,
    disable,
    arm,
    resetBuzz,
    collectPins,
    clearPins,
    collectAnswers,
    lobby,
    idle,
    pushPresent,
    pushLive,
    pushHost,
    pushScores,
    setEnded,
    setRoomPass,
  };
}

/**
 * TV-side room: read-only mirror of the host for #/present/<code>. Subscribes to
 * the present (heavy) + live (light) topics and the lean state topic — the
 * latter clearing (empty body) signals the host left, so the TV can wait.
 * All payloads are validated; the broker is never trusted.
 */
export function usePresenterRoom(code, opts = {}) {
  const isHost = !!opts.host;
  const [status, setStatus] = useState("connecting");
  const [present, setPresent] = useState(null);
  const [live, setLive] = useState(null);
  const [alive, setAlive] = useState(true);
  const [hostAux, setHostAux] = useState(null); // host-remote only (whoknows answer list, …)
  const connRef = useRef(null);
  const id = useRef(deviceId());

  const validCode = typeof code === "string" && /^[A-Za-z0-9]{3,12}$/.test(code) ? code : null;

  useEffect(() => {
    if (!validCode) {
      setStatus("error");
      return;
    }
    const topics = roomTopics(validCode);
    // The host remote also reads the host-only topic (reveal aids the TV never sees).
    const subscribe = isHost
      ? [topics.present, topics.live, topics.state, topics.host]
      : [topics.present, topics.live, topics.state];
    const conn = connectRoom({
      code: validCode,
      subscribe,
      onStatus: setStatus,
      onMessage: (topic, msg) => {
        if (topic === topics.present) setPresent(msg ? normalizePresent(msg) : null);
        else if (topic === topics.live) setLive(msg ? normalizeLive(msg) : null);
        else if (topic === topics.state)
          setAlive(!!msg); // empty retained body = host gone
        else if (topic === topics.host) setHostAux(msg ? normalizeHostAux(msg) : null);
      },
    });
    connRef.current = conn;
    return () => conn.close();
  }, [validCode, isHost]);

  // Host-remote: send a control command up to the host (ignored by the TV view).
  const sendCtrl = useCallback((action, args) => {
    const conn = connRef.current;
    if (conn && typeof action === "string")
      conn.publish(conn.topics.up, { type: "ctrl", action, args: args || {}, deviceId: id.current });
  }, []);

  return { status, present, live, alive, hostAux, sendCtrl };
}

/** Phone-side room: join, buzz, submit a pin; mirrors the host's state. */
export function usePlayerRoom(code) {
  const [status, setStatus] = useState("connecting");
  const [state, setState] = useState(null); // { phase, qKey, lockedBy }
  const [name, setName] = useState("");
  const [created, setCreated] = useState(null); // relayed player-creation result { reqId, id } | null
  const pendingCreateRef = useRef(null); // reqId we're awaiting back from the host
  const connRef = useRef(null);
  const id = useRef(deviceId());

  // A room code is used as an MQTT topic segment — only allow the safe alphabet.
  const validCode = typeof code === "string" && /^[A-Za-z0-9]{3,12}$/.test(code) ? code : null;

  useEffect(() => {
    if (!validCode) {
      setStatus("error");
      return;
    }
    const conn = connectRoom({
      code: validCode,
      subscribe: [roomTopics(validCode).state],
      onStatus: setStatus,
      // null = cleared retained state (host left) → fall back to the lobby screen.
      onMessage: (_topic, msg) => {
        const obj = msg && typeof msg === "object" && !Array.isArray(msg) ? msg : null;
        setState(
          obj
            ? {
                phase: str(obj.phase) || "idle",
                qKey: obj.qKey ?? null,
                lockedBy: obj.lockedBy ?? null,
                teams: Array.isArray(obj.teams) ? obj.teams : null,
                options: Array.isArray(obj.options) ? obj.options : null,
                scores: normalizePhoneScores(obj.scores),
                ended: !!obj.ended,
                gameId: str(obj.gameId),
                quizTitle: str(obj.quizTitle),
                mode: obj.mode === "teams" ? "teams" : "solo",
                needsPass: !!obj.needsPass,
                admitted: Array.isArray(obj.admitted) ? obj.admitted.map(str) : [],
                rejected: Array.isArray(obj.rejected) ? obj.rejected.map(str) : [],
              }
            : null,
        );
        // relayed player-creation result addressed to THIS device (matched by reqId).
        // The host only ever broadcasts a TERMINAL result — a real id, or an
        // explicit { failed:true } — so this never fires mid-flight.
        const mine = obj && obj.created ? obj.created[id.current] : null;
        if (
          mine &&
          typeof mine === "object" &&
          pendingCreateRef.current &&
          str(mine.reqId) === pendingCreateRef.current
        )
          setCreated({
            reqId: pendingCreateRef.current,
            id: typeof mine.id === "string" ? mine.id : null,
            failed: !!mine.failed,
          });
      },
    });
    connRef.current = conn;
    return () => conn.close();
  }, [validCode]);

  const send = useCallback((obj) => {
    const conn = connRef.current;
    if (conn) conn.publish(conn.topics.up, { ...obj, deviceId: id.current });
  }, []);

  const join = useCallback(
    (n, teamId, avatar, profileId = null, pass = null) => {
      const clean = str(n).trim() || "Player";
      setName(clean);
      send({
        type: "join",
        name: clean,
        teamId: teamId || null,
        emoji: avatar?.emoji || null,
        color: avatar?.color || null,
        profileId: profileId || null, // links this phone to a persistent player profile (optional)
        pass: pass || null, // optional room passphrase (no-login join gate)
      });
    },
    [send],
  );
  const buzz = useCallback(() => send({ type: "buzz", name }), [send, name]);
  const sendPin = useCallback((lat, lng) => send({ type: "pin", lat, lng }), [send]);
  const sendAnswer = useCallback((value) => send({ type: "answer", value }), [send]);
  const leave = useCallback(() => send({ type: "leave" }), [send]);

  // Ask the (admin-authed) host to create a player on our behalf — the only path
  // that can create a profile when the admin gate is on. The PIN is set later,
  // directly over TLS, never here (the broker is public). Returns the reqId.
  const requestCreate = useCallback(
    (fields) => {
      const reqId = uid();
      pendingCreateRef.current = reqId;
      setCreated(null);
      send({
        type: "createPlayer",
        reqId,
        name: fields?.name || "",
        emoji: fields?.emoji || null,
        color: fields?.color || null,
      });
      return reqId;
    },
    [send],
  );

  return { status, state, name, deviceId: id.current, created, join, buzz, sendPin, sendAnswer, leave, requestCreate };
}
