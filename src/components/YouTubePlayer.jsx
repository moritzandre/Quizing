/* ====================================================================
   YOUTUBE PLAYER (chrome-free, custom controls)
   --------------------------------------------------------------------
   Wraps the YouTube IFrame Player API instead of a bare embed so the
   clip's TITLE never shows (it would give the answer away): native
   controls are off, the iframe is non-interactive, a strip masks the
   title region, and we render our own play/seek/mute controls. In
   audioOnly mode the video stays hidden behind an equalizer cover so
   only the sound plays.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Music, ExternalLink } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider.jsx";

/** Load the IFrame API once and resolve with the global YT namespace. */
let apiPromise = null;
function loadYouTubeAPI() {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === "function") prev();
      resolve(window.YT);
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onerror = () => reject(new Error("Could not load the YouTube player."));
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const fmt = (s) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/**
 * @param {object} props
 * @param {string} props.videoId YouTube video ID (validated by the caller).
 * @param {boolean} [props.audioOnly] Hide the video behind a cover; play sound only.
 * @param {number|null} [props.start] Trim: start playback at this second.
 * @param {number|null} [props.end] Trim: pause when playback reaches this second.
 * @param {{n:number,action:string}|null} [props.transport] Remote transport: when `n` changes, apply
 *   `action` (play | pause | restart). Lets the host drive playback from another screen (and a buzz pause).
 * @param {boolean} [props.controls] Show the built-in control bar (false = headless, transport-driven).
 */
export default function YouTubePlayer({
  videoId,
  audioOnly = false,
  start = null,
  end = null,
  transport = null,
  controls = true,
  volume = 100,
}) {
  const { t } = useI18n();
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const startRef = useRef(start);
  startRef.current = start;
  const endRef = useRef(end);
  endRef.current = end;
  const retriesRef = useRef(0); // one-shot recovery budget for onError (per source)
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState("unstarted"); // unstarted | playing | paused | ended
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let poll = null;
    const host = hostRef.current;
    retriesRef.current = 0; // fresh recovery budget whenever the source changes
    // YT.Player replaces its target element with an iframe, so give it a
    // disposable inner div (not the React-managed host) — this survives
    // StrictMode's mount→unmount→remount without detaching the host ref.
    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || !host) return;
        const inner = document.createElement("div");
        host.appendChild(inner);
        playerRef.current = new YT.Player(inner, {
          videoId,
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 1,
            playsinline: 1,
            ...(start ? { start: Math.floor(start) } : {}),
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              setReady(true);
              setDur(e.target.getDuration() || 0);
              // Start position is handled natively by playerVars.start — calling
              // seekTo() here too can leave the player stuck, so we don't.
              if (startRef.current) setCur(startRef.current);
              const f = e.target.getIframe();
              if (f) {
                f.style.position = "absolute";
                f.style.inset = "0";
                f.style.width = "100%";
                f.style.height = "100%";
                f.style.pointerEvents = "none";
              }
              poll = setInterval(() => {
                const p = playerRef.current;
                if (!p || typeof p.getCurrentTime !== "function") return;
                const now = p.getCurrentTime() || 0;
                setCur(now);
                setDur(p.getDuration() || 0);
                setMuted(typeof p.isMuted === "function" ? p.isMuted() : false);
                // Trim: stop at the out-point so only the chosen clip plays
                // (only when `end` is a real point past the start).
                const out = endRef.current;
                if (
                  out != null &&
                  out > (startRef.current || 0) &&
                  now >= out &&
                  window.YT?.PlayerState &&
                  typeof p.getPlayerState === "function" &&
                  p.getPlayerState() === window.YT.PlayerState.PLAYING
                ) {
                  p.pauseVideo();
                }
              }, 250);
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const YTP = window.YT.PlayerState;
              // Track the state so the cover logic can hide YouTube's title bar
              // (while paused) and its end-screen related-videos grid (on ended)
              // — both leak clip titles. BUFFERING keeps the previous state.
              if (e.data === YTP.PLAYING) setState("playing");
              else if (e.data === YTP.PAUSED) setState("paused");
              else if (e.data === YTP.ENDED) setState("ended");
              else if (e.data === YTP.UNSTARTED || e.data === YTP.CUED) setState("unstarted");
            },
            onError: () => {
              if (cancelled) return;
              // Recover once before giving up: a clip whose start point sits past
              // the video's end errors out, as do transient load glitches. Re-cue
              // the video from the beginning (dropping the start) — if it still
              // errors (e.g. embedding disabled by the uploader) we show the
              // fallback. This is the common case for music clips.
              const p = playerRef.current;
              if (retriesRef.current < 1 && p && typeof p.cueVideoById === "function") {
                retriesRef.current += 1;
                try {
                  p.cueVideoById({ videoId });
                  return;
                } catch {
                  /* fall through to the failed state */
                }
              }
              setFailed(true);
            },
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
      const p = playerRef.current;
      playerRef.current = null;
      if (p && typeof p.destroy === "function") {
        try {
          p.destroy();
        } catch {
          /* player already torn down */
        }
      }
      if (host) host.innerHTML = "";
    };
  }, [videoId, start]);

  // Remote transport: apply play / pause / restart whenever transport.n changes
  // (host driving from another screen, or a buzz auto-pause).
  useEffect(() => {
    if (!transport || !transport.n) return;
    const p = playerRef.current;
    if (!p) return;
    try {
      if (transport.action === "pause") p.pauseVideo();
      else if (transport.action === "play") p.playVideo();
      else if (transport.action === "restart") {
        p.seekTo(startRef.current || 0, true);
        p.playVideo();
      }
    } catch {
      /* player not ready */
    }
  }, [transport?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume (0-100), applied once the player is ready and whenever it changes.
  useEffect(() => {
    const p = playerRef.current;
    if (!p || typeof p.setVolume !== "function") return;
    try {
      p.setVolume(Math.max(0, Math.min(100, volume)));
      if (volume > 0 && typeof p.isMuted === "function" && p.isMuted() && typeof p.unMute === "function") p.unMute();
    } catch {
      /* player not ready */
    }
  }, [volume, ready]);

  const playing = state === "playing";
  // Seek-bar bounds: honor a trim window only when end is past start.
  const trimLo = start || 0;
  const trimHi = end && end > trimLo ? end : dur || 0;

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };
  const restart = () => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(startRef.current || 0, true);
    p.playVideo();
  };
  const toggleMute = () => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  };
  const seek = (e) => {
    const p = playerRef.current;
    if (!p) return;
    const t = +e.target.value;
    p.seekTo(t, true);
    setCur(t);
  };

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-300 px-6 text-center dark:border-stone-700">
        <p className="text-sm font-medium text-stone-500 dark:text-stone-400">{t("play.clipBlocked")}</p>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
        >
          <ExternalLink size={15} /> {t("play.openOnYoutube")}
        </a>
      </div>
    );
  }

  // Fully cover the frame before first play and after it ends (both show
  // YouTube thumbnails/related-videos with titles), and always in audio-only
  // mode. While paused, the frame stays visible but the title bar is masked.
  const fullCover = audioOnly || state === "unstarted" || state === "ended";

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-sm dark:border-stone-800">
      <div className="relative aspect-video w-full">
        <div ref={hostRef} className="absolute inset-0" />

        {/* Mask YouTube's title bar (top-left, shown for the first seconds of
            playback and can't be disabled) whenever the frame is visible. A
            solid-to-fade band sized to the player reliably hides it. */}
        {!fullCover && (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[24%] min-h-[64px]"
            style={{
              background: "linear-gradient(to bottom, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.96) 70%, transparent 100%)",
            }}
          />
        )}

        {/* full cover: audio-only equalizer, or a play/replay poster that hides the thumbnail + title */}
        {fullCover && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-900 text-white">
            {audioOnly ? (
              <>
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
                  <Music size={16} /> Audio only
                  {playing ? " — listen closely" : state === "ended" ? " — replay below" : ""}
                </div>
              </>
            ) : (
              <button
                onClick={togglePlay}
                disabled={!ready}
                aria-label={state === "ended" ? "Replay" : "Play"}
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                {state === "ended" ? <RotateCcw size={32} /> : <Play size={34} className="ml-1" fill="currentColor" />}
              </button>
            )}
          </div>
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
