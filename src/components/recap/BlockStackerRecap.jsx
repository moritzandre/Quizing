/* ====================================================================
   RECAP MINIGAME — Block Stacker
   --------------------------------------------------------------------
   A column per entity. Each tower grows from the start-of-round height to
   the end-of-round height (this round's points stack on as new blocks),
   the avatar riding the top. Tallest tower wins. A self-building bar chart.
   ==================================================================== */

import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { useRecapProgress, scoreAt, rankRecap } from "./recapShared.js";

export default function BlockStackerRecap({ entities = [], present = false }) {
  const { t } = useI18n();
  const p = useRecapProgress();
  const { ranked, topMoverId, maxTo } = rankRecap(entities);
  const areaH = present ? 240 : 170;

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border-2 border-emerald-400/50 bg-stone-950 p-4 text-stone-100">
      <p className={`mb-3 text-center font-pixel text-emerald-300 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.stacker")}
      </p>
      <div className="flex items-end justify-center gap-2 overflow-x-auto" style={{ minHeight: areaH + 48 }}>
        {ranked.map((entity) => {
          const score = scoreAt(entity, p);
          const barH = Math.round((score / maxTo) * areaH);
          const color = entity.color || "#6366f1";
          return (
            <div key={entity.id} className="flex w-16 shrink-0 flex-col items-center justify-end sm:w-20">
              <Avatar
                color={entity.color}
                emoji={entity.emoji}
                photo={entity.photo}
                name={entity.name}
                size={present ? 32 : 24}
              />
              <span className={`mb-0.5 mt-0.5 font-pixel text-emerald-300 ${present ? "text-sm" : "text-[10px]"}`}>
                {score}
              </span>
              {/* the tower — a brick-textured bar grown to the score */}
              <div
                className={`w-9 rounded-t-sm sm:w-11 ${entity.id === topMoverId ? "ring-2 ring-amber-400" : ""}`}
                style={{
                  height: barH,
                  backgroundColor: color,
                  backgroundImage:
                    "repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 11px), repeating-linear-gradient(90deg, rgba(0,0,0,0.28) 0 2px, transparent 2px 18px)",
                }}
              />
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
