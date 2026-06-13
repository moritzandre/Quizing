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
import { Play, Pause, RotateCcw, Volume2, VolumeX, Music } from "lucide-react";

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
 */
export default function YouTubePlayer({ videoId, audioOnly = false }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let poll = null;
    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        playerRef.current = new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 1,
            playsinline: 1,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              setReady(true);
              setDur(e.target.getDuration() || 0);
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
                setCur(p.getCurrentTime() || 0);
                setDur(p.getDuration() || 0);
                setMuted(typeof p.isMuted === "function" ? p.isMuted() : false);
              }, 250);
            },
            onStateChange: (e) => {
              if (cancelled) return;
              const YTP = window.YT.PlayerState;
              if (e.data === YTP.PLAYING) {
                setPlaying(true);
                setStarted(true);
              } else if (e.data === YTP.PAUSED || e.data === YTP.ENDED) {
                setPlaying(false);
              }
            },
            onError: () => !cancelled && setFailed(true),
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
    };
  }, [videoId]);

  const togglePlay = () => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  };
  const restart = () => {
    const p = playerRef.current;
    if (!p) return;
    p.seekTo(0, true);
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
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
        Couldn't load the clip
      </div>
    );
  }

  const coverVideo = audioOnly || !started;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-sm dark:border-stone-800">
      <div className="relative aspect-video w-full">
        <div ref={hostRef} className="absolute inset-0" />

        {/* mask the title strip whenever the video frame is visible but not playing */}
        {!coverVideo && !playing && (
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
        )}

        {/* full cover: pre-start poster (hides thumbnail + title) or audio-only mode */}
        {coverVideo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-900 text-white">
            {audioOnly ? (
              <>
                <div className="flex items-end gap-1.5" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`w-2.5 rounded-full bg-rose-400 ${playing ? "animate-pulse" : ""}`}
                      style={{ height: `${[28, 46, 64, 40, 24][i]}px`, animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-stone-300">
                  <Music size={16} /> Audio only — listen closely
                </div>
              </>
            ) : (
              <button
                onClick={togglePlay}
                disabled={!ready}
                aria-label="Play"
                className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 text-stone-900 shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-40"
              >
                <Play size={34} className="ml-1" fill="currentColor" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* custom control bar */}
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
          min={0}
          max={dur || 0}
          step="any"
          value={Math.min(cur, dur || 0)}
          onChange={seek}
          disabled={!ready}
          className="h-1 flex-1 cursor-pointer accent-rose-500"
        />
        <span className="w-10 text-xs tabular-nums text-white/70">{fmt(dur)}</span>
        <button
          onClick={toggleMute}
          disabled={!ready}
          aria-label={muted ? "Unmute" : "Mute"}
          className="text-white/70 transition hover:text-white disabled:opacity-40"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
