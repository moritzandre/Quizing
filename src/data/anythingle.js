/* ====================================================================
   ANYTHINGLE CHARACTER DATABASE
   --------------------------------------------------------------------
   A curated pool of ~1500 well-known fictional characters, each tagged
   on the 10-trait Anythingle matrix (see ANYTHINGLE_TRAITS in
   lib/model.js). Generated + fact-checked by a multi-agent pass and
   stored as plain JSON (anythingle.characters.json) so it's easy to
   regenerate/extend; this module validates every row through
   normalizeAnyChar at load (a stray value clamps to a valid one rather
   than breaking the comparison) and builds the name/alias resolver.
   Dynamic-imported by PlayView only when an anythingle round renders; the
   Builder + host-remote pull it statically, but those are themselves
   code-split route chunks, so the home bundle never includes it. The host
   can still guess characters NOT in here — those fall through to the
   inline manual-add. Framework-free named exports.

   Trait conventions (kept consistent so feedback never lies):
   - debut year = first appearance in the ORIGINAL medium under the
     known name (not the famous adaptation); medium = that debut medium.
   - species by canonical origin; augmented/mutated humans → Cyborg/Augmented.
   - origin = the CHARACTER'S own home: a real nationality if set in the
     real world (e.g. "British"), else their fictional realm ("Hyrule").
   - affiliation = their in-story group/team, or "Independent".
   - role/powers = up to 3 each; powers ["None"] for the powerless.
   ==================================================================== */

import { normText, normalizeAnyChar } from "../lib/model.js";
import RAW from "./anythingle.characters.json";

/** Validated, frozen character pool (invalid/typo'd tokens clamp via normalize). */
export const ANYTHINGLE_DB = RAW.map(normalizeAnyChar).filter(Boolean);

/** Distinct canonical franchise names present in the DB (for author autocomplete). */
export const ANYTHINGLE_FRANCHISES = [...new Set(ANYTHINGLE_DB.map((c) => c.franchise))].filter(Boolean).sort();

let INDEX = null;
function index() {
  if (INDEX) return INDEX;
  INDEX = new Map();
  // Pass 1: PRIMARY names win (first occurrence keeps the key) — deterministic.
  for (const c of ANYTHINGLE_DB) {
    const k = normText(c.name);
    if (k && !INDEX.has(k)) INDEX.set(k, c);
  }
  // Pass 2: aliases fill only still-free keys, so an alias (e.g. "Robin" for
  // Nico Robin) can never shadow another character's primary name ("Robin").
  for (const c of ANYTHINGLE_DB) {
    for (const a of c.aliases || []) {
      const k = normText(a);
      if (k && !INDEX.has(k)) INDEX.set(k, c);
    }
  }
  return INDEX;
}

/** Resolve a typed name/alias to a DB character (accent/case-insensitive), or null. */
export function findAnyChar(name) {
  const k = normText(name);
  return k ? index().get(k) || null : null;
}
