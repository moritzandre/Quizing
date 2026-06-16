/* ====================================================================
   RECAP MINIGAME — Rocket Race
   --------------------------------------------------------------------
   One lane per entity; each avatar rides a flame-trailing rocket from its
   start-of-round score to its end-of-round score (as a % of the leader)
   across a starfield with drifting planets. Furthest right wins; the
   leader's rocket launches last. Lanes in final-standings order.
   ==================================================================== */

import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { scoreAt, rankRecap, phaseFor } from "./recapShared.js";

const STARS = Array.from({ length: 20 }, (_, i) => ({
  top: (i * 47) % 100,
  left: (i * 31) % 100,
  delay: ((i * 23) % 16) / 10,
}));
const PLANETS = [
  { body: "🪐", top: 8, left: 12, dur: 3.4 },
  { body: "☄️", top: 64, left: 78, dur: 2.6 },
];

export default function RocketRaceRecap({ entities = [], present = false, progress = 1 }) {
  const { t } = useI18n();
  const { ranked, topMoverId, maxTo } = rankRecap(entities);
  const n = ranked.length;
  const laneH = present ? 56 : 42;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-sky-400/50 bg-gradient-to-b from-indigo-950 to-sky-950 p-4 text-stone-100">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="qn-twinkle absolute h-0.5 w-0.5 rounded-full bg-white"
            style={{ top: `${s.top}%`, left: `${s.left}%`, animationDelay: `${s.delay}s`, opacity: 0.6 }}
          />
        ))}
        {PLANETS.map((pl, i) => (
          <span
            key={i}
            className={`qn-bob absolute ${present ? "text-2xl" : "text-lg"}`}
            style={{ top: `${pl.top}%`, left: `${pl.left}%`, animationDuration: `${pl.dur}s`, opacity: 0.7 }}
          >
            {pl.body}
          </span>
        ))}
      </div>
      <p className={`relative mb-3 text-center font-pixel text-sky-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.race")}
      </p>
      <div className="relative space-y-2">
        {ranked.map((entity, idx) => {
          const localP = phaseFor(progress, n - 1 - idx, n);
          const score = scoreAt(entity, localP);
          const pct = Math.max(0, Math.min(100, (score / maxTo) * 100));
          const flying = localP > 0 && localP < 1;
          return (
            <div
              key={entity.id}
              className={`relative overflow-hidden rounded-lg border ${
                entity.id === topMoverId ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
              }`}
              style={{ height: laneH }}
            >
              <div className="absolute inset-y-0 left-0 right-6 my-auto h-0.5 border-t-2 border-dashed border-white/15" />
              <div
                className={`qn-bob absolute inset-y-0 right-1 flex items-center ${present ? "text-base" : "text-[12px]"}`}
                style={{ animationDuration: "1.1s" }}
              >
                🏁
              </div>
              <div
                className="absolute top-1/2 flex -translate-y-1/2 items-center gap-0.5 transition-none"
                style={{ left: `calc(${pct}% - ${pct / 100} * ${present ? 100 : 74}px)` }}
              >
                {flying && (
                  <span className={`qn-flicker text-orange-400 ${present ? "text-base" : "text-[11px]"}`}>🔥</span>
                )}
                <Avatar
                  color={entity.color}
                  emoji={entity.emoji}
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
