/* ====================================================================
   RECAP MINIGAME — Brick Breaker
   --------------------------------------------------------------------
   One row per entity. The avatar (a paddle) smashes a wall of bricks sized
   to the points it won this round; a bouncing ball works along the wall and
   bricks shatter (with debris + a blip) as the score counts up. Rows resolve
   one-by-one in standings order over a faint scanline backdrop.
   ==================================================================== */

import { useEffect } from "react";
import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { easeOutCubic, scoreAt, glyphsForDelta, rankRecap, phaseFor, useRecapSfx } from "./recapShared.js";

const SCANLINES = "repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 3px)";

export default function BrickBreakerRecap({ entities = [], present = false, progress = 1 }) {
  const { t } = useI18n();
  const { ranked, topMoverId } = rankRecap(entities);
  const n = ranked.length;
  const sfx = useRecapSfx(!present);

  let totalBroken = 0;
  const rows = ranked.map((entity, idx) => {
    const localP = phaseFor(progress, n - 1 - idx, n);
    const glyphs = glyphsForDelta(entity.to - entity.from);
    const broken = Math.round(glyphs * easeOutCubic(localP));
    totalBroken += broken;
    return { entity, localP, glyphs, broken };
  });
  useEffect(() => sfx(totalBroken, "shatter"), [totalBroken, sfx]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-rose-400/50 bg-stone-950 p-4 text-stone-100">
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: SCANLINES }} />
      <p className={`relative mb-3 text-center font-pixel text-rose-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.bricks")}
      </p>
      <div className="relative space-y-2">
        {rows.map(({ entity, localP, glyphs, broken }) => {
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
                {scoreAt(entity, localP)}
              </span>
              <div className="ml-auto flex items-center gap-0.5 overflow-hidden">
                {Array.from({ length: glyphs }).map((_, i) => {
                  // the bouncing ball sits at the current frontier
                  if (i === broken && localP < 1)
                    return (
                      <span
                        key={i}
                        className={`qn-bob leading-none text-white ${present ? "text-sm" : "text-[10px]"}`}
                        style={{ animationDuration: "0.4s" }}
                      >
                        ⚪
                      </span>
                    );
                  // debris puff on the brick that just shattered (re-keyed each break)
                  if (i === broken - 1 && localP < 1)
                    return (
                      <span key={`d${broken}`} className={`qn-burst leading-none ${present ? "text-sm" : "text-[10px]"}`}>
                        ✦
                      </span>
                    );
                  const gone = i < broken;
                  return (
                    <span
                      key={i}
                      className={`inline-block rounded-[1px] ${present ? "h-3 w-4" : "h-2 w-3"} ${gone ? "opacity-0" : ""}`}
                      style={{ backgroundColor: color, opacity: gone ? 0 : i % 2 ? 0.78 : 1 }}
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
