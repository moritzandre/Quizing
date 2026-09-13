import { describe, it, expect } from "vitest";
import {
  NFL_SEASONS,
  NFL_CATS,
  nflBoard,
  nflAliases,
  nflValueLabel,
  nflRankUnambiguous,
  nflLatestFullSeason,
  nflToplistRound,
  nflRankTypeitRound,
  nflChoiceRound,
  nflFacesRound,
  nflHigherLowerRound,
  nflNumberRound,
  nflTrueFalseRound,
  nflWhoknowsRound,
  nflJeopardyRound,
  nflPlayerSearch,
  nflPlayerFinds,
} from "./nfl.js";
import { NFL_QUIZ } from "./nflQuiz.js";
import { normalizeQuiz, roundsFromImport, questionsFromImport, normalizeGame, buildPresentQ } from "../lib/model.js";
import { translate } from "../i18n/strings.js";

/** i18n stub: returns the key with vars appended, deterministic for asserts. */
const t = (key, vars) => (vars ? `${key} ${Object.values(vars).join(" ")}` : key);
/** The real English catalog — what the refresh script bakes with. */
const en = (key, vars) => translate("en", key, vars);

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

  it("the latest FULL season skips a barely-started running season", () => {
    const full = nflLatestFullSeason();
    expect(nflBoard(full, "passYd")[0].value).toBeGreaterThanOrEqual(3500);
    expect(NFL_SEASONS).toContain(full);
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

  it("higher/lower, closest-guess, true/false, who-knows and jeopardy generators are consistent", () => {
    const board = nflBoard(2021, "rushYd");
    const hl = normalizeQuiz({ rounds: [nflHigherLowerRound(t, { season: 2021, cat: "rushYd", points: 10 })] })
      .rounds[0];
    expect(hl.type).toBe("higherlower");
    expect(hl.questions.length).toBeGreaterThanOrEqual(4);
    for (const q of hl.questions) {
      // the note names the asked player (y), the question the stated one (x); the flag must match the board
      const y = board.find((r) => q.note.includes(` ${r.name} `));
      const x = board.find((r) => r.name !== y.name && q.q.includes(` ${r.name} `));
      expect(y && x).toBeTruthy();
      expect(q.correct).toBe(y.value > x.value ? 0 : 1);
    }
    const num = normalizeQuiz({
      rounds: [nflNumberRound(t, { season: 2021, cat: "recYd", ranks: [1, 2], points: 10 })],
    }).rounds[0];
    expect(num.questions[0]).toMatchObject({ answer: nflBoard(2021, "recYd")[0].value, unit: "yds" });
    const tf = normalizeQuiz({ rounds: [nflTrueFalseRound(t, { season: 2021, cat: "sacks", points: 10 })] }).rounds[0];
    expect(tf.questions[0].correct).toBe(0); // the actual leader → True
    expect(tf.questions.slice(1).every((q) => q.correct === 1)).toBe(true); // everyone else → False
    const wk = normalizeQuiz({ rounds: [nflWhoknowsRound(t, { season: 2021, cat: "rec", n: 10, points: 2 })] })
      .rounds[0];
    expect(wk.questions[0].answers).toHaveLength(10);
    expect(wk.questions[0].ordered).toBe(true);
    const jeop = normalizeQuiz({ rounds: [nflJeopardyRound(t, { season: 2021 })] }).rounds[0];
    expect(jeop.type).toBe("jeopardy");
    expect(jeop.categories).toHaveLength(4); // 3 stat categories + Faces
    const faces = jeop.categories[3];
    expect(faces.questions[0].media).toMatchObject({ type: "image" });
    expect(faces.questions[0].media.url).toMatch(/^https:\/\//);
    expect(faces.questions.map((q) => q.points)).toEqual([100, 200, 300, 400, 500]);
  });

  it("player search + finds tie a player to their board appearances", () => {
    const hit = nflPlayerSearch("mahomes")[0];
    expect(hit.name).toBe("Patrick Mahomes");
    const finds = nflPlayerFinds(hit.id);
    expect(finds.some((f) => f.cat === "passTd" && f.season === 2018 && f.rank === 1)).toBe(true); // 50 passing TD MVP year
  });
});

describe("NFL Night showcase quiz (baked built-in) — export/import compatibility", () => {
  it("is fully normalized (survives storage + reload byte-for-byte) and covers every NFL-capable format", () => {
    expect(normalizeQuiz(NFL_QUIZ)).toEqual(NFL_QUIZ);
    expect(NFL_QUIZ.rounds.map((r) => r.type)).toEqual([
      "toplist",
      "typeit",
      "higherlower",
      "number",
      "truefalse",
      "choice",
      "image",
      "jeopardy",
      "whoknows",
    ]);
    expect(NFL_QUIZ.rounds[5].reveal).toBe("end"); // the multiple-choice round runs pub-quiz style
    expect(NFL_QUIZ.rounds.every((r) => (r.questions || []).length > 0 || (r.categories || []).length > 0)).toBe(true);
  });

  it("round-trips through the .quiz.json export/import path and the JSON round/question importers", () => {
    // exportQuiz writes { app, v, quiz } — the importer accepts the wrapper, a bare quiz, or rounds
    const file = JSON.parse(JSON.stringify({ app: "quiz-night", v: 1, quiz: NFL_QUIZ }));
    expect(normalizeQuiz(file.quiz)).toEqual(NFL_QUIZ);
    expect(roundsFromImport(file).map((r) => r.type)).toEqual(NFL_QUIZ.rounds.map((r) => r.type));
    // per-round "import questions" into an existing Top List / Higher-Lower round
    const tl = questionsFromImport(JSON.parse(JSON.stringify(NFL_QUIZ.rounds[0])), "toplist");
    expect(tl[0].entries).toHaveLength(10);
    const hl = questionsFromImport(JSON.parse(JSON.stringify(NFL_QUIZ)), "higherlower");
    expect(hl.length).toBe(NFL_QUIZ.rounds[2].questions.length);
  });

  it("uses the real English catalog (no raw i18n keys leaked into content) and stays reveal-safe", () => {
    const text = JSON.stringify(NFL_QUIZ);
    expect(text).not.toMatch(/nfl\.(q|round|jeop|cat)\./);
    expect(
      NFL_QUIZ.rounds[1].questions.some((q) => q.q === en("nfl.q.rank1", { season: 2021, cat: "passing yards" })),
    ).toBe(true);
    // the Top List board's TV payload carries only the prompt + slot count
    const game = normalizeGame({ quiz: NFL_QUIZ, players: [{ id: "p", name: "P", score: 0 }], stage: "question" });
    const present = buildPresentQ(game);
    expect(present.q.count).toBe(10);
    expect(JSON.stringify(present)).not.toContain(NFL_QUIZ.rounds[0].questions[0].entries[0].name);
  });
});
