import { describe, it, expect } from "vitest";
import {
  ytId,
  mediaSource,
  normalizeQuiz,
  normalizeGame,
  nextNonEmpty,
  countQuestions,
  moveItem,
  haversineKm,
  morphValue,
  morphValueAt,
  clipLadderActive,
  clipEnd,
  summarizeGame,
  aggregateLeaderboard,
  normalizeProfile,
  normalizeResults,
  summarizeResults,
  summarizeForProfile,
  normalizeLeaderboard,
  buildResultRow,
  makeHint,
  hintHasContent,
  buildPresentQ,
  buildLive,
  buildHostAux,
  normalizeHostAux,
  normalizePhoneScores,
  normalizePresent,
  normalizeLive,
  recapStory,
  summarizeGamesFromResults,
  mapillaryEmbedUrl,
  roundsFromImport,
  normText,
  makeAnyChar,
  normalizeAnyChar,
  matchAnyEntity,
  gradeAnythingle,
  anyAllGreen,
  isAnyTarget,
  anyTurnOrder,
  ANYTHINGLE_TRAITS,
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

describe("mediaSource", () => {
  it("detects YouTube (and a bare id) last", () => {
    expect(mediaSource(`https://youtu.be/${ID}`)).toEqual({ kind: "youtube", id: ID });
    expect(mediaSource(ID)).toEqual({ kind: "youtube", id: ID });
  });

  it("detects a Spotify track from a share URL (and strips the ?si query)", () => {
    const m = mediaSource("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc123");
    expect(m).toMatchObject({ kind: "spotify", spType: "track", id: "4cOdK2wGLETKBW3PvgPWqT" });
    expect(m.uri).toBe("spotify:track:4cOdK2wGLETKBW3PvgPWqT");
    expect(m.embedUrl).toBe("https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT");
  });

  it("detects a localized Spotify URL, a spotify: URI, and an episode", () => {
    expect(mediaSource("https://open.spotify.com/intl-de/track/4cOdK2wGLETKBW3PvgPWqT")).toMatchObject({
      kind: "spotify",
      spType: "track",
      id: "4cOdK2wGLETKBW3PvgPWqT",
    });
    expect(mediaSource("spotify:track:4cOdK2wGLETKBW3PvgPWqT")).toMatchObject({
      kind: "spotify",
      id: "4cOdK2wGLETKBW3PvgPWqT",
    });
    expect(mediaSource("https://open.spotify.com/episode/512ojhOuo1ktJprKbVcKyQ")).toMatchObject({
      kind: "spotify",
      spType: "episode",
    });
  });

  it("detects direct audio/video files by extension (incl. a trailing query)", () => {
    expect(mediaSource("https://cdn.example.com/song.mp3")).toEqual({
      kind: "file",
      url: "https://cdn.example.com/song.mp3",
      media: "audio",
    });
    expect(mediaSource("https://cdn.example.com/clip.mp4?token=xyz")).toMatchObject({ kind: "file", media: "video" });
    expect(mediaSource("https://cdn.example.com/a.webm")).toMatchObject({ kind: "file", media: "video" });
    expect(mediaSource("data:audio/mpeg;base64,AAAA")).toMatchObject({ kind: "file", media: "audio" });
  });

  it("returns null for empty or unrecognized input", () => {
    expect(mediaSource("")).toBe(null);
    expect(mediaSource()).toBe(null);
    expect(mediaSource("https://example.com/page.html")).toBe(null);
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
        questions: [
          { id: "m1", q: "Where?", name: "Spot", lat: 1.5, lng: -2.25, points: 10, tileLayer: "satellite", street: "" },
        ],
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

  it("normalizes a connect round: typed clues + the connection answer", () => {
    const q = normalizeQuiz({
      rounds: [
        {
          type: "connect",
          questions: [
            {
              answer: "All red",
              clues: ["Apple", { type: "image", url: "x.png" }, { type: "audio", url: "a.mp3", start: "2" }],
            },
            { answer: "X", clues: "not-an-array" },
          ],
        },
      ],
    });
    const r = q.rounds[0];
    expect(r.type).toBe("connect");
    expect(r.questions[0].answer).toBe("All red");
    expect(r.questions[0].clues).toEqual([
      "Apple",
      { type: "image", url: "x.png" },
      { type: "audio", url: "a.mp3", start: 2, end: null },
    ]);
    expect(r.questions[1].clues).toEqual([""]); // junk clues → [""]
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

  it("normalizes video rounds: trim window + defaults, and carries no clip-ladder steps", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "video", questions: [{ url: "u", a: "A", start: 10, end: 40, steps: 5 }] },
        { type: "video", questions: [{}] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ url: "u", a: "A", start: 10, end: 40 });
    expect(q.rounds[0].questions[0].steps).toBeUndefined(); // plain video has no ladder
    expect(q.rounds[1].questions[0]).toMatchObject({ audioOnly: false, points: 10, start: null, end: null });
  });

  it("normalizes clip rounds: trim window + clip-ladder steps clamp (min 1) + defaults", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "clip", questions: [{ url: "u", a: "A", start: 10, end: 40, steps: 99 }] },
        { type: "clip", questions: [{ url: "u", a: "A", steps: 0 }] },
        { type: "clip", questions: [{}] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ url: "u", a: "A", start: 10, end: 40, steps: 8 }); // clamped to 8
    expect(q.rounds[1].questions[0].steps).toBe(1); // a ladder needs at least one extension
    expect(q.rounds[2].questions[0]).toMatchObject({ steps: 4, audioOnly: false, points: 10 }); // defaults
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

  it("caps choice options at 6 (the UI only labels A–F) and clamps correct into range", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "choice", questions: [{ q: "Q", options: ["a", "b", "c", "d", "e", "f", "g", "h"], correct: 7 }] },
      ],
    });
    expect(q.rounds[0].questions[0].options).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(q.rounds[0].questions[0].correct).toBe(5); // clamped to options.length - 1
  });

  it("normalizes true/false + higher/lower rounds: correct coerced to 0|1, optional note", () => {
    const q = normalizeQuiz({
      rounds: [
        { type: "truefalse", questions: [{ q: "Statement", correct: 1, points: 20, note: "fact" }, { correct: 5 }] },
        { type: "higherlower", questions: [{ q: "Higher?", correct: 0 }, {}] },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ q: "Statement", correct: 1, points: 20, note: "fact" });
    expect(q.rounds[0].questions[1]).toMatchObject({ correct: 0, points: 10, note: "" }); // non-0/1 -> 0
    expect(q.rounds[1].questions[0]).toMatchObject({ q: "Higher?", correct: 0, points: 10 });
    expect(q.rounds[1].questions[1]).toMatchObject({ correct: 0, points: 10 });
  });

  it("normalizes number rounds: numeric answer or null", () => {
    const q = normalizeQuiz({
      rounds: [{ type: "number", questions: [{ q: "How many?", answer: "42", unit: "kg" }, { answer: "" }] }],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({ q: "How many?", answer: 42, unit: "kg", points: 10 });
    expect(q.rounds[0].questions[1].answer).toBe(null);
  });

  it("normalizes who-knows rounds: stringifies answers, drops blanks, coerces ordered", () => {
    const q = normalizeQuiz({
      rounds: [
        {
          type: "whoknows",
          questions: [
            { q: "Border countries", answers: ["France", "", "  ", 42, "Poland"], ordered: 1 },
            { answers: "nope" },
          ],
        },
      ],
    });
    expect(q.rounds[0].questions[0]).toMatchObject({
      q: "Border countries",
      answers: ["France", "42", "Poland"],
      ordered: true,
    });
    expect(q.rounds[0].questions[1]).toMatchObject({ q: "", answers: [], ordered: false });
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

  it("builds a Mapillary embed URL from a share link, embed link, raw id, or nothing", () => {
    expect(mapillaryEmbedUrl("")).toBe(null);
    expect(mapillaryEmbedUrl("   ")).toBe(null);
    expect(mapillaryEmbedUrl("https://www.mapillary.com/app/?pKey=123&focus=photo")).toBe(
      "https://www.mapillary.com/embed?image_key=123&style=photo",
    );
    expect(mapillaryEmbedUrl("https://www.mapillary.com/embed?image_key=abc-DEF_9")).toBe(
      "https://www.mapillary.com/embed?image_key=abc-DEF_9&style=photo",
    );
    expect(mapillaryEmbedUrl("rawId123")).toBe("https://www.mapillary.com/embed?image_key=rawId123&style=photo");
    expect(mapillaryEmbedUrl("a totally unrelated phrase")).toBe(null);
    // a param ending in "id" must not be mistaken for the real key
    expect(mapillaryEmbedUrl("https://m/?someid=999&pKey=REAL")).toBe(
      "https://www.mapillary.com/embed?image_key=REAL&style=photo",
    );
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

  it("falls a tile-less jeopardy question back to the board (corrupt-save coherence)", () => {
    const jeopQuiz = {
      rounds: [{ type: "jeopardy", categories: [{ name: "C", questions: [{ clue: "x", answer: "y", points: 100 }] }] }],
    };
    const players = [{ id: "p1", name: "A", score: 0 }];
    // stage "question" with no tile would crash the render → reset to board.
    expect(normalizeGame({ quiz: jeopQuiz, players, ri: 0, stage: "question", tile: null }).stage).toBe("board");
    // a coherent tile is preserved.
    const ok = normalizeGame({ quiz: jeopQuiz, players, ri: 0, stage: "question", tile: { ci: 0, qi: 0 } });
    expect(ok.stage).toBe("question");
    expect(ok.tile).toEqual({ ci: 0, qi: 0 });
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

describe("morphValueAt (continuous demorph)", () => {
  it("is full value at progress 0 and decays to a floor of 1 at progress 1", () => {
    expect(morphValueAt(30, 0)).toBe(30);
    expect(morphValueAt(30, 0.5)).toBe(15);
    expect(morphValueAt(30, 1)).toBe(1); // floored
  });
  it("clamps out-of-range progress and never drops below 1", () => {
    expect(morphValueAt(30, -1)).toBe(30);
    expect(morphValueAt(30, 2)).toBe(1);
    expect(morphValueAt(2, 0.99)).toBeGreaterThanOrEqual(1);
  });
});

describe("clip ladder (video/audio)", () => {
  it("is active only with steps>0 and a real trim window", () => {
    expect(clipLadderActive({ steps: 2, start: 10, end: 40 })).toBe(true);
    expect(clipLadderActive({ steps: 0, start: 10, end: 40 })).toBe(false); // no ladder
    expect(clipLadderActive({ steps: 2, start: 10, end: 10 })).toBe(false); // empty window
    expect(clipLadderActive({ steps: 2, start: 10 })).toBe(false); // no end
    expect(clipLadderActive({ steps: "2", start: 0, end: 30 })).toBe(true); // coerces
    expect(clipLadderActive(null)).toBe(false);
  });

  it("grows the out-point progressively — short first slice, bigger later jumps", () => {
    const q = { steps: 2, start: 0, end: 30 }; // power-2 curve over a 30s window
    expect(clipEnd(q, 0)).toBeCloseTo(30 * (1 / 3) ** 2); // ~3.3s — short first reveal
    expect(clipEnd(q, 1)).toBeCloseTo(30 * (2 / 3) ** 2); // ~13.3s
    expect(clipEnd(q, 2)).toBeCloseTo(30); // final step = the whole window
    expect(clipEnd(q, 99)).toBeCloseTo(30); // clamps to the full window
    // each extension reveals MORE than the previous one
    expect(clipEnd(q, 2) - clipEnd(q, 1)).toBeGreaterThan(clipEnd(q, 1) - clipEnd(q, 0));
  });

  it("honors a non-zero start offset", () => {
    const q = { steps: 1, start: 60, end: 120 }; // 60s window
    expect(clipEnd(q, 0)).toBeCloseTo(60 + 60 * (1 / 2) ** 2); // 75
    expect(clipEnd(q, 1)).toBeCloseTo(120);
  });

  it("returns the plain end (or null) when the ladder is inactive", () => {
    expect(clipEnd({ steps: 0, start: 5, end: 25 }, 0)).toBe(25);
    expect(clipEnd({ steps: 2, start: 5 }, 0)).toBe(null);
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

describe("player profiles (Supabase)", () => {
  it("normalizeProfile coerces a row, requires an id, and carries `locked`", () => {
    expect(normalizeProfile(null)).toBe(null);
    expect(normalizeProfile({ name: "x" })).toBe(null); // no id
    expect(normalizeProfile({ id: "u1", name: "Ann", emoji: "ghost", color: "#f00", locked: true })).toEqual({
      id: "u1",
      name: "Ann",
      emoji: "ghost",
      color: "#f00",
      locked: true,
    });
    // junk types coerced to null; locked defaults false
    expect(normalizeProfile({ id: "u2", name: 7, emoji: 5, color: {} })).toEqual({
      id: "u2",
      name: "",
      emoji: null,
      color: null,
      locked: false,
    });
  });

  it("normalizeLeaderboard coerces view rows (snake→camel) and sorts by wins/total/best", () => {
    expect(normalizeLeaderboard("nope")).toEqual([]);
    const board = normalizeLeaderboard([
      { id: "a", name: "Ann", games: 3, wins: 1, total_score: 80, best_score: 40 },
      { id: "b", name: "Bob", games: 5, wins: "3", total_score: 120, best_score: 50 },
      { name: "no-id" }, // dropped (no id)
    ]);
    expect(board.map((e) => e.id)).toEqual(["b", "a"]); // Bob (3 wins) first
    expect(board[0]).toMatchObject({ name: "Bob", games: 5, wins: 3, totalScore: 120, bestScore: 50 });
  });

  it("buildResultRow computes a phone's own row from the standings it mirrors", () => {
    const scores = [
      { id: "a", name: "Ann", score: 30, deviceIds: ["d1"] },
      { id: "b", name: "Bob", score: 10, deviceIds: ["d2"] },
    ];
    expect(buildResultRow(scores, "d1", { gameId: "g1", quizTitle: "Fri", mode: "solo", roomCode: "ABCD" })).toEqual({
      game_id: "g1",
      quiz_title: "Fri",
      score: 30,
      won: true,
      team_name: null,
      room_code: "ABCD",
    });
    expect(buildResultRow(scores, "d2", { gameId: "g1" }).won).toBe(false);
    expect(buildResultRow(scores, "nope", { gameId: "g1" })).toBe(null); // not in standings
    expect(buildResultRow(scores, "d1", {})).toBe(null); // no gameId
    // team mode → team_name from the entity; tie → nobody won
    const tied = [
      { id: "r", name: "Reds", score: 20, deviceIds: ["d1"] },
      { id: "b", name: "Blues", score: 20, deviceIds: ["d2"] },
    ];
    expect(buildResultRow(tied, "d1", { gameId: "g2", mode: "teams" })).toMatchObject({
      won: false,
      team_name: "Reds",
    });
  });

  it("normalizeResults + summarizeResults coerce rows and aggregate", () => {
    expect(normalizeResults("nope")).toEqual([]);
    const rows = [
      { game_id: "g1", quiz_title: "Q", score: "30", won: true, team_name: null, room_code: "ABCD" },
      { game_id: "g2", score: 10, won: 0 },
    ];
    const n = normalizeResults(rows);
    expect(n[0]).toMatchObject({ game_id: "g1", quiz_title: "Q", score: 30, won: true, room_code: "ABCD" });
    expect(n[1]).toMatchObject({ quiz_title: "Untitled quiz", score: 10, won: false });
    expect(summarizeResults(rows)).toMatchObject({ games: 2, wins: 1, totalScore: 40, bestScore: 30 });
  });

  it("summarizeForProfile finds the phone's entity and computes its win (solo + team)", () => {
    const solo = {
      id: "game1",
      mode: "solo",
      quiz: { title: "Friday" },
      players: [
        { id: "a", name: "Ann", score: 30, deviceIds: ["d1"] },
        { id: "b", name: "Bob", score: 10, deviceIds: ["d2"] },
      ],
    };
    expect(summarizeForProfile(solo, "d1")).toEqual({
      game_id: "game1",
      quiz_title: "Friday",
      score: 30,
      won: true,
      team_name: null,
    });
    expect(summarizeForProfile(solo, "d2").won).toBe(false);
    expect(summarizeForProfile(solo, "unknown")).toBe(null); // phone not in the game

    const team = {
      id: "g2",
      mode: "teams",
      quiz: { title: "T" },
      players: [
        { id: "r", name: "Reds", score: 50, deviceIds: ["d1", "d2"] },
        { id: "b", name: "Blues", score: 40, deviceIds: ["d3"] },
      ],
    };
    expect(summarizeForProfile(team, "d2")).toMatchObject({ score: 50, won: true, team_name: "Reds" });
  });

  it("normalizeGame round-trips an optional per-player profileId", () => {
    const g = normalizeGame({
      quiz: { rounds: [{ type: "classic", questions: [{ q: "Q", a: "A" }] }] },
      players: [
        { id: "a", name: "Ann", score: 0, deviceIds: ["d1"], profileId: "prof-1" },
        { id: "b", name: "Bob", score: 0 },
      ],
    });
    expect(g.players[0].profileId).toBe("prof-1");
    expect(g.players[1].profileId).toBeUndefined();
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

  it("buildLive sends map guess pins only after reveal (TV mirrors everyone's pins)", () => {
    // pre-reveal there's no reveal payload at all, so no coords leak
    expect(buildLive(game({ guesses: { a: { lat: 1, lng: 2 } } })).reveal).toBeUndefined();
    // on reveal, each player who guessed becomes a marker (colour/label from the player)
    const revealed = buildLive(game({ revealed: true, guesses: { a: { lat: 1, lng: 2 } } }));
    expect(revealed.reveal.guesses).toEqual([{ lat: 1, lng: 2, color: "#6366f1", label: "Ann" }]);
  });

  it("buildLive strips standings to id/name/score/color/emoji", () => {
    const live = buildLive(game());
    expect(live.standings).toEqual([
      { id: "a", name: "Ann", score: 30, color: "#6366f1", emoji: "🦊" },
      { id: "b", name: "Bob", score: 10, color: null, emoji: null },
    ]);
  });

  it("buildLive carries the recap window only when opts.recap is set", () => {
    expect(buildLive(game()).showRecap).toBe(false);
    expect(buildLive(game()).recapFrom).toBe(null);
    const r = buildLive(game(), { recap: true, recapFrom: { a: 10, b: 5, junk: "x" } });
    expect(r.showRecap).toBe(true);
    expect(r.recapFrom).toEqual({ a: 10, b: 5 }); // non-numeric entries dropped
  });

  it("buildLive carries the media transport + soundOnTv + volume (so the TV plays/pauses the clip)", () => {
    expect(buildLive(game()).transport).toEqual({ n: 0, action: "idle" });
    expect(buildLive(game()).soundOnTv).toBe(false);
    expect(buildLive(game()).volume).toBe(100); // full by default
    const t = buildLive(game(), { transport: { n: 3, action: "play" }, soundOnTv: true, volume: 40 });
    expect(t.transport).toEqual({ n: 3, action: "play" });
    expect(t.soundOnTv).toBe(true);
    expect(t.volume).toBe(40);
  });

  it("buildLive/normalizeLive mirror morphRunning (so the host remote can label/toggle the demorph)", () => {
    expect(buildLive(game()).morphRunning).toBe(false); // off by default
    expect(buildLive(game(), { morphRunning: true }).morphRunning).toBe(true);
    expect(normalizeLive({}).morphRunning).toBe(false);
    expect(normalizeLive({ morphRunning: 1 }).morphRunning).toBe(true); // coerced
    expect(normalizeLive({ morphRunning: true }).morphRunning).toBe(true);
  });

  it("normalizeLive validates the transport action + soundOnTv + volume against junk", () => {
    expect(normalizeLive({}).transport).toEqual({ n: 0, action: "idle" });
    expect(normalizeLive({}).volume).toBe(100);
    expect(normalizeLive({ transport: { n: 5, action: "restart" }, soundOnTv: 1, volume: 25 })).toMatchObject({
      transport: { n: 5, action: "restart" },
      soundOnTv: true,
      volume: 25,
    });
    expect(normalizeLive({ transport: { n: 2, action: "hack" } }).transport).toEqual({ n: 2, action: "idle" }); // bad action dropped
    expect(normalizeLive({ volume: 999 }).volume).toBe(100); // clamped
    expect(normalizeLive({ volume: -5 }).volume).toBe(0); // clamped
  });

  it("buildPresentQ → normalizePresent round-trips a clip ladder (steps + window survive)", () => {
    const g = game({
      quiz: {
        title: "Q",
        rounds: [
          {
            id: "r",
            type: "clip",
            title: "V",
            questions: [
              { id: "c1", url: "https://youtu.be/x", q: "?", a: "A", points: 10, start: 10, end: 40, steps: 2 },
            ],
          },
        ],
      },
    });
    const n = normalizePresent(buildPresentQ(g));
    expect(n.roundType).toBe("clip");
    expect(n.q).toMatchObject({ start: 10, end: 40, steps: 2 });
    expect(n.q.url).toBe("https://youtu.be/x");
    expect(clipEnd(n.q, 0)).toBeCloseTo(10 + 30 * (1 / 3) ** 2); // progressive: short first slice
  });

  it("plain video present payload carries no clip-ladder steps", () => {
    const g = game({
      quiz: {
        title: "Q",
        rounds: [
          {
            id: "r",
            type: "video",
            title: "V",
            questions: [{ id: "v1", url: "https://youtu.be/x", q: "?", a: "A", points: 10, start: 10, end: 40 }],
          },
        ],
      },
    });
    const n = normalizePresent(buildPresentQ(g));
    expect(n.roundType).toBe("video");
    expect(n.q).toMatchObject({ start: 10, end: 40, audioOnly: false });
    expect(n.q.steps).toBeUndefined();
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

  it("normalizeLive validates the recap variant (unknown → first variant)", () => {
    expect(normalizeLive({ recapVariant: "race" }).recapVariant).toBe("race");
    expect(normalizeLive({ recapVariant: "stacker" }).recapVariant).toBe("stacker");
    expect(normalizeLive({ recapVariant: "hax" }).recapVariant).toBe("invaders");
    expect(normalizeLive({}).recapVariant).toBe("invaders");
  });

  it("buildLive carries the recap variant only sanely (defaults bad input)", () => {
    expect(buildLive(game(), { recapVariant: "bricks" }).recapVariant).toBe("bricks");
    expect(buildLive(game(), { recapVariant: "nope" }).recapVariant).toBe("invaders");
  });

  it("buildLive/normalizeLive round-trip the recap round number (only when recapping)", () => {
    const l = buildLive(game(), { recap: true, recapRound: 2, recapTotal: 5 });
    expect(l.recapRound).toBe(2);
    expect(l.recapTotal).toBe(5);
    expect(buildLive(game(), { recapRound: 2, recapTotal: 5 }).recapRound).toBe(0); // not recapping → 0
    expect(normalizeLive({ showRecap: true, recapRound: "3", recapTotal: "8" }).recapRound).toBe(3);
    expect(normalizeLive({ showRecap: true, recapRound: "3", recapTotal: "8" }).recapTotal).toBe(8);
    expect(normalizeLive({ recapRound: 3 }).recapRound).toBe(0); // no showRecap → 0
  });

  describe("summarizeGamesFromResults (admin past-games)", () => {
    it("groups result rows by game, newest first, entries by score desc", () => {
      const games = summarizeGamesFromResults([
        {
          game_id: "g1",
          quiz_title: "Q1",
          room_code: "AAA",
          score: 5,
          won: false,
          profile_id: "p1",
          played_at: "2026-01-01T10:00:00Z",
        },
        {
          game_id: "g1",
          quiz_title: "Q1",
          room_code: "AAA",
          score: 9,
          won: true,
          profile_id: "p2",
          played_at: "2026-01-01T10:05:00Z",
        },
        {
          game_id: "g2",
          quiz_title: "Q2",
          room_code: "BBB",
          score: 3,
          won: true,
          profile_id: "p1",
          played_at: "2026-02-02T20:00:00Z",
        },
        { junk: true },
        { game_id: "", score: 1 },
      ]);
      expect(games.map((g) => g.gameId)).toEqual(["g2", "g1"]); // newest first
      const g1 = games.find((g) => g.gameId === "g1");
      expect(g1.entries.map((e) => e.profileId)).toEqual(["p2", "p1"]); // score desc
      expect(g1.entries[0]).toMatchObject({ score: 9, won: true });
      expect(g1.playedAt).toBe("2026-01-01T10:05:00Z"); // latest entry's timestamp
      expect(g1.quizTitle).toBe("Q1");
    });

    it("returns an empty array for junk", () => {
      expect(summarizeGamesFromResults(null)).toEqual([]);
      expect(summarizeGamesFromResults([{ no: "game_id" }])).toEqual([]);
    });
  });

  describe("recapStory (between-rounds commentary)", () => {
    it("returns nothing for an empty field", () => {
      expect(recapStory([])).toEqual({ mid: null, winner: null });
    });

    it("names the ROUND winner = biggest positive mover, not the overall leader", () => {
      const s = recapStory([
        { id: "a", name: "Ann", from: 30, to: 35 }, // overall leader, only +5
        { id: "b", name: "Bo", from: 0, to: 12 }, // biggest mover this round, +12
      ]);
      expect(s.winner).toEqual({ key: "recapStory.winner", vars: { name: "Bo", delta: 12 } });
    });

    it("has no round winner when nobody gained points", () => {
      const s = recapStory([
        { id: "a", name: "Ann", from: 30, to: 30 },
        { id: "b", name: "Bo", from: 5, to: 5 },
      ]);
      expect(s.winner).toBeNull();
    });

    it("calls out a lead change as an overtake (mid)", () => {
      const s = recapStory([
        { id: "a", name: "Ann", from: 2, to: 10 },
        { id: "b", name: "Bo", from: 8, to: 9 },
      ]);
      expect(s.mid).toEqual({ key: "recapStory.overtake", vars: { name: "Ann", prev: "Bo" } });
    });

    it("flags a photo finish when the top two are within a hair (mid)", () => {
      const s = recapStory([
        { id: "a", name: "Ann", from: 0, to: 10 },
        { id: "b", name: "Bo", from: 0, to: 9 },
      ]);
      expect(s.mid).toEqual({ key: "recapStory.photoFinish", vars: {} });
    });
  });

  it("normalizeLive round-trips a true/false reveal (correct + note for the TV)", () => {
    const n = normalizeLive({ reveal: { correct: 1, note: "It's a myth." } });
    expect(n.reveal).toMatchObject({ correct: 1, note: "It's a myth." });
  });

  it("normalizeLive round-trips a who-knows payload and defends against junk", () => {
    expect(normalizeLive({}).whoknows).toBeNull();
    const n = normalizeLive({
      whoknows: {
        phase: "answering",
        winner: { name: "Ann", color: "#f00", emoji: "🦊" },
        claimed: 3,
        picked: [{ i: 1, text: "Poland" }, "junk"],
        result: "hack", // not deliver|bust -> ""
        showAll: false,
        answers: ["should", "be", "hidden"], // dropped while showAll=false (no leak)
        ordered: 1,
        total: 9,
        secsLeft: 12,
      },
    });
    expect(n.whoknows).toMatchObject({
      phase: "answering",
      winner: { name: "Ann", color: "#f00", emoji: "🦊" },
      claimed: 3,
      result: "",
      ordered: true,
      total: 9,
      secsLeft: 12,
      answers: [], // not exposed until the host shows all
    });
    expect(n.whoknows.picked).toEqual([
      { i: 1, text: "Poland" },
      { i: 0, text: "" },
    ]);
  });

  it("normalizeLive who-knows surfaces the full answer list only when showAll is set", () => {
    const n = normalizeLive({
      whoknows: { phase: "done", showAll: true, answers: ["France", 42, "Poland"], total: 3 },
    });
    expect(n.whoknows.answers).toEqual(["France", "42", "Poland"]);
  });

  it("normalizeLive who-knows carries winnerId for the host remote to highlight", () => {
    expect(normalizeLive({ whoknows: { phase: "auction", winnerId: "p2" } }).whoknows.winnerId).toBe("p2");
    expect(normalizeLive({ whoknows: { phase: "auction", winnerId: 5 } }).whoknows.winnerId).toBe(null); // junk dropped
  });

  it("buildHostAux carries the full who-knows answer list (host-only topic, never the TV)", () => {
    const g = game({
      quiz: {
        title: "Q",
        rounds: [
          {
            id: "r",
            type: "whoknows",
            title: "WK",
            questions: [{ id: "wk1", q: "Cats", answers: ["Lion", "Tiger", "Puma"], ordered: true }],
          },
        ],
      },
    });
    const aux = buildHostAux(g);
    expect(aux.whoknows).toEqual({ answers: ["Lion", "Tiger", "Puma"], ordered: true });
    // The TV-facing present payload must NOT carry the answers (only the count).
    expect(buildPresentQ(g).q).toMatchObject({ total: 3 });
    expect(buildPresentQ(g).q.answers).toBeUndefined();
  });

  it("buildHostAux is empty for non-whoknows rounds and off the question stage", () => {
    expect(buildHostAux(game()).whoknows).toBe(null); // map round
    const g = game({
      stage: "intro",
      quiz: {
        title: "Q",
        rounds: [{ id: "r", type: "whoknows", title: "WK", questions: [{ id: "w", answers: ["X"] }] }],
      },
    });
    expect(buildHostAux(g).whoknows).toBe(null); // not the question stage
  });

  it("normalizePhoneScores coerces the standings pushed to phones (incl. deviceIds)", () => {
    expect(normalizePhoneScores("nope")).toEqual([]);
    expect(normalizePhoneScores(undefined)).toEqual([]);
    const s = normalizePhoneScores([
      { id: "p1", name: "Ann", score: "30", color: "#f00", emoji: "🦊", deviceIds: ["d1", 5, ""] },
      { name: "Bob" },
    ]);
    // non-string deviceIds are dropped (real ids are uid strings)
    expect(s[0]).toEqual({ id: "p1", name: "Ann", score: 30, color: "#f00", emoji: "🦊", deviceIds: ["d1"] });
    expect(s[1]).toEqual({ id: "Bob", name: "Bob", score: 0, color: null, emoji: null, deviceIds: [] });
  });

  it("normalizeHostAux defends against junk and coerces numeric answers", () => {
    expect(normalizeHostAux("nope")).toBeNull();
    expect(normalizeHostAux({}).whoknows).toBe(null);
    expect(normalizeHostAux({ whoknows: "bad" }).whoknows).toBe(null);
    expect(normalizeHostAux({ whoknows: { answers: ["A", 7, null], ordered: 1 } }).whoknows).toEqual({
      answers: ["A", "7", ""],
      ordered: true,
    });
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

  it("no longer carries avatar photos (the photo feature was removed)", () => {
    const g = game();
    g.players = [
      { id: "a", name: "Ann", score: 1 },
      { id: "b", name: "Bob", score: 0 },
    ];
    expect("photos" in buildPresentQ(g)).toBe(false);
    expect(buildLive(g).standings.every((s) => !("photo" in s))).toBe(true);
  });

  it("normalizePresent ignores any incoming avatar photos", () => {
    const n = normalizePresent({ stage: "intro", photos: { a: "data:image/png;base64,Z" } });
    expect("photos" in n).toBe(false);
  });
});

describe("roundsFromImport", () => {
  const r = (over = {}) => ({ type: "classic", title: "T", questions: [{ q: "Q", a: "A", points: 10 }], ...over });

  it("accepts a single round, an array, a {rounds} object, and a {quiz} wrapper", () => {
    expect(roundsFromImport(r())).toHaveLength(1);
    expect(roundsFromImport([r(), r({ type: "image" })])).toHaveLength(2);
    expect(roundsFromImport({ rounds: [r()] })).toHaveLength(1);
    expect(roundsFromImport({ quiz: { rounds: [r(), r()] } })).toHaveLength(2);
  });

  it("normalizes + assigns ids and drops invalid rounds", () => {
    const out = roundsFromImport([r(), { type: "bogus" }, { nope: 1 }]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBeTruthy();
    expect(out[0].type).toBe("classic");
  });

  it("returns [] for junk", () => {
    expect(roundsFromImport(null)).toEqual([]);
    expect(roundsFromImport(42)).toEqual([]);
    expect(roundsFromImport("nope")).toEqual([]);
    expect(roundsFromImport({})).toEqual([]);
  });
});

describe("Anythingle", () => {
  const LUKE = {
    name: "Luke Skywalker",
    aliases: ["Luke"],
    species: "Human",
    gender: "Male",
    alignment: "Hero/Good",
    powers: ["Magic/Sorcery", "Telepathy/Mind", "Weapon mastery"],
    franchise: "Star Wars",
    medium: "Film/TV (live-action)",
    country: "USA",
    year: 1977,
  };
  const LUFFY = {
    name: "Monkey D. Luffy",
    species: "Human",
    gender: "Male",
    alignment: "Hero/Good",
    powers: ["Elasticity/Stretch", "Martial arts", "Super strength"],
    franchise: "One Piece",
    medium: "Manga",
    country: "Japan",
    year: 1997,
  };
  const cellFor = (cells, key) => cells.find((c) => c.key === key);

  it("normText folds case, diacritics and whitespace", () => {
    expect(normText("  Lúke   Skywalker ")).toBe("luke skywalker");
    expect(normText("GÉRALT")).toBe("geralt");
    expect(normText(null)).toBe("");
  });

  it("makeAnyChar produces a valid, normalizable empty entry shape", () => {
    const c = makeAnyChar();
    expect(c.powers).toEqual(["None"]);
    expect(ANYTHINGLE_TRAITS).toHaveLength(8);
  });

  it("normalizeAnyChar clamps vocab, dedupes/caps powers, keeps None exclusive, drops nameless", () => {
    expect(normalizeAnyChar({ name: "" })).toBeNull();
    const c = normalizeAnyChar({
      name: " Goku ",
      species: "Saiyan", // not in vocab -> Object/Other
      gender: "male", // wrong case -> default None/Genderless
      powers: ["Flight", "Flight", "Bogus", "Energy/Beams", "Super strength", "Super speed"],
      franchise: "",
      medium: "OVA",
      country: "Japan",
      year: "1984",
    });
    expect(c.species).toBe("Object/Other");
    expect(c.gender).toBe("None/Genderless");
    expect(c.powers).toHaveLength(3); // capped, deduped, "Bogus" dropped
    expect(c.powers).not.toContain("Bogus");
    expect(c.franchise).toBe("Standalone");
    expect(c.medium).toBe("Web/Other");
    expect(c.year).toBe(1984);
    // None is exclusive
    expect(normalizeAnyChar({ name: "X", powers: ["None", "Flight"] }).powers).toEqual(["None"]);
    expect(normalizeAnyChar({ name: "X", powers: [] }).powers).toEqual(["None"]);
  });

  it("gradeAnythingle returns one cell per trait in matrix order", () => {
    const cells = gradeAnythingle(LUKE, LUFFY);
    expect(cells.map((c) => c.key)).toEqual(ANYTHINGLE_TRAITS.map((t) => t.key));
  });

  it("grades exact matches green and misses grey (guess Luffy vs secret Luke)", () => {
    const cells = gradeAnythingle(LUKE, LUFFY);
    expect(cellFor(cells, "species").result).toBe("green");
    expect(cellFor(cells, "gender").result).toBe("green");
    expect(cellFor(cells, "alignment").result).toBe("green");
    expect(cellFor(cells, "powers").result).toBe("grey"); // no shared ability
    expect(cellFor(cells, "franchise").result).toBe("grey");
    expect(cellFor(cells, "medium").result).toBe("grey");
    expect(cellFor(cells, "country").result).toBe("grey");
  });

  it("powers yields yellow on partial overlap, green on equal set", () => {
    const goku = { ...LUFFY, powers: ["Super strength", "Energy/Beams", "Flight"] };
    const p = cellFor(gradeAnythingle(goku, LUFFY), "powers"); // share Super strength
    expect(p.result).toBe("yellow");
    expect(p.shared).toContain("Super strength");
    expect(cellFor(gradeAnythingle(LUKE, { ...LUFFY, powers: LUKE.powers }), "powers").result).toBe("green");
  });

  it("None powers green only against None, never via overlap", () => {
    const hamlet = { ...LUKE, powers: ["None"] };
    expect(cellFor(gradeAnythingle(hamlet, { ...LUFFY, powers: ["None"] }), "powers").result).toBe("green");
    expect(cellFor(gradeAnythingle(hamlet, LUFFY), "powers").result).toBe("grey");
  });

  it("debut year gives the up/down arrow + a yellow close-band", () => {
    // secret 1977, guess 1997 -> secret OLDER -> down, beyond 15y -> grey
    const far = cellFor(gradeAnythingle(LUKE, LUFFY), "year");
    expect(far.result).toBe("grey");
    expect(far.dir).toBe("down");
    // within 15 years -> yellow, secret newer -> up
    const near = cellFor(gradeAnythingle({ ...LUKE, year: 1990 }, { ...LUFFY, year: 1980 }), "year");
    expect(near.result).toBe("yellow");
    expect(near.dir).toBe("up");
    // exact -> green, no arrow
    const exact = cellFor(gradeAnythingle(LUKE, { ...LUFFY, year: 1977 }), "year");
    expect(exact.result).toBe("green");
    expect(exact.dir).toBeUndefined();
  });

  it("anyAllGreen / isAnyTarget detect a solve by all-green and by identity", () => {
    expect(anyAllGreen(gradeAnythingle(LUKE, LUKE))).toBe(true);
    expect(anyAllGreen(gradeAnythingle(LUKE, LUFFY))).toBe(false);
    expect(isAnyTarget(LUKE, { name: "luke skywalker" })).toBe(true); // case-insensitive
    expect(isAnyTarget(LUKE, { name: "Luke" })).toBe(true); // via target alias
    expect(isAnyTarget(LUKE, { name: "Han Solo" })).toBe(false);
  });

  it("matchAnyEntity resolves by name + alias, accent/case-insensitive", () => {
    const pool = [normalizeAnyChar(LUKE), normalizeAnyChar(LUFFY)];
    expect(matchAnyEntity(pool, "LUKE SKYWALKER").name).toBe("Luke Skywalker");
    expect(matchAnyEntity(pool, "luke").name).toBe("Luke Skywalker"); // alias
    expect(matchAnyEntity(pool, "Mónkey D. Lúffy").name).toBe("Monkey D. Luffy");
    expect(matchAnyEntity(pool, "Gandalf")).toBeNull();
  });

  it("anyTurnOrder puts the trailing player first, tie-broken by seed index", () => {
    const order = anyTurnOrder([
      { id: "a", score: 5 },
      { id: "b", score: 1 },
      { id: "c", score: 1 },
    ]);
    expect(order).toEqual(["b", "c", "a"]);
  });

  it("normalizeQuiz validates an anythingle round (target, pool, clamps)", () => {
    const q = normalizeQuiz({
      rounds: [
        {
          type: "anythingle",
          questions: [{ q: "Guess", target: LUKE, pool: [LUFFY, { name: "" }], points: 30, maxGuesses: 99 }],
        },
      ],
    });
    const r = q.rounds[0].questions[0];
    expect(r.target.name).toBe("Luke Skywalker");
    expect(r.pool).toHaveLength(1); // nameless dropped
    expect(r.maxGuesses).toBe(20); // clamped to <=20
  });

  // ---- reveal-safety: the secret target + traits must never reach present/pre-reveal live ----
  const anyGame = (over = {}) =>
    normalizeGame({
      quiz: {
        title: "T",
        rounds: [{ type: "anythingle", title: "R", questions: [{ q: "Guess", target: LUKE, pool: [LUFFY] }] }],
      },
      players: [{ id: "a", name: "Ann" }],
      ri: 0,
      qi: 0,
      stage: "question",
      anythingle: {
        order: ["a"],
        turn: 0,
        guesses: [{ name: "Monkey D. Luffy", by: "a", cells: gradeAnythingle(LUKE, LUFFY) }],
        solvedBy: null,
      },
      ...over,
    });

  it("present payload carries only the prompt + pool size, never the secret", () => {
    const g = anyGame();
    const present = buildPresentQ(g);
    expect(present.q.poolSize).toBe(1);
    expect("target" in present.q).toBe(false);
    expect(JSON.stringify(present)).not.toContain("Luke Skywalker");
  });

  it("pre-reveal live carries graded rows but NOT the secret target; reveal adds it", () => {
    const g = anyGame();
    const live = buildLive(g);
    expect(live.anythingle.guesses[0].name).toBe("Monkey D. Luffy"); // public guess
    expect(live.anythingle.target).toBeNull();
    expect(JSON.stringify(live.anythingle)).not.toContain("Luke Skywalker");
    // once revealed, the target name is exposed via live
    const revealed = buildLive(anyGame({ revealed: true }));
    expect(revealed.anythingle.target.name).toBe("Luke Skywalker");
  });

  it("host-only aux carries the secret target + pool (for the host remote)", () => {
    const aux = buildHostAux(anyGame());
    expect(aux.anythingle.target.name).toBe("Luke Skywalker");
    expect(aux.anythingle.pool[0].name).toBe("Monkey D. Luffy");
    // and it round-trips through the untrusted-input validator
    expect(normalizeHostAux(aux).anythingle.target.name).toBe("Luke Skywalker");
  });

  it("normalizeGame defaults the anythingle block to null on old saves", () => {
    const g = normalizeGame({
      quiz: { rounds: [{ type: "classic", questions: [{ q: "Q", a: "A", points: 10 }] }] },
      players: [{ id: "a", name: "Ann" }],
    });
    expect(g.anythingle).toBeNull();
  });
});
