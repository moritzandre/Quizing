/* ====================================================================
   RECAP MINIGAME — Pellet Muncher
   --------------------------------------------------------------------
   One maze lane per entity. The avatar munches left→right along a trail of
   pellets sized to the points it won this round (chomping + a blip on each),
   a ghost giving chase, a pulsing power-pellet at the end. Pellets vanish as
   the score counts up; lanes resolve one-by-one in standings order.
   ==================================================================== */

import { useEffect } from "react";
import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { easeOutCubic, scoreAt, glyphsForDelta, rankRecap, phaseFor, useRecapSfx } from "./recapShared.js";

export default function PelletMuncherRecap({ entities = [], present = false, progress = 1 }) {
  const { t } = useI18n();
  const { ranked, topMoverId } = rankRecap(entities);
  const n = ranked.length;
  const laneH = present ? 54 : 42;
  const sfx = useRecapSfx(!present);

  let totalEaten = 0;
  const lanes = ranked.map((entity, idx) => {
    const localP = phaseFor(progress, n - 1 - idx, n);
    const e = easeOutCubic(localP);
    const glyphs = glyphsForDelta(entity.to - entity.from);
    const muncherPct = e * 84;
    const positions = Array.from({ length: glyphs }, (_, i) => ((i + 1) / (glyphs + 1)) * 84);
    const eaten = positions.filter((pp) => muncherPct >= pp).length;
    totalEaten += eaten;
    return { entity, localP, glyphs, muncherPct, positions, eaten };
  });
  useEffect(() => sfx(totalEaten, "chomp"), [totalEaten, sfx]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-yellow-400/50 bg-stone-950 p-4 text-stone-100">
      <p className={`mb-3 text-center font-pixel text-yellow-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.pellet")}
      </p>
      <div className="space-y-2">
        {lanes.map(({ entity, localP, glyphs, muncherPct, positions, eaten }) => {
          const ghostPct = Math.max(-6, muncherPct - 13);
          return (
            <div
              key={entity.id}
              className={`relative overflow-hidden rounded-lg border pr-12 ${
                entity.id === topMoverId ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
              }`}
              style={{ height: laneH }}
            >
              {/* maze walls — dotted rails top + bottom */}
              <div className="absolute inset-x-2 top-1 h-0.5 border-t-2 border-dotted border-yellow-400/25" />
              <div className="absolute inset-x-2 bottom-1 h-0.5 border-t-2 border-dotted border-yellow-400/25" />
              {/* pellet trail (last one is a pulsing power-pellet) */}
              {positions.map((pp, i) => {
                const isEaten = muncherPct >= pp;
                const power = i === glyphs - 1;
                return (
                  <span
                    key={i}
                    className={`absolute top-1/2 -translate-y-1/2 transition-opacity ${isEaten ? "opacity-0" : "opacity-100"} ${
                      power ? "qn-pulse text-yellow-200" : "text-yellow-300"
                    } ${power ? (present ? "text-lg" : "text-sm") : present ? "text-sm" : "text-[10px]"}`}
                    style={{ left: `${pp}%` }}
                  >
                    {power ? "◉" : "●"}
                  </span>
                );
              })}
              {/* the chasing ghost */}
              {muncherPct > 4 && muncherPct < 84 && (
                <div
                  className={`qn-bob absolute top-1/2 -translate-y-1/2 ${present ? "text-base" : "text-[12px]"}`}
                  style={{ left: `${ghostPct}%`, animationDuration: "0.7s" }}
                >
                  👻
                </div>
              )}
              {/* the muncher — pops on each pellet eaten */}
              <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${muncherPct}%` }}>
                <div key={eaten} className="qn-pop">
                  <Avatar
                    color={entity.color}
                    emoji={entity.emoji}
                    name={entity.name}
                    size={present ? 32 : 24}
                  />
                </div>
              </div>
              <span
                className={`absolute right-2 top-1/2 -translate-y-1/2 font-pixel text-yellow-300 ${present ? "text-base" : "text-[10px]"}`}
              >
                {scoreAt(entity, localP)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
