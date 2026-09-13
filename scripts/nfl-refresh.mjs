/* ====================================================================
   NFL DATASET REFRESH (build-time, node — run: npm run nfl:refresh)
   --------------------------------------------------------------------
   Downloads nflverse's public per-season regular-season player stats
   (github.com/nflverse/nflverse-data, releases/stats_player) plus the
   master player ID map (releases/players, for ESPN ids → the ESPN
   headshot "face db"), computes compact top-N leaderboards per season
   and stat category, and writes src/data/nfl.stats.json — the bundled
   dataset the Builder's NFL wizard reads. The app itself NEVER fetches
   NFL data at runtime (GitHub release assets send no CORS headers, and
   party night shouldn't depend on a third party anyway): re-run this
   script and redeploy to refresh, e.g. mid-season.

   Downloads are cached in scripts/.nflcache/ (gitignored); delete the
   current season's file (or the whole dir) to force a re-download.
   ==================================================================== */

import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = join(ROOT, "scripts", ".nflcache");
const OUT = join(ROOT, "src", "data", "nfl.stats.json");

const FIRST_SEASON = 1999; // nflverse player-stats coverage starts here
const TOP_N = 40; // deep enough for top-10 boards, "Nth most" up to ~25, and distractors

/** The stat categories we bake boards for: CSV column → short key. */
const CATS = {
  passing_yards: "passYd",
  passing_tds: "passTd",
  rushing_yards: "rushYd",
  rushing_tds: "rushTd",
  receiving_yards: "recYd",
  receiving_tds: "recTd",
  receptions: "rec",
  def_sacks: "sacks",
  def_interceptions: "defInt",
};

const statsUrl = (year) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_${year}.csv`;
const PLAYERS_URL = "https://github.com/nflverse/nflverse-data/releases/download/players/players.csv";

/** Latest season that plausibly has data: the NFL season starting in year Y kicks off in September. */
function latestSeason() {
  const now = new Date();
  return now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
}

/** Download (with a tiny disk cache). The CURRENT season is always re-fetched. */
async function fetchCached(url, cacheName, { alwaysFresh = false } = {}) {
  await mkdir(CACHE, { recursive: true });
  const file = join(CACHE, cacheName);
  if (!alwaysFresh) {
    try {
      await access(file);
      return await readFile(file, "utf8");
    } catch {
      /* not cached yet */
    }
  }
  process.stdout.write(`  fetching ${cacheName} … `);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const text = await res.text();
  await writeFile(file, text, "utf8");
  process.stdout.write(`${(text.length / 1e6).toFixed(1)} MB\n`);
  return text;
}

/** Minimal RFC-4180 CSV parser (quoted fields, "" escapes, CRLF). Returns array of row-objects. */
function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  const header = rows.shift() || [];
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  return { rows, idx };
}

/** Sum a season's rows into one record per player (a traded player has one row per team). */
function aggregateSeason(csv) {
  const { rows, idx } = csv;
  const col = (name, alt) => (idx[name] != null ? idx[name] : idx[alt]);
  const iId = col("player_id");
  const iName = col("player_display_name", "player_name");
  const iPos = col("position");
  const iTeam = col("recent_team", "team");
  const iHead = col("headshot_url");
  const catCols = Object.fromEntries(Object.keys(CATS).map((c) => [c, idx[c]]));
  const players = new Map();
  for (const r of rows) {
    const id = r[iId];
    if (!id) continue;
    let p = players.get(id);
    if (!p) {
      p = {
        id,
        name: "",
        pos: "",
        team: "",
        head: "",
        stats: Object.fromEntries(Object.keys(CATS).map((c) => [c, 0])),
      };
      players.set(id, p);
    }
    if (r[iName]) p.name = r[iName];
    if (r[iPos]) p.pos = r[iPos];
    if (r[iTeam]) p.team = r[iTeam];
    if (r[iHead]) p.head = r[iHead];
    for (const [c, ci] of Object.entries(catCols)) {
      if (ci == null) continue;
      const v = parseFloat(r[ci]);
      if (Number.isFinite(v)) p.stats[c] += v;
    }
  }
  return players;
}

/** Round away float dust (sacks come in halves; everything else is integral). */
const clean = (v) => Math.round(v * 2) / 2;

async function main() {
  const last = latestSeason();
  console.log(`NFL refresh: seasons ${FIRST_SEASON}-${last}, top ${TOP_N} per category`);

  // ESPN id map (the "face db" join): gsis_id -> espn_id.
  const espnById = new Map();
  try {
    const pcsv = parseCsv(await fetchCached(PLAYERS_URL, "players.csv"));
    const iGsis = pcsv.idx.gsis_id;
    const iEspn = pcsv.idx.espn_id;
    if (iGsis != null && iEspn != null)
      for (const r of pcsv.rows) if (r[iGsis] && r[iEspn]) espnById.set(r[iGsis], r[iEspn]);
    console.log(`  players.csv: ${espnById.size} ESPN ids mapped`);
  } catch (e) {
    console.warn(`  players.csv unavailable (${e.message}) — falling back to nflverse headshot URLs`);
  }

  const boards = {}; // season -> catKey -> [[playerId, value], ...]
  const used = new Map(); // playerId -> {n, p, t, e?, h?} (only players on some board)

  for (let year = FIRST_SEASON; year <= last; year++) {
    let csv;
    try {
      csv = parseCsv(await fetchCached(statsUrl(year), `stats_player_reg_${year}.csv`, { alwaysFresh: year === last }));
    } catch (e) {
      console.warn(`  season ${year}: unavailable (${e.message}) — skipped`);
      continue;
    }
    const players = aggregateSeason(csv);
    const seasonBoards = {};
    for (const [catCol, catKey] of Object.entries(CATS)) {
      const board = [...players.values()]
        .filter((p) => p.stats[catCol] > 0 && p.name)
        .sort((a, b) => b.stats[catCol] - a.stats[catCol] || a.name.localeCompare(b.name))
        .slice(0, TOP_N);
      seasonBoards[catKey] = board.map((p) => [p.id, clean(p.stats[catCol])]);
      for (const p of board) {
        const prev = used.get(p.id) || {};
        const rec = { n: p.name, p: p.pos || prev.p || "", t: p.team || prev.t || "" };
        const espn = espnById.get(p.id);
        if (espn) rec.e = espn;
        else if (p.head || prev.h) rec.h = p.head || prev.h;
        used.set(p.id, rec); // later seasons win (freshest name/team/face)
      }
    }
    boards[year] = seasonBoards;
    console.log(`  season ${year}: ${players.size} players`);
  }

  const out = {
    v: 1,
    generated: new Date().toISOString().slice(0, 10),
    seasons: Object.keys(boards).map(Number),
    cats: Object.values(CATS),
    players: Object.fromEntries(used),
    boards,
  };
  const json = JSON.stringify(out);
  await writeFile(OUT, json, "utf8");
  console.log(`wrote ${OUT} (${(json.length / 1e6).toFixed(2)} MB, ${used.size} players)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
