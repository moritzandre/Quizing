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
import { uid, str } from "../lib/model.js";

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
  const [participants, setParticipants] = useState({}); // deviceId -> { name }
  const [buzz, setBuzz] = useState(null); // { deviceId, name } | null
  const [pins, setPins] = useState({}); // deviceId -> { lat, lng }

  const connRef = useRef(null);
  const phaseRef = useRef({ phase: "idle", qKey: null });
  const lockedRef = useRef(null);
  const participantsRef = useRef({});
  participantsRef.current = participants;

  const pushState = useCallback(() => {
    const conn = connRef.current;
    if (!conn) return;
    conn.publish(conn.topics.state, { ...phaseRef.current, lockedBy: lockedRef.current }, { retain: true });
  }, []);
  const pushStateRef = useRef(pushState);
  pushStateRef.current = pushState;

  const enable = useCallback(() => {
    if (connRef.current) return;
    const c = newRoomCode();
    setCode(c);
    setEnabled(true);
    setStatus("connecting");
    phaseRef.current = { phase: "idle", qKey: null };
    lockedRef.current = null;
    setParticipants({});
    setBuzz(null);
    setPins({});
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
          setParticipants((p) => ({ ...p, [msg.deviceId]: { name: str(msg.name) || "Player" } }));
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
        }
      },
    });
  }, []);

  const disable = useCallback(() => {
    const conn = connRef.current;
    if (conn) {
      conn.clearRetained(conn.topics.state);
      conn.close();
    }
    connRef.current = null;
    phaseRef.current = { phase: "idle", qKey: null };
    lockedRef.current = null;
    setEnabled(false);
    setCode(null);
    setStatus("idle");
    setParticipants({});
    setBuzz(null);
    setPins({});
  }, []);

  // Tear down on unmount — clear the retained state first so it doesn't strand phones.
  useEffect(
    () => () => {
      const c = connRef.current;
      if (c) {
        c.clearRetained(c.topics.state);
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
  const idle = useCallback(() => {
    phaseRef.current = { phase: "idle", qKey: null };
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
    enable,
    disable,
    arm,
    resetBuzz,
    collectPins,
    clearPins,
    idle,
  };
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
            ? { phase: str(msg.phase) || "idle", qKey: msg.qKey ?? null, lockedBy: msg.lockedBy ?? null }
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
    (n) => {
      const clean = str(n).trim() || "Player";
      setName(clean);
      send({ type: "join", name: clean });
    },
    [send],
  );
  const buzz = useCallback(() => send({ type: "buzz", name }), [send, name]);
  const sendPin = useCallback((lat, lng) => send({ type: "pin", lat, lng }), [send]);
  const leave = useCallback(() => send({ type: "leave" }), [send]);

  return { status, state, name, deviceId: id.current, join, buzz, sendPin, leave };
}
