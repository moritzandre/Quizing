/* ====================================================================
   PLAY VIEW (round intro → questions/board → final scores)
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  Trophy,
  RotateCcw,
  ArrowRight,
  Eye,
  Lightbulb,
  Sparkles,
  MapPin,
  TimerReset,
  Pause,
  Play,
  Target,
  Radio,
  Bell,
} from "lucide-react";
import { uid, ytId, nextNonEmpty, haversineKm, morphValue, hintHasContent } from "../lib/model.js";
import { TYPES, FOCUS, Button, Confetti } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import ScoreBar from "./ScoreBar.jsx";
import LeafletMap from "./LeafletMap.jsx";
import YouTubePlayer from "./YouTubePlayer.jsx";
import MorphImage from "./MorphImage.jsx";
import FusionImage from "./FusionImage.jsx";
import HintMedia from "./HintMedia.jsx";

/** Short WebAudio beep when a player buzzes in (no asset needed). */
function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
    osc.onended = () => ctx.close();
  } catch {
    /* audio not available */
  }
}

/** Distinct marker colors for player map guesses (cycled). */
const PLAYER_COLORS = [
  "#6366f1",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#f97316",
];
const colorFor = (i) => PLAYER_COLORS[i % PLAYER_COLORS.length];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const fmtKm = (km) => (km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km).toLocaleString()} km`);
// Blank lines in the hints textarea aren't real hint steps; ignore them so the
// value math and the displayed ladder match the builder's hint count.
const realHints = (hints) => (hints || []).filter(hintHasContent);
const ptsOr = (n, d) => (Number.isFinite(n) ? n : d);

/** Host-facing game screen; drives a game object via setGame (persisted by the app shell). */
export default function PlayView({ game, setGame, onExit, room }) {
  const { t } = useI18n();
  const quiz = game.quiz;
  const round = quiz.rounds[game.ri];
  const upd = (patch) => setGame({ ...game, ...patch });
  const buzzerOn = !!room?.enabled;

  const isJeop = round?.type === "jeopardy";
  const timerSecs = round?.timer || 0;
  const qKey = isJeop ? `${game.ri}-${game.tile?.ci}-${game.tile?.qi}` : `${game.ri}-${game.qi}`;

  /* --- all hooks must run unconditionally, before any early return --- */

  /* award sign (+/-), reset per question; negative only offered for jeopardy */
  const allowNegative = isJeop;
  const [sign, setSign] = useState(1);

  /* whose pin is being placed in a map round (host-side) */
  const [guessFor, setGuessFor] = useState(null);

  /* morph round reveal step (0 = fully obscured) */
  const [morphStep, setMorphStep] = useState(0);

  /* countdown timer (UI-only; not persisted) */
  const [timeLeft, setTimeLeft] = useState(timerSecs);
  const [paused, setPaused] = useState(false);

  /* current question value (points at stake) */
  const value = (() => {
    if (!round) return 0;
    if (round.type === "jeopardy") {
      if (!game.tile) return 0;
      const q = round.categories[game.tile.ci]?.questions[game.tile.qi];
      return ptsOr(q?.points, 100);
    }
    const q = round.questions[game.qi];
    if (!q) return 0;
    if (round.type === "hints") return Math.max(1, realHints(q.hints).length - game.hintsShown + 1) * 10;
    if (round.type === "morph" || round.type === "fusion") return morphValue(q.points, q.steps, morphStep);
    return ptsOr(q.points, 10);
  })();

  useEffect(() => {
    setSign(1);
    setTimeLeft(timerSecs);
    setPaused(false);
    setMorphStep(0);
    setGuessFor(game.players[0]?.id ?? null);
  }, [qKey, timerSecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Buzzer/pin orchestration: tell phones what to show for the current question.
  useEffect(() => {
    if (!buzzerOn) return;
    if (game.stage !== "question" || game.revealed) {
      room.idle();
    } else if (round?.type === "map") {
      room.collectPins(qKey);
    } else {
      room.arm(qKey);
    }
  }, [buzzerOn, game.stage, game.revealed, qKey, round?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Beep whenever someone buzzes in first (init from current so a remount with an
  // already-locked buzz doesn't replay the sound).
  const lastBuzzId = useRef(room?.buzz?.deviceId || null);
  useEffect(() => {
    const id = room?.buzz?.deviceId || null;
    if (id && id !== lastBuzzId.current) beep();
    lastBuzzId.current = id;
  }, [room?.buzz]);

  useEffect(() => {
    if (game.stage !== "question" || game.revealed || paused || timerSecs <= 0 || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, paused, game.revealed, game.stage, timerSecs, qKey]);

  const toggleAward = (pid) => {
    const a = { ...(game.awarded || {}) };
    let players;
    if (a[pid] != null) {
      const prev = a[pid];
      players = game.players.map((p) => (p.id === pid ? { ...p, score: p.score - prev } : p));
      delete a[pid];
    } else {
      const delta = sign * value;
      a[pid] = delta;
      players = game.players.map((p) => (p.id === pid ? { ...p, score: p.score + delta } : p));
    }
    upd({ players, awarded: a });
  };

  const placeGuess = (lat, lng) => {
    if (!guessFor) return;
    const guesses = { ...(game.guesses || {}), [guessFor]: { lat, lng } };
    // Skip players who already have a pin from either the host or their phone.
    const placed = { ...(buzzerOn ? room.pins : {}), ...guesses };
    const idx = game.players.findIndex((p) => p.id === guessFor);
    const next =
      game.players.slice(idx + 1).find((p) => !placed[p.id]) || game.players.find((p) => !placed[p.id]) || null;
    upd({ guesses });
    setGuessFor(next ? next.id : null); // null once everyone has guessed
  };

  const beginRound = () => {
    setMorphStep(0); // reset now so a morph question never flashes the previous (clear) step
    upd({
      stage: round.type === "jeopardy" ? "board" : "question",
      qi: 0,
      revealed: false,
      hintsShown: 1,
      awarded: {},
      tile: null,
      guesses: {},
    });
  };

  const goNextRound = () => {
    const j = nextNonEmpty(quiz, game.ri + 1);
    if (j === -1) upd({ stage: "end" });
    else upd({ ri: j, stage: "intro", qi: 0, revealed: false, hintsShown: 1, awarded: {}, tile: null, guesses: {} });
  };

  const nextQuestion = () => {
    if (game.qi + 1 < round.questions.length) {
      setMorphStep(0);
      upd({ qi: game.qi + 1, revealed: false, hintsShown: 1, awarded: {}, guesses: {} });
    } else goNextRound();
  };

  const backToBoard = () => {
    const key = `${game.ri}-${game.tile.ci}-${game.tile.qi}`;
    upd({ used: { ...game.used, [key]: true }, tile: null, stage: "board", revealed: false, awarded: {} });
  };

  const advance = isJeop ? backToBoard : nextQuestion;
  const scoreActive = game.stage === "question" && game.revealed;

  /* host keyboard shortcuts: R reveal · H hint · N/→ next · +/- sign · 1–9 award */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (game.stage !== "question" || !round) return;
      const k = e.key.toLowerCase();
      const q = isJeop ? round.categories[game.tile?.ci]?.questions[game.tile?.qi] : round.questions[game.qi];
      if (!q) return;
      if (k === "r" && !game.revealed) upd({ revealed: true });
      else if ((k === "n" || k === "arrowright") && game.revealed) advance();
      else if (k === "h" && !game.revealed && round.type === "hints" && game.hintsShown < realHints(q.hints).length)
        upd({ hintsShown: game.hintsShown + 1 });
      else if (k === "h" && !game.revealed && (round.type === "morph" || round.type === "fusion"))
        setMorphStep((s) => Math.min(q.steps, s + 1));
      else if (allowNegative && game.revealed && (e.key === "-" || e.key === "_")) setSign(-1);
      else if (allowNegative && game.revealed && (e.key === "+" || e.key === "=")) setSign(1);
      else if (game.revealed && /^[1-9]$/.test(e.key)) {
        const p = game.players[+e.key - 1];
        if (p) toggleAward(p.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const Header = (
    <div className="mb-8 flex items-center justify-between">
      <button
        onClick={onExit}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <ChevronLeft size={16} /> {t("play.exit")}
      </button>
      {round && game.stage !== "end" && (
        <p className="text-sm text-stone-500 dark:text-stone-400">
          {t("play.roundProgress", { n: game.ri + 1, total: quiz.rounds.length })} ·{" "}
          <span className="font-medium text-stone-700 dark:text-stone-200">{t(`round.${round.type}.label`)}</span>
        </p>
      )}
      <span className="w-14" />
    </div>
  );

  /* ---- final scores ---- */
  if (game.stage === "end") {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    // A winner exists when scores aren't all tied — works for all-negative
    // games too (least-negative leads); a flat all-equal board (e.g. all 0) gets none.
    const hasWinner = sorted.length > 1 ? sorted[0].score > sorted[sorted.length - 1].score : sorted[0]?.score > 0;
    const playAgain = () =>
      setGame({
        ...game,
        id: uid(), // a replay is a new game so the leaderboard records it again
        players: game.players.map((p) => ({ ...p, score: 0 })),
        ri: Math.max(nextNonEmpty(quiz, 0), 0),
        qi: 0,
        stage: "intro",
        revealed: false,
        hintsShown: 1,
        awarded: {},
        used: {},
        tile: null,
        guesses: {},
      });
    return (
      <div className="mx-auto max-w-xl px-6 pb-16 pt-10 text-center">
        {hasWinner && <Confetti />}
        <Trophy className="mx-auto mb-4 text-amber-500" size={44} />
        <h2 className="text-3xl font-bold tracking-tight">{t("play.finalScores")}</h2>
        <p className="mt-1 text-stone-500 dark:text-stone-400">{quiz.title}</p>
        <div className="mt-8 space-y-2">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`qn-fade-up flex items-center justify-between rounded-2xl border px-5 py-4 ${
                i === 0
                  ? "border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10"
                  : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
              }`}
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-lg font-bold ${i === 0 ? "text-amber-600 dark:text-amber-400" : "text-stone-400"}`}
                >
                  {i + 1}
                </span>
                <span className="text-lg font-medium">{p.name}</span>
                {i === 0 && hasWinner && <span className="text-xl">🏆</span>}
              </div>
              <span className="text-xl font-bold tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={playAgain}>
            <RotateCcw size={16} /> {t("play.playAgain")}
          </Button>
          <Button variant="outline" onClick={onExit}>
            {t("common.done")}
          </Button>
        </div>
      </div>
    );
  }

  if (!round) return null;

  /* ---- round intro ---- */
  if (game.stage === "intro") {
    const T = TYPES[round.type];
    const Icon = T.icon;
    return (
      <div className="mx-auto max-w-2xl px-6 pb-32 pt-6">
        {Header}
        <div className="qn-fade-up mt-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-900">
            <Icon size={28} className="text-stone-700 dark:text-stone-200" />
          </div>
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">
            {t("play.round", { n: game.ri + 1 })}
          </p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight">{round.title || t(`round.${round.type}.label`)}</h2>
          <p className="mx-auto mt-4 max-w-md text-stone-500 dark:text-stone-400">{t(`round.${round.type}.desc`)}</p>
          {timerSecs > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-300">
              <TimerReset size={13} /> {t("play.perQuestion", { n: timerSecs })}
            </p>
          )}
          <div>
            <Button className="mt-8 px-6 py-3.5 text-base" onClick={beginRound}>
              {t("play.startRound")} <ArrowRight size={18} />
            </Button>
          </div>
        </div>
        <ScoreBar players={game.players} active={false} value={0} awarded={{}} onAward={() => {}} />
      </div>
    );
  }

  /* ---- jeopardy board ---- */
  if (game.stage === "board") {
    const boardDone = round.categories.every((c, ci) =>
      c.questions.every((_, qi) => game.used[`${game.ri}-${ci}-${qi}`]),
    );
    const maxRows = Math.max(...round.categories.map((c) => c.questions.length), 0);
    return (
      <div className="mx-auto max-w-3xl px-6 pb-32 pt-6">
        {Header}
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{round.title || t("play.pickTile")}</h2>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${round.categories.length}, minmax(0,1fr))` }}
        >
          {round.categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-center rounded-xl bg-stone-900 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white dark:bg-stone-700 md:text-sm"
            >
              {c.name || "—"}
            </div>
          ))}
          {Array.from({ length: maxRows }).map((_, qi) =>
            round.categories.map((c, ci) => {
              const q = c.questions[qi];
              if (!q) return <div key={c.id + "-" + qi} />;
              const used = game.used[`${game.ri}-${ci}-${qi}`];
              return (
                <button
                  key={c.id + "-" + qi}
                  disabled={used}
                  onClick={() => upd({ tile: { ci, qi }, stage: "question", revealed: false, awarded: {} })}
                  className={`flex h-16 items-center justify-center rounded-xl border text-xl font-bold transition active:scale-95 md:h-20 md:text-2xl ${FOCUS} ${
                    used
                      ? "border-stone-100 bg-stone-50 text-stone-200 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-700"
                      : "border-stone-200 bg-white text-indigo-600 hover:-translate-y-0.5 hover:border-indigo-400 hover:bg-indigo-50 hover:shadow-md dark:border-stone-700 dark:bg-stone-800 dark:text-indigo-300 dark:hover:border-indigo-500 dark:hover:bg-stone-700"
                  }`}
                >
                  {used ? "" : q.points}
                </button>
              );
            }),
          )}
        </div>
        {boardDone && (
          <div className="mt-8 text-center">
            <Button className="px-6 py-3.5 text-base" onClick={goNextRound}>
              {t("play.continue")} <ArrowRight size={18} />
            </Button>
          </div>
        )}
        <ScoreBar players={game.players} active={false} value={0} awarded={{}} onAward={() => {}} />
      </div>
    );
  }

  /* ---- question stage ---- */
  const q = isJeop ? round.categories[game.tile.ci].questions[game.tile.qi] : round.questions[game.qi];

  const RevealBtn = (
    <Button className="px-6 py-3.5 text-base" onClick={() => upd({ revealed: true })}>
      <Eye size={18} /> {t("play.revealAnswer")}
    </Button>
  );
  const NextBtn = (
    <Button className="px-6 py-3.5 text-base" onClick={advance}>
      {isJeop ? t("play.backToBoard") : t("common.next")} <ArrowRight size={18} />
    </Button>
  );
  const Progress = !isJeop && (
    <p className="mb-3 text-center text-sm text-stone-400">
      {t("play.questionProgress", { n: game.qi + 1, total: round.questions.length })}
    </p>
  );

  /* countdown pill (only before reveal, when the round sets a timer) */
  const TimerPill = timerSecs > 0 && !game.revealed && (
    <div className="mb-5 flex items-center justify-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold tabular-nums transition-colors ${
          timeLeft === 0
            ? "bg-red-600 text-white"
            : timeLeft <= 10
              ? "animate-pulse bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
              : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-200"
        }`}
      >
        <TimerReset size={14} /> {timeLeft === 0 ? t("play.timesUp") : fmtClock(timeLeft)}
      </span>
      <button
        onClick={() => setPaused((p) => !p)}
        aria-label={paused ? t("play.resumeTimer") : t("play.pauseTimer")}
        className={`rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button
        onClick={() => {
          setTimeLeft(timerSecs);
          setPaused(false);
        }}
        aria-label={t("play.resetTimer")}
        className={`rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <RotateCcw size={14} />
      </button>
    </div>
  );

  const Shortcuts = (
    <p className="mt-8 hidden text-center text-xs text-stone-300 dark:text-stone-600 md:block">
      {t("play.shortcuts", {
        keys:
          "R reveal" +
          (round.type === "hints" ? " · H hint" : round.type === "morph" ? " · H demorph" : "") +
          " · N next" +
          (allowNegative ? " · +/- sign" : "") +
          " · 1–9 award",
      })}
    </p>
  );

  /* buzzer banner: who buzzed first, with re-arm/reset (only when phones are connected) */
  const BuzzerBar = buzzerOn && !game.revealed && round.type !== "map" && (
    <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
      {room.buzz ? (
        <span className="inline-flex animate-pulse items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white">
          <Bell size={15} /> {t("play.buzzedFirst", { name: room.buzz.name })}
        </span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-4 py-1.5 text-sm font-medium text-stone-500 dark:bg-stone-800 dark:text-stone-300">
          <Radio size={14} /> {t("play.buzzArmed")}
        </span>
      )}
      <button
        onClick={room.resetBuzz}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <RotateCcw size={13} /> {t("play.rearm")}
      </button>
    </div>
  );

  let body = null;

  if (round.type === "classic" || isJeop) {
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        {isJeop && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            {round.categories[game.tile.ci].name || t("play.category")} · {q.points}
          </p>
        )}
        <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-snug tracking-tight md:text-5xl">
          {isJeop ? q.clue : q.q}
        </h2>
        <div className="mt-10" style={{ minHeight: 80 }}>
          {game.revealed ? (
            <p className="qn-pop text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">
              {isJeop ? q.answer : q.a}
            </p>
          ) : (
            RevealBtn
          )}
        </div>
        {game.revealed && <div className="mt-8">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "hints") {
    const hints = realHints(q.hints);
    const shown = hints.slice(0, game.hintsShown);
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <div className="mb-4 flex items-center justify-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("play.whoOrWhat")}</h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {t("play.worth", { value })}
          </span>
        </div>
        <div className="mx-auto max-w-xl space-y-2 text-left">
          {shown.map((h, i) => (
            <div
              key={i}
              className="qn-fade-up flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
            >
              <span className="mt-0.5 text-xs font-bold text-stone-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <HintMedia hint={h} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!game.revealed && game.hintsShown < hints.length && (
            <Button
              variant="outline"
              className="px-5 py-3 text-base"
              onClick={() => upd({ hintsShown: game.hintsShown + 1 })}
            >
              <Lightbulb size={18} /> {t("play.nextHint")} <span className="text-sm text-stone-400">(−10)</span>
            </Button>
          )}
          {!game.revealed && RevealBtn}
        </div>
        {game.revealed && (
          <>
            <p className="qn-pop mt-8 text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">
              {q.answer}
            </p>
            <div className="mt-8">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "video") {
    const vid = ytId(q.url);
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <div className="mx-auto max-w-2xl">
          {vid ? (
            <YouTubePlayer key={qKey} videoId={vid} audioOnly={!!q.audioOnly} />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
              {t("play.noVideo")}
            </div>
          )}
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight md:text-3xl">{q.q}</h2>
        <div className="mt-6" style={{ minHeight: 64 }}>
          {game.revealed ? (
            <p className="qn-pop text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-3xl">{q.a}</p>
          ) : (
            RevealBtn
          )}
        </div>
        {game.revealed && <div className="mt-6">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "image") {
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <div className="mx-auto max-w-2xl">
          {q.url ? (
            <img
              src={q.url}
              alt="Quiz picture"
              className="max-h-[60vh] w-full rounded-2xl border border-stone-200 bg-white object-contain shadow-sm dark:border-stone-800 dark:bg-stone-900"
            />
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
              {t("play.noPicture")}
            </div>
          )}
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight md:text-3xl">{q.q}</h2>
        <div className="mt-6" style={{ minHeight: 64 }}>
          {game.revealed ? (
            <p className="qn-pop text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-3xl">{q.a}</p>
          ) : (
            RevealBtn
          )}
        </div>
        {game.revealed && <div className="mt-6">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "morph") {
    const atEnd = morphStep >= q.steps;
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <div className="mb-4 flex items-center justify-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("play.whatIsThis")}</h2>
          {!game.revealed && (
            <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-sm font-bold text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300">
              {t("play.worth", { value })}
            </span>
          )}
        </div>
        <div className="mx-auto max-w-2xl">
          <MorphImage url={q.url} effect={q.effect} steps={q.steps} step={morphStep} revealed={game.revealed} />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!game.revealed && !atEnd && (
            <Button
              variant="outline"
              className="px-5 py-3 text-base"
              onClick={() => setMorphStep((s) => Math.min(q.steps, s + 1))}
            >
              <Sparkles size={18} /> {t("play.demorph")}{" "}
              <span className="text-sm text-stone-400">
                ({morphStep + 1}/{q.steps})
              </span>
            </Button>
          )}
          {!game.revealed && RevealBtn}
        </div>
        {game.revealed && (
          <>
            <p className="qn-pop mt-6 text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">{q.a}</p>
            <div className="mt-6">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "fusion") {
    const atEnd = morphStep >= q.steps;
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <div className="mb-4 flex items-center justify-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{t("play.whoOrWhat")}</h2>
          {!game.revealed && (
            <span className="rounded-full bg-fuchsia-100 px-3 py-1 text-sm font-bold text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300">
              {t("play.worth", { value })}
            </span>
          )}
        </div>
        <div className="mx-auto max-w-2xl">
          <FusionImage urlA={q.urlA} urlB={q.urlB} steps={q.steps} step={morphStep} revealed={game.revealed} />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {!game.revealed && !atEnd && (
            <Button
              variant="outline"
              className="px-5 py-3 text-base"
              onClick={() => setMorphStep((s) => Math.min(q.steps, s + 1))}
            >
              <Sparkles size={18} /> {t("play.defuse")}{" "}
              <span className="text-sm text-stone-400">
                ({morphStep + 1}/{q.steps})
              </span>
            </Button>
          )}
          {!game.revealed && RevealBtn}
        </div>
        {game.revealed && (
          <>
            <p className="qn-pop mt-6 text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">{q.a}</p>
            <div className="mt-6">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "map") {
    const hasAnswer = q.lat != null && q.lng != null;
    // Merge host-placed guesses with pins submitted from phones (keyed by playerId === deviceId).
    const combined = { ...(game.guesses || {}), ...(buzzerOn ? room.pins : {}) };
    const markers = game.players
      .map((p, i) => {
        const g = combined[p.id];
        return g ? { lat: g.lat, lng: g.lng, color: colorFor(i), label: p.name } : null;
      })
      .filter(Boolean);
    const ranked = hasAnswer
      ? game.players
          .map((p, i) => ({ p, i, g: combined[p.id] }))
          .filter((x) => x.g)
          .map((x) => ({ ...x, km: haversineKm(x.g.lat, x.g.lng, q.lat, q.lng) }))
          .sort((a, b) => a.km - b.km)
      : [];

    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{q.q}</h2>

        {!game.revealed && (
          <div className="mx-auto mt-5 max-w-2xl">
            {buzzerOn && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Radio size={14} /> {t("play.pinsIn", { n: Object.keys(room.pins).length, total: game.players.length })}
              </p>
            )}
            <p className="mb-2 text-sm text-stone-500 dark:text-stone-400">
              {guessFor
                ? t("play.dropPinFor", { name: game.players.find((p) => p.id === guessFor)?.name || "the player" })
                : t("play.everyoneGuessed")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {game.players.map((p, i) => {
                const has = !!combined[p.id];
                const sel = guessFor === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setGuessFor(p.id)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition active:scale-95 ${FOCUS} ${
                      sel
                        ? "border-transparent text-white shadow-sm"
                        : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                    }`}
                    style={sel ? { backgroundColor: colorFor(i) } : undefined}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: sel ? "#fff" : colorFor(i) }}
                    />
                    {p.name}
                    {has && <span className={sel ? "text-white/80" : "text-emerald-600 dark:text-emerald-400"}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mx-auto mt-4 max-w-3xl">
          <LeafletMap
            answer={game.revealed && hasAnswer ? { lat: q.lat, lng: q.lng, label: q.name } : undefined}
            guesses={markers}
            showLines={game.revealed}
            onPick={game.revealed ? undefined : placeGuess}
            className="h-[55vh]"
          />
        </div>

        {game.revealed && ranked.length > 0 && (
          <div className="mx-auto mt-5 max-w-md space-y-1.5 text-left">
            {ranked.map((x, idx) => (
              <div
                key={x.p.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-sm ${
                  idx === 0
                    ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/10"
                    : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                }`}
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colorFor(x.i) }} />
                  {x.p.name}
                  {idx === 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Target size={12} /> {t("play.closest")}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-stone-500 dark:text-stone-400">{fmtKm(x.km)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          {game.revealed ? (
            NextBtn
          ) : (
            <Button className="px-6 py-3.5 text-base" onClick={() => upd({ revealed: true })}>
              <MapPin size={18} /> {t("play.revealLocation")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-36 pt-6">
      {Header}
      {BuzzerBar}
      <div key={qKey} className="qn-fade-up">
        {body}
      </div>
      {Shortcuts}
      <ScoreBar
        players={game.players}
        active={scoreActive}
        value={value}
        awarded={game.awarded || {}}
        onAward={toggleAward}
        allowNegative={allowNegative}
        sign={sign}
        onSignChange={setSign}
      />
    </div>
  );
}
