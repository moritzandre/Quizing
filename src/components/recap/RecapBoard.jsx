/* ====================================================================
   RECAP BOARD — the plain ranked standings (no animation)
   --------------------------------------------------------------------
   Used as the reduced-motion fallback for every recap minigame: the
   final order with each entity's round gain. Pure props.
   ==================================================================== */

import { Star } from "lucide-react";
import { Avatar } from "../ui.jsx";
import { rankRecap } from "./recapShared.js";

/**
 * @param {object} props
 * @param {Array<{id:string,name:string,color?:string,emoji?:string,photo?:string,from:number,to:number}>} props.entities
 * @param {boolean} [props.present] Larger sizing for the TV.
 */
export default function RecapBoard({ entities = [], present = false }) {
  const { ranked, topMoverId } = rankRecap(entities);
  return (
    <div className="mx-auto w-full max-w-2xl space-y-2">
      {ranked.map((e, rank) => {
        const delta = e.to - e.from;
        return (
          <div
            key={e.id}
            className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2 ${
              e.id === topMoverId
                ? "border-amber-300 bg-amber-50/80 dark:border-amber-500/40 dark:bg-amber-500/10"
                : "border-stone-200 bg-white/80 dark:border-stone-800 dark:bg-stone-900/70"
            }`}
          >
            <span className={`w-6 shrink-0 text-center font-pixel ${present ? "text-sm" : "text-xs"} text-stone-400`}>
              {rank + 1}
            </span>
            <Avatar color={e.color} emoji={e.emoji} photo={e.photo} name={e.name} size={present ? 38 : 28} />
            <span className={`min-w-0 flex-1 truncate font-semibold ${present ? "text-xl" : "text-sm"}`}>
              {e.name}
              {e.id === topMoverId && <Star size={13} className="ml-1 inline fill-amber-400 text-amber-400" />}
            </span>
            {delta !== 0 && (
              <span className={`shrink-0 font-pixel text-[10px] ${delta > 0 ? "text-emerald-500" : "text-red-500"}`}>
                {delta > 0 ? "+" : "−"}
                {Math.abs(delta)}
              </span>
            )}
            <span className={`w-14 shrink-0 text-right font-pixel ${present ? "text-xl" : "text-sm"}`}>{e.to}</span>
          </div>
        );
      })}
    </div>
  );
}
