/* ====================================================================
   PRESENTER VIEW (TV) — read-only mirror of the host, no HDMI needed
   --------------------------------------------------------------------
   Opened on a TV/second screen at #/present/<code> on the same Wi-Fi. It
   subscribes to the host's present/live MQTT topics and renders a clean,
   enlarged, audience-facing view: question + media, the answer once the
   host reveals, and the animated live podium. Map pins are never shown
   (coordinates aren't sent until reveal). No controls, no answers early.
   ==================================================================== */

import { useState } from "react";
import { Trophy, Wifi, WifiOff, Tv, Volume2 } from "lucide-react";
import { usePresenterRoom } from "./useRoom.js";
import { TYPES, accentFor, ThemeToggle, Confetti } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import RoundBody from "./RoundBody.jsx";
import PodiumClimb from "./PodiumClimb.jsx";
import RoundRecap from "./RoundRecap.jsx";

/**
 * @param {object} props
 * @param {string} props.code Room code from the URL (#/present/<code>).
 */
export default function PresenterView({ code }) {
  const { t } = useI18n();
  const { status, present, live, alive } = usePresenterRoom(code);
  const online = status === "connected";
  // Browsers block audio autoplay until the page is interacted with. When the
  // host routes clip sound to the TV, we show a one-time tap to unlock audio.
  const [soundOn, setSoundOn] = useState(false);
  const needsSound = !!live?.soundOnTv && !soundOn;
  // Avatar photos arrive on the heavy/present channel; merge them into the
  // light live standings so the podium/recap can show them on the TV.
  const photos = present?.photos || {};
  const standings = (live?.standings || []).map((s) => (photos[s.id] ? { ...s, photo: photos[s.id] } : s));

  // A plain function (not a component) so children reconcile by type instead of
  // remounting the map/player subtree on every live update.
  const shell = (children) => (
    <div className="qn-app-bg qn-present flex h-[100dvh] flex-col overflow-hidden px-6 py-5 text-stone-900 antialiased dark:text-stone-100">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Tv size={20} /> {present?.quizTitle || "Quiz Night"}
        </h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              online
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            }`}
          >
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {code}
          </span>
          <ThemeToggle />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-center">{children}</div>
      {needsSound && (
        <button
          onClick={() => setSoundOn(true)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-stone-900/95 text-white backdrop-blur"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10">
            <Volume2 size={48} />
          </div>
          <p className="text-2xl font-bold">{t("play.tapForSound")}</p>
        </button>
      )}
    </div>
  );

  // Waiting: not connected yet, host gone (state cleared), or no payload yet.
  if (!online || !alive || !present) {
    return shell(
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <Tv size={36} className="text-stone-400" />
        </div>
        <h2 className="text-3xl font-bold">{online ? t("present.waiting") : t("present.connecting")}</h2>
        <p className="mt-2 text-stone-500 dark:text-stone-400">{t("present.roomCode", { code })}</p>
      </div>,
    );
  }

  // Between-rounds points-progression recap (host advanced past a round).
  if (live?.showRecap) {
    const from = live.recapFrom || {};
    return shell(
      <>
        <h2 className="mb-6 text-center text-3xl font-bold">{t("play.roundRecap")}</h2>
        <RoundRecap
          present
          entities={standings.map((s) => ({
            id: s.id,
            name: s.name,
            color: s.color,
            emoji: s.emoji,
            photo: s.photo,
            from: from[s.id] ?? s.score,
            to: s.score,
          }))}
        />
      </>,
    );
  }

  // Live standings overlay (host pressed the standings button).
  if (live?.showStandings) {
    return shell(
      <>
        <h2 className="mb-6 text-center text-3xl font-bold">{t("present.standings")}</h2>
        <PodiumClimb standings={standings} present />
      </>,
    );
  }

  if (present.stage === "end") {
    const sorted = [...standings].sort((a, b) => b.score - a.score);
    const hasWinner = sorted.length > 1 ? sorted[0]?.score > sorted[sorted.length - 1]?.score : sorted[0]?.score > 0;
    return shell(
      <>
        {hasWinner && <Confetti />}
        <div className="mb-6 text-center">
          <Trophy className="mx-auto mb-2 text-amber-500" size={48} />
          <h2 className="text-4xl font-bold tracking-tight">{t("play.finalScores")}</h2>
        </div>
        <PodiumClimb standings={standings} present />
      </>,
    );
  }

  if (present.stage === "intro" || present.stage === "board") {
    const type = present.roundType;
    const T = type ? TYPES[type] : null;
    const Icon = T?.icon;
    return shell(
      <div className="qn-fade-up text-center">
        {Icon && (
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl shadow-sm ${accentFor(type).soft}`}
          >
            <Icon size={36} />
          </div>
        )}
        <p className="text-sm font-medium uppercase tracking-widest text-stone-400">
          {t("play.round", { n: present.ri + 1 })}
        </p>
        <h2 className="mt-2 text-5xl font-bold tracking-tight">
          {present.roundTitle || (type ? t(`round.${type}.label`) : "")}
        </h2>
        {type && <p className="mx-auto mt-4 max-w-xl text-stone-500 dark:text-stone-400">{t(`round.${type}.desc`)}</p>}
      </div>,
    );
  }

  // question stage
  return shell(
    <RoundBody
      type={present.roundType}
      q={present.q || {}}
      revealed={!!live?.revealed}
      hintsShown={live?.hintsShown || 1}
      step={live?.step || 0}
      reveal={live?.reveal || null}
      transport={live?.transport || null}
      stage={!!live?.soundOnTv && soundOn}
      qKey={`${present.ri ?? 0}-${present.qi ?? 0}`}
      volume={live?.volume ?? 100}
    />,
  );
}
