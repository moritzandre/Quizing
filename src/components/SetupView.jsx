/* ====================================================================
   SETUP VIEW (enter players or teams, optionally open the phone buzzer)
   ==================================================================== */

import { useState, useEffect } from "react";
import { ChevronLeft, Users, X, Plus, Play, UserRound, Shield } from "lucide-react";
import { FOCUS, inputCls, Button, IconButton, TypeBadge, Avatar, colorAt, emojiAt } from "./ui.jsx";
import BuzzerPanel from "./BuzzerPanel.jsx";
import { uid } from "../lib/model.js";
import { useI18n } from "../i18n/I18nProvider.jsx";

/** Player-entry screen shown before a game starts. */
export default function SetupView({ quiz, defaults, room, onStart, onBack }) {
  const { t } = useI18n();
  const [mode, setMode] = useState("solo");
  const [names, setNames] = useState(defaults.length ? defaults : ["", ""]);
  const [teams, setTeams] = useState(() => [
    { id: uid(), name: "" },
    { id: uid(), name: "" },
  ]);

  // Members who joined by phone, grouped by the team they picked.
  const roster = room?.enabled ? room.participants : {};
  const membersOf = (teamId) =>
    Object.entries(roster)
      .filter(([, p]) => p.teamId === teamId)
      .map(([deviceId, p]) => ({ deviceId, name: p.name }));
  const unassigned = Object.entries(roster).filter(([, p]) => !p.teamId);

  const phonePlayers = room?.enabled
    ? Object.entries(roster).map(([deviceId, p]) => ({
        name: p.name,
        deviceId,
        emoji: p.emoji,
        color: p.color,
        photo: p.photo,
        profileId: p.profileId,
      }))
    : [];
  const manualPlayers = names
    .map((n) => n.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
  const soloPlayers = [...phonePlayers, ...manualPlayers];

  const namedTeams = teams.filter((tm) => tm.name.trim());
  const teamEntities = namedTeams.map((tm) => {
    const m = membersOf(tm.id);
    return {
      id: tm.id,
      name: tm.name.trim(),
      deviceIds: m.map((x) => x.deviceId),
      members: m.map((x) => ({ name: x.name })),
    };
  });

  const isTeams = mode === "teams";
  const canStart = isTeams ? teamEntities.length >= 1 : soloPlayers.length > 0;

  // Publish the lobby so phones either see a plain name prompt (solo) or a
  // team picker (teams). Re-publish whenever the team roster/names change.
  const teamsKey = teams.map((tm) => `${tm.id}:${tm.name.trim()}`).join("|");
  useEffect(() => {
    if (!room?.enabled || !room.lobby) return;
    room.lobby(isTeams ? namedTeams.map((tm, i) => ({ id: tm.id, name: tm.name.trim(), color: colorAt(i) })) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.enabled, isTeams, teamsKey]);

  const start = () => onStart(isTeams ? teamEntities : soloPlayers, isTeams ? "teams" : "solo");

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

      {/* Solo / Teams mode toggle */}
      <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 dark:bg-stone-800">
        {[
          { k: "solo", icon: UserRound, label: t("setup.solo") },
          { k: "teams", icon: Shield, label: t("setup.teams") },
        ].map(({ k, icon: Icon, label }) => (
          <button
            key={k}
            onClick={() => setMode(k)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${FOCUS} ${
              mode === k
                ? "bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-white"
                : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {room && (
        <div className="mt-6">
          <BuzzerPanel room={room} />
        </div>
      )}

      {isTeams ? (
        <div className="mt-6 space-y-3">
          <p className="text-xs text-stone-400 dark:text-stone-500">{t("setup.teamsHint")}</p>
          {teams.map((tm, i) => {
            const m = membersOf(tm.id);
            return (
              <div key={tm.id} className="rounded-2xl border border-stone-200 p-3 dark:border-stone-800">
                <div className="flex items-center gap-2">
                  <Avatar color={colorAt(i)} emoji={emojiAt(i)} name={tm.name || `${i + 1}`} size={34} />
                  <input
                    className={inputCls}
                    placeholder={t("setup.teamN", { n: i + 1 })}
                    value={tm.name}
                    onChange={(e) => setTeams(teams.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                  {teams.length > 1 && (
                    <IconButton
                      label={t("setup.removeTeam")}
                      onClick={() => setTeams(teams.filter((_, j) => j !== i))}
                      className="hover:text-red-600"
                    >
                      <X size={16} />
                    </IconButton>
                  )}
                </div>
                {m.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
                    {m.map((x) => (
                      <span
                        key={x.deviceId}
                        className="inline-flex items-center rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 dark:bg-stone-800 dark:text-stone-300"
                      >
                        {x.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button
            onClick={() => setTeams([...teams, { id: uid(), name: "" }])}
            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
          >
            <Plus size={15} /> {t("setup.addTeam")}
          </button>
          {unassigned.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{t("setup.noTeam", { n: unassigned.length })}</p>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {phonePlayers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400 dark:text-stone-500">
                {t("setup.joinedByPhone", { n: phonePlayers.length })}
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {phonePlayers.map((p, i) => (
                  <span
                    key={p.deviceId}
                    className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 py-1 pl-1 pr-3 text-sm font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-200"
                  >
                    <Avatar
                      color={p.color || colorAt(i)}
                      emoji={p.emoji || emojiAt(i)}
                      photo={p.photo}
                      name={p.name}
                      size={24}
                    />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
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
      )}

      <Button className="mt-8 w-full px-6 py-3.5 text-base" disabled={!canStart} onClick={start}>
        <Play size={18} /> {t("setup.startGame")}
        {isTeams
          ? teamEntities.length
            ? ` · ${teamEntities.length}`
            : ""
          : soloPlayers.length
            ? ` · ${soloPlayers.length}`
            : ""}
      </Button>
    </div>
  );
}
