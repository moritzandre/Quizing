/* ====================================================================
   HOST REMOTE (phone) — drive the game from a phone (#/host/<code>)
   --------------------------------------------------------------------
   A second device the HOST holds to reveal answers, advance, award
   points, etc. — distinct from the read-only TV presenter. It reads the
   same present/live payloads for context and sends `ctrl` commands up to
   the laptop host, which applies them to the game. Whoever holds this URL
   controls the game, so it's a host-only QR (same trust model as the room).
   ==================================================================== */

import {
  Eye,
  ArrowRight,
  Lightbulb,
  Play,
  Bell,
  BarChart3,
  Plus,
  Minus,
  SkipForward,
  Volume2,
  VolumeX,
  RotateCcw,
  Pause,
  Wifi,
  WifiOff,
  Gamepad2,
} from "lucide-react";
import { usePresenterRoom } from "./useRoom.js";
import { TYPES, FOCUS, Avatar } from "./ui.jsx";
import { clipLadderActive } from "../lib/model.js";
import { useI18n } from "../i18n/I18nProvider.jsx";
import RoundBody from "./RoundBody.jsx";

/**
 * @param {object} props
 * @param {string} props.code Room code from the URL (#/host/<code>).
 */
export default function HostRemoteView({ code }) {
  const { t } = useI18n();
  const { status, present, live, alive, sendCtrl } = usePresenterRoom(code);
  const online = status === "connected";
  const stage = live?.stage || present?.stage || "idle";
  const type = present?.roundType;
  const revealed = !!live?.revealed;
  const value = live?.value || 0;
  // Rounds with a ladder to advance via the "hint" ctrl: hint/morph/fusion always,
  // and clip only while its ladder is live (steps + a real trim window).
  const hasLadder =
    type === "hints" || type === "morph" || type === "fusion" || (type === "clip" && clipLadderActive(present?.q));
  // Photos ride the heavy present channel; merge them into the light live standings.
  const photos = present?.photos || {};
  const standings = (live?.standings || []).map((s) => (photos[s.id] ? { ...s, photo: photos[s.id] } : s));

  const btn =
    "flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-semibold transition active:scale-[.97] disabled:opacity-30";

  const Shell = (children) => (
    <div className="qn-app-bg flex min-h-[100dvh] flex-col px-5 py-6 text-stone-900 antialiased dark:text-stone-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Gamepad2 size={20} /> {t("host.title")}
          </h1>
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
        </div>
        {children}
      </div>
    </div>
  );

  if (!online || !alive || !present) {
    return Shell(
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <Gamepad2 size={34} className="text-stone-400" />
        </div>
        <p className="text-lg font-semibold">{online ? t("host.waiting") : t("present.connecting")}</p>
        <p className="mt-1 text-stone-500 dark:text-stone-400">{t("present.roomCode", { code })}</p>
      </div>,
    );
  }

  const roundLabel = type ? t(`round.${type}.label`) : "";
  const TypeIcon = type ? TYPES[type]?.icon : null;

  return Shell(
    <div className="flex flex-1 flex-col">
      {/* context */}
      <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          {TypeIcon && <TypeIcon size={15} />}
          <span className="font-medium text-stone-700 dark:text-stone-200">{roundLabel || t("host.title")}</span>
          <span className="ml-auto">
            {t("play.roundProgress", { n: (present.ri || 0) + 1, total: present.total || 1 })}
          </span>
        </div>
        {present.q?.q && <p className="mt-1 truncate text-sm text-stone-500 dark:text-stone-400">{present.q.q}</p>}
      </div>

      {/* live round mirror — lets the host read the question/answer and see the
          map/image/clip on the phone (so map rounds don't need the PC). Scrolls
          with the page; read-only (no pin placement here). */}
      {stage === "question" && present.q && type && (
        <div className="mb-4 rounded-2xl border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900">
          <div className="h-[38vh] overflow-hidden">
            <RoundBody
              type={type}
              q={present.q}
              revealed={revealed}
              hintsShown={live?.hintsShown || 1}
              step={live?.step || 0}
              reveal={live?.reveal || null}
              compact
              qKey={`${present.ri ?? 0}-${present.qi ?? 0}`}
              whoknows={live?.whoknows || null}
            />
          </div>
        </div>
      )}

      {/* primary controls */}
      <div className="grid grid-cols-2 gap-2">
        {stage === "intro" && (
          <>
            <button
              onClick={() => sendCtrl("startRound")}
              className={`col-span-2 bg-indigo-600 text-white ${btn} ${FOCUS}`}
            >
              <Play size={18} /> {t("play.startRound")}
            </button>
            <button
              onClick={() => sendCtrl("skipRound")}
              className={`col-span-2 border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
            >
              <SkipForward size={18} /> {t("host.skipRound")}
            </button>
          </>
        )}
        {stage === "question" && (
          <>
            {!revealed && (
              <button
                onClick={() => sendCtrl("reveal")}
                className={`col-span-2 bg-indigo-600 text-white ${btn} ${FOCUS}`}
              >
                <Eye size={18} /> {t("play.revealAnswer")}
              </button>
            )}
            {!revealed && (type === "video" || type === "clip") && (
              <div className="col-span-2 grid grid-cols-3 gap-2">
                <button
                  onClick={() => sendCtrl("media", { action: "play" })}
                  className={`border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
                >
                  <Play size={16} /> {t("play.play")}
                </button>
                <button
                  onClick={() => sendCtrl("media", { action: "pause" })}
                  className={`border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
                >
                  <Pause size={16} /> {t("play.pause")}
                </button>
                <button
                  onClick={() => sendCtrl("media", { action: "restart" })}
                  className={`border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
                >
                  <RotateCcw size={16} /> {t("play.restart")}
                </button>
              </div>
            )}
            {!revealed && (type === "video" || type === "clip") && (
              <label className="col-span-2 flex items-center gap-3 rounded-2xl border border-stone-300 px-4 py-2.5 dark:border-stone-700">
                {(live?.volume ?? 100) === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={live?.volume ?? 100}
                  onChange={(e) => sendCtrl("volume", { value: +e.target.value })}
                  aria-label={t("play.volume")}
                  className="h-1 flex-1 cursor-pointer accent-indigo-500"
                />
              </label>
            )}
            {!revealed && hasLadder && (
              <button
                onClick={() => sendCtrl("hint")}
                className={`bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 ${btn} ${FOCUS}`}
              >
                <Lightbulb size={18} /> {type === "clip" ? t("play.extendClip") : t("host.hint")}
              </button>
            )}
            <button
              onClick={() => sendCtrl("advance")}
              className={`border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS} ${
                !revealed && !hasLadder ? "col-span-2" : ""
              }`}
            >
              <ArrowRight size={18} /> {revealed ? t("host.next") : t("play.skipQuestion")}
            </button>
            <button
              onClick={() => sendCtrl("resetBuzz")}
              className={`border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
            >
              <Bell size={18} /> {t("host.resetBuzz")}
            </button>
            <button
              onClick={() => sendCtrl("skipRound")}
              className={`border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
            >
              <SkipForward size={18} /> {t("host.skipRound")}
            </button>
          </>
        )}
        <button
          onClick={() => sendCtrl("standings", { on: !live?.showStandings })}
          className={`col-span-2 border border-stone-300 dark:border-stone-700 ${btn} ${FOCUS}`}
        >
          <BarChart3 size={18} /> {t("play.standings")}
        </button>
        <button
          onClick={() => sendCtrl("soundOnTv", { on: !live?.soundOnTv })}
          className={`col-span-2 border ${btn} ${FOCUS} ${
            live?.soundOnTv
              ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
              : "border-stone-300 dark:border-stone-700"
          }`}
        >
          <Volume2 size={18} /> {t("play.soundOnTv")} {live?.soundOnTv ? "✓" : ""}
        </button>
      </div>

      {/* award + adjust */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
            {t("host.award", { n: value })}
          </p>
          {live?.allowNegative && (
            <div className="inline-flex overflow-hidden rounded-lg border border-stone-200 text-xs font-semibold dark:border-stone-700">
              <button
                onClick={() => sendCtrl("sign", { sign: 1 })}
                className="px-2 py-1 text-emerald-600 dark:text-emerald-400"
              >
                +{value}
              </button>
              <button
                onClick={() => sendCtrl("sign", { sign: -1 })}
                className="px-2 py-1 text-red-600 dark:text-red-400"
              >
                −{value}
              </button>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          {[...standings]
            .sort((a, b) => b.score - a.score)
            .map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-2.5 py-2 dark:border-stone-800 dark:bg-stone-900"
              >
                <Avatar color={s.color} emoji={s.emoji} photo={s.photo} name={s.name} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                <span className="w-7 shrink-0 text-center text-sm font-bold tabular-nums">{s.score}</span>
                {/* fine tweak ±1 */}
                <button
                  onClick={() => sendCtrl("adjust", { id: s.id, delta: -1 })}
                  aria-label="-1"
                  className={`shrink-0 rounded-md border border-stone-200 p-1.5 text-stone-500 dark:border-stone-700 ${FOCUS}`}
                >
                  <Minus size={13} />
                </button>
                <button
                  onClick={() => sendCtrl("adjust", { id: s.id, delta: 1 })}
                  aria-label="+1"
                  className={`shrink-0 rounded-md border border-stone-200 p-1.5 text-stone-500 dark:border-stone-700 ${FOCUS}`}
                >
                  <Plus size={13} />
                </button>
                {/* take / give the round's points */}
                {value > 0 && (
                  <>
                    <button
                      onClick={() => sendCtrl("adjust", { id: s.id, delta: -value })}
                      aria-label={`-${value}`}
                      className={`shrink-0 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white ${FOCUS}`}
                    >
                      −{value}
                    </button>
                    <button
                      onClick={() => sendCtrl("adjust", { id: s.id, delta: value })}
                      aria-label={`+${value}`}
                      className={`shrink-0 rounded-md bg-emerald-600 px-2 py-1 text-xs font-bold text-white ${FOCUS}`}
                    >
                      +{value}
                    </button>
                  </>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>,
  );
}
