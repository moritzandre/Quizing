/* ====================================================================
   ROUND BODY — read-only round renderer for the TV presenter
   --------------------------------------------------------------------
   Renders the clean, audience-facing view of the current question from the
   streamed present/live payload (see lib/model buildPresentQ / buildLive).
   It is purely presentational: no controls, no awarding, and — crucially —
   no map pins (guess coordinates are never sent until reveal). Reuses the
   pure media children (MorphImage / FusionImage / HintMedia / YouTubePlayer
   / LeafletMap). The host screen keeps its own interactive rendering.
   ==================================================================== */

import { ytId, hintHasContent, mapillaryEmbedUrl, clipEnd } from "../lib/model.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { Check, Target } from "lucide-react";
import MorphImage from "./MorphImage.jsx";
import FusionImage from "./FusionImage.jsx";
import HintMedia from "./HintMedia.jsx";
import YouTubePlayer from "./YouTubePlayer.jsx";
import LeafletMap from "./LeafletMap.jsx";
import MapillaryEmbed from "./MapillaryEmbed.jsx";

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const answerCls = "qn-pop qn-answer mt-6 text-3xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl";

/** Question heading (module-scope so it reconciles by type, not remounts per live update). */
const Q = ({ children }) => (
  <h2 className="mx-auto max-w-3xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{children}</h2>
);

/**
 * @param {object} props
 * @param {string} props.type Round type.
 * @param {object} props.q Static display fields (present.q).
 * @param {boolean} props.revealed
 * @param {number} props.hintsShown
 * @param {number} props.step Morph/fusion reveal step (also the video clip-ladder step).
 * @param {object|null} props.reveal Answer data (live.reveal), present once revealed.
 * @param {boolean} [props.buzzed] Someone has buzzed — pause the video clip.
 */
export default function RoundBody({
  type,
  q = {},
  revealed = false,
  hintsShown = 1,
  step = 0,
  reveal = null,
  buzzed = false,
}) {
  const { t } = useI18n();

  if (type === "classic" || type === "jeopardy") {
    return (
      <div className="text-center">
        <Q>{type === "jeopardy" ? q.clue : q.q}</Q>
        {revealed && reveal?.answer != null && <p className={answerCls}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "hints") {
    const shown = (Array.isArray(q.hints) ? q.hints : []).filter(hintHasContent).slice(0, Math.max(1, hintsShown));
    return (
      <div className="mx-auto max-w-3xl">
        <div className="space-y-3">
          {shown.map((h, i) => (
            <div
              key={i}
              className="qn-fade-up rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900"
            >
              <HintMedia hint={h} />
            </div>
          ))}
        </div>
        {revealed && reveal?.answer != null && <p className={`${answerCls} text-center`}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "video" || type === "clip") {
    const vid = ytId(q.url);
    return (
      <div className="text-center">
        {q.q && <Q>{q.q}</Q>}
        <div className="mx-auto mt-5 max-w-5xl">
          {vid ? (
            <YouTubePlayer
              videoId={vid}
              audioOnly={!!q.audioOnly}
              start={q.start}
              end={clipEnd(q, step)}
              pauseSignal={buzzed ? "buzzed" : null}
            />
          ) : (
            <p className="text-stone-400">{t("play.noVideo")}</p>
          )}
        </div>
        {revealed && reveal?.answer != null && <p className={answerCls}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "image") {
    return (
      <div className="text-center">
        {q.q && <Q>{q.q}</Q>}
        <div className="mx-auto mt-5 max-w-5xl">
          {q.url ? (
            <img
              src={q.url}
              alt=""
              className="max-h-[74vh] w-full rounded-2xl border border-stone-200 bg-white object-contain shadow-sm dark:border-stone-800 dark:bg-stone-900"
            />
          ) : null}
        </div>
        {revealed && reveal?.answer != null && <p className={answerCls}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "morph") {
    return (
      <div className="mx-auto max-w-4xl text-center">
        <MorphImage url={q.url} effect={q.effect} steps={q.steps} step={step} revealed={revealed} />
        {revealed && reveal?.answer != null && <p className={answerCls}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "fusion") {
    return (
      <div className="mx-auto max-w-4xl text-center">
        <FusionImage urlA={q.urlA} urlB={q.urlB} steps={q.steps} step={step} revealed={revealed} />
        {revealed && reveal?.answer != null && <p className={answerCls}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "map") {
    const ans = revealed ? reveal?.answer : null;
    // Before reveal, show the street view (the puzzle) if the question has one;
    // on reveal switch to the map so the answer location is shown.
    const showStreet = !revealed && mapillaryEmbedUrl(q.street);
    return (
      <div className="mx-auto max-w-5xl text-center">
        {q.q && <Q>{q.q}</Q>}
        <div className="mt-5">
          {showStreet ? (
            <MapillaryEmbed street={q.street} className="h-[70vh]" />
          ) : (
            <LeafletMap
              answer={
                ans && ans.lat != null && ans.lng != null ? { lat: ans.lat, lng: ans.lng, label: ans.name } : undefined
              }
              tileLayer={q.tileLayer}
              className="h-[70vh]"
            />
          )}
        </div>
        {ans?.name && <p className={answerCls}>{ans.name}</p>}
      </div>
    );
  }

  if (type === "choice") {
    const options = Array.isArray(q.options) ? q.options : [];
    return (
      <div className="text-center">
        <Q>{q.q}</Q>
        <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
          {options.map((opt, oi) => {
            const correct = revealed && reveal?.correct === oi;
            return (
              <div
                key={oi}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                  correct
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                    : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    correct
                      ? "bg-emerald-500 text-white"
                      : "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-200"
                  }`}
                >
                  {LETTERS[oi]}
                </span>
                <span className="min-w-0 flex-1 font-medium md:text-lg">{opt}</span>
                {correct && <Check size={18} className="text-emerald-600 dark:text-emerald-400" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (type === "number") {
    return (
      <div className="text-center">
        <Q>{q.q}</Q>
        {revealed && reveal?.answer != null && (
          <p className={`${answerCls} inline-flex items-center gap-2`}>
            <Target size={28} /> {reveal.answer}
            {reveal.unit ? ` ${reveal.unit}` : ""}
          </p>
        )}
      </div>
    );
  }

  return null;
}
