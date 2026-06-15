/* ====================================================================
   RECAP MINIGAME — Rocket Race
   --------------------------------------------------------------------
   One lane per entity; each avatar rides a rocket from its start-of-round
   score to its end-of-round score (as a % of the leader). Furthest right
   wins. Lanes are stacked in final-standings order.
   ==================================================================== */

import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { useRecapProgress, scoreAt, rankRecap } from "./recapShared.js";

export default function RocketRaceRecap({ entities = [], present = false }) {
  const { t } = useI18n();
  const p = useRecapProgress();
  const { ranked, topMoverId, maxTo } = rankRecap(entities);
  const laneH = present ? 56 : 42;

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-sky-400/50 bg-gradient-to-b from-indigo-950 to-sky-950 p-4 text-stone-100">
      <p className={`mb-3 text-center font-pixel text-sky-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.race")}
      </p>
      <div className="space-y-2">
        {ranked.map((entity) => {
          const score = scoreAt(entity, p);
          const pct = Math.max(0, Math.min(100, (score / maxTo) * 100));
          return (
            <div
              key={entity.id}
              className={`relative overflow-hidden rounded-lg border ${
                entity.id === topMoverId ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
              }`}
              style={{ height: laneH }}
            >
              {/* dashed track + finish line */}
              <div className="absolute inset-y-0 left-0 right-6 my-auto h-0.5 border-t-2 border-dashed border-white/15" />
              <div className="absolute inset-y-0 right-1 flex items-center font-pixel text-[10px] text-white/40">
                🏁
              </div>
              {/* the racer — avatar + rocket, positioned by score */}
              <div
                className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1 transition-none"
                style={{ left: `calc(${pct}% - ${pct / 100} * ${present ? 86 : 64}px)` }}
              >
                <Avatar
                  color={entity.color}
                  emoji={entity.emoji}
                  photo={entity.photo}
                  name={entity.name}
                  size={present ? 34 : 24}
                />
                <span className={present ? "text-lg" : "text-sm"}>🚀</span>
                <span className={`font-pixel text-sky-300 ${present ? "text-base" : "text-[10px]"}`}>{score}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
