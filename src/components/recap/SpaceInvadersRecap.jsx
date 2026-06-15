/* ====================================================================
   RECAP MINIGAME — Space Invaders
   --------------------------------------------------------------------
   Each entity is a ship (its avatar) facing a fleet of invaders sized to
   the points it won this round. As the score counts up, the fleet is
   blasted away invader-by-invader. Rows sit in final-standings order.
   ==================================================================== */

import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { useRecapProgress, easeOutCubic, scoreAt, glyphsForDelta, rankRecap } from "./recapShared.js";

export default function SpaceInvadersRecap({ entities = [], present = false }) {
  const { t } = useI18n();
  const p = useRecapProgress();
  const { ranked, topMoverId } = rankRecap(entities);
  const e = easeOutCubic(p);

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-indigo-500/40 bg-stone-950 p-4 text-stone-100 shadow-[0_0_40px_rgba(99,102,241,0.25)_inset]">
      <p className={`mb-3 text-center font-pixel text-emerald-400 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.invaders")}
      </p>
      <div className="space-y-2">
        {ranked.map((entity) => {
          const glyphs = glyphsForDelta(entity.to - entity.from);
          const destroyed = Math.round(glyphs * e);
          return (
            <div
              key={entity.id}
              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${
                entity.id === topMoverId ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
              }`}
            >
              <Avatar
                color={entity.color}
                emoji={entity.emoji}
                photo={entity.photo}
                name={entity.name}
                size={present ? 36 : 26}
              />
              <span
                className={`min-w-0 max-w-[7rem] flex-shrink truncate font-semibold ${present ? "text-lg" : "text-xs"}`}
              >
                {entity.name}
              </span>
              <span className={`shrink-0 font-pixel text-emerald-300 ${present ? "text-xl" : "text-sm"}`}>
                {scoreAt(entity, p)}
              </span>
              {/* the fleet — invaders vanish (nearest the ship first) as points are scored */}
              <div className="ml-auto flex items-center gap-0.5 overflow-hidden">
                {Array.from({ length: glyphs }).map((_, i) => {
                  const gone = i < destroyed;
                  const frontier = i === destroyed - 1 && p < 1;
                  return (
                    <span key={i} className={`${present ? "text-base" : "text-[11px]"} leading-none`}>
                      {gone ? (
                        frontier ? (
                          "💥"
                        ) : (
                          <span className="opacity-0">👾</span>
                        )
                      ) : (
                        <span className="text-fuchsia-400">👾</span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
