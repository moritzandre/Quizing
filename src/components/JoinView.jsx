/* ====================================================================
   JOIN VIEW (phone) — buzz, drop map pins, pick answers, guess numbers
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import { Radio, Wifi, WifiOff, Check, MapPin, ListChecks, Hash, Camera, Loader2, X, Trophy } from "lucide-react";
import { usePlayerRoom } from "./useRoom.js";
import { FOCUS, inputCls, Button, Avatar, AnimatedNumber, PLAYER_COLORS, PLAYER_EMOJI } from "./ui.jsx";
import { fileToDataUrl } from "../lib/model.js";
import { playSound } from "../lib/sound.js";
import LeafletMap from "./LeafletMap.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

/** Stable small hash → spread default avatars so unconfigured phones still differ. */
const hashIdx = (s, n) => {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % n;
};

/**
 * Standalone phone page reached via #/join/<code> (the host's QR).
 * @param {object} props
 * @param {string} props.code Room code from the URL.
 */
export default function JoinView({ code }) {
  const { t } = useI18n();
  const room = usePlayerRoom(code);
  const [draftName, setDraftName] = useState("");
  const [teamId, setTeamId] = useState(null);
  const [pickedEmoji, setPickedEmoji] = useState(() => PLAYER_EMOJI[hashIdx(room.deviceId, PLAYER_EMOJI.length)]);
  const [pickedColor, setPickedColor] = useState(() => PLAYER_COLORS[hashIdx(room.deviceId, PLAYER_COLORS.length)]);
  const [pickedPhoto, setPickedPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef(null);
  const [joined, setJoined] = useState(false);
  const [myPin, setMyPin] = useState(null);
  const [pinSent, setPinSent] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [answerSent, setAnswerSent] = useState(false);

  const phase = room.state?.phase || "idle";
  const qKey = room.state?.qKey;
  const lockedBy = room.state?.lockedBy || null;
  const teams = room.state?.teams || null;
  const options = room.state?.options || [];

  // Live standings mirrored from the host: find our own entity (by deviceId) to
  // show score + rank, and the sorted list for the between-questions leaderboard.
  const standings = room.state?.scores || [];
  const sorted = [...standings].sort((a, b) => b.score - a.score);
  const myEntity = standings.find((e) => (e.deviceIds || []).includes(room.deviceId)) || null;
  const myScore = myEntity ? myEntity.score : null;
  const myRank = myEntity ? sorted.findIndex((e) => e.id === myEntity.id) + 1 : null;

  // New question/round → clear our previous pin and answer.
  useEffect(() => {
    setMyPin(null);
    setPinSent(false);
    setAnswer(null);
    setAnswerSent(false);
  }, [qKey]);

  // Celebrate a points gain: float a "+N" and play a coin (or a climb if our rank
  // improved). Tracks the previous score/rank across renders.
  const prevRef = useRef({ score: null, rank: null });
  const gainKey = useRef(0);
  const [gain, setGain] = useState(null);
  useEffect(() => {
    if (myScore == null) return;
    const prev = prevRef.current;
    const climbed = prev.rank != null && myRank != null && myRank < prev.rank;
    if (prev.score != null && myScore > prev.score) {
      gainKey.current += 1;
      setGain({ delta: myScore - prev.score, key: gainKey.current });
      playSound(climbed ? "levelup" : "coin");
    }
    prevRef.current = { score: myScore, rank: myRank };
  }, [myScore, myRank]);

  // Tell the host we're gone when the tab/app closes, so the roster shrinks.
  const leaveRef = useRef(room.leave);
  leaveRef.current = room.leave;
  useEffect(() => {
    if (!joined) return;
    const onHide = () => leaveRef.current?.();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [joined]);

  const iLocked = lockedBy && lockedBy === room.deviceId;
  const online = room.status === "connected";
  const needsTeam = !!teams;
  const canJoin = draftName.trim() && (!needsTeam || teamId);

  const placePin = (lat, lng) => {
    setMyPin({ lat, lng });
    setPinSent(true);
    room.sendPin(lat, lng);
    playSound("select");
  };
  const pick = (value) => {
    setAnswer(value);
    setAnswerSent(true);
    room.sendAnswer(value);
    playSound("select");
  };
  const buzz = () => {
    room.buzz();
    playSound("buzz");
  };
  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    try {
      // Avatars are tiny — downscale hard so the photo stays small on the wire.
      setPickedPhoto(await fileToDataUrl(file, { maxDim: 160, keepBelow: 0, quality: 0.72 }));
    } catch {
      /* ignore — keep the emoji avatar */
    } finally {
      setPhotoBusy(false);
    }
  };

  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="qn-app-bg flex h-[100dvh] flex-col overflow-hidden px-5 py-6 font-sans text-stone-900 antialiased dark:text-stone-100">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-pixel text-sm leading-tight text-stone-900 dark:text-stone-50">
            QUIZ<span className="text-indigo-600 dark:text-indigo-400"> NIGHT</span>
          </h1>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              online
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            }`}
          >
            {online ? <Wifi size={12} /> : <WifiOff size={12} />}
            {online ? t("join.connected") : t("join.connecting")}
          </span>
        </div>

        {!joined ? (
          <div className="flex flex-1 flex-col justify-center">
            <div className="mb-2 flex items-center gap-2 text-stone-400">
              <Radio size={18} />
              <span className="text-sm font-medium uppercase tracking-wide">{t("join.joinRoom", { code })}</span>
            </div>
            <h2 className="mb-4 text-3xl font-bold tracking-tight">{t("join.whatsYourName")}</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canJoin) return;
                room.join(
                  draftName,
                  teamId,
                  needsTeam ? null : { emoji: pickedEmoji, color: pickedColor, photo: pickedPhoto },
                );
                setJoined(true);
              }}
            >
              <input
                className={`${inputCls} text-lg`}
                placeholder={t("join.namePlaceholder")}
                value={draftName}
                autoFocus
                maxLength={24}
                onChange={(e) => setDraftName(e.target.value)}
              />
              {!needsTeam && (
                <div className="mt-5">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar
                      color={pickedColor}
                      emoji={pickedEmoji}
                      photo={pickedPhoto}
                      name={draftName}
                      size={48}
                      className="shadow-sm"
                    />
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-300">{t("join.pickAvatar")}</p>
                    <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                    {pickedPhoto ? (
                      <button
                        type="button"
                        onClick={() => setPickedPhoto("")}
                        className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 ${FOCUS}`}
                      >
                        <X size={14} /> {t("join.removePhoto")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => photoRef.current?.click()}
                        disabled={photoBusy}
                        className={`ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-100 disabled:opacity-50 dark:text-stone-400 dark:hover:bg-stone-800 ${FOCUS}`}
                      >
                        {photoBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}{" "}
                        {t("join.usePhoto")}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAYER_EMOJI.map((em) => (
                      <button
                        type="button"
                        key={em}
                        onClick={() => setPickedEmoji(em)}
                        aria-label={em}
                        aria-pressed={pickedEmoji === em}
                        className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg transition active:scale-90 ${FOCUS} ${
                          pickedEmoji === em
                            ? "bg-stone-900 ring-2 ring-stone-900 dark:bg-stone-100 dark:ring-stone-100"
                            : "bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700"
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {PLAYER_COLORS.map((c, i) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setPickedColor(c)}
                        aria-label={t("join.colorN", { n: i + 1 })}
                        aria-pressed={pickedColor === c}
                        style={{ backgroundColor: c }}
                        className={`h-9 w-9 rounded-full transition active:scale-90 ${FOCUS} ${
                          pickedColor === c
                            ? "ring-2 ring-stone-900 ring-offset-2 ring-offset-white dark:ring-stone-100 dark:ring-offset-stone-950"
                            : ""
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {needsTeam && (
                <div className="mt-4">
                  <p className="mb-2 text-sm font-medium text-stone-600 dark:text-stone-300">{t("join.pickTeam")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {teams.map((tm) => (
                      <button
                        type="button"
                        key={tm.id}
                        onClick={() => setTeamId(tm.id)}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${FOCUS} ${
                          teamId === tm.id
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-300"
                            : "border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
                        }`}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: tm.color || "#6366f1" }}
                        />
                        <span className="min-w-0 truncate">{tm.name}</span>
                        {teamId === tm.id && <Check size={15} className="ml-auto shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Button type="submit" variant="accent" className="mt-4 w-full px-6 py-3.5 text-base" disabled={!canJoin}>
                {t("join.joinGame")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            {/* persistent arcade HUD: avatar + name, plus live score + rank once
                the host has started scoring (a "+N" floats up on every gain) */}
            <div className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border-2 border-stone-200 bg-white/70 px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-900/60">
              <Avatar
                color={myEntity?.color || pickedColor}
                emoji={needsTeam ? myEntity?.emoji : pickedEmoji}
                photo={needsTeam ? null : pickedPhoto}
                name={room.name}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-stone-800 dark:text-stone-100">{room.name}</p>
                <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  {t("join.score")}
                </p>
                {myScore != null ? (
                  <AnimatedNumber
                    value={myScore}
                    pop
                    className="font-pixel text-lg leading-tight text-stone-900 dark:text-stone-50"
                  />
                ) : (
                  <span className="font-pixel text-lg leading-tight text-stone-300 dark:text-stone-600">0</span>
                )}
              </div>
              {myRank != null && (
                <div className="shrink-0 text-right">
                  <p className="font-pixel text-[8px] uppercase tracking-widest text-stone-400 dark:text-stone-500">
                    {t("join.rank")}
                  </p>
                  <p className="font-pixel text-lg leading-tight text-indigo-600 dark:text-indigo-400">
                    {myRank}
                    <span className="text-[10px] text-stone-400">/{sorted.length}</span>
                  </p>
                </div>
              )}
              {gain && (
                <span
                  key={gain.key}
                  className="qn-float-up pointer-events-none absolute left-14 top-1.5 font-pixel text-sm text-emerald-500"
                >
                  +{gain.delta}
                </span>
              )}
            </div>

            {phase === "buzz" && (
              <div className="flex flex-1 flex-col items-center justify-center">
                {iLocked ? (
                  <div className="text-center">
                    <div className="mx-auto mb-4 flex h-28 w-28 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg">
                      <Check size={56} />
                    </div>
                    <p className="text-2xl font-bold">{t("join.youreInFirst")}</p>
                    <p className="mt-1 text-stone-500 dark:text-stone-400">{t("join.answerOutLoud")}</p>
                  </div>
                ) : lockedBy ? (
                  <div className="text-center">
                    <p className="text-xl font-semibold text-stone-500 dark:text-stone-400">
                      {t("join.someoneBuzzed")}
                    </p>
                    <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">{t("join.waitNext")}</p>
                  </div>
                ) : (
                  <button
                    onClick={buzz}
                    className={`flex h-56 w-56 items-center justify-center rounded-full border-4 border-indigo-800 bg-indigo-600 font-pixel text-xl uppercase tracking-wider text-white shadow-[0_8px_0_0_#3730a3] transition hover:bg-indigo-500 active:translate-y-2 active:shadow-[0_2px_0_0_#3730a3] ${FOCUS} dark:border-indigo-300/40`}
                  >
                    <span className="qn-blink">{t("join.buzz")}</span>
                  </button>
                )}
              </div>
            )}

            {phase === "map" && (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-2 flex shrink-0 items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <MapPin size={16} /> {t("join.tapMap")}
                </div>
                <div className="min-h-0 flex-1">
                  <LeafletMap
                    answer={myPin ? { lat: myPin.lat, lng: myPin.lng, label: room.name } : undefined}
                    onPick={placePin}
                    className="h-full w-full"
                  />
                </div>
                <p
                  className={`mt-2 shrink-0 text-center text-sm ${pinSent ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}`}
                >
                  {pinSent ? t("join.pinSent") : t("join.noPin")}
                </p>
              </div>
            )}

            {phase === "choice" && (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <ListChecks size={16} /> {t("join.tapAnswer")}
                </div>
                <div className="grid gap-2.5">
                  {options.map((opt, oi) => {
                    const selected = answer === oi;
                    return (
                      <button
                        key={oi}
                        onClick={() => pick(oi)}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left text-lg font-medium transition active:scale-[0.99] ${FOCUS} ${
                          selected
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-500/10 dark:text-indigo-200"
                            : "border-stone-200 bg-white text-stone-800 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-pixel text-xs ${
                            selected
                              ? "bg-indigo-600 text-white"
                              : "bg-stone-100 text-stone-500 dark:bg-stone-700 dark:text-stone-200"
                          }`}
                        >
                          {letters[oi]}
                        </span>
                        <span className="min-w-0 flex-1">{opt}</span>
                        {selected && <Check size={18} className="shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <p
                  className={`mt-4 text-center text-sm ${answerSent ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}`}
                >
                  {answerSent ? t("join.submitted") : t("join.tapAnswer")}
                </p>
              </div>
            )}

            {phase === "number" && (
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <Hash size={16} /> {t("join.enterNumber")}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = +answer;
                    if (answer === null || answer === "" || !Number.isFinite(v)) return;
                    pick(v);
                  }}
                >
                  <input
                    type="number"
                    step="any"
                    inputMode="decimal"
                    className={`${inputCls} text-center text-2xl font-bold`}
                    placeholder="0"
                    value={answer ?? ""}
                    onChange={(e) => {
                      setAnswer(e.target.value);
                      setAnswerSent(false);
                    }}
                  />
                  <Button
                    type="submit"
                    variant="accent"
                    className="mt-4 w-full px-6 py-3.5 text-base"
                    disabled={answer === null || answer === "" || answerSent}
                  >
                    {answerSent ? t("join.submitted") : t("join.submit")}
                  </Button>
                </form>
              </div>
            )}

            {phase !== "buzz" &&
              phase !== "map" &&
              phase !== "choice" &&
              phase !== "number" &&
              (sorted.length > 0 ? (
                <div className="flex min-h-0 flex-1 flex-col">
                  <p className="mb-3 flex shrink-0 items-center justify-center gap-2 font-pixel text-xs uppercase tracking-widest text-stone-500 dark:text-stone-400">
                    <Trophy size={14} className="text-amber-500" /> {t("join.leaderboard")}
                  </p>
                  <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto">
                    {sorted.map((e, i) => {
                      const mine = myEntity && e.id === myEntity.id;
                      return (
                        <div
                          key={e.id}
                          className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 transition ${
                            mine
                              ? "border-indigo-400 bg-indigo-50 dark:border-indigo-500/50 dark:bg-indigo-500/10"
                              : "border-stone-200 bg-white/70 dark:border-stone-800 dark:bg-stone-900/50"
                          }`}
                        >
                          <span
                            className={`w-6 shrink-0 text-center font-pixel text-xs ${
                              i === 0 ? "text-amber-500" : "text-stone-400 dark:text-stone-500"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <Avatar color={e.color} emoji={e.emoji} name={e.name} size={26} />
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
                            {e.name}
                            {mine && <span className="ml-1 text-indigo-500">{t("join.youTag")}</span>}
                          </span>
                          <AnimatedNumber
                            value={e.score}
                            pop
                            className="shrink-0 font-pixel text-sm text-stone-700 dark:text-stone-200"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 shrink-0 text-center text-xs text-stone-400 dark:text-stone-500">
                    {t("join.watchScreen")}
                  </p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                    <Radio size={34} className="text-stone-400" />
                  </div>
                  <p className="text-lg font-semibold">{t("join.youreIn")}</p>
                  <p className="mt-1 text-stone-500 dark:text-stone-400">{t("join.watchScreen")}</p>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
