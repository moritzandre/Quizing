/* ====================================================================
   SPOTIFY PLAYER (embed iFrame API, masked)
   --------------------------------------------------------------------
   Plays a Spotify track/episode for clips that YouTube blocks from
   embedding (common for music). The Spotify embed always loads, but it
   shows the title + cover — which would spoil the answer — so we cover it
   completely and drive playback through Spotify's iFrame API (play/pause/
   seek), rendering our own equalizer + controls on top. Note: without a
   Spotify Premium session in the browser only the ~30s preview plays, so
   the clip ladder runs over that preview.
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Music } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider.jsx";

const fmt = (s) => {
  if (!Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

/** Load the Spotify iFrame API once and resolve with the IFrameAPI namespace. */
let spotifyApiPromise = null;
function loadSpotifyAPI() {
  if (spotifyApiPromise) return spotifyApiPromise;
  spotifyApiPromise = new Promise((resolve, reject) => {
    if (window.SpotifyIframeApi) return resolve(window.SpotifyIframeApi);
    const prev = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.SpotifyIframeApi = IFrameAPI;
      if (typeof prev === "function") prev(IFrameAPI);
      resolve(IFrameAPI);
    };
    const tag = document.createElement("script");
    tag.src = "https://open.spotify.com/embed/iframe-api/v1";
    tag.async = true;
    tag.onerror = () => reject(new Error("Could not load the Spotify player."));
    document.head.appendChild(tag);
  });
  return spotifyApiPromise;
}

/**
 * @param {object} props
 * @param {string} props.uri Spotify URI (spotify:track:ID / spotify:episode:ID).
 * @param {number|null} [props.start] Trim: seek here on first play (seconds).
 * @param {number|null} [props.end] Trim: pause when playback reaches this second.
 * @param {{n:number,action:string}|null} [props.transport] Remote transport (play | pause | restart) on n change.
 * @param {boolean} [props.controls] Show the built-in control bar (false = headless, transport-driven).
 */
export default function SpotifyPlayer({ uri, start = null, end = null, transport = null, controls = true, volume = 100 }) {
  const { t } = useI18n();
  const hostRef = useRef(null);
  const ctrlRef = useRef(null);
  const startedRef = useRef(false);
  const startRef = useRef(start);
  startRef.current = start;
  const endRef = useRef(end);
  endRef.current = end;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  playingRef.current = playing;
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    startedRef.current = false;
    loadSpotifyAPI()
      .then((IFrameAPI) => {
        if (cancelled || !host) return;
        const inner = document.createElement("div");
        host.appendChild(inner);
        IFrameAPI.createController(inner, { uri, width: "100%", height: "100%" }, (ctrl) => {
          if (cancelled) {
            try {
              ctrl.destroy();
            } catch {
              /* already gone */
            }
            return;
          }
          ctrlRef.current = ctrl;
          setReady(true);
          ctrl.addListener("playback_update", (e) => {
            const d = (e && e.data) || {};
            setPlaying(!d.isPaused);
            setCur((d.position || 0) / 1000);
            setDur((d.duration || 0) / 1000);
            // Trim: stop at the out-point (only when end is a real point past start).
            const out = endRef.current;
            if (out != null && out > (startRef.current || 0) && !d.isPaused && (d.position || 0) / 1000 >= out) {
              try {
                ctrl.pause();
                setPlaying(false); // keep our state accurate even if no follow-up update fires
              } catch {
                /* ignore */
              }
            }
          });
        });
      })
      .catch(() => !cancelled && setFailed(true));

    return () => {
      cancelled = true;
      const c = ctrlRef.current;
      ctrlRef.current = null;
      if (c) {
        try {
          c.destroy();
        } catch {
          /* already gone */
        }
      }
      if (host) host.innerHTML = "";
    };
  }, [uri]);

  // Definitively start playback regardless of our cached state (which can be
  // stale after the end-poll auto-pause — that made Restart silently no-op).
  // play() is the idempotent Spotify-embed method; resume()/togglePlay() are
  // defensive fallbacks if a given embed build exposes a different surface.
  const playNow = (c) => {
    try {
      if (typeof c.play === "function") c.play();
      else if (typeof c.resume === "function") c.resume();
      else if (!playingRef.current) c.togglePlay();
    } catch {
      /* ignore */
    }
  };

  // Remote transport: apply play / pause / restart whenever transport.n changes
  // (host driving from another screen, or a buzz auto-pause).
  useEffect(() => {
    if (!transport || !transport.n) return;
    const c = ctrlRef.current;
    if (!c) return;
    try {
      if (transport.action === "pause") c.pause();
      else if (transport.action === "play") {
        if (startRef.current && !startedRef.current) c.seek(startRef.current);
        startedRef.current = true;
        playNow(c);
      } else if (transport.action === "restart") {
        startedRef.current = true;
        c.seek(startRef.current || 0);
        playNow(c);
      }
    } catch {
      /* not ready */
    }
  }, [transport?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume (0-100). Best-effort: the Spotify embed API may not expose setVolume,
  // in which case the volume follows the device — the slider is a no-op there.
  useEffect(() => {
    const c = ctrlRef.current;
    if (c && typeof c.setVolume === "function") {
      try {
        c.setVolume(Math.max(0, Math.min(1, volume / 100)));
      } catch {
        /* unsupported */
      }
    }
  }, [volume, ready]);

  const togglePlay = () => {
    const c = ctrlRef.current;
    if (!c) return;
    // On the very first play, jump to the clip's start point, then toggle.
    if (!playing && !startedRef.current) {
      startedRef.current = true;
      if (startRef.current) {
        try {
          c.seek(startRef.current);
        } catch {
          /* ignore */
        }
      }
    }
    try {
      c.togglePlay();
    } catch {
      /* ignore */
    }
  };
  const restart = () => {
    const c = ctrlRef.current;
    if (!c) return;
    try {
      c.seek(startRef.current || 0);
      playNow(c);
    } catch {
      /* ignore */
    }
  };

  if (failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 px-6 text-center text-sm font-medium text-stone-500 dark:border-stone-700 dark:text-stone-400">
        {t("play.spotifyFailed")}
      </div>
    );
  }

  const trimLo = start || 0;
  const trimHi = end && end > trimLo ? end : dur || 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-black shadow-sm dark:border-stone-800">
      <div className="relative aspect-video w-full">
        {/* The real Spotify embed lives here but is fully covered by the opaque
            cover below (it shows the title/cover, which would give the answer
            away). It stays rendered — never display:none — so audio keeps
            playing; opacity-0 + pointer-events-none + the cover hide it. */}
        <div ref={hostRef} className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stone-900 text-white">
          <div className="flex h-16 items-end gap-1.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`w-2.5 rounded-full bg-emerald-400 ${playing ? "qn-eq-bar" : ""}`}
                style={{ height: `${[28, 46, 64, 40, 24][i]}px`, animationDelay: `${i * 0.13}s` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm font-medium text-stone-300">
            <Music size={16} /> {t("play.spotifyClip")}
          </div>
        </div>
      </div>

      {/* custom control bar (hidden when transport-driven; Spotify chrome stays hidden behind the cover) */}
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
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${trimHi > 0 ? Math.min(100, (Math.max(0, cur - trimLo) / Math.max(0.01, trimHi - trimLo)) * 100) : 0}%` }}
            />
          </div>
          <span className="w-10 text-xs tabular-nums text-white/70">{fmt(trimHi)}</span>
        </div>
      )}
    </div>
  );
}
