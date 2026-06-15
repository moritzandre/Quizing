/* ====================================================================
   RECAP MINIGAME — Pellet Muncher
   --------------------------------------------------------------------
   One lane per entity. The avatar munches left→right along a trail of
   pellets sized to the points it won this round; pellets vanish as the
   score counts up. Lanes in final-standings order.
   ==================================================================== */

import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { useRecapProgress, easeOutCubic, scoreAt, glyphsForDelta, rankRecap } from "./recapShared.js";

export default function PelletMuncherRecap({ entities = [], present = false }) {
  const { t } = useI18n();
  const p = useRecapProgress();
  const { ranked, topMoverId } = rankRecap(entities);
  const e = easeOutCubic(p);
  const laneH = present ? 52 : 40;
  const muncherPct = e * 88; // how far across the lane the muncher has travelled

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-yellow-400/50 bg-stone-950 p-4 text-stone-100">
      <p className={`mb-3 text-center font-pixel text-yellow-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.pellet")}
      </p>
      <div className="space-y-2">
        {ranked.map((entity) => {
          const glyphs = glyphsForDelta(entity.to - entity.from);
          return (
            <div
              key={entity.id}
              className={`relative overflow-hidden rounded-lg border pr-12 ${
                entity.id === topMoverId ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
              }`}
              style={{ height: laneH }}
            >
              {/* pellet trail — each vanishes once the muncher passes it */}
              {Array.from({ length: glyphs }).map((_, i) => {
                const pelletPct = ((i + 1) / (glyphs + 1)) * 84;
                const eaten = muncherPct >= pelletPct;
                return (
                  <span
                    key={i}
                    className={`absolute top-1/2 -translate-y-1/2 text-yellow-300 transition-opacity ${eaten ? "opacity-0" : "opacity-100"} ${present ? "text-sm" : "text-[10px]"}`}
                    style={{ left: `${pelletPct}%` }}
                  >
                    ●
                  </span>
                );
              })}
              {/* the muncher */}
              <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `${muncherPct}%` }}>
                <Avatar
                  color={entity.color}
                  emoji={entity.emoji}
                  photo={entity.photo}
                  name={entity.name}
                  size={present ? 32 : 24}
                />
              </div>
              <span
                className={`absolute right-2 top-1/2 -translate-y-1/2 font-pixel text-yellow-300 ${present ? "text-base" : "text-[10px]"}`}
              >
                {scoreAt(entity, p)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
