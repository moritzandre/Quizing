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
import { PLAYER_COLORS, PLAYER_EMOJI } from "./ui.jsx";

/** Keep only a palette emoji/color from an (untrusted) phone join message. */
const safeEmoji = (e) => (typeof e === "string" && PLAYER_EMOJI.includes(e) ? e : null);
const safeColor = (c) => (typeof c === "string" && PLAYER_COLORS.includes(c) ? c : null);
// Accept a small inline avatar photo only (data: image, capped so the broker payload stays sane).
const safePhoto = (p) => (typeof p === "string" && /^data:image\//.test(p) && p.length <= 120000 ? p : null);

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
  const [command, setCommand] = useState(null); // { id, action, args } from a host-remote phone

  const connRef = useRef(null);
  const cmdIdRef = useRef(0);
  const phaseRef = useRef({ phase: "idle", qKey: null });
  const lockedRef = useRef(null);
  const scoresRef = useRef(null); // latest standings to mirror onto phones
  const participantsRef = useRef({});
  participantsRef.current = participants;

  const pushState = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    conn.publish(
      conn.topics.state,
      { ...phaseRef.current, lockedBy: lockedRef.current, ...(scoresRef.current ? { scores: scoresRef.current } : {}) },
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
        if (msg.type === "join") {
          setParticipants((p) => ({
            ...p,
            [msg.deviceId]: {
              name: str(msg.name) || "Player",
              teamId: msg.teamId ? str(msg.teamId) : null,
              emoji: safeEmoji(msg.emoji),
              color: safeColor(msg.color),
              photo: safePhoto(msg.photo),
              profileId: typeof msg.profileId === "string" ? msg.profileId : null,
            },
          }));
          pushStateRef.current();
        } else if (msg.type === "leave") {
          setParticipants((p) => {
            const n = { ...p };
            delete n[msg.deviceId];
            return n;
          });
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
          // A host-remote phone is driving the game; surface the command (with a
          // bumped id so repeated identical actions still re-fire on the host).
          cmdIdRef.current += 1;
          setCommand({
            id: cmdIdRef.current,
            action: msg.action,
            args: msg.args && typeof msg.args === "object" ? msg.args : {},
          });
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
    setEnabled(false);
    setCode(null);
    setStatus("idle");
    setParticipants({});
    setBuzz(null);
    setPins({});
    setAnswers({});
    setCommand(null);
    cmdIdRef.current = 0;
  }, []);

  // Tear down on unmount — clear retained topics first so they don't strand phones/TVs.
  useEffect(
    () => () => {
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
    command,
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
      onMessage: (_topic, msg) =>
        setState(
          msg && typeof msg === "object" && !Array.isArray(msg)
            ? {
                phase: str(msg.phase) || "idle",
                qKey: msg.qKey ?? null,
                lockedBy: msg.lockedBy ?? null,
                teams: Array.isArray(msg.teams) ? msg.teams : null,
                options: Array.isArray(msg.options) ? msg.options : null,
                scores: normalizePhoneScores(msg.scores),
              }
            : null,
        ),
    });
    connRef.current = conn;
    return () => conn.close();
  }, [validCode]);

  const send = useCallback((obj) => {
    const conn = connRef.current;
    if (conn) conn.publish(conn.topics.up, { ...obj, deviceId: id.current });
  }, []);

  const join = useCallback(
    (n, teamId, avatar, profileId = null) => {
      const clean = str(n).trim() || "Player";
      setName(clean);
      send({
        type: "join",
        name: clean,
        teamId: teamId || null,
        emoji: avatar?.emoji || null,
        color: avatar?.color || null,
        photo: avatar?.photo || null,
        profileId: profileId || null, // links this phone to a persistent player profile (optional)
      });
    },
    [send],
  );
  const buzz = useCallback(() => send({ type: "buzz", name }), [send, name]);
  const sendPin = useCallback((lat, lng) => send({ type: "pin", lat, lng }), [send]);
  const sendAnswer = useCallback((value) => send({ type: "answer", value }), [send]);
  const leave = useCallback(() => send({ type: "leave" }), [send]);

  return { status, state, name, deviceId: id.current, join, buzz, sendPin, sendAnswer, leave };
}
