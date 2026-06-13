/* ====================================================================
   REALTIME ROOM TRANSPORT
   --------------------------------------------------------------------
   Thin wrapper over MQTT-over-WebSocket against a free public broker, so
   players' phones can reach the host screen with no backend of our own.
   Framework-free (no React). Two topics per room:
     quiznight/<code>/state  host → phones, RETAINED (late joiners catch up)
     quiznight/<code>/up      phones → host (join / buzz / pin / leave)
   A short random room code in the topic is the only privacy boundary —
   fine for a living-room game, not for anything sensitive.
   ==================================================================== */

import mqtt from "mqtt";

/** Public broker (WSS). No account; uptime/privacy are best-effort. */
export const BROKER_URL = "wss://broker.emqx.io:8084/mqtt";
const TOPIC_ROOT = "quiznight";

/** Topic pair for a room code. */
export function roomTopics(code) {
  return { state: `${TOPIC_ROOT}/${code}/state`, up: `${TOPIC_ROOT}/${code}/up` };
}

/** Generate a short, unambiguous room code (no 0/O/1/I/L). */
export function newRoomCode() {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/**
 * Connect to the broker and subscribe to topics. JSON messages are delivered
 * to onMessage(topic, obj); connection lifecycle to onStatus(status).
 * @returns {{ topics: object, publish: Function, clearRetained: Function, close: Function }}
 */
export function connectRoom({ code, subscribe = [], onMessage, onStatus }) {
  const topics = roomTopics(code);
  const clientId = `qn_${code}_${Math.random().toString(36).slice(2, 10)}`;
  const client = mqtt.connect(BROKER_URL, {
    clientId,
    clean: true,
    connectTimeout: 8000,
    reconnectPeriod: 3000,
    keepalive: 30,
  });

  client.on("connect", () => {
    onStatus?.("connected");
    if (subscribe.length) client.subscribe(subscribe, { qos: 0 });
  });
  client.on("reconnect", () => onStatus?.("connecting"));
  client.on("offline", () => onStatus?.("offline"));
  client.on("error", () => onStatus?.("error"));
  client.on("message", (topic, payload) => {
    const text = payload.toString();
    if (!text) return; // empty body = cleared retained message
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      return; // ignore non-JSON
    }
    onMessage?.(topic, obj);
  });

  return {
    topics,
    publish(topic, obj, opts = {}) {
      try {
        client.publish(topic, JSON.stringify(obj), { qos: 0, retain: !!opts.retain });
      } catch {
        /* not connected yet — caller will re-publish on next state change */
      }
    },
    clearRetained(topic) {
      try {
        client.publish(topic, "", { qos: 0, retain: true });
      } catch {
        /* ignore */
      }
    },
    close() {
      try {
        client.end(true);
      } catch {
        /* already closed */
      }
    },
  };
}
