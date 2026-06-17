/* ====================================================================
   ROUND BODY — read-only round renderer for the TV presenter
   --------------------------------------------------------------------
   Renders the clean, audience-facing view of the current question from the
   streamed present/live payload (see lib/model buildPresentQ / buildLive).
   It is purely presentational: no controls, no awarding; map pins appear only
   on reveal (guess coordinates aren't sent until then). Reuses the
   pure media children (MorphImage / FusionImage / HintMedia / YouTubePlayer
   / LeafletMap). The host screen keeps its own interactive rendering.
   ==================================================================== */

import { hintHasContent, mapillaryEmbedUrl, clipEnd } from "../lib/model.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { optionsFor, Avatar } from "./ui.jsx";
import { GuessGrid, TraitLegend, AnyQuote, AnyColors } from "./anythingleTraits.jsx";
import { Check, X, Target, Volume2 } from "lucide-react";
import MorphImage from "./MorphImage.jsx";
import FusionImage from "./FusionImage.jsx";
import HintMedia from "./HintMedia.jsx";
import MediaPlayer from "./MediaPlayer.jsx";
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
 * @param {{n:number,action:string}|null} [props.transport] Remote media transport (play/pause/restart).
 * @param {boolean} [props.stage] This screen is the audio/video stage — render the real player (else a placeholder).
 * @param {boolean} [props.compact] Smaller media heights (for the host phone mirror).
 * @param {string} [props.qKey] Stable per-question key so the player remounts on a new question (even same URL).
 */
export default function RoundBody({
  type,
  q = {},
  revealed = false,
  hintsShown = 1,
  step = 0,
  morphProgress = 0,
  reveal = null,
  transport = null,
  stage = false,
  compact = false,
  qKey = "",
  volume = 100,
  whoknows = null,
  anythingle = null,
}) {
  const { t } = useI18n();

  if (type === "classic" || type === "jeopardy") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
        <Q>{type === "jeopardy" ? q.clue : q.q}</Q>
        {revealed && reveal?.answer != null && <p className={answerCls}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "hints") {
    const shown = (Array.isArray(q.hints) ? q.hints : []).filter(hintHasContent).slice(0, Math.max(1, hintsShown));
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col justify-center overflow-y-auto">
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

  if (type === "connect") {
    const shown = (Array.isArray(q.clues) ? q.clues : []).filter(hintHasContent).slice(0, Math.max(1, hintsShown));
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col justify-center overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {shown.map((c, i) => (
            <div
              key={i}
              className="qn-fade-up relative rounded-2xl border-2 border-blue-200 bg-white p-4 dark:border-blue-500/30 dark:bg-stone-900"
            >
              <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 font-pixel text-[10px] text-white shadow">
                {i + 1}
              </span>
              <HintMedia hint={c} />
            </div>
          ))}
        </div>
        {revealed && reveal?.answer != null && <p className={`${answerCls} mt-4 text-center`}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "video" || type === "clip") {
    return (
      <div className="flex h-full min-h-0 flex-col text-center">
        {q.q && (
          <div className="shrink-0">
            <Q>{q.q}</Q>
          </div>
        )}
        <div className="relative mt-4 min-h-0 flex-1">
          {stage ? (
            <div className="absolute inset-0 m-auto aspect-video max-h-full max-w-full">
              <MediaPlayer
                key={qKey || q.url || "none"}
                url={q.url}
                audioOnly={!!q.audioOnly}
                start={q.start}
                end={clipEnd(q, step)}
                transport={transport}
                controls={false}
                volume={volume}
              />
            </div>
          ) : (
            <div className="absolute inset-0 m-auto flex aspect-video max-h-full max-w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
              <Volume2 size={compact ? 28 : 44} />
              <p className="text-sm font-medium">{t("play.clipElsewhere")}</p>
            </div>
          )}
        </div>
        {revealed && reveal?.answer != null && <p className={`${answerCls} shrink-0`}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "image") {
    return (
      <div className="flex h-full min-h-0 flex-col text-center">
        {q.q && (
          <div className="shrink-0">
            <Q>{q.q}</Q>
          </div>
        )}
        <div className="mt-4 flex min-h-0 flex-1 items-center justify-center">
          {q.url ? (
            <img
              src={q.url}
              alt=""
              className="max-h-full max-w-full rounded-2xl border border-stone-200 bg-white object-contain shadow-sm dark:border-stone-800 dark:bg-stone-900"
            />
          ) : null}
        </div>
        {revealed && reveal?.answer != null && <p className={`${answerCls} shrink-0`}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "morph") {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center text-center">
        <MorphImage url={q.url} effect={q.effect} progress={morphProgress} revealed={revealed} />
        {revealed && reveal?.answer != null && <p className={`${answerCls} shrink-0`}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "fusion") {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-4xl flex-col items-center justify-center text-center">
        <FusionImage urlA={q.urlA} urlB={q.urlB} steps={q.steps} step={step} revealed={revealed} />
        {revealed && reveal?.answer != null && <p className={`${answerCls} shrink-0`}>{reveal.answer}</p>}
      </div>
    );
  }

  if (type === "map") {
    const ans = revealed ? reveal?.answer : null;
    // Before reveal, show the street view (the puzzle) if the question has one;
    // on reveal switch to the map so the answer location is shown.
    const showStreet = !revealed && mapillaryEmbedUrl(q.street);
    return (
      <div className="flex h-full min-h-0 flex-col text-center">
        {q.q && (
          <div className="shrink-0">
            <Q>{q.q}</Q>
          </div>
        )}
        <div className="mt-4 min-h-0 flex-1">
          {showStreet ? (
            <MapillaryEmbed street={q.street} className="h-full w-full" />
          ) : (
            <LeafletMap
              key={qKey}
              answer={
                ans && ans.lat != null && ans.lng != null ? { lat: ans.lat, lng: ans.lng, label: ans.name } : undefined
              }
              guesses={revealed ? reveal?.guesses || [] : []}
              showLines={revealed}
              tileLayer={q.tileLayer}
              className="h-full w-full"
            />
          )}
        </div>
        {ans?.name && <p className={`${answerCls} shrink-0`}>{ans.name}</p>}
      </div>
    );
  }

  if (type === "choice" || type === "truefalse" || type === "higherlower") {
    const options = optionsFor(type, q, t);
    const binary = type !== "choice";
    return (
      <div className="flex h-full min-h-0 flex-col justify-center overflow-y-auto text-center">
        <Q>{q.q}</Q>
        <div className="mx-auto mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
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
                {!binary && (
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      correct
                        ? "bg-emerald-500 text-white"
                        : "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-200"
                    }`}
                  >
                    {LETTERS[oi]}
                  </span>
                )}
                <span className="min-w-0 flex-1 font-medium md:text-lg">{opt}</span>
                {correct && <Check size={18} className="text-emerald-600 dark:text-emerald-400" />}
              </div>
            );
          })}
        </div>
        {revealed && binary && reveal?.note && (
          <p className="mx-auto mt-4 max-w-xl text-sm text-stone-500 dark:text-stone-400">{reveal.note}</p>
        )}
      </div>
    );
  }

  if (type === "number") {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
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

  if (type === "whoknows") {
    const wkk = whoknows || {};
    const picked = wkk.picked || [];
    const claimed = wkk.claimed || 0;
    const pickedIdx = new Set(picked.map((p) => p.i));
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
        <Q>{q.q}</Q>
        <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">{t("play.wkTotal", { n: wkk.total || 0 })}</p>
        {wkk.phase === "auction" ? (
          <p className="mt-8 text-3xl font-bold text-violet-600 dark:text-violet-400">{t("play.wkAuctionTitle")}</p>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-center gap-2 text-lg">
              {wkk.winner && (
                <span className="inline-flex items-center gap-2 font-semibold">
                  <Avatar color={wkk.winner.color} emoji={wkk.winner.emoji} name={wkk.winner.name} size={28} />
                  {wkk.winner.name}
                </span>
              )}
              <span className="text-stone-400">·</span>
              <span className="text-stone-500 dark:text-stone-400">{t("play.wkClaimsN", { n: claimed })}</span>
              {wkk.phase === "answering" && (
                <span
                  className={`ml-1 rounded-full px-3 py-0.5 font-bold tabular-nums ${
                    wkk.secsLeft <= 5
                      ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300"
                      : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                  }`}
                >
                  {wkk.secsLeft <= 0 ? t("play.wkTimeUp") : t("play.wkPerAnswerLeft", { n: wkk.secsLeft })}
                </span>
              )}
            </div>
            <div className="mt-6 flex max-w-4xl flex-wrap justify-center gap-2">
              {Array.from({ length: claimed }).map((_, si) => {
                const p = picked[si];
                return (
                  <div
                    key={si}
                    className={`flex h-12 min-w-[4rem] items-center justify-center rounded-xl border px-3 text-lg font-semibold ${
                      p
                        ? "qn-pop border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-dashed border-stone-300 text-stone-300 dark:border-stone-700 dark:text-stone-600"
                    }`}
                  >
                    {p ? p.text : si + 1}
                  </div>
                );
              })}
            </div>
            {wkk.phase === "done" && (
              <p
                className={`mt-5 text-2xl font-bold ${
                  wkk.result === "deliver" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {wkk.result === "deliver"
                  ? t("play.wkDelivered", { n: claimed })
                  : t("play.wkBust", { n: picked.length })}
              </p>
            )}
            {wkk.showAll && (wkk.answers || []).length > 0 && (
              <div className="mt-5 grid max-h-[34vh] max-w-3xl gap-1.5 overflow-y-auto text-left sm:grid-cols-2">
                {wkk.answers.map((ans, ai) => (
                  <div
                    key={ai}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm ${
                      pickedIdx.has(ai)
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "border-red-200 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                    }`}
                  >
                    {pickedIdx.has(ai) ? (
                      <Check size={14} className="shrink-0" />
                    ) : (
                      <X size={14} className="shrink-0" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {wkk.ordered ? `${ai + 1}. ` : ""}
                      {ans}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (type === "anythingle") {
    const a = anythingle || {};
    const guesses = a.guesses || [];
    const solved = a.solvedBy;
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center text-center">
        <Q>{q.q}</Q>
        {a.active && !revealed && !solved && (
          <p className="mt-2 inline-flex items-center gap-2 text-lg font-semibold text-pink-600 dark:text-pink-400">
            <Avatar color={a.active.color} emoji={a.active.emoji} name={a.active.name} size={26} />
            {t("play.anyTurn", { name: a.active.name })}
          </p>
        )}
        {!revealed && !solved && <AnyQuote quote={a.quote} />}
        {!revealed && !solved && <AnyColors colors={a.colors} />}
        {guesses.length > 0 ? (
          <>
            <div className="mt-5 w-full max-w-5xl">
              <GuessGrid guesses={guesses} big={!compact} />
            </div>
            <div className="mt-3">
              <TraitLegend />
            </div>
          </>
        ) : (
          <p className="mt-8 text-stone-400 dark:text-stone-500">{t("play.anyNoGuesses")}</p>
        )}
        {(revealed || solved) && a.target?.name && (
          <p className={answerCls}>
            {solved ? `${t("play.anySolvedBy", { name: solved.name })} ` : `${t("play.anySecret")}: `}
            {a.target.name}
          </p>
        )}
      </div>
    );
  }

  return null;
}
