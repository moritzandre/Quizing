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
  start = null,
  end = null,
  transport = null,
  controls = true,
  volume = 100,
}) {
  const { t } = useI18n();
  const ref = useRef(null);
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
