/* ====================================================================
   RECAP MINIGAME — Brick Breaker
   --------------------------------------------------------------------
   One row per entity. The avatar (a paddle) smashes a wall of bricks
   sized to the points it won this round; bricks shatter as the score
   counts up. Rows in final-standings order.
   ==================================================================== */

import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { useRecapProgress, easeOutCubic, scoreAt, glyphsForDelta, rankRecap } from "./recapShared.js";

export default function BrickBreakerRecap({ entities = [], present = false }) {
  const { t } = useI18n();
  const p = useRecapProgress();
  const { ranked, topMoverId } = rankRecap(entities);
  const e = easeOutCubic(p);

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-rose-400/50 bg-stone-950 p-4 text-stone-100">
      <p className={`mb-3 text-center font-pixel text-rose-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.bricks")}
      </p>
      <div className="space-y-2">
        {ranked.map((entity) => {
          const glyphs = glyphsForDelta(entity.to - entity.from);
          const broken = Math.round(glyphs * e);
          const color = entity.color || "#f43f5e";
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
                size={present ? 34 : 24}
              />
              <span
                className={`min-w-0 max-w-[7rem] flex-shrink truncate font-semibold ${present ? "text-lg" : "text-xs"}`}
              >
                {entity.name}
              </span>
              <span className={`shrink-0 font-pixel text-rose-300 ${present ? "text-xl" : "text-sm"}`}>
                {scoreAt(entity, p)}
              </span>
              {/* the wall — bricks shatter (left first) as the score climbs */}
              <div className="ml-auto flex items-center gap-0.5 overflow-hidden">
                {Array.from({ length: glyphs }).map((_, i) => {
                  const gone = i < broken;
                  const ball = i === broken && p < 1;
                  if (ball)
                    return (
                      <span key={i} className={`leading-none text-white ${present ? "text-sm" : "text-[10px]"}`}>
                        ⚪
                      </span>
                    );
                  return (
                    <span
                      key={i}
                      className={`inline-block rounded-[1px] ${present ? "h-3 w-4" : "h-2 w-3"} ${gone ? "opacity-0" : ""}`}
                      style={{ backgroundColor: color }}
                    />
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
