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
 * @param {Array<{id:string,name:string,color?:string,emoji?:string,photo?:string,from:number,to:number}>} props.entities
 * @param {boolean} [props.present] Larger sizing for the TV.
 * @param {string} [props.variant] One of RECAP_VARIANTS (model.js).
 */
export default function RoundRecap({ entities = [], present = false, variant = "invaders" }) {
  if (!entities.length) return null;
  if (prefersReducedMotion()) return <RecapBoard entities={entities} present={present} />;
  const Comp = VARIANTS[variant] || SpaceInvadersRecap;
  return <Comp entities={entities} present={present} />;
}
