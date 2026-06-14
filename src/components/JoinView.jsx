/* ====================================================================
   JOIN VIEW (phone) — buzz in and drop map pins from your own device
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import { Radio, Wifi, WifiOff, Check, MapPin } from "lucide-react";
import { usePlayerRoom } from "./useRoom.js";
import { FOCUS, inputCls, Button } from "./ui.jsx";
import LeafletMap from "./LeafletMap.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

/**
 * Standalone phone page reached via #/join/<code> (the host's QR).
 * @param {object} props
 * @param {string} props.code Room code from the URL.
 */
export default function JoinView({ code }) {
  const { t } = useI18n();
  const room = usePlayerRoom(code);
  const [draftName, setDraftName] = useState("");
  const [joined, setJoined] = useState(false);
  const [myPin, setMyPin] = useState(null);
  const [pinSent, setPinSent] = useState(false);

  const phase = room.state?.phase || "idle";
  const qKey = room.state?.qKey;
  const lockedBy = room.state?.lockedBy || null;

  // New question/round → clear our previously dropped pin.
  useEffect(() => {
    setMyPin(null);
    setPinSent(false);
  }, [qKey]);

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

  const placePin = (lat, lng) => {
    setMyPin({ lat, lng });
    setPinSent(true);
    room.sendPin(lat, lng);
  };

  return (
    <div className="qn-app-bg flex min-h-screen flex-col px-5 py-6 font-sans text-stone-900 antialiased dark:text-stone-100">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            Quiz Night<span className="text-indigo-600 dark:text-indigo-400">.</span>
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
                if (!draftName.trim()) return;
                room.join(draftName);
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
              <Button
                type="submit"
                variant="accent"
                className="mt-4 w-full px-6 py-3.5 text-base"
                disabled={!draftName.trim()}
              >
                {t("join.joinGame")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <p className="mb-6 text-sm text-stone-500 dark:text-stone-400">
              <span className="font-semibold text-stone-800 dark:text-stone-100">
                {t("join.playingAs", { name: room.name })}
              </span>
            </p>

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
                    onClick={room.buzz}
                    className={`flex h-56 w-56 items-center justify-center rounded-full bg-indigo-600 text-3xl font-bold uppercase tracking-widest text-white shadow-xl transition active:scale-95 hover:bg-indigo-500 ${FOCUS}`}
                  >
                    {t("join.buzz")}
                  </button>
                )}
              </div>
            )}

            {phase === "map" && (
              <div className="flex flex-1 flex-col">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-stone-600 dark:text-stone-300">
                  <MapPin size={16} /> {t("join.tapMap")}
                </div>
                <LeafletMap
                  answer={myPin ? { lat: myPin.lat, lng: myPin.lng, label: room.name } : undefined}
                  onPick={placePin}
                  className="h-[55vh]"
                />
                <p
                  className={`mt-3 text-center text-sm ${pinSent ? "text-emerald-600 dark:text-emerald-400" : "text-stone-400"}`}
                >
                  {pinSent ? t("join.pinSent") : t("join.noPin")}
                </p>
              </div>
            )}

            {phase !== "buzz" && phase !== "map" && (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
                  <Radio size={34} className="text-stone-400" />
                </div>
                <p className="text-lg font-semibold">{t("join.youreIn")}</p>
                <p className="mt-1 text-stone-500 dark:text-stone-400">{t("join.watchScreen")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
