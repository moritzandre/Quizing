/* ====================================================================
   SETUP VIEW (enter players, optionally open the phone buzzer room)
   ==================================================================== */

import { useState } from "react";
import { ChevronLeft, Users, X, Plus, Play } from "lucide-react";
import { FOCUS, inputCls, Button, IconButton, TypeBadge, Avatar, colorAt, emojiAt } from "./ui.jsx";
import BuzzerPanel from "./BuzzerPanel.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

/** Player-entry screen shown before a game starts. */
export default function SetupView({ quiz, defaults, room, onStart, onBack }) {
  const { t } = useI18n();
  const [names, setNames] = useState(defaults.length ? defaults : ["", ""]);

  const phonePlayers = room?.enabled
    ? Object.entries(room.participants).map(([deviceId, p]) => ({ name: p.name, deviceId }))
    : [];
  const manualPlayers = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  const players = [...phonePlayers, ...manualPlayers];

  return (
    <div className="mx-auto max-w-md px-6 pb-16 pt-6">
      <button
        onClick={onBack}
        className={`mb-8 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <ChevronLeft size={16} /> {t("common.back")}
      </button>
      <div className="mb-2 flex items-center gap-2 text-stone-400">
        <Users size={18} />
        <span className="text-sm font-medium uppercase tracking-wide">{t("setup.playersOrTeams")}</span>
      </div>
      <h2 className="text-3xl font-bold tracking-tight">{quiz.title}</h2>
      <div className="mt-1 flex flex-wrap gap-1.5 pt-2">
        {quiz.rounds.map((r) => (
          <TypeBadge key={r.id} type={r.type} />
        ))}
      </div>

      {room && (
        <div className="mt-6">
          <BuzzerPanel room={room} />
        </div>
      )}

      <div className="mt-6 space-y-2">
        {phonePlayers.length > 0 && (
          <p className="text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
            {t("setup.joinedByPhone", { n: phonePlayers.length })}
          </p>
        )}
        {names.map((n, i) => {
          // Preview the color this player will actually get: phone players first,
          // then non-blank manual names in order (mirrors startGame's seeding).
          const slot = phonePlayers.length + names.slice(0, i).filter((x) => x.trim()).length;
          return (
            <div key={i} className="flex items-center gap-2">
              <Avatar color={colorAt(slot)} emoji={emojiAt(slot)} name={n || `${i + 1}`} size={34} />
              <input
                className={inputCls}
                placeholder={t("setup.playerN", { n: i + 1 })}
                value={n}
                onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
              />
              {names.length > 1 && (
                <IconButton
                  label={t("setup.removePlayer")}
                  onClick={() => setNames(names.filter((_, j) => j !== i))}
                  className="hover:text-red-600"
                >
                  <X size={16} />
                </IconButton>
              )}
            </div>
          );
        })}
        <button
          onClick={() => setNames([...names, ""])}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
        >
          <Plus size={15} /> {t("setup.addPlayer")}
        </button>
      </div>
      <Button
        className="mt-8 w-full px-6 py-3.5 text-base"
        disabled={players.length === 0}
        onClick={() => onStart(players)}
      >
        <Play size={18} /> {t("setup.startGame")}
        {players.length ? ` · ${players.length}` : ""}
      </Button>
    </div>
  );
}
