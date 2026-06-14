/* ====================================================================
   SOUND EFFECTS (WebAudio, no asset files)
   --------------------------------------------------------------------
   Short synthesized cues for game moments, with a persisted mute.
   Framework-free; components call playSound(kind) and toggle via setMuted.
   ==================================================================== */

const MUTE_KEY = "quiznight.muted";

let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
})();

export const isMuted = () => muted;

export function setMuted(m) {
  muted = !!m;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let ctx = null;
function audioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!ctx) ctx = new Ctx();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

/** Schedule one tone. */
function tone(ac, { freq, start = 0, dur = 0.18, type = "sine", gain = 0.16 }) {
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SEQUENCES = {
  reveal: [
    { freq: 523, dur: 0.14 },
    { freq: 784, start: 0.1, dur: 0.22 },
  ],
  correct: [
    { freq: 523, dur: 0.12 },
    { freq: 659, start: 0.1, dur: 0.12 },
    { freq: 784, start: 0.2, dur: 0.26 },
  ],
  wrong: [
    { freq: 196, dur: 0.18, type: "square", gain: 0.12 },
    { freq: 147, start: 0.12, dur: 0.3, type: "square", gain: 0.12 },
  ],
  timeup: [
    { freq: 880, dur: 0.12, type: "square", gain: 0.12 },
    { freq: 880, start: 0.16, dur: 0.12, type: "square", gain: 0.12 },
    { freq: 880, start: 0.32, dur: 0.2, type: "square", gain: 0.12 },
  ],
  buzz: [{ freq: 880, dur: 0.3, type: "square", gain: 0.18 }],
  win: [
    { freq: 523, dur: 0.12 },
    { freq: 659, start: 0.12, dur: 0.12 },
    { freq: 784, start: 0.24, dur: 0.12 },
    { freq: 1047, start: 0.36, dur: 0.34 },
  ],
};

/**
 * Play a named cue. No-op when muted or WebAudio is unavailable.
 * @param {"reveal"|"correct"|"wrong"|"timeup"|"buzz"|"win"} kind
 */
export function playSound(kind) {
  if (muted) return;
  const seq = SEQUENCES[kind];
  if (!seq) return;
  try {
    const ac = audioCtx();
    if (!ac) return;
    seq.forEach((s) => tone(ac, s));
  } catch {
    /* audio unavailable */
  }
}
