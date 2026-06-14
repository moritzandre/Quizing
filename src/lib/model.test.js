import { describe, it, expect } from "vitest";
import {
  ytId,
  normalizeQuiz,
  normalizeGame,
  nextNonEmpty,
  countQuestions,
  moveItem,
  haversineKm,
  morphValue,
  summarizeGame,
  aggregateLeaderboard,
  makeHint,
  hintHasContent,
  buildPresentQ,
  buildLive,
  normalizePresent,
  normalizeLive,
} from "./model.js";

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
      { id: "r1", type: "classic", title: "C", timer: null, questions: [{ id: "q1", q: "Q?", a: "A", points: 10 }] },
      {
        id: "r2",
        type: "jeopardy",
        title: "J",
        timer: 30,
        categories: [{ id: "c1", name: "Cat", questions: [{ id: "j1", clue: "Clue", answer: "Ans", points: 100 }] }],
      },
      {
        id: "r3",
        type: "hints",
        title: "H",
        timer: null,
        questions: [
          {
            id: "h1",
            answer: "X",
            hints: [
              "a text hint",
              { type: "image", url: "https://e.com/p.jpg" },
              { type: "map", lat: 1, lng: 2, name: "n" },
            ],
          },
        ],
      },
      {
        id: "r4",
        type: "video",
        title: "V",
        timer: null,
        questions: [
          { id: "v1", url: `https://youtu.be/${ID}`, q: "Q", a: "A", points: 10, audioOnly: true, start: 5, end: 20 },
        ],
      },
      {
        id: "r6",
        type: "image",
        title: "I",
        timer: null,
        questions: [{ id: "i1", url: "https://example.com/cat.jpg", q: "Q", a: "A", points: 10 }],
      },
      {
        id: "r7",
        type: "morph",
        title: "Mo",
        timer: null,
        questions: [{ id: "mo1", url: "https://example.com/x.jpg", a: "A", points: 30, effect: "pixelate", steps: 5 }],
      },
      {
        id: "r8",
        type: "fusion",
        title: "Fu",
        timer: null,
        questions: [
          { id: "fu1", urlA: "https://e.com/a.jpg", urlB: "https://e.com/b.jpg", a: "A + B", points: 40, steps: 4 },
        ],
      },
      {
        id: "r9",
        type: "choice",
        title: "MC",
        timer: null,
        questions: [{ id: "mc1", q: "Q?", options: ["A", "B", "C", "D"], correct: 2, points: 10 }],
      },
      {
        id: "r10",
        type: "number",
        title: "Num",
        timer: null,
        questions: [{ id: "nu1", q: "How many?", answer: 42, unit: "kg", points: 10 }],
      },
      {
        id: "r5",
        type: "map",
        title: "M",
        timer: null,
        questions: [{ id: "m1", q: "Where?", name: "Spot", lat: 1.5, lng: -2.25, points: 10, tileLayer: "satellite" }],
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
    expect(q.rounds[0].timer).toBe(null);
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

  it("normalizes new fields: timer, audioOnly, image type", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "video", timer: "45", questions: [{ url: "x", audioOnly: "yes" }] },
        { type: "image", questions: [{ url: 9, q: null }] },
        { type: "classic", timer: "not-a-number", questions: [] },
      ],
    });
    expect(q.rounds[0].timer).toBe(45);
    expect(q.rounds[0].questions[0].audioOnly).toBe(true);
    expect(q.rounds[1].questions[0]).toMatchObject({ url: "", q: "", a: "", points: 10 });
    expect(q.rounds[2].timer).toBe(null);
  });

  it("normalizes morph rounds: effect whitelist + steps clamp + defaults", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "morph", questions: [{ url: "u", a: "A", effect: "bogus", steps: 99 }] },
        { type: "morph", questions: [{}] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ url: "u", a: "A", effect: "blur", steps: 8 });
    expect(q.rounds[1].questions[0]).toMatchObject({ effect: "blur", steps: 4, points: 30 });
  });

  it("normalizes fusion rounds with defaults", () => {
    const q = normalizeQuiz({ rounds: [{ type: "fusion", questions: [{ urlA: "a", urlB: "b", a: "X+Y" }] }] });
    expect(q.rounds[0].questions[0]).toMatchObject({ urlA: "a", urlB: "b", a: "X+Y", points: 40, steps: 4 });
  });

  it("normalizes choice rounds: clamps correct, coerces options, defaults", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "choice", questions: [{ q: "Q", options: ["a", 7, "c"], correct: 9 }] },
        { type: "choice", questions: [{}] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ q: "Q", options: ["a", "", "c"], correct: 2, points: 10 });
    expect(q.rounds[1].questions[0]).toMatchObject({ options: ["", "", "", ""], correct: 0, points: 10 });
  });

  it("normalizes number rounds: numeric answer or null", () => {
    const q = normalizeQuiz({
      rounds: [{ type: "number", questions: [{ q: "How many?", answer: "42", unit: "kg" }, { answer: "" }] }],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ q: "How many?", answer: 42, unit: "kg", points: 10 });
    expect(q.rounds[0].questions[1].answer).toBe(null);
  });

  it("normalizes typed media hints; keeps text hints as strings; coerces junk", () => {
    const q = normalizeQuiz({
      rounds: [
        {
          type: "hints",
          questions: [
            {
              answer: "Z",
              hints: [
                "plain",
                { type: "image", url: 5 },
                { type: "map", lat: "1.5", lng: "x", name: 9 },
                { type: "bogus", text: "t" },
                42,
              ],
            },
          ],
        },
      ],
    });
    const hints = q.rounds[0].questions[0].hints;
    expect(hints[0]).toBe("plain");
    expect(hints[1]).toEqual({ type: "image", url: "" });
    expect(hints[2]).toEqual({ type: "map", lat: 1.5, lng: null, name: "" });
    expect(hints[3]).toBe("t"); // unknown type → text → str(h.text)
    expect(hints[4]).toBe(""); // non-string/object → ""
  });

  it("normalizes video trim (start/end) and map tileLayer with safe defaults", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "video", questions: [{ url: "u", start: "5", end: "abc" }, {}] },
        { type: "map", questions: [{ q: "W?", tileLayer: "satellite" }, { q: "W2?", tileLayer: "hack" }, {}] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ start: 5, end: null });
    expect(q.rounds[0].questions[1]).toMatchObject({ start: null, end: null });
    expect(q.rounds[1].questions[0].tileLayer).toBe("satellite");
    expect(q.rounds[1].questions[1].tileLayer).toBe("map"); // unknown → map
    expect(q.rounds[1].questions[2].tileLayer).toBe("map"); // missing → map
  });

  it("keeps an audio/video hint trim window; image hints carry no trim", () => {
    const q = normalizeQuiz({
      rounds: [
        {
          type: "hints",
          questions: [
            {
              answer: "Z",
              hints: [
                { type: "audio", url: "a", start: "3", end: 9 },
                { type: "image", url: "i" },
              ],
            },
          ],
        },
      ],
    });
    const hints = q.rounds[0].questions[0].hints;
    expect(hints[0]).toEqual({ type: "audio", url: "a", start: 3, end: 9 });
    expect(hints[1]).toEqual({ type: "image", url: "i" });
  });
});

describe("makeHint / hintHasContent", () => {
  it("makeHint returns a string for text, objects for media", () => {
    expect(makeHint("text")).toBe("");
    expect(makeHint("image")).toEqual({ type: "image", url: "" });
    expect(makeHint("map")).toEqual({ type: "map", lat: null, lng: null, name: "" });
  });

  it("hintHasContent recognises filled text, media, and map hints", () => {
    expect(hintHasContent("hi")).toBe(true);
    expect(hintHasContent("   ")).toBe(false);
    expect(hintHasContent({ type: "image", url: "u" })).toBe(true);
    expect(hintHasContent({ type: "image", url: "" })).toBe(false);
    expect(hintHasContent({ type: "map", lat: 1, lng: 2 })).toBe(true);
    expect(hintHasContent({ type: "map", lat: null, lng: 2 })).toBe(false);
    expect(hintHasContent(null)).toBe(false);
  });
});

describe("normalizeGame", () => {
  const baseQuiz = { rounds: [{ type: "classic", questions: [{ id: "q1", q: "Q", a: "A", points: 10 }] }] };

  it("keeps valid per-player map guesses", () => {
    const g = normalizeGame({
      quiz: baseQuiz,
      players: [{ id: "p1", name: "A", score: 0 }],
      guesses: { p1: { lat: 10, lng: 20 } },
    });
    expect(g.guesses).toEqual({ p1: { lat: 10, lng: 20 } });
  });

  it("drops malformed guesses and defaults to an empty object", () => {
    const g = normalizeGame({
      quiz: baseQuiz,
      players: [{ id: "p1", name: "A", score: 0 }],
      guesses: { p1: { lat: "x", lng: 20 }, p2: null, p3: { lat: 5, lng: 6 } },
    });
    expect(g.guesses).toEqual({ p3: { lat: 5, lng: 6 } });
    const g2 = normalizeGame({ quiz: baseQuiz, players: [{ id: "p1", name: "A", score: 0 }] });
    expect(g2.guesses).toEqual({});
  });

  it("rejects games without a valid quiz or players", () => {
    expect(normalizeGame(null)).toBe(null);
    expect(normalizeGame({ quiz: baseQuiz, players: [] })).toBe(null);
    expect(normalizeGame({ quiz: { rounds: "no" }, players: [{ id: "p1" }] })).toBe(null);
  });

  it("normalizes team mode: deviceIds array + members; migrates single deviceId", () => {
    const g = normalizeGame({
      quiz: baseQuiz,
      mode: "teams",
      players: [
        { id: "t1", name: "Reds", deviceIds: ["d1", "d2"], members: [{ name: "Ann" }, { name: "Bo" }] },
        { id: "p2", name: "Solo", deviceId: "d3" },
      ],
    });
    expect(g.mode).toBe("teams");
    expect(g.players[0].deviceIds).toEqual(["d1", "d2"]);
    expect(g.players[0].members).toEqual([{ name: "Ann" }, { name: "Bo" }]);
    expect(g.players[1].deviceIds).toEqual(["d3"]); // migrated from deviceId
  });

  it("defaults mode to solo", () => {
    const g = normalizeGame({ quiz: baseQuiz, players: [{ id: "p1", name: "A", score: 0 }] });
    expect(g.mode).toBe("solo");
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

describe("moveItem", () => {
  it("moves an element forward without mutating the source", () => {
    const src = ["a", "b", "c", "d"];
    expect(moveItem(src, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(src).toEqual(["a", "b", "c", "d"]);
  });

  it("moves an element backward", () => {
    expect(moveItem(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("is a no-op when from === to", () => {
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "b", "c"]);
  });
});

describe("haversineKm", () => {
  it("returns 0 for identical points", () => {
    expect(haversineKm(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it("approximates the Paris–London distance (~344 km)", () => {
    const d = haversineKm(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(360);
  });

  it("is symmetric", () => {
    const a = haversineKm(-33.87, 151.21, 35.68, 139.69);
    const b = haversineKm(35.68, 139.69, -33.87, 151.21);
    expect(Math.abs(a - b)).toBeLessThan(1e-6);
  });
});

describe("morphValue", () => {
  it("is full value when fully morphed and declines per demorph step", () => {
    expect(morphValue(30, 4, 0)).toBe(30);
    expect(morphValue(30, 4, 4)).toBe(6); // floor = points/(steps+1)
    const seq = [0, 1, 2, 3, 4].map((s) => morphValue(30, 4, s));
    for (let i = 1; i < seq.length; i++) expect(seq[i]).toBeLessThanOrEqual(seq[i - 1]);
  });

  it("never drops below 1", () => {
    expect(morphValue(2, 8, 8)).toBeGreaterThanOrEqual(1);
  });
});

describe("summarizeGame", () => {
  const mk = (scores) => ({
    quiz: { title: "Q" },
    players: scores.map((s, i) => ({ id: `p${i}`, name: `P${i}`, score: s })),
  });

  it("marks the top scorer as winner when the board isn't tied", () => {
    const s = summarizeGame(mk([10, 30, 20]));
    expect(s.players.map((p) => p.won)).toEqual([false, true, false]);
    expect(s.quizTitle).toBe("Q");
  });

  it("awards a win to the least-negative player in an all-negative game", () => {
    const s = summarizeGame(mk([-100, -500]));
    expect(s.players.find((p) => p.score === -100).won).toBe(true);
  });

  it("declares no winner when everyone is tied", () => {
    const s = summarizeGame(mk([0, 0]));
    expect(s.players.every((p) => !p.won)).toBe(true);
  });
});

describe("aggregateLeaderboard", () => {
  it("tallies games, wins, totals and best score by case-insensitive name", () => {
    const results = [
      {
        players: [
          { name: "Ann", score: 30, won: true },
          { name: "bob", score: 10, won: false },
        ],
      },
      {
        players: [
          { name: "ann", score: 20, won: false },
          { name: "Bob", score: 40, won: true },
        ],
      },
    ];
    const board = aggregateLeaderboard(results);
    const ann = board.find((e) => e.name.toLowerCase() === "ann");
    const bob = board.find((e) => e.name.toLowerCase() === "bob");
    expect(ann).toMatchObject({ games: 2, wins: 1, totalScore: 50, bestScore: 30 });
    expect(bob).toMatchObject({ games: 2, wins: 1, totalScore: 50, bestScore: 40 });
  });

  it("sorts by wins, then total score; tolerates junk", () => {
    const board = aggregateLeaderboard([
      { players: [{ name: "A", score: 5, won: false }] },
      { players: [{ name: "B", score: 5, won: true }] },
      null,
      { players: "nope" },
    ]);
    expect(board[0].name).toBe("B");
    expect(board).toHaveLength(2);
  });
});

describe("presenter payloads", () => {
  const game = (over = {}) => ({
    stage: "question",
    ri: 0,
    qi: 0,
    revealed: false,
    hintsShown: 1,
    players: [
      { id: "a", name: "Ann", score: 30, color: "#6366f1", emoji: "🦊", deviceIds: ["d1"] },
      { id: "b", name: "Bob", score: 10 },
    ],
    quiz: {
      title: "Q",
      rounds: [
        {
          id: "r1",
          type: "map",
          title: "Where?",
          questions: [{ id: "m1", q: "Where is it?", name: "Paris", lat: 48.85, lng: 2.35, points: 10 }],
        },
      ],
    },
    ...over,
  });

  it("buildPresentQ omits map coordinates (pins stay hidden until reveal)", () => {
    const p = buildPresentQ(game());
    expect(p.stage).toBe("question");
    expect(p.roundType).toBe("map");
    expect(p.q).toMatchObject({ q: "Where is it?" });
    expect(p.q.lat).toBeUndefined();
    expect(p.q.lng).toBeUndefined();
    expect(p.q.name).toBeUndefined();
  });

  it("buildLive omits the answer until revealed, then includes it", () => {
    expect(buildLive(game()).reveal).toBeUndefined();
    const revealed = buildLive(game({ revealed: true }));
    expect(revealed.reveal.answer).toEqual({ lat: 48.85, lng: 2.35, name: "Paris" });
  });

  it("buildLive strips standings to id/name/score/color/emoji", () => {
    const live = buildLive(game());
    expect(live.standings).toEqual([
      { id: "a", name: "Ann", score: 30, color: "#6366f1", emoji: "🦊" },
      { id: "b", name: "Bob", score: 10, color: null, emoji: null },
    ]);
  });

  it("buildPresentQ has no q when not in the question stage", () => {
    expect(buildPresentQ(game({ stage: "intro" })).q).toBeUndefined();
  });

  it("normalizePresent rejects hostile input and coerces fields", () => {
    expect(normalizePresent(null)).toBeNull();
    expect(normalizePresent([1, 2, 3])).toBeNull();
    const n = normalizePresent({
      stage: "haxx",
      roundType: "evil",
      q: { q: "Hi", effect: "nope", steps: "3" },
    });
    expect(n.stage).toBe("intro"); // unknown stage → default
    expect(n.roundType).toBeNull(); // unknown type dropped
    expect(n.q).toMatchObject({ q: "Hi", effect: "blur", steps: 3 });
  });

  it("normalizeLive coerces and defends against junk", () => {
    expect(normalizeLive("nope")).toBeNull();
    const n = normalizeLive({
      revealed: 1,
      hintsShown: 0,
      standings: [{ name: "X", score: "5" }, "junk"],
      reveal: { answer: { lat: "1", lng: "2", name: 5 } },
    });
    expect(n.revealed).toBe(true);
    expect(n.hintsShown).toBe(1); // clamped to >= 1
    expect(n.standings[0]).toMatchObject({ name: "X", score: 5, color: null, emoji: null });
    expect(n.reveal.answer).toEqual({ lat: 1, lng: 2, name: "" });
  });

  it("buildPresentQ → normalizePresent round-trips a choice question", () => {
    const g = game({
      quiz: {
        title: "Q",
        rounds: [
          {
            id: "r",
            type: "choice",
            title: "C",
            questions: [{ id: "c1", q: "Pick", options: ["A", "B"], correct: 1, points: 10 }],
          },
        ],
      },
    });
    const n = normalizePresent(buildPresentQ(g));
    expect(n.roundType).toBe("choice");
    expect(n.q.options).toEqual(["A", "B"]);
    expect(n.q.correct).toBeUndefined(); // the correct index is never in the present payload
  });
});
