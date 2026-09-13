import { describe, it, expect } from "vitest";
import {
  NFL_SEASONS,
  NFL_CATS,
  nflBoard,
  nflAliases,
  nflValueLabel,
  nflRankUnambiguous,
  nflToplistRound,
  nflRankTypeitRound,
  nflChoiceRound,
  nflFacesRound,
  nflPlayerSearch,
  nflPlayerFinds,
} from "./nfl.js";
import { normalizeQuiz } from "../lib/model.js";

/** i18n stub: returns the key with vars appended, deterministic for asserts. */
const t = (key, vars) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key);

describe("nfl data layer (bundled snapshot)", () => {
  it("snapshot covers 1999 onward and all 9 categories", () => {
    expect(NFL_SEASONS[0]).toBe(1999);
    expect(NFL_SEASONS.length).toBeGreaterThanOrEqual(26);
    for (const cat of Object.keys(NFL_CATS)) expect(nflBoard(2021, cat).length).toBeGreaterThan(10);
  });

  it("a settled historical board is correct (2021 passing yards)", () => {
    const b = nflBoard(2021, "passYd");
    expect(b[0]).toMatchObject({ rank: 1, name: "Tom Brady", value: 5316 });
    expect(b[0].valueLabel).toBe("5,316 yds");
    expect(b[0].face).toMatch(/^https:\/\//);
    expect(b[7].rank).toBe(8); // "who had the 8th most…" has a definite subject
  });

  it("nflValueLabel groups thousands and keeps half-sacks", () => {
    expect(nflValueLabel("passYd", 5316)).toBe("5,316 yds");
    expect(nflValueLabel("sacks", 17.5)).toBe("17.5 sacks");
    expect(nflValueLabel("passTd", 43)).toBe("43 TD");
  });

  it("nflRankUnambiguous rejects tied ranks", () => {
    const board = [{ value: 10 }, { value: 8 }, { value: 8 }, { value: 5 }];
    expect(nflRankUnambiguous(board, 1)).toBe(true); // 10 > 8
    expect(nflRankUnambiguous(board, 2)).toBe(false); // tied with rank 3
    expect(nflRankUnambiguous(board, 3)).toBe(false);
    expect(nflRankUnambiguous(board, 4)).toBe(true);
    expect(nflRankUnambiguous(board, 5)).toBe(false); // off the board
  });

  it("nflAliases offers the bare last name only when unambiguous in context", () => {
    expect(nflAliases("Patrick Mahomes", [])).toEqual(["Mahomes"]);
    expect(nflAliases("Odell Beckham Jr.", [])).toEqual(["Beckham"]);
    const board = [{ name: "Josh Allen" }, { name: "Keenan Allen" }];
    expect(nflAliases("Josh Allen", board)).toEqual([]); // two Allens — bare surname matches neither
  });

  it("generated rounds are valid quiz rounds with content fully baked in", () => {
    const rounds = [
      nflToplistRound(t, { season: 2021, cat: "passYd", n: 10, points: 10 }),
      nflRankTypeitRound(t, { season: 2021, cat: "passYd", ranks: [1, 8], points: 10 }),
      nflChoiceRound(t, { season: 2021, cat: "passYd", ranks: [3], points: 10 }),
      nflFacesRound(t, { season: 2021, cat: "recYd", n: 4, points: 10 }),
    ];
    const quiz = normalizeQuiz({ rounds });
    expect(quiz.rounds.map((r) => r.type)).toEqual(["toplist", "typeit", "choice", "image"]);
    expect(quiz.rounds[0].questions[0].entries).toHaveLength(10);
    expect(quiz.rounds[0].questions[0].entries[0].name).toBe("Tom Brady");
    // rank-8 Type It: the right answer with last-name alias, auto-gradable
    const rank8 = quiz.rounds[1].questions[1];
    expect(rank8.answer).toBe(nflBoard(2021, "passYd")[7].name);
    expect(rank8.q).toContain("8th");
    // choice: correct index points at the rank-3 player
    const c = quiz.rounds[2].questions[0];
    expect(c.options[c.correct]).toBe(nflBoard(2021, "passYd")[2].name);
    expect(new Set(c.options).size).toBe(4);
    // faces: ESPN headshot urls
    expect(quiz.rounds[3].questions[0].url).toMatch(/espncdn|nfl/);
  });

  it("player search + finds tie a player to their board appearances", () => {
    const hit = nflPlayerSearch("mahomes")[0];
    expect(hit.name).toBe("Patrick Mahomes");
    const finds = nflPlayerFinds(hit.id);
    expect(finds.some((f) => f.cat === "passTd" && f.season === 2018 && f.rank === 1)).toBe(true); // 50 passing TD MVP year
  });
});
