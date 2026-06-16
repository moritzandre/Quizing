/* ====================================================================
   RECAP MINIGAME — Block Stacker
   --------------------------------------------------------------------
   A column per entity. Each tower starts at the round-start height, then
   this round's points drop in as discrete bricks that squash on landing
   (with a dust puff + thud), the avatar riding the top. Tallest tower wins;
   the leader's tower finishes last. Clouds drift above a ground line.
   ==================================================================== */

import { useEffect } from "react";
import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { easeOutCubic, scoreAt, glyphsForDelta, rankRecap, phaseFor, useRecapSfx } from "./recapShared.js";

const BRICK_TEXTURE =
  "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 11px), repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 18px)";
const CLOUDS = [
  { top: 4, left: 14, dur: 3.6 },
  { top: 12, left: 62, dur: 4.4 },
];

export default function BlockStackerRecap({ entities = [], present = false, progress = 1 }) {
  const { t } = useI18n();
  const { ranked, topMoverId, maxTo } = rankRecap(entities);
  const n = ranked.length;
  const areaH = present ? 230 : 165;
  const sfx = useRecapSfx(!present);

  let totalLanded = 0;
  const cols = ranked.map((entity, idx) => {
    const localP = phaseFor(progress, n - 1 - idx, n);
    const e = easeOutCubic(localP);
    const score = scoreAt(entity, localP);
    const delta = entity.to - entity.from;
    const baseH = Math.round((Math.max(0, entity.from) / maxTo) * areaH);
    const glyphs = glyphsForDelta(delta);
    const blockH = glyphs > 0 ? ((Math.max(0, delta) / maxTo) * areaH) / glyphs : 0;
    const landed = Math.round(glyphs * e);
    totalLanded += landed;
    const towerH = glyphs > 0 ? baseH + landed * blockH : Math.round((Math.max(0, score) / maxTo) * areaH);
    return { entity, score, glyphs, blockH, landed, baseH, towerH };
  });
  useEffect(() => sfx(totalLanded, "thud"), [totalLanded, sfx]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-emerald-400/50 bg-stone-950 p-4 text-stone-100">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {CLOUDS.map((c, i) => (
          <span
            key={i}
            className={`qn-bob absolute ${present ? "text-xl" : "text-sm"}`}
            style={{ top: `${c.top}%`, left: `${c.left}%`, animationDuration: `${c.dur}s`, opacity: 0.5 }}
          >
            ☁️
          </span>
        ))}
      </div>
      <p className={`relative mb-3 text-center font-pixel text-emerald-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.stacker")}
      </p>
      <div
        className="relative flex items-end justify-center gap-2 overflow-x-auto border-b-2 border-emerald-400/30 pb-1"
        style={{ minHeight: areaH + 52 }}
      >
        {cols.map(({ entity, score, glyphs, blockH, landed, baseH, towerH }) => {
          const color = entity.color || "#6366f1";
          return (
            <div key={entity.id} className="flex w-16 shrink-0 flex-col items-center sm:w-20">
              <div className="flex flex-col items-center justify-end" style={{ height: areaH + 8 }}>
                <Avatar color={entity.color} emoji={entity.emoji} name={entity.name} size={present ? 32 : 24} />
                <span className={`mb-0.5 mt-0.5 font-pixel text-emerald-300 ${present ? "text-sm" : "text-[10px]"}`}>
                  {score}
                </span>
                <div
                  className={`relative flex w-9 flex-col-reverse sm:w-11 ${entity.id === topMoverId ? "ring-2 ring-amber-400" : ""}`}
                  style={{ height: towerH }}
                >
                  {glyphs > 0 ? (
                    <>
                      <div
                        className="w-full rounded-t-sm"
                        style={{ height: baseH, backgroundColor: color, backgroundImage: BRICK_TEXTURE }}
                      />
                      {Array.from({ length: landed }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-full ${i === landed - 1 ? "qn-squash" : ""}`}
                          style={{ height: blockH, backgroundColor: color, backgroundImage: BRICK_TEXTURE }}
                        />
                      ))}
                      {/* landing dust — re-bursts each time a new block lands */}
                      {landed > 0 && landed < glyphs && (
                        <span
                          key={landed}
                          className="qn-burst pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-stone-300"
                        >
                          ✦
                        </span>
                      )}
                    </>
                  ) : (
                    <div
                      className="w-full rounded-t-sm"
                      style={{ height: towerH, backgroundColor: color, backgroundImage: BRICK_TEXTURE }}
                    />
                  )}
                </div>
              </div>
              <span className={`mt-1 w-full truncate text-center font-semibold ${present ? "text-xs" : "text-[9px]"}`}>
                {entity.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
