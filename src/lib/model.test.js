import { describe, it, expect } from "vitest";
import { ytId, normalizeQuiz, nextNonEmpty, countQuestions } from "./model.js";

const ID = "dQw4w9WgXcQ";

describe("ytId", () => {
  it("extracts the ID from a standard watch URL", () => {
    expect(ytId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("extracts the ID from a watch URL with extra query params", () => {
    expect(ytId(`https://www.youtube.com/watch?v=${ID}&t=42s`)).toBe(ID);
  });

  it("extracts the ID from a youtu.be short link", () => {
    expect(ytId(`https://youtu.be/${ID}`)).toBe(ID);
  });

  it("extracts the ID from an embed URL", () => {
    expect(ytId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });

  it("extracts the ID from a shorts URL", () => {
    expect(ytId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
  });

  it("accepts a raw 11-character ID (with surrounding whitespace)", () => {
    expect(ytId(ID)).toBe(ID);
    expect(ytId(`  ${ID}  `)).toBe(ID);
  });

  it("returns null for non-YouTube input", () => {
    expect(ytId("")).toBe(null);
    expect(ytId()).toBe(null);
    expect(ytId("not a url")).toBe(null);
    expect(ytId("https://example.com/watch")).toBe(null);
    expect(ytId("tooShort")).toBe(null);
    expect(ytId("definitelyMoreThanElevenChars")).toBe(null);
  });
});

describe("normalizeQuiz", () => {
  const validQuiz = {
    id: "qz1",
    title: "Test Quiz",
    sample: false,
    rounds: [
      { id: "r1", type: "classic", title: "C", questions: [{ id: "q1", q: "Q?", a: "A", points: 10 }] },
      {
        id: "r2",
        type: "jeopardy",
        title: "J",
        categories: [{ id: "c1", name: "Cat", questions: [{ id: "j1", clue: "Clue", answer: "Ans", points: 100 }] }],
      },
      { id: "r3", type: "hints", title: "H", questions: [{ id: "h1", answer: "X", hints: ["a", "b"] }] },
      {
        id: "r4",
        type: "video",
        title: "V",
        questions: [{ id: "v1", url: `https://youtu.be/${ID}`, q: "Q", a: "A", points: 10 }],
      },
      {
        id: "r5",
        type: "map",
        title: "M",
        questions: [{ id: "m1", q: "Where?", name: "Spot", lat: 1.5, lng: -2.25, points: 10 }],
      },
    ],
  };

  it("round-trips a valid quiz unchanged", () => {
    expect(normalizeQuiz(validQuiz)).toEqual(validQuiz);
  });

  it("rejects garbage input", () => {
    expect(normalizeQuiz(null)).toBe(null);
    expect(normalizeQuiz(undefined)).toBe(null);
    expect(normalizeQuiz(42)).toBe(null);
    expect(normalizeQuiz("quiz")).toBe(null);
    expect(normalizeQuiz({})).toBe(null);
    expect(normalizeQuiz({ rounds: "nope" })).toBe(null);
  });

  it("drops rounds with unknown or missing types", () => {
    const q = normalizeQuiz({ rounds: [{ type: "bogus", questions: [] }, null, { questions: [] }] });
    expect(q.rounds).toEqual([]);
  });

  it("fills in defaults for missing fields", () => {
    const q = normalizeQuiz({ rounds: [{ type: "classic", questions: [{}] }] });
    expect(q.title).toBe("Untitled quiz");
    expect(q.sample).toBe(false);
    expect(q.id).toBeTruthy();
    const item = q.rounds[0].questions[0];
    expect(item.id).toBeTruthy();
    expect(item).toMatchObject({ q: "", a: "", points: 10 });
  });

  it("coerces corrupt question fields", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "classic", questions: [{ q: 7, a: null, points: "abc" }] },
        { type: "hints", questions: [{ answer: "X", hints: "not-an-array" }] },
        { type: "map", questions: [{ q: "W?", lat: "12.5", lng: "" }] },
        { type: "jeopardy", categories: [{ name: 3, questions: [{ clue: "C", points: NaN }] }] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ q: "", a: "", points: 10 });
    expect(q.rounds[1].questions[0].hints).toEqual([""]);
    expect(q.rounds[2].questions[0]).toMatchObject({ lat: 12.5, lng: null, points: 10 });
    expect(q.rounds[3].categories[0].name).toBe("");
    expect(q.rounds[3].categories[0].questions[0].points).toBe(100);
  });
});

describe("nextNonEmpty", () => {
  const quiz = {
    rounds: [
      { type: "classic", questions: [] },
      { type: "jeopardy", categories: [{ questions: [] }] },
      { type: "classic", questions: [{ id: "a" }] },
      { type: "jeopardy", categories: [{ questions: [{ id: "b" }] }] },
    ],
  };

  it("finds the first round with content from the given index", () => {
    expect(nextNonEmpty(quiz, 0)).toBe(2);
    expect(nextNonEmpty(quiz, 3)).toBe(3);
  });

  it("returns -1 when no round with content remains", () => {
    expect(nextNonEmpty(quiz, 4)).toBe(-1);
    expect(nextNonEmpty({ rounds: [] }, 0)).toBe(-1);
    expect(nextNonEmpty({ rounds: [{ type: "classic", questions: [] }] }, 0)).toBe(-1);
  });

  it("treats a jeopardy round with at least one clue as non-empty", () => {
    expect(nextNonEmpty(quiz, 3)).toBe(3);
  });
});

describe("countQuestions", () => {
  it("counts plain and jeopardy questions across all rounds", () => {
    const quiz = {
      rounds: [
        { type: "classic", questions: [{ id: "a" }, { id: "b" }] },
        { type: "jeopardy", categories: [{ questions: [{ id: "c" }, { id: "d" }] }, { questions: [{ id: "e" }] }] },
        { type: "hints", questions: [{ id: "f" }] },
      ],
    };
    expect(countQuestions(quiz)).toBe(6);
  });

  it("returns 0 for an empty quiz", () => {
    expect(countQuestions({ rounds: [] })).toBe(0);
    expect(countQuestions({ rounds: [{ type: "jeopardy", categories: [] }] })).toBe(0);
  });
});
