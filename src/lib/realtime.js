/* ====================================================================
   REALTIME ROOM TRANSPORT
   --------------------------------------------------------------------
   Thin wrapper over MQTT-over-WebSocket against a free public broker, so
   players' phones can reach the host screen with no backend of our own.
   Framework-free (no React). Two topics per room:
     quiznight/<code>/state  host → phones, RETAINED (late joiners catch up)
     quiznight/<code>/up      phones → host (join / buzz / pin / leave)
   A short random room code in the topic is the only privacy boundary —
   fine for a living-room game, not for anything sensitive. mqtt is loaded
   dynamically so it stays out of the initial bundle until a room opens.
   ==================================================================== */

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
export function connectRoom({ code, subscribe = [], onMessage, onStatus, will }) {
  const topics = roomTopics(code);
  const clientId = `qn_${code}_${Math.random().toString(36).slice(2, 10)}`;
  let client = null;
  let closed = false;
  const queue = []; // publishes requested before mqtt finished loading/connecting

  const doPublish = (topic, payload, retain) => {
    try {
      client.publish(topic, payload, { qos: 0, retain });
    } catch {
      /* transient — ignore */
    }
  };

  import("mqtt")
    .then(({ default: mqtt }) => {
      if (closed) return;
      client = mqtt.connect(BROKER_URL, {
        clientId,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 3000,
        keepalive: 30,
        // The broker publishes this on an ungraceful disconnect (tab closed/crash),
        // so a stranded retained state self-heals to "cleared".
        ...(will ? { will: { topic: will.topic, payload: will.payload ?? "", qos: 0, retain: true } } : {}),
      });
      client.on("connect", () => {
        onStatus?.("connected");
        if (subscribe.length) client.subscribe(subscribe, { qos: 0 });
        while (queue.length) {
          const [topic, payload, retain] = queue.shift();
          doPublish(topic, payload, retain);
        }
      });
      client.on("reconnect", () => onStatus?.("connecting"));
      client.on("offline", () => onStatus?.("offline"));
      client.on("error", () => onStatus?.("error"));
      client.on("message", (topic, payload) => {
        const text = payload.toString();
        if (!text) return onMessage?.(topic, null); // empty body = cleared retained message (reset signal)
        let obj;
        try {
          obj = JSON.parse(text);
        } catch {
          return; // ignore non-JSON
        }
        onMessage?.(topic, obj);
      });
    })
    .catch(() => onStatus?.("error"));

  return {
    topics,
    publish(topic, obj, opts = {}) {
      const payload = JSON.stringify(obj);
      if (client && client.connected) doPublish(topic, payload, !!opts.retain);
      else queue.push([topic, payload, !!opts.retain]);
    },
    clearRetained(topic) {
      if (client) doPublish(topic, "", true);
    },
    close() {
      closed = true;
      try {
        client?.end(true);
      } catch {
        /* already closed */
      }
    },
  };
}
