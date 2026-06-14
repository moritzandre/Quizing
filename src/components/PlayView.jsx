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
  FastForward,
  Target,
  Radio,
  Bell,
  Maximize,
  Minimize,
  SlidersHorizontal,
  ListOrdered,
  Plus,
  Minus,
  X,
  Check,
  Tv,
  BarChart3,
} from "lucide-react";
import {
  uid,
  nextNonEmpty,
  haversineKm,
  morphValue,
  clipLadderActive,
  clipEnd,
  hintHasContent,
  buildPresentQ,
  buildLive,
  mapillaryEmbedUrl,
} from "../lib/model.js";
import { TYPES, FOCUS, Button, IconButton, Confetti, Avatar, accentFor, colorAt, SoundToggle } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import MapillaryEmbed from "./MapillaryEmbed.jsx";
import { playSound } from "../lib/sound.js";
import QRCode from "qrcode";
import ScoreBar from "./ScoreBar.jsx";
import PodiumClimb from "./PodiumClimb.jsx";
import RoundRecap from "./RoundRecap.jsx";
import LeafletMap from "./LeafletMap.jsx";
import MediaPlayer from "./MediaPlayer.jsx";
import MorphImage from "./MorphImage.jsx";
import FusionImage from "./FusionImage.jsx";
import HintMedia from "./HintMedia.jsx";

/** Map marker color for a player (their chosen color, else by index). */
const colorFor = (p, i) => p?.color || colorAt(i);

/** Number of questions in a round (jeopardy counts clues across categories). */
const roundCount = (r) =>
  r.type === "jeopardy"
    ? (r.categories || []).reduce((n, c) => n + (c.questions?.length || 0), 0)
    : r.questions?.length || 0;

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

  // Map a phone deviceId to its scoring entity (a solo player or a team).
  const entityForDevice = (deviceId) => game.players.find((p) => (p.deviceIds || []).includes(deviceId));
  // Re-key a {deviceId: value} map (room.pins / room.answers) by entity id.
  const mapByEntity = (deviceMap) => {
    const out = {};
    for (const [d, v] of Object.entries(deviceMap || {})) {
      const e = entityForDevice(d);
      if (e) out[e.id] = v;
    }
    return out;
  };

  const isJeop = round?.type === "jeopardy";
  const timerSecs = round?.timer || 0;
  const qKey = isJeop ? `${game.ri}-${game.tile?.ci}-${game.tile?.qi}` : `${game.ri}-${game.qi}`;

  /* --- all hooks must run unconditionally, before any early return --- */

  /* award sign (+/-), reset per question; negative only offered for jeopardy */
  const allowNegative = isJeop;
  const [sign, setSign] = useState(1);

  /* whose pin is being placed in a map round (host-side) */
  const [guessFor, setGuessFor] = useState(null);

  /* morph round reveal step (0 = fully obscured); also the clip-ladder step */
  const [morphStep, setMorphStep] = useState(0);

  /* media transport for clips/video: the stage (this screen or the TV) plays/
     pauses/restarts from this. `soundOnTv` moves the stage (audio) to the TV. */
  const [transport, setTransport] = useState({ n: 0, action: "idle" });
  const [soundOnTv, setSoundOnTv] = useState(false);
  const sendTransport = (action) => setTransport((tr) => ({ n: tr.n + 1, action }));
  // Extending the clip ladder replays from the start at the new (longer) length.
  const extendClip = (steps) => {
    setMorphStep((s) => Math.min(steps, s + 1));
    sendTransport("restart");
  };

  /* map round: show the Mapillary street view instead of the map (UI-only) */
  const [streetOn, setStreetOn] = useState(false);

  /* host UI toggles (not persisted): projector layout + score/round panels */
  const [pres, setPres] = useState(false);
  const [editScores, setEditScores] = useState(false);
  const [nav, setNav] = useState(false);
  const [streamTv, setStreamTv] = useState(false); // "Stream to TV" modal
  const [showStandings, setShowStandings] = useState(false); // live podium overlay (host + TV)
  const [recap, setRecap] = useState(false); // between-rounds points-progression overlay
  const [tvQr, setTvQr] = useState("");
  const [hostQr, setHostQr] = useState("");

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
    if ((round.type === "video" || round.type === "clip") && clipLadderActive(q))
      return morphValue(q.points, q.steps, morphStep);
    return ptsOr(q.points, 10);
  })();

  useEffect(() => {
    setSign(1);
    setTimeLeft(timerSecs);
    setPaused(false);
    setMorphStep(0);
    setTransport({ n: 0, action: "idle" });
    setStreetOn(false);
    setRecap(false);
    setGuessFor(game.players[0]?.id ?? null);
  }, [qKey, timerSecs]); // eslint-disable-line react-hooks/exhaustive-deps

  // A buzz auto-pauses the clip on whichever screen is the stage (host or TV).
  useEffect(() => {
    if (room?.buzz) sendTransport("pause");
  }, [room?.buzz?.deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Buzzer/pin orchestration: tell phones what to show for the current question.
  useEffect(() => {
    if (!buzzerOn) return;
    if (game.stage !== "question" || game.revealed) {
      room.idle();
    } else if (round?.type === "map") {
      room.collectPins(qKey);
    } else if (round?.type === "choice") {
      room.collectAnswers(qKey, { phase: "choice", options: round.questions[game.qi]?.options || [] });
    } else if (round?.type === "number") {
      room.collectAnswers(qKey, { phase: "number" });
    } else {
      room.arm(qKey);
    }
  }, [buzzerOn, game.stage, game.revealed, qKey, round?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stream the heavy, per-question presenter payload (media + text) to any TV.
  useEffect(() => {
    if (!buzzerOn) return;
    room.pushPresent(buildPresentQ(game));
  }, [buzzerOn, game.stage, qKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stream the light, frequently-changing presenter payload (reveal/step/scores).
  const scoreSig = game.players.map((p) => `${p.id}:${p.score}:${p.name}:${p.color}:${p.emoji}`).join(",");
  useEffect(() => {
    if (!buzzerOn) return;
    room.pushLive(
      buildLive(game, {
        step: morphStep,
        showStandings,
        value,
        allowNegative,
        recap,
        recapFrom: game.roundStartScores,
        transport,
        soundOnTv,
      }),
    );
  }, [buzzerOn, game.stage, game.revealed, game.hintsShown, morphStep, showStandings, recap, value, qKey, scoreSig, transport.n, soundOnTv]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build the TV (present) + host-remote (host) URLs and their QRs when the modal opens.
  const roomBase =
    room?.code && typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  const presentUrl = roomBase ? `${roomBase}#/present/${room.code}` : "";
  const hostUrl = roomBase ? `${roomBase}#/host/${room.code}` : "";
  useEffect(() => {
    if (!streamTv) return;
    let alive = true;
    if (presentUrl)
      QRCode.toDataURL(presentUrl, { margin: 1, width: 320 })
        .then((u) => alive && setTvQr(u))
        .catch(() => alive && setTvQr(""));
    if (hostUrl)
      QRCode.toDataURL(hostUrl, { margin: 1, width: 320 })
        .then((u) => alive && setHostQr(u))
        .catch(() => alive && setHostQr(""));
    return () => {
      alive = false;
    };
  }, [streamTv, presentUrl, hostUrl]);

  // Beep whenever someone buzzes in first (init from current so a remount with an
  // already-locked buzz doesn't replay the sound).
  const lastBuzzId = useRef(room?.buzz?.deviceId || null);
  useEffect(() => {
    const id = room?.buzz?.deviceId || null;
    if (id && id !== lastBuzzId.current) playSound("buzz");
    lastBuzzId.current = id;
  }, [room?.buzz]);

  useEffect(() => {
    if (game.stage !== "question" || game.revealed || paused || timerSecs <= 0 || timeLeft <= 0) return;
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, paused, game.revealed, game.stage, timerSecs, qKey]);

  // Sound the alarm once per question when its timer genuinely reaches 0
  // (a ref keyed by qKey avoids re-firing on a stale 0 carried into the next question).
  const timeupRef = useRef(null);
  useEffect(() => {
    if (timerSecs > 0 && timeLeft === 0 && game.stage === "question" && !game.revealed && timeupRef.current !== qKey) {
      timeupRef.current = qKey;
      playSound("timeup");
    }
  }, [timeLeft, timerSecs, game.stage, game.revealed, qKey]);

  // Fanfare when the final scores appear.
  useEffect(() => {
    if (game.stage === "end") playSound("win");
  }, [game.stage]);

  // Keep presentation state in sync when the user leaves fullscreen via Esc.
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPres(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

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
      playSound(delta < 0 ? "wrong" : "correct");
    }
    upd({ players, awarded: a });
  };

  const reveal = () => {
    playSound("reveal");
    upd({ revealed: true });
  };

  // Multiple-choice reveal: auto-award everyone who picked the correct option.
  const revealChoice = (q) => {
    const ans = mapByEntity(buzzerOn ? room.answers : {});
    const awarded = {};
    const players = game.players.map((p) => {
      if (ans[p.id] === q.correct) {
        awarded[p.id] = q.points;
        return { ...p, score: p.score + q.points };
      }
      return p;
    });
    playSound(Object.keys(awarded).length ? "correct" : "reveal");
    upd({ revealed: true, players, awarded });
  };

  // Closest-number reveal: auto-award the nearest guess to the answer.
  const revealNumber = (q) => {
    let awarded = {};
    let players = game.players;
    if (q.answer != null) {
      const ans = mapByEntity(buzzerOn ? room.answers : {});
      const ranked = game.players
        .map((p) => ({ p, g: +ans[p.id] }))
        .filter((x) => Number.isFinite(x.g))
        .sort((a, b) => Math.abs(a.g - q.answer) - Math.abs(b.g - q.answer));
      if (ranked.length) {
        const winnerId = ranked[0].p.id;
        awarded = { [winnerId]: q.points };
        players = game.players.map((p) => (p.id === winnerId ? { ...p, score: p.score + q.points } : p));
      }
    }
    playSound(Object.keys(awarded).length ? "correct" : "reveal");
    upd({ revealed: true, players, awarded });
  };

  // Map reveal: auto-award the closest guess (host-placed or phone pin) the points.
  const revealMap = (q) => {
    let awarded = {};
    let players = game.players;
    if (q.lat != null && q.lng != null) {
      const combined = { ...(game.guesses || {}), ...(buzzerOn ? mapByEntity(room.pins) : {}) };
      const ranked = game.players
        .map((p) => ({ p, g: combined[p.id] }))
        .filter((x) => x.g)
        .sort((a, b) => haversineKm(a.g.lat, a.g.lng, q.lat, q.lng) - haversineKm(b.g.lat, b.g.lng, q.lat, q.lng));
      if (ranked.length) {
        const winnerId = ranked[0].p.id;
        const pts = ptsOr(q.points, 10);
        awarded = { [winnerId]: pts };
        players = game.players.map((p) => (p.id === winnerId ? { ...p, score: p.score + pts } : p));
      }
    }
    playSound(Object.keys(awarded).length ? "correct" : "reveal");
    upd({ revealed: true, players, awarded });
  };

  const adjustScore = (pid, delta) =>
    upd({ players: game.players.map((p) => (p.id === pid ? { ...p, score: p.score + delta } : p)) });

  const jumpToRound = (ri) => {
    if (!Number.isInteger(ri) || ri < 0 || ri >= quiz.rounds.length) return; // guard untrusted ctrl/jump input
    setMorphStep(0);
    upd({ ri, stage: "intro", qi: 0, revealed: false, hintsShown: 1, awarded: {}, tile: null, guesses: {} });
    setNav(false);
  };

  // Toggle projector layout + browser fullscreen (called from the click for the gesture).
  const togglePres = () => {
    const next = !pres;
    setPres(next);
    try {
      if (next) document.documentElement.requestFullscreen?.();
      else if (document.fullscreenElement) document.exitFullscreen?.();
    } catch {
      /* fullscreen may be blocked — the layout still enlarges */
    }
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
      // snapshot totals at round start so the recap can animate the round's gains
      roundStartScores: Object.fromEntries(game.players.map((p) => [p.id, p.score])),
    });
  };

  const goNextRound = () => {
    const j = nextNonEmpty(quiz, game.ri + 1);
    if (j === -1) upd({ stage: "end" });
    else upd({ ri: j, stage: "intro", qi: 0, revealed: false, hintsShown: 1, awarded: {}, tile: null, guesses: {} });
  };

  // Show the between-rounds recap (with a little flourish); host confirms to advance.
  const endRound = () => {
    playSound("fanfare");
    setRecap(true);
  };
  const continueAfterRecap = () => {
    setRecap(false);
    goNextRound();
  };

  const nextQuestion = () => {
    if (game.qi + 1 < round.questions.length) {
      setMorphStep(0);
      upd({ qi: game.qi + 1, revealed: false, hintsShown: 1, awarded: {}, guesses: {} });
    } else endRound();
  };

  const backToBoard = () => {
    const key = `${game.ri}-${game.tile.ci}-${game.tile.qi}`;
    upd({ used: { ...game.used, [key]: true }, tile: null, stage: "board", revealed: false, awarded: {} });
  };

  const advance = isJeop ? backToBoard : nextQuestion;
  const scoreActive = game.stage === "question" && game.revealed;

  /* Apply a command sent from a host-remote phone (#/host/<code>). Re-derive the
     current question here (the render-scope `q` only exists in the question path).
     Seed from the buffered command so a host re-mount (navigate away & back)
     doesn't replay the last command — the room outlives this component. */
  const lastCmdRef = useRef(room?.command?.id ?? 0);
  useEffect(() => {
    const cmd = room?.command;
    if (!cmd || cmd.id <= lastCmdRef.current) return;
    lastCmdRef.current = cmd.id;
    const a = cmd.args || {};
    // While the recap is up, "advance" continues past it; ignore other actions.
    if (recap) {
      if (cmd.action === "advance") continueAfterRecap();
      return;
    }
    const cq = isJeop ? round?.categories?.[game.tile?.ci]?.questions?.[game.tile?.qi] : round?.questions?.[game.qi];
    switch (cmd.action) {
      case "reveal":
        if (game.stage === "question" && !game.revealed && cq) {
          if (round.type === "choice") revealChoice(cq);
          else if (round.type === "number") revealNumber(cq);
          else if (round.type === "map") revealMap(cq);
          else reveal();
        }
        break;
      case "advance":
        if (game.stage === "question") advance();
        break;
      case "hint":
        if (game.stage === "question" && !game.revealed && cq) {
          if (round.type === "hints" && game.hintsShown < realHints(cq.hints).length)
            upd({ hintsShown: game.hintsShown + 1 });
          else if (round.type === "morph" || round.type === "fusion") setMorphStep((s) => Math.min(cq.steps, s + 1));
          else if ((round.type === "video" || round.type === "clip") && clipLadderActive(cq)) extendClip(cq.steps);
        }
        break;
      case "media":
        if (["play", "pause", "restart"].includes(a.action)) sendTransport(a.action);
        break;
      case "soundOnTv":
        setSoundOnTv(!!a.on);
        break;
      case "sign":
        setSign(a.sign === -1 ? -1 : 1);
        break;
      case "award":
        if (a.id && game.players.some((p) => p.id === a.id)) toggleAward(a.id);
        break;
      case "adjust":
        if (a.id && Number.isFinite(+a.delta) && game.players.some((p) => p.id === a.id)) adjustScore(a.id, +a.delta);
        break;
      case "startRound":
        if (game.stage === "intro") beginRound();
        break;
      case "jump":
        if (Number.isFinite(+a.ri)) jumpToRound(+a.ri);
        break;
      case "skipRound":
        goNextRound(); // jump straight to the next round (or the end)
        break;
      case "standings":
        setShowStandings(!!a.on);
        break;
      case "resetBuzz":
        if (buzzerOn) room.resetBuzz();
        break;
      default:
        break;
    }
  }, [room?.command]); // eslint-disable-line react-hooks/exhaustive-deps

  /* host keyboard shortcuts: R reveal · H hint · N/→ next · +/- sign · 1–9 award */
  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      // While the between-rounds recap is up, N/→/Enter continues past it.
      if (recap) {
        if (k === "n" || k === "arrowright" || k === "enter") continueAfterRecap();
        return;
      }
      if (game.stage !== "question" || !round) return;
      const q = isJeop ? round.categories[game.tile?.ci]?.questions[game.tile?.qi] : round.questions[game.qi];
      if (!q) return;
      if (k === "r" && !game.revealed) {
        if (round.type === "choice") revealChoice(q);
        else if (round.type === "number") revealNumber(q);
        else if (round.type === "map") revealMap(q);
        else reveal();
      } else if ((k === "n" || k === "arrowright") && game.revealed) advance();
      else if (k === "h" && !game.revealed && round.type === "hints" && game.hintsShown < realHints(q.hints).length)
        upd({ hintsShown: game.hintsShown + 1 });
      else if (k === "h" && !game.revealed && (round.type === "morph" || round.type === "fusion"))
        setMorphStep((s) => Math.min(q.steps, s + 1));
      else if (k === "h" && !game.revealed && (round.type === "video" || round.type === "clip") && clipLadderActive(q))
        extendClip(q.steps);
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

  const stepperCls = `rounded-lg border border-stone-200 px-2 py-1 text-xs font-bold text-stone-600 transition hover:bg-stone-100 active:scale-95 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800 ${FOCUS}`;
  const Header = (
    <>
      <div className="mb-8 flex items-center justify-between gap-2">
        <button
          onClick={onExit}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
        >
          <ChevronLeft size={16} /> {t("play.exit")}
        </button>
        {round && (
          <p className="hidden text-sm text-stone-500 dark:text-stone-400 sm:block">
            {t("play.roundProgress", { n: game.ri + 1, total: quiz.rounds.length })} ·{" "}
            <span className="font-medium text-stone-700 dark:text-stone-200">{t(`round.${round.type}.label`)}</span>
          </p>
        )}
        <div className="flex items-center gap-1">
          <IconButton label={t("play.jump")} onClick={() => setNav(true)}>
            <ListOrdered size={18} />
          </IconButton>
          <IconButton label={t("play.editScores")} onClick={() => setEditScores(true)}>
            <SlidersHorizontal size={18} />
          </IconButton>
          <IconButton
            label={t("play.standings")}
            onClick={() => setShowStandings((s) => !s)}
            className={showStandings ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300" : ""}
          >
            <BarChart3 size={18} />
          </IconButton>
          <IconButton label={t("play.streamToTv")} onClick={() => setStreamTv(true)}>
            <Tv size={18} />
          </IconButton>
          <IconButton label={pres ? t("play.exitPresentation") : t("play.presentation")} onClick={togglePres}>
            {pres ? <Minimize size={18} /> : <Maximize size={18} />}
          </IconButton>
          <SoundToggle />
        </div>
      </div>

      {editScores && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setEditScores(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">{t("play.adjustScores")}</h3>
              <IconButton label={t("common.done")} onClick={() => setEditScores(false)}>
                <X size={16} />
              </IconButton>
            </div>
            <div className="space-y-2">
              {game.players.map((p, i) => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <Avatar color={colorFor(p, i)} emoji={p.emoji} photo={p.photo} name={p.name} size={26} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  <button onClick={() => adjustScore(p.id, -5)} className={stepperCls}>
                    −5
                  </button>
                  <button onClick={() => adjustScore(p.id, -1)} className={stepperCls} aria-label="-1">
                    <Minus size={13} />
                  </button>
                  <span className="w-10 text-center text-sm font-bold tabular-nums">{p.score}</span>
                  <button onClick={() => adjustScore(p.id, 1)} className={stepperCls} aria-label="+1">
                    <Plus size={13} />
                  </button>
                  <button onClick={() => adjustScore(p.id, 5)} className={stepperCls}>
                    +5
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {nav && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setNav(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold">{t("play.rounds")}</h3>
              <IconButton label={t("common.done")} onClick={() => setNav(false)}>
                <X size={16} />
              </IconButton>
            </div>
            {game.stage === "question" && (
              <button
                onClick={() => {
                  setNav(false);
                  advance();
                }}
                className={`mb-2 w-full rounded-xl border border-stone-200 px-3 py-2 text-left text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800 ${FOCUS}`}
              >
                <ArrowRight size={14} className="mr-1 inline" /> {t("play.skipQuestion")}
              </button>
            )}
            <div className="space-y-1.5">
              {quiz.rounds.map((r, ri) => (
                <button
                  key={r.id}
                  onClick={() => jumpToRound(ri)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${FOCUS} ${
                    ri === game.ri
                      ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                      : "border-stone-200 hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
                  }`}
                >
                  <span className="w-5 text-xs font-bold text-stone-400">{ri + 1}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${accentFor(r.type).solid}`} />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.title || t(`round.${r.type}.label`)}</span>
                  <span className="text-xs text-stone-400">{roundCount(r)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {streamTv && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setStreamTv(false)}
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-base font-semibold">
                <Tv size={18} /> {t("play.streamToTv")}
              </h3>
              <IconButton label={t("common.done")} onClick={() => setStreamTv(false)}>
                <X size={16} />
              </IconButton>
            </div>
            {buzzerOn && presentUrl ? (
              <div className="space-y-5">
                <div className="text-center">
                  <p className="mb-1 text-sm font-semibold">{t("play.tvScreen")}</p>
                  {tvQr && (
                    <img
                      src={tvQr}
                      alt=""
                      className="mx-auto h-40 w-40 rounded-xl border border-stone-200 dark:border-stone-700"
                    />
                  )}
                  <p className="mt-2 break-all rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {presentUrl}
                  </p>
                  <p className="mt-2 text-left text-xs text-stone-500 dark:text-stone-400">{t("play.castTip")}</p>
                </div>
                <div className="border-t border-stone-200 pt-4 text-center dark:border-stone-800">
                  <p className="mb-1 text-sm font-semibold">{t("play.hostRemote")}</p>
                  {hostQr && (
                    <img
                      src={hostQr}
                      alt=""
                      className="mx-auto h-40 w-40 rounded-xl border border-stone-200 dark:border-stone-700"
                    />
                  )}
                  <p className="mt-2 break-all rounded-lg bg-stone-100 px-3 py-2 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {hostUrl}
                  </p>
                  <p className="mt-2 text-left text-xs text-amber-600 dark:text-amber-400">
                    {t("play.hostRemoteHint")}
                  </p>
                </div>
                <div className="border-t border-stone-200 pt-4 dark:border-stone-800">
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <span className="text-sm">
                      <span className="font-semibold">{t("play.soundOnTv")}</span>
                      <span className="mt-0.5 block text-xs text-stone-500 dark:text-stone-400">
                        {t("play.soundOnTvHint")}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 shrink-0 rounded accent-indigo-600"
                      checked={soundOnTv}
                      onChange={(e) => setSoundOnTv(e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-stone-500 dark:text-stone-400">
                {t("play.streamEnableFirst")}
              </p>
            )}
          </div>
        </div>
      )}

      {showStandings && (
        <div
          className="qn-app-bg fixed inset-0 z-40 overflow-y-auto px-6 py-10"
          onClick={() => setShowStandings(false)}
        >
          <div className="mx-auto max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight">{t("play.standings")}</h2>
              <IconButton label={t("common.done")} onClick={() => setShowStandings(false)}>
                <X size={18} />
              </IconButton>
            </div>
            <PodiumClimb standings={game.players} />
          </div>
        </div>
      )}

      {recap && (
        <div className="qn-app-bg fixed inset-0 z-50 flex flex-col overflow-y-auto px-6 py-10">
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
            <h2 className="mb-1 text-center text-3xl font-bold tracking-tight">{t("play.roundRecap")}</h2>
            <p className="mb-6 text-center text-stone-500 dark:text-stone-400">
              {round?.title || (round ? t(`round.${round.type}.label`) : "")}
            </p>
            <div className="flex flex-1 flex-col justify-center">
              <RoundRecap
                entities={game.players.map((p) => ({
                  id: p.id,
                  name: p.name,
                  color: p.color,
                  emoji: p.emoji,
                  photo: p.photo,
                  from: game.roundStartScores?.[p.id] ?? p.score,
                  to: p.score,
                }))}
              />
            </div>
            <div className="mt-6 text-center">
              <Button className="px-6 py-3.5 text-base" onClick={continueAfterRecap}>
                {t("play.continue")} <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
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
    const podium = sorted.slice(0, 3);
    const rest = sorted.slice(3);
    // Visual left→right order: 2nd, 1st, 3rd (1st in the middle, tallest).
    const layout = podium.length === 1 ? [0] : podium.length === 2 ? [1, 0] : [1, 0, 2];
    const medal = ["🥇", "🥈", "🥉"];
    const podHeight = ["h-32", "h-24", "h-20"];
    const idxOf = (p) => game.players.findIndex((x) => x.id === p.id);
    return (
      <div className="mx-auto max-w-xl px-6 pb-16 pt-10 text-center">
        {hasWinner && <Confetti />}
        <Trophy className="mx-auto mb-3 text-amber-500" size={44} />
        <h2 className="text-3xl font-bold tracking-tight">{t("play.finalScores")}</h2>
        <p className="mt-1 text-stone-500 dark:text-stone-400">{quiz.title}</p>

        <div className="mt-10 flex items-end justify-center gap-2 sm:gap-4">
          {layout.map((rank) => {
            const p = podium[rank];
            if (!p) return null;
            return (
              <div
                key={p.id}
                className="qn-fade-up flex w-24 flex-col items-center"
                style={{ animationDelay: `${rank * 0.12}s` }}
              >
                {rank === 0 && hasWinner && (
                  <span className="mb-1 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-900">
                    {t("play.winner")}
                  </span>
                )}
                <Avatar
                  color={colorFor(p, idxOf(p))}
                  emoji={p.emoji}
                  photo={p.photo}
                  name={p.name}
                  size={rank === 0 ? 56 : 44}
                  className="shadow-md"
                />
                <span className="mt-1 max-w-full truncate text-sm font-semibold">{p.name}</span>
                <span className="text-lg font-bold tabular-nums">{p.score}</span>
                <div
                  className={`mt-1 flex w-full items-start justify-center rounded-t-xl pt-2 text-2xl ${podHeight[rank]} ${
                    rank === 0
                      ? "bg-amber-200 dark:bg-amber-500/30"
                      : rank === 1
                        ? "bg-stone-200 dark:bg-stone-700"
                        : "bg-orange-200 dark:bg-orange-500/25"
                  }`}
                >
                  {medal[rank]}
                </div>
              </div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <div className="mt-6 space-y-2">
            {rest.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-4 py-2.5 dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-sm font-bold text-stone-400">{i + 4}</span>
                  <Avatar color={colorFor(p, idxOf(p))} emoji={p.emoji} photo={p.photo} name={p.name} size={24} />
                  <span className="font-medium">{p.name}</span>
                </div>
                <span className="font-bold tabular-nums">{p.score}</span>
              </div>
            ))}
          </div>
        )}

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
      <div className={`mx-auto px-6 pb-32 pt-6 ${pres ? "max-w-4xl qn-present" : "max-w-2xl"}`}>
        {Header}
        <div className="qn-fade-up mt-10 text-center">
          <div
            className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ${accentFor(round.type).soft}`}
          >
            <Icon size={28} />
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
      <div className={`mx-auto px-6 pb-32 pt-6 ${pres ? "max-w-5xl qn-present" : "max-w-3xl"}`}>
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
            <Button className="px-6 py-3.5 text-base" onClick={endRound}>
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
    <Button className="px-6 py-3.5 text-base" onClick={reveal}>
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
        keys: [
          t("play.scReveal"),
          round.type === "hints" ? t("play.scHint") : null,
          round.type === "morph" ? t("play.scDemorph") : null,
          round.type === "fusion" ? t("play.scDefuse") : null,
          round.type === "clip" && clipLadderActive(q) ? t("play.scExtend") : null,
          t("play.scNext"),
          allowNegative ? t("play.scSign") : null,
          t("play.scAward"),
        ]
          .filter(Boolean)
          .join(" · "),
      })}
    </p>
  );

  /* buzzer banner: who buzzed first, with re-arm/reset (only for buzz rounds) */
  const buzzName = room?.buzz ? entityForDevice(room.buzz.deviceId)?.name || room.buzz.name : "";
  const BuzzerBar = buzzerOn && !game.revealed && !["map", "choice", "number"].includes(round.type) && (
    <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
      {room.buzz ? (
        <span className="inline-flex animate-pulse items-center gap-2 rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-bold text-white">
          <Bell size={15} /> {t("play.buzzedFirst", { name: buzzName })}
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
            <p className="qn-pop qn-answer text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">
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
          <span className={`rounded-full px-3 py-1 text-sm font-bold ${accentFor(round.type).soft}`}>
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
            <p className="qn-pop qn-answer mt-8 text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">
              {q.answer}
            </p>
            <div className="mt-8">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "video" || round.type === "clip") {
    const ladder = clipLadderActive(q);
    const atEnd = morphStep >= q.steps;
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        {ladder && !game.revealed && (
          <div className="mb-4 flex items-center justify-center">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${accentFor(round.type).soft}`}>
              {t("play.worth", { value })}
            </span>
          </div>
        )}
        <div className="mx-auto max-w-2xl">
          {soundOnTv ? (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
              <Tv size={32} />
              <p className="text-sm font-medium">{t("play.playingOnTv")}</p>
            </div>
          ) : (
            <MediaPlayer
              key={qKey}
              url={q.url}
              audioOnly={!!q.audioOnly}
              start={q.start}
              end={clipEnd(q, morphStep)}
              transport={transport}
            />
          )}
        </div>
        {/* transport: when the TV is the stage, the host drives playback from here */}
        {soundOnTv && !game.revealed && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" className="px-4 py-2.5" onClick={() => sendTransport("play")}>
              <Play size={16} /> {t("play.play")}
            </Button>
            <Button variant="outline" className="px-4 py-2.5" onClick={() => sendTransport("pause")}>
              <Pause size={16} /> {t("play.pause")}
            </Button>
            <Button variant="outline" className="px-4 py-2.5" onClick={() => sendTransport("restart")}>
              <RotateCcw size={16} /> {t("play.restart")}
            </Button>
          </div>
        )}
        <h2 className="mt-6 text-2xl font-bold tracking-tight md:text-3xl">{q.q}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3" style={{ minHeight: 64 }}>
          {game.revealed ? (
            <p className="qn-pop qn-answer text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-3xl">
              {q.a}
            </p>
          ) : (
            <>
              {ladder && !atEnd && (
                <Button variant="outline" className="px-5 py-3 text-base" onClick={() => extendClip(q.steps)}>
                  <FastForward size={18} /> {t("play.extendClip")}{" "}
                  <span className="text-sm text-stone-400">
                    ({morphStep + 1}/{q.steps + 1})
                  </span>
                </Button>
              )}
              {RevealBtn}
            </>
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
            <p className="qn-pop qn-answer text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-3xl">
              {q.a}
            </p>
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
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${accentFor(round.type).soft}`}>
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
            <p className="qn-pop qn-answer mt-6 text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">
              {q.a}
            </p>
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
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${accentFor(round.type).soft}`}>
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
            <p className="qn-pop qn-answer mt-6 text-2xl font-bold text-indigo-600 dark:text-indigo-400 md:text-4xl">
              {q.a}
            </p>
            <div className="mt-6">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "choice") {
    const answersByEntity = buzzerOn ? mapByEntity(room.answers) : {};
    const counts = q.options.map((_, oi) => Object.values(answersByEntity).filter((v) => v === oi).length);
    const answered = Object.keys(answersByEntity).length;
    const letters = ["A", "B", "C", "D", "E", "F"];
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{q.q}</h2>
        {buzzerOn && !game.revealed && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-700 dark:bg-teal-500/10 dark:text-teal-300">
            <Radio size={14} /> {t("play.answersIn", { n: answered, total: game.players.length })}
          </p>
        )}
        <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-2">
          {q.options.map((opt, oi) => {
            const isCorrect = game.revealed && oi === q.correct;
            return (
              <div
                key={oi}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  isCorrect
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500/50 dark:bg-emerald-500/10"
                    : "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isCorrect
                      ? "bg-emerald-500 text-white"
                      : "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-200"
                  }`}
                >
                  {letters[oi]}
                </span>
                <span className="min-w-0 flex-1 font-medium md:text-lg">{opt}</span>
                {buzzerOn && <span className="text-sm font-bold tabular-nums text-stone-400">{counts[oi]}</span>}
                {isCorrect && <Check size={18} className="text-emerald-600 dark:text-emerald-400" />}
              </div>
            );
          })}
        </div>
        <div className="mt-6">
          {game.revealed ? (
            NextBtn
          ) : (
            <Button className="px-6 py-3.5 text-base" onClick={() => revealChoice(q)}>
              <Eye size={18} /> {t("play.revealAnswer")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (round.type === "number") {
    const answersByEntity = buzzerOn ? mapByEntity(room.answers) : {};
    const answered = Object.values(answersByEntity).filter((v) => Number.isFinite(+v)).length;
    const ranked =
      q.answer != null
        ? game.players
            .map((p, i) => ({ p, i, g: +answersByEntity[p.id] }))
            .filter((x) => Number.isFinite(x.g))
            .map((x) => ({ ...x, diff: Math.abs(x.g - q.answer) }))
            .sort((a, b) => a.diff - b.diff)
        : [];
    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{q.q}</h2>
        {buzzerOn && !game.revealed && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            <Radio size={14} /> {t("play.answersIn", { n: answered, total: game.players.length })}
          </p>
        )}
        <div className="mt-8" style={{ minHeight: 72 }}>
          {game.revealed ? (
            <p className="qn-pop qn-answer text-3xl font-bold text-indigo-600 dark:text-indigo-400 md:text-5xl">
              {q.answer != null ? `${q.answer}${q.unit ? ` ${q.unit}` : ""}` : "—"}
            </p>
          ) : (
            <Button className="px-6 py-3.5 text-base" onClick={() => revealNumber(q)}>
              <Eye size={18} /> {t("play.revealAnswer")}
            </Button>
          )}
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
                  <Avatar color={colorFor(x.p, x.i)} emoji={x.p.emoji} photo={x.p.photo} name={x.p.name} size={22} />
                  {x.p.name}
                  <span className="text-stone-400">
                    {x.g}
                    {q.unit ? ` ${q.unit}` : ""}
                  </span>
                  {idx === 0 && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Target size={12} /> {t("play.closest")}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-stone-500 dark:text-stone-400">
                  Δ {Math.round(x.diff * 100) / 100}
                </span>
              </div>
            ))}
          </div>
        )}
        {game.revealed && <div className="mt-6">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "map") {
    const hasAnswer = q.lat != null && q.lng != null;
    // Merge host-placed guesses with phone-submitted pins (re-keyed by entity).
    const phonePins = buzzerOn ? mapByEntity(room.pins) : {};
    const combined = { ...(game.guesses || {}), ...phonePins };
    const markers = game.players
      .map((p, i) => {
        const g = combined[p.id];
        return g ? { lat: g.lat, lng: g.lng, color: colorFor(p, i), label: p.name } : null;
      })
      .filter(Boolean);
    const ranked = hasAnswer
      ? game.players
          .map((p, i) => ({ p, i, g: combined[p.id] }))
          .filter((x) => x.g)
          .map((x) => ({ ...x, km: haversineKm(x.g.lat, x.g.lng, q.lat, q.lng) }))
          .sort((a, b) => a.km - b.km)
      : [];
    // Fit the whole map round on one screen for the host (shorter map); keep it
    // big for the projector/TV (pres).
    const mapH = pres ? "h-[58vh]" : "h-[40vh]";

    body = (
      <div className="text-center">
        {Progress}
        {TimerPill}
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{q.q}</h2>

        {!game.revealed && (
          <div className="mx-auto mt-3 max-w-2xl">
            {buzzerOn && (
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                <Radio size={14} /> {t("play.pinsIn", { n: Object.keys(phonePins).length, total: game.players.length })}
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
                    style={sel ? { backgroundColor: colorFor(p, i) } : undefined}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: sel ? "#fff" : colorFor(p, i) }}
                    />
                    {p.name}
                    {has && <span className={sel ? "text-white/80" : "text-emerald-600 dark:text-emerald-400"}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!game.revealed && mapillaryEmbedUrl(q.street) && (
          <div className="mx-auto mt-4 inline-flex rounded-xl border border-stone-200 p-0.5 dark:border-stone-700">
            {[
              { k: false, label: t("play.mapView") },
              { k: true, label: t("play.streetView") },
            ].map(({ k, label }) => (
              <button
                key={String(k)}
                onClick={() => setStreetOn(k)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${FOCUS} ${
                  streetOn === k
                    ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="mx-auto mt-3 max-w-3xl">
          {streetOn && !game.revealed && mapillaryEmbedUrl(q.street) ? (
            <MapillaryEmbed street={q.street} className={mapH} />
          ) : (
            <LeafletMap
              answer={game.revealed && hasAnswer ? { lat: q.lat, lng: q.lng, label: q.name } : undefined}
              guesses={markers}
              showLines={game.revealed}
              onPick={game.revealed ? undefined : placeGuess}
              tileLayer={q.tileLayer}
              className={mapH}
            />
          )}
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
                  <Avatar color={colorFor(x.p, x.i)} emoji={x.p.emoji} photo={x.p.photo} name={x.p.name} size={22} />
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
            <Button className="px-6 py-3.5 text-base" onClick={() => revealMap(q)}>
              <MapPin size={18} /> {t("play.revealLocation")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`mx-auto px-6 pb-36 pt-6 ${pres ? "max-w-5xl qn-present" : "max-w-3xl"}`}>
      {Header}
      {BuzzerBar}
      <div key={qKey} className="qn-fade-up">
        {body}
      </div>
      {!pres && Shortcuts}
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
