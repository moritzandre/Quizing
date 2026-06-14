/* ====================================================================
   HINT MEDIA — render one hint-ladder hint by type
   --------------------------------------------------------------------
   A hint is either a plain string (text) or a typed object:
   { type: "image"|"audio"|"video"|"map", url|lat/lng/name }.
   Audio/video hints may carry an optional trim window { start, end }.
   ==================================================================== */

import { useRef } from "react";
import { ytId } from "../lib/model.js";
import YouTubePlayer from "./YouTubePlayer.jsx";
import LeafletMap from "./LeafletMap.jsx";

/** Native <video>/<audio> with a soft trim window enforced by currentTime gating. */
function TrimmedMedia({ kind, url, start, end, className }) {
  const ref = useRef(null);
  const onLoaded = () => {
    if (ref.current && start) ref.current.currentTime = start;
  };
  const onTime = () => {
    const el = ref.current;
    // Only honor `end` as a real out-point when it's past the start.
    if (el && end != null && end > (start || 0) && el.currentTime >= end) el.pause();
  };
  const props = {
    ref,
    src: url,
    controls: true,
    onLoadedMetadata: onLoaded,
    onTimeUpdate: onTime,
    className,
  };
  return kind === "video" ? <video {...props} /> : <audio {...props} />;
}

/**
 * @param {object} props
 * @param {string|object} props.hint The hint to render.
 */
export default function HintMedia({ hint }) {
  if (typeof hint === "string") return <p className="text-base md:text-lg">{hint}</p>;
  if (!hint || typeof hint !== "object") return null;

  if (hint.type === "image") {
    return hint.url ? (
      <img
        src={hint.url}
        alt="Hint"
        className="max-h-72 w-full rounded-xl border border-stone-200 bg-white object-contain dark:border-stone-700 dark:bg-stone-900"
      />
    ) : null;
  }

  if (hint.type === "video") {
    const vid = ytId(hint.url);
    return vid ? (
      <YouTubePlayer videoId={vid} start={hint.start} end={hint.end} />
    ) : hint.url ? (
      <TrimmedMedia
        kind="video"
        url={hint.url}
        start={hint.start}
        end={hint.end}
        className="w-full rounded-xl border border-stone-200 dark:border-stone-700"
      />
    ) : null;
  }

  if (hint.type === "audio") {
    const vid = ytId(hint.url);
    return vid ? (
      <YouTubePlayer videoId={vid} audioOnly start={hint.start} end={hint.end} />
    ) : hint.url ? (
      <TrimmedMedia kind="audio" url={hint.url} start={hint.start} end={hint.end} className="w-full" />
    ) : null;
  }

  if (hint.type === "map" && hint.lat != null && hint.lng != null) {
    return <LeafletMap answer={{ lat: hint.lat, lng: hint.lng, label: hint.name || "" }} className="h-64" />;
  }

  return null;
}
