/* ====================================================================
   NFL NIGHT (read-only built-in) — the NFL integration, playable end to end.
   --------------------------------------------------------------------
   Generated content: `npm run nfl:refresh` bakes nflQuiz.json from the
   real nflverse snapshot with the same generators the Builder's NFL wizard
   uses — one round per NFL-capable format (Top List/Tenable, Type-It rank
   questions, Higher/Lower, Closest Guess, True/False, a pub-quiz batched
   Multiple Choice, headshot Faces, a Jeopardy board with face-media clues,
   Who Knows More). Don't hand-edit the JSON; re-run the script.
   ==================================================================== */

import quiz from "./nflQuiz.json";

/** Built-in NFL showcase quiz (baked; already normalized). */
export const NFL_QUIZ = quiz;
