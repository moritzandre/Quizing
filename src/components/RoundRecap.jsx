/* ====================================================================
   ROUND RECAP — between-rounds points-progression (8-bit minigames)
   --------------------------------------------------------------------
   Dispatches to one of several arcade "skins" that animate each entity's
   score from its start-of-round total to its end-of-round total using the
   players' avatars as sprites. The host picks the `variant` at random and
   mirrors it to the TV (live.recapVariant) so both screens play the same
   one. Pure props; honors prefers-reduced-motion (static board).
   ==================================================================== */

import { prefersReducedMotion } from "./ui.jsx";
import RecapBoard from "./recap/RecapBoard.jsx";
import RecapShow from "./recap/RecapShow.jsx";
import SpaceInvadersRecap from "./recap/SpaceInvadersRecap.jsx";
import RocketRaceRecap from "./recap/RocketRaceRecap.jsx";
import BlockStackerRecap from "./recap/BlockStackerRecap.jsx";
import PelletMuncherRecap from "./recap/PelletMuncherRecap.jsx";
import BrickBreakerRecap from "./recap/BrickBreakerRecap.jsx";

const VARIANTS = {
  invaders: SpaceInvadersRecap,
  race: RocketRaceRecap,
  stacker: BlockStackerRecap,
  pellet: PelletMuncherRecap,
  bricks: BrickBreakerRecap,
};

/**
 * @param {object} props
 * @param {Array<{id:string,name:string,color?:string,emoji?:string,from:number,to:number}>} props.entities
 * @param {boolean} [props.present] Larger sizing for the TV.
 * @param {string} [props.variant] One of RECAP_VARIANTS (model.js).
 * @param {number} [props.round] 1-based round number for the intro card (0 = unknown).
 * @param {number} [props.total] Total rounds (0 = unknown).
 */
export default function RoundRecap({ entities = [], present = false, variant = "invaders", round = 0, total = 0 }) {
  if (!entities.length) return null;
  if (prefersReducedMotion()) return <RecapBoard entities={entities} present={present} />;
  const Variant = VARIANTS[variant] || SpaceInvadersRecap;
  return <RecapShow Variant={Variant} entities={entities} present={present} round={round} total={total} />;
}
