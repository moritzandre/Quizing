/* ====================================================================
   MEDIA PLAYER (source-aware clip dispatcher)
   --------------------------------------------------------------------
   One entry point for clip/video media: detects the source from the URL
   (YouTube / Spotify / direct audio-video file) and renders the matching
   player. Spotify and direct files dodge YouTube's "embedding disabled"
   wall (common for music). Every player honors the same contract: start/
   end trim (the clip ladder's growing out-point), audioOnly, and a buzz
   auto-pause signal — so the host, the TV and the host remote all behave
   the same regardless of source.
   ==================================================================== */

import { mediaSource } from "../lib/model.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import YouTubePlayer from "./YouTubePlayer.jsx";
import SpotifyPlayer from "./SpotifyPlayer.jsx";
import NativeMediaPlayer from "./NativeMediaPlayer.jsx";

/**
 * @param {object} props
 * @param {string} props.url YouTube / Spotify / direct-file URL.
 * @param {boolean} [props.audioOnly] Hide the video, play sound only (YouTube / file).
 * @param {number|null} [props.start] Clip start (seconds).
 * @param {number|null} [props.end] Clip out-point (seconds) — the ladder's current end.
 * @param {*} [props.pauseSignal] Changing to truthy pauses playback (e.g. first buzz).
 */
export default function MediaPlayer({ url, audioOnly = false, start = null, end = null, pauseSignal = null }) {
  const { t } = useI18n();
  const src = mediaSource(url);

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
        {t("play.noVideo")}
      </div>
    );
  }
  if (src.kind === "spotify") {
    return <SpotifyPlayer uri={src.uri} start={start} end={end} pauseSignal={pauseSignal} />;
  }
  if (src.kind === "file") {
    return (
      <NativeMediaPlayer
        url={src.url}
        media={src.media}
        audioOnly={audioOnly}
        start={start}
        end={end}
        pauseSignal={pauseSignal}
      />
    );
  }
  return <YouTubePlayer videoId={src.id} audioOnly={audioOnly} start={start} end={end} pauseSignal={pauseSignal} />;
}
