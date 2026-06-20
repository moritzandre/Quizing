/* ====================================================================
   NATIVE MEDIA PLAYER (direct audio/video file URLs)
   --------------------------------------------------------------------
   Plays a direct .mp3/.mp4/… file via a native <audio>/<video> element —
   the most reliable clip source (no embedding restrictions, full precise
   control). Mirrors YouTubePlayer's API: start/end trim (the clip ladder's
   growing out-point), a buzz auto-pause signal, and the audio-only cover.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Music, ExternalLink } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider.jsx";

const fmt = (s) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * Reversed-audio playback for a direct file URL via the Web Audio API: fetch →
 * decodeAudioData → reverse each channel → play the trim window backwards through
 * an AudioBufferSourceNode. Honors the same start/end trim, transport and volume
 * contract as the forward player. Calls onFail (caller then falls back to normal
 * forward playback) if the file can't be fetched/decoded — e.g. a CORS-blocked
 * host. Reversing is audio-only, so it always shows the audio cover.
 */
function ReverseClip({ url, start, end, transport, controls, volume, onFail }) {
  const { t } = useI18n();
  const ctxRef = useRef(null);
  const bufRef = useRef(null); // the REVERSED AudioBuffer
  const gainRef = useRef(null);
  const srcRef = useRef(null);
  const fwdDurRef = useRef(0); // forward (== reversed) duration
  const posRef = useRef(0); // seconds already played within the window
  const startedAtRef = useRef(0); // ctx.currentTime when the current source started
  const stoppingRef = useRef(false); // distinguishes a manual stop from a natural end
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const startRef = useRef(start);
  startRef.current = start;
  const endRef = useRef(end);
  endRef.current = end;
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0); // forward-time position (descends hi → lo)

  // The forward trim window [lo, hi]; played backwards it runs hi → lo.
  const windowOf = () => {
    const dur = fwdDurRef.current || 0;
    const lo = Math.max(0, startRef.current || 0);
    const hi = endRef.current && endRef.current > lo ? Math.min(endRef.current, dur) : dur;
    return { dur, lo, hi, len: Math.max(0, hi - lo) };
  };

  // Lazy fetch + decode + reverse (once). Returns false (→ fallback) on failure.
  const ensure = async () => {
    if (bufRef.current) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) throw new Error("no-webaudio");
      const ctx = ctxRef.current || new Ctx();
      ctxRef.current = ctx;
      const arr = await fetch(url).then((r) => r.arrayBuffer());
      const decoded = await ctx.decodeAudioData(arr);
      const rev = ctx.createBuffer(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
      for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
        const s = decoded.getChannelData(ch);
        const d = rev.getChannelData(ch);
        for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i];
      }
      bufRef.current = rev;
      fwdDurRef.current = decoded.duration;
      const gain = ctx.createGain();
      gain.gain.value = muted ? 0 : Math.max(0, Math.min(1, volume / 100));
      gain.connect(ctx.destination);
      gainRef.current = gain;
      return true;
    } catch {
      failRef.current && failRef.current();
      return false;
    }
  };

  const stopSrc = () => {
    if (srcRef.current) {
      stoppingRef.current = true;
      try {
        srcRef.current.stop();
      } catch {
        /* already stopped */
      }
      try {
        srcRef.current.disconnect();
      } catch {
        /* */
      }
      srcRef.current = null;
      stoppingRef.current = false;
    }
  };

  const play = async () => {
    if (!(await ensure())) return;
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* needs a gesture */
      }
    }
    const { hi, len, dur } = windowOf();
    if (len <= 0) return;
    if (posRef.current >= len - 0.02) posRef.current = 0; // replay from the window start
    stopSrc();
    const node = ctx.createBufferSource();
    node.buffer = bufRef.current;
    node.connect(gainRef.current);
    node.onended = () => {
      if (stoppingRef.current) return; // manual stop, not the natural end
      posRef.current = len;
      setPlaying(false);
    };
    node.start(0, dur - hi + posRef.current, len - posRef.current); // reversed-buffer offset
    srcRef.current = node;
    startedAtRef.current = ctx.currentTime;
    setPlaying(true);
  };

  const pause = () => {
    const ctx = ctxRef.current;
    if (ctx && srcRef.current) {
      const { len } = windowOf();
      posRef.current = Math.min(len, posRef.current + (ctx.currentTime - startedAtRef.current));
      stopSrc();
    }
    setPlaying(false);
  };
  const restart = () => {
    posRef.current = 0;
    play();
  };
  const toggleMute = () =>
    setMuted((m) => {
      const nm = !m;
      if (gainRef.current) gainRef.current.gain.value = nm ? 0 : Math.max(0, Math.min(1, volume / 100));
      return nm;
    });

  // progress clock
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const ctx = ctxRef.current;
      const { lo, hi, len } = windowOf();
      let played = posRef.current;
      if (playing && ctx) played = Math.min(len, posRef.current + (ctx.currentTime - startedAtRef.current));
      setCur(Math.max(lo, hi - played));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  // remote transport (host / TV stage / buzz auto-pause)
  useEffect(() => {
    if (!transport || !transport.n) return;
    if (transport.action === "pause") pause();
    else if (transport.action === "play") play();
    else if (transport.action === "restart") restart();
  }, [transport?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (gainRef.current && !muted) gainRef.current.gain.value = Math.max(0, Math.min(1, volume / 100));
  }, [volume, muted]);

  // reset + tear down the audio graph when the source changes
  useEffect(() => {
    stopSrc();
    bufRef.current = null;
    posRef.current = 0;
    setPlaying(false);
    return () => {
      stopSrc();
      try {
        ctxRef.current && ctxRef.current.close();
      } catch {
        /* */
      }
      ctxRef.current = null;
    };
  }, [url]);

  const { lo, hi } = windowOf();
  const pct = hi > lo ? ((hi - cur) / (hi - lo)) * 100 : 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-sm dark:border-stone-800">
      <div className="relative aspect-video w-full">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-900 text-white">
          <div className="flex h-16 items-end gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-2.5 rounded-full bg-rose-400 ${playing ? "qn-eq-bar" : ""}`}
                style={{ height: `${[24, 40, 64, 46, 28][i]}px`, animationDelay: `${i * 0.13}s` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-stone-300">
            <Music size={16} /> {t("play.audioReversed")}
          </div>
        </div>
      </div>
      {controls && (
        <div className="flex items-center gap-3 bg-stone-900 px-4 py-3 text-white">
          <button
            onClick={() => (playing ? pause() : play())}
            aria-label={playing ? "Pause" : "Play"}
            className="text-white/90 transition hover:text-white"
          >
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button onClick={restart} aria-label="Restart" className="text-white/70 transition hover:text-white">
            <RotateCcw size={17} />
          </button>
          <span className="w-10 text-right text-xs tabular-nums text-white/70">{fmt(cur)}</span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div className="h-full bg-rose-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="w-10 text-xs tabular-nums text-white/70">{fmt(hi)}</span>
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            className="text-white/70 transition hover:text-white"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * @param {object} props
 * @param {string} props.url Direct media file URL.
 * @param {"audio"|"video"} [props.media] Element kind (from mediaSource).
 * @param {boolean} [props.audioOnly] Force the audio-only cover for a video file.
 * @param {number|null} [props.start] Trim: start playback at this second.
 * @param {number|null} [props.end] Trim: pause when playback reaches this second.
 * @param {{n:number,action:string}|null} [props.transport] Remote transport (play | pause | restart) on n change.
 * @param {boolean} [props.controls] Show the built-in control bar (false = headless, transport-driven).
 */
export default function NativeMediaPlayer({
  url,
  media = "audio",
  audioOnly = false,
  reverse = false,
  start = null,
  end = null,
  transport = null,
  controls = true,
  volume = 100,
}) {
  const { t } = useI18n();
  const ref = useRef(null);
  const [revFailed, setRevFailed] = useState(false); // reverse decode/fetch failed → forward fallback
  const startRef = useRef(start);
  startRef.current = start;
  const endRef = useRef(end);
  endRef.current = end;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const isVideo = media === "video" && !audioOnly;

  // Remote transport: apply play / pause / restart whenever transport.n changes
  // (host driving from another screen, or a buzz auto-pause).
  useEffect(() => {
    if (!transport || !transport.n) return;
    const el = ref.current;
    if (!el) return;
    try {
      if (transport.action === "pause") el.pause();
      else if (transport.action === "play") el.play();
      else if (transport.action === "restart") {
        el.currentTime = startRef.current || 0;
        el.play();
      }
    } catch {
      /* element not ready */
    }
  }, [transport?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume (0-100) → the element's 0..1 volume.
  useEffect(() => {
    const el = ref.current;
    if (el) {
      try {
        el.volume = Math.max(0, Math.min(1, volume / 100));
      } catch {
        /* not ready */
      }
    }
  }, [volume]);

  // Reset transient state + reload when the source changes — RoundBody (TV /
  // host remote) reuses this component across questions without remounting it.
  useEffect(() => {
    setReady(false);
    setFailed(false);
    setRevFailed(false);
    setPlaying(false);
    setEnded(false);
    setCur(startRef.current || 0);
    const el = ref.current;
    if (el) {
      try {
        el.load();
      } catch {
        /* ignore */
      }
    }
  }, [url]);

  const onLoaded = () => {
    const el = ref.current;
    if (!el) return;
    setReady(true);
    setDur(el.duration || 0);
    if (startRef.current != null) {
      try {
        el.currentTime = startRef.current;
      } catch {
        /* seek not allowed yet */
      }
      setCur(startRef.current);
    }
  };
  const onTime = () => {
    const el = ref.current;
    if (!el) return;
    const now = el.currentTime || 0;
    setCur(now);
    // Trim: stop at the out-point (only when end is a real point past the start).
    const out = endRef.current;
    if (out != null && out > (startRef.current || 0) && now >= out && !el.paused) el.pause();
  };

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      if (ended || (endRef.current && el.currentTime >= endRef.current)) el.currentTime = startRef.current || 0;
      el.play();
    } else el.pause();
  };
  const restart = () => {
    const el = ref.current;
    if (!el) return;
    el.currentTime = startRef.current || 0;
    el.play();
  };
  const toggleMute = () => {
    const el = ref.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
  };
  const seek = (e) => {
    const el = ref.current;
    if (!el) return;
    const v = +e.target.value;
    el.currentTime = v;
    setCur(v);
  };

  const trimLo = start || 0;
  const trimHi = end && end > trimLo ? end : dur || 0;

  // Reverse mode (file sources only): hand off to the Web Audio engine. If it
  // can't fetch/decode the file (CORS), it flips revFailed and we fall through
  // to normal forward playback below.
  if (reverse && !revFailed) {
    return (
      <ReverseClip
        url={url}
        start={start}
        end={end}
        transport={transport}
        controls={controls}
        volume={volume}
        onFail={() => setRevFailed(true)}
      />
    );
  }

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 text-center dark:border-stone-700">
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">{t("play.fileFailed")}</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          <ExternalLink size={15} /> {t("play.openLink")}
        </a>
      </div>
    );
  }

  const mediaProps = {
    ref,
    src: url,
    preload: "metadata",
    onLoadedMetadata: onLoaded,
    onTimeUpdate: onTime,
    onPlay: () => {
      setPlaying(true);
      setEnded(false);
    },
    onPause: () => setPlaying(false),
    onEnded: () => {
      setPlaying(false);
      setEnded(true);
    },
    onError: () => setFailed(true),
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-sm dark:border-stone-800">
      <div className="relative aspect-video w-full">
        {isVideo ? (
          <video {...mediaProps} playsInline className="absolute inset-0 h-full w-full bg-black" />
        ) : (
          <>
            {/* a media element drives the audio behind the cover. A <video> must
                stay in the render tree (display:none can stop video playback in
                some browsers), so it's rendered full-size and the opaque cover
                below hides it; <audio> has no visual, so display:none is fine. */}
            {media === "video" ? (
              <video {...mediaProps} playsInline className="absolute inset-0 h-full w-full bg-black" />
            ) : (
              <audio {...mediaProps} className="hidden" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-900 text-white">
              <div className="flex h-16 items-end gap-1.5" aria-hidden>
                {[0, 1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`w-2.5 rounded-full bg-rose-400 ${playing ? "qn-eq-bar" : ""}`}
                    style={{ height: `${[28, 46, 64, 40, 24][i]}px`, animationDelay: `${i * 0.13}s` }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-stone-300">
                <Music size={16} /> {t("play.audioClip")}
              </div>
            </div>
          </>
        )}
      </div>

      {/* custom control bar (hidden when transport-driven from another screen) */}
      {controls && (
        <div className="flex items-center gap-3 bg-stone-900 px-4 py-3 text-white">
          <button
            onClick={togglePlay}
            disabled={!ready}
            aria-label={playing ? "Pause" : "Play"}
            className="text-white/90 transition hover:text-white disabled:opacity-40"
          >
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <button
            onClick={restart}
            disabled={!ready}
            aria-label="Restart"
            className="text-white/70 transition hover:text-white disabled:opacity-40"
          >
            <RotateCcw size={17} />
          </button>
          <span className="w-10 text-right text-xs tabular-nums text-white/70">{fmt(cur)}</span>
          <input
            type="range"
            aria-label="Seek"
            min={trimLo}
            max={trimHi}
            step="any"
            value={Math.min(Math.max(cur, trimLo), trimHi)}
            onChange={seek}
            disabled={!ready}
            className="h-1 flex-1 cursor-pointer accent-rose-500"
          />
          <span className="w-10 text-xs tabular-nums text-white/70">{fmt(trimHi)}</span>
          <button
            onClick={toggleMute}
            disabled={!ready}
            aria-label={muted ? "Unmute" : "Mute"}
            className="text-white/70 transition hover:text-white disabled:opacity-40"
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
        </div>
      )}
    </div>
  );
}
