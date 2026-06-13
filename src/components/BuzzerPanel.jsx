/* ====================================================================
   BUZZER PANEL (host) — room code, QR, and connected players
   ==================================================================== */

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Radio, X, Loader2, AlertTriangle } from "lucide-react";
import { cardCls, Button, IconButton } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

const STATUS_KEY = {
  idle: "buzzer.off",
  connecting: "buzzer.connecting",
  connected: "buzzer.live",
  offline: "buzzer.reconnecting",
  error: "buzzer.error",
};

const isLocalhost = () =>
  typeof window !== "undefined" && /^(localhost|127\.|0\.0\.0\.0|::1)/.test(window.location.hostname);

/**
 * Host-side buzzer lobby: shows the join QR/code and who has joined.
 * @param {object} props
 * @param {object} props.room The useHostRoom() handle.
 */
export default function BuzzerPanel({ room }) {
  const { t } = useI18n();
  const [qr, setQr] = useState("");

  useEffect(() => {
    if (!room.link) return setQr("");
    let alive = true;
    QRCode.toDataURL(room.link, { margin: 1, width: 320 })
      .then((url) => alive && setQr(url))
      .catch(() => alive && setQr(""));
    return () => {
      alive = false;
    };
  }, [room.link]);

  if (!room.enabled) {
    return (
      <Button variant="outline" onClick={room.enable}>
        <Radio size={16} /> {t("buzzer.enable")}
      </Button>
    );
  }

  const names = Object.values(room.participants);

  return (
    <div className={`${cardCls} p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Radio size={16} className="text-indigo-600 dark:text-indigo-400" />
          {t("buzzer.title")}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              room.status === "connected"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400"
            }`}
          >
            {room.status !== "connected" && <Loader2 size={11} className="animate-spin" />}
            {t(STATUS_KEY[room.status] || "buzzer.connecting")}
          </span>
        </div>
        <IconButton label={t("buzzer.turnOff")} onClick={room.disable} className="hover:text-red-600">
          <X size={16} />
        </IconButton>
      </div>

      {isLocalhost() && (
        <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {t("buzzer.localhostWarn")}
        </p>
      )}

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="shrink-0 text-center">
          {qr ? (
            <img
              src={qr}
              alt="Join QR code"
              className="h-40 w-40 rounded-xl border border-stone-200 dark:border-stone-700"
            />
          ) : (
            <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-stone-200 text-stone-400 dark:border-stone-700">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            {t("buzzer.scanToJoin")}{" "}
            <span className="font-bold tracking-widest text-stone-700 dark:text-stone-200">{room.code}</span>
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
            {t("buzzer.joined", { n: names.length })}
          </p>
          {names.length ? (
            <div className="flex flex-wrap gap-1.5">
              {names.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-sm dark:border-stone-700 dark:bg-stone-800"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {p.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-400 dark:text-stone-500">{t("buzzer.waiting")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
