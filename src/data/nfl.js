/* ====================================================================
   NFL STATS DATA LAYER (framework-free; lazy-imported by the Builder)
   --------------------------------------------------------------------
   Binds the bundled nfl.stats.json snapshot (baked from nflverse's public
   per-season regular-season stats by `npm run nfl:refresh` — see
   scripts/nfl-refresh.mjs) to the pure, data-parameterized generators in
   nflGen.js. Faces come from ESPN's headshot CDN via each player's espn_id
   (nflverse fallback URL when a player has no ESPN id). The GENERATED rounds
   are ordinary quiz rounds with all content baked in, so games never depend
   on this module — or any NFL source — at play time.
   ==================================================================== */

import DATA from "./nfl.stats.json";
import * as gen from "./nflGen.js";

export { NFL_CATS } from "./nflGen.js";

/** Seasons available in the bundled snapshot (ascending). */
export const NFL_SEASONS = gen.seasons(DATA);

/** The date the bundled snapshot was generated (shown in the wizard). */
export const NFL_GENERATED = DATA.generated || "";

/** The latest season with a full set of stats (the running one until February). */
export const nflLatestFullSeason = () => gen.latestFullSeason(DATA);

/** ESPN headshot ("face db") URL for a player record, else the nflverse one. */
export const nflFace = gen.face;
/** Human value label for a board cell, e.g. "5,316 yds" / "17.5 sacks". */
export const nflValueLabel = gen.valueLabel;
/** One season × category leaderboard from the snapshot, as rich rows. */
export const nflBoard = (season, cat) => gen.board(DATA, season, cat);
/** Is "the Nth most" unambiguous on this board (no tie at rank n)? */
export const nflRankUnambiguous = gen.rankUnambiguous;
/** Accepted alt spellings for a player answer (bare last name when unambiguous). */
export const nflAliases = gen.aliases;
/** Search the snapshot's players by name fragment. */
export const nflPlayerSearch = (text, limit) => gen.playerSearch(DATA, text, limit);
/** Every top-40 board appearance of a player. */
export const nflPlayerFinds = (id) => gen.playerFinds(DATA, id);

/* round generators — `t` is the caller's i18n function (text baked at generation time) */
export const nflToplistRound = (t, opts) => gen.toplistRound(DATA, t, opts);
export const nflRankTypeitRound = (t, opts) => gen.rankTypeitRound(DATA, t, opts);
export const nflChoiceRound = (t, opts) => gen.choiceRound(DATA, t, opts);
export const nflFacesRound = (t, opts) => gen.facesRound(DATA, t, opts);
export const nflHigherLowerRound = (t, opts) => gen.higherLowerRound(DATA, t, opts);
export const nflNumberRound = (t, opts) => gen.numberRound(DATA, t, opts);
export const nflTrueFalseRound = (t, opts) => gen.trueFalseRound(DATA, t, opts);
export const nflWhoknowsRound = (t, opts) => gen.whoknowsRound(DATA, t, opts);
export const nflJeopardyRound = (t, opts) => gen.jeopardyRound(DATA, t, opts);
