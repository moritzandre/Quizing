/* ====================================================================
   RECAP SHOW — the broadcast wrapper around a recap minigame
   --------------------------------------------------------------------
   Owns the single master clock and stages the recap as a little show:
   a "ROUND N" intro splash → the chosen arcade minigame (driven by a
   `progress` 0→1 for its play window) → and ALWAYS finishes on a ranked
   leaderboard with confetti and a crowned winner before the host advances.
   A live commentary caption reacts to the round (overtake / photo finish /
   on-fire / winner). Pure props; only ever rendered when motion is allowed
   (RoundRecap swaps in the static board for prefers-reduced-motion).
   ==================================================================== */

import { useEffect, useRef } from "react";
import { Avatar, Confetti } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { recapStory } from "../../lib/model.js";
import { playSound } from "../../lib/sound.js";
import { useRecapProgress, rankRecap } from "./recapShared.js";
import RecapBoard from "./RecapBoard.jsx";

const DURATION = 6000; // ms: intro (~0.7s) → play → leaderboard finish
const PLAY_START = 0.12;
const PLAY_END = 0.72; // minigame is done; the leaderboard finish takes over

/**
 * @param {object} props
 * @param {React.ComponentType} props.Variant The chosen minigame component.
 * @param {Array<{id,name,color?,emoji?,from,to}>} props.entities
 * @param {boolean} [props.present] Larger sizing for the TV.
 * @param {number} [props.round] 1-based round number (0 = unknown).
 * @param {number} [props.total] Total rounds (0 = unknown).
 */
export default function RecapShow({ Variant, entities = [], present = false, round = 0, total = 0 }) {
  const { t } = useI18n();
  const p = useRecapProgress(DURATION);
  const { ranked } = rankRecap(entities);
  const leader = ranked[0];
  const story = recapStory(entities);

  const playP = Math.max(0, Math.min(1, (p - PLAY_START) / (PLAY_END - PLAY_START)));
  const introOpacity = p < 0.07 ? 1 : p < 0.15 ? Math.max(0, (0.15 - p) / 0.08) : 0;
  const showBoard = p >= PLAY_END; // the recap always ends on the standings

  // Sparkle when the winner board lands — host only (the TV stays silent unless
  // the viewer opted into sound), once per recap.
  const dinged = useRef(false);
  useEffect(() => {
    if (showBoard && !present && !dinged.current) {
      dinged.current = true;
      playSound("sparkle");
    }
  }, [showBoard, present]);

  const introTitle =
    round && total
      ? t("recapShow.roundOf", { n: round, total })
      : round
        ? t("recapShow.round", { n: round })
        : t("recapShow.results");

  // ---- the leaderboard finish (always shown last) ----
  if (showBoard) {
    return (
      <div className="relative mx-auto w-full max-w-2xl">
        <Confetti count={present ? 140 : 80} />
        {leader && (
          <div className="qn-pop mb-3 flex items-center justify-center gap-2">
            <span className={`qn-bob ${present ? "text-2xl" : "text-base"}`}>👑</span>
            <span className={`font-pixel text-amber-300 ${present ? "text-base" : "text-[10px]"}`}>
              {t("recapStory.winner", { name: leader.name })}
            </span>
          </div>
        )}
        <div className="qn-fade-up">
          <RecapBoard entities={entities} present={present} />
        </div>
      </div>
    );
  }

  // ---- the animated minigame (intro + play) ----
  const caption = p >= 0.42 && story.mid ? t(story.mid.key, story.mid.vars) : null;
  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <Variant entities={entities} present={present} progress={playP} />

      {/* live commentary caption */}
      <div className={`mt-3 flex justify-center ${present ? "h-9" : "h-7"}`}>
        {caption && (
          <span
            className={`qn-fade-up inline-block max-w-full truncate rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-center font-pixel text-amber-300 ${
              present ? "text-sm" : "text-[10px]"
            }`}
          >
            {caption}
          </span>
        )}
      </div>

      {/* "ROUND N" intro splash — fades out as the minigame begins */}
      {introOpacity > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center"
          style={{ opacity: introOpacity }}
        >
          <div className="qn-pop rounded-2xl border-2 border-indigo-400/60 bg-stone-950/85 px-8 py-5 text-center shadow-[0_0_40px_rgba(99,102,241,0.4)]">
            <p className={`font-pixel text-indigo-300 ${present ? "text-2xl" : "text-base"}`}>{introTitle}</p>
            <p className={`mt-2 font-pixel text-emerald-400 ${present ? "text-base" : "text-[10px]"}`}>
              {t("recapShow.results")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
