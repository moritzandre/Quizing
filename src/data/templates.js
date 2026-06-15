/* ====================================================================
   TEMPLATES (starter rounds + quizzes) and the AI-authoring helper text
   --------------------------------------------------------------------
   Plain data (no ids — they're assigned by normalizeQuiz on insert, so a
   template can be inserted many times and always gets fresh ids). Round
   templates seed the Builder's "from template" picker; quiz templates seed
   "New from template". AI_SCHEMA_HELP is a compact, copy-paste spec a user
   can hand to an LLM to generate a whole .quiz.json. Template content is
   not translated (same contract as the built-in sample quizzes); the picker
   shows each template's own title and round type.
   ==================================================================== */

/** One starter round per format. Pickers show `round.title` + the type icon. */
export const ROUND_TEMPLATES = [
  {
    key: "classic-trivia",
    type: "classic",
    round: {
      type: "classic",
      title: "General Knowledge",
      questions: [
        { q: "What is the capital of Australia?", a: "Canberra", points: 10 },
        { q: "Which planet is known as the Red Planet?", a: "Mars", points: 10 },
        { q: "How many continents are there?", a: "Seven", points: 10 },
      ],
    },
  },
  {
    key: "jeopardy-board",
    type: "jeopardy",
    round: {
      type: "jeopardy",
      title: "The Board",
      categories: [
        {
          name: "Science",
          questions: [
            { clue: "The chemical symbol for gold.", answer: "Au", points: 100 },
            { clue: "The closest star to Earth.", answer: "The Sun", points: 200 },
            { clue: "The powerhouse of the cell.", answer: "Mitochondria", points: 300 },
          ],
        },
        {
          name: "History",
          questions: [
            { clue: "Year WWII ended.", answer: "1945", points: 100 },
            { clue: "First person on the Moon.", answer: "Neil Armstrong", points: 200 },
            { clue: "Ancient wonder still standing in Giza.", answer: "The Great Pyramid", points: 300 },
          ],
        },
      ],
    },
  },
  {
    key: "hints-ladder",
    type: "hints",
    round: {
      type: "hints",
      title: "Who Am I?",
      questions: [
        {
          answer: "Albert Einstein",
          hints: [
            "I was born in Germany in 1879.",
            "I developed a famous theory of physics.",
            "E = mc².",
            "My hair is as iconic as my equations.",
          ],
        },
      ],
    },
  },
  {
    key: "video-clip",
    type: "video",
    round: {
      type: "video",
      title: "Name That Clip",
      questions: [{ url: "", q: "What is this from?", a: "", points: 10, audioOnly: false, start: null, end: null }],
    },
  },
  {
    key: "clip-ladder",
    type: "clip",
    round: {
      type: "clip",
      title: "Guess It Early",
      questions: [
        { url: "", q: "What is this from?", a: "", points: 10, audioOnly: false, start: 0, end: 30, steps: 4 },
      ],
    },
  },
  {
    key: "picture-round",
    type: "image",
    round: {
      type: "image",
      title: "Guess the Picture",
      questions: [
        { url: "", q: "What is this?", a: "", points: 10 },
        { url: "", q: "Where is this?", a: "", points: 10 },
      ],
    },
  },
  {
    key: "morph-reveal",
    type: "morph",
    round: {
      type: "morph",
      title: "Slowly Revealed",
      questions: [{ url: "", a: "", points: 30, effect: "pixelate", steps: 5 }],
    },
  },
  {
    key: "fusion-blend",
    type: "fusion",
    round: {
      type: "fusion",
      title: "Who Did We Blend?",
      questions: [{ urlA: "", urlB: "", a: "", points: 40, steps: 4 }],
    },
  },
  {
    key: "map-geography",
    type: "map",
    round: {
      type: "map",
      title: "Where in the World?",
      questions: [
        {
          q: "Where is the Eiffel Tower?",
          name: "Paris, France",
          lat: 48.8584,
          lng: 2.2945,
          points: 10,
          tileLayer: "map",
        },
        {
          q: "Where is the Statue of Liberty?",
          name: "New York, USA",
          lat: 40.6892,
          lng: -74.0445,
          points: 10,
          tileLayer: "map",
        },
      ],
    },
  },
  {
    key: "choice-quiz",
    type: "choice",
    round: {
      type: "choice",
      title: "Multiple Choice",
      questions: [
        {
          q: "Which is the largest ocean?",
          options: ["Atlantic", "Indian", "Pacific", "Arctic"],
          correct: 2,
          points: 10,
        },
        {
          q: "Which language has the most native speakers?",
          options: ["English", "Mandarin Chinese", "Spanish", "Hindi"],
          correct: 1,
          points: 10,
        },
      ],
    },
  },
  {
    key: "truefalse-quiz",
    type: "truefalse",
    round: {
      type: "truefalse",
      title: "True or False?",
      questions: [
        { q: "A group of flamingos is called a flamboyance.", correct: 0, points: 10, note: "Yes — really!" },
        { q: "The Great Wall of China is visible from space with the naked eye.", correct: 1, points: 10, note: "A myth — it isn't." },
      ],
    },
  },
  {
    key: "higherlower-quiz",
    type: "higherlower",
    round: {
      type: "higherlower",
      title: "Higher or Lower?",
      questions: [
        { q: "Mount Everest is 8,849 m. Is K2 higher or lower?", correct: 1, points: 10, note: "Lower — 8,611 m." },
        { q: "Tokyo has ~14M people. Is London's population higher or lower?", correct: 1, points: 10, note: "Lower — ~9M." },
      ],
    },
  },
  {
    key: "number-guess",
    type: "number",
    round: {
      type: "number",
      title: "Closest Guess Wins",
      questions: [
        { q: "How tall is the Eiffel Tower (m)?", answer: 330, unit: "m", points: 15 },
        { q: "In what year was the first iPhone released?", answer: 2007, unit: "", points: 15 },
      ],
    },
  },
];

/** The starter round for a given ROUND_TEMPLATES key (by key so order can change freely). */
const roundTpl = (key) => ROUND_TEMPLATES.find((tpl) => tpl.key === key).round;

/** Whole-quiz starters for "New from template". Pickers show `title` + round count. */
export const QUIZ_TEMPLATES = [
  {
    key: "mixed-night",
    title: "Mixed Night (Starter)",
    quiz: {
      title: "Mixed Night",
      rounds: [roundTpl("classic-trivia"), roundTpl("choice-quiz"), roundTpl("map-geography"), roundTpl("number-guess")],
    },
  },
  {
    key: "pub-classic",
    title: "Pub Classic (Starter)",
    quiz: {
      title: "Pub Classic",
      rounds: [roundTpl("classic-trivia"), roundTpl("hints-ladder"), roundTpl("clip-ladder"), roundTpl("jeopardy-board")],
    },
  },
];

/** Per-round-type question/category JSON shape (AI-facing; used by the round Creator Room). */
const ROUND_SHAPES = {
  classic: 'questions: [{ "q": string, "a": string, "points": number }]',
  jeopardy: 'categories: [{ "name": string, "questions": [{ "clue": string, "answer": string, "points": number }] }]',
  hints:
    'questions: [{ "answer": string, "hints": [ string | {"type":"image"|"audio"|"video","url":string} | {"type":"map","lat":number,"lng":number,"name":string} ] }]   // earlier hints are harder',
  video:
    'questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": null, "end": null }]   // url may be YouTube, a Spotify track (open.spotify.com/track/…), or a direct .mp3/.mp4 link; start/end (seconds) optionally trim it; pauses automatically when a player buzzes',
  clip:
    'questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": number, "end": number, "steps": 1-8 }]   // the clip ladder: url may be YouTube, Spotify (great for music — dodges YouTube embed blocks), or a direct .mp3/.mp4; start/end is the FULL window; the host plays the first 1/(steps+1) of it and extends step by step for fewer points (like the hint ladder)',
  image: 'questions: [{ "url": "https://.../pic.jpg", "q": string, "a": string, "points": number }]',
  morph:
    'questions: [{ "url": "https://.../pic.jpg", "a": string, "points": number, "effect": "blur"|"pixelate"|"tiles"|"zoom"|"slices", "steps": 1-8 }]',
  fusion:
    'questions: [{ "urlA": "https://.../a.jpg", "urlB": "https://.../b.jpg", "a": string, "points": number, "steps": 1-8 }]',
  map: 'questions: [{ "q": string, "name": string, "lat": number, "lng": number, "points": number, "tileLayer": "map"|"satellite" }]',
  choice: 'questions: [{ "q": string, "options": [string,...], "correct": <0-based index>, "points": number }]',
  truefalse:
    'questions: [{ "q": string (a statement), "correct": 0|1 (0 = True, 1 = False), "points": number, "note": string (optional, shown on reveal) }]',
  higherlower:
    'questions: [{ "q": string (e.g. "X is N. Is Y higher or lower?"), "correct": 0|1 (0 = Higher, 1 = Lower), "points": number, "note": string (optional fact shown on reveal) }]',
  number: 'questions: [{ "q": string, "answer": number, "unit": string, "points": number }]',
};

/**
 * A copy-paste prompt for generating ONE round of a given type with an AI,
 * including the JSON shape and a concrete example. Paste the reply back into the
 * round Creator Room to insert it.
 * @param {string} type One of ROUND_TYPES.
 */
export function roundCreatorPrompt(type) {
  const shape = ROUND_SHAPES[type] || ROUND_SHAPES.classic;
  const example = ROUND_TEMPLATES.find((tpl) => tpl.type === type)?.round;
  return [
    `Generate ONE Quiz Night "${type}" round as JSON. Reply with ONLY the JSON object, no prose.`,
    "",
    `Shape: { "type": "${type}", "title": string, "timer": number|null, ${shape} }`,
    example ? `\nExample:\n${JSON.stringify(example, null, 2)}` : "",
    "",
    'Rules: omit "id" fields (they are generated). 3-6 questions. Unambiguous answers. Use real reachable media URLs, or leave url empty for the host to fill in.',
  ].join("\n");
}

/** Copy-paste spec for generating a .quiz.json with an AI. English (AI-facing). */
export const AI_SCHEMA_HELP = `Generate a Quiz Night quiz as JSON. Reply with ONLY a JSON object, no prose.

Top level: { "title": string, "rounds": [ ...rounds ] }
Every round: { "type": <one of the types below>, "title": string, "timer": number|null, and a questions or categories array }

Round types and their question shapes:
- "classic":  questions: [{ "q": string, "a": string, "points": number }]
- "jeopardy": categories: [{ "name": string, "questions": [{ "clue": string, "answer": string, "points": number }] }]
- "hints":    questions: [{ "answer": string, "hints": [ string | {"type":"image"|"audio"|"video","url":string} | {"type":"map","lat":number,"lng":number,"name":string} ] }]   // earlier hints are harder
- "video":    questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": null, "end": null }]   // url: YouTube, Spotify track, or direct .mp3/.mp4; start/end (seconds) optionally trim the clip
- "clip":     questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": number, "end": number, "steps": 1-8 }]   // clip ladder; url: YouTube, Spotify (best for music), or direct .mp3/.mp4; host plays the first 1/(steps+1) of [start,end] and extends for fewer points
- "image":    questions: [{ "url": "https://.../pic.jpg", "q": string, "a": string, "points": number }]
- "morph":    questions: [{ "url": "https://.../pic.jpg", "a": string, "points": number, "effect": "blur"|"pixelate"|"tiles"|"zoom"|"slices", "steps": 1-8 }]
- "fusion":   questions: [{ "urlA": "https://.../a.jpg", "urlB": "https://.../b.jpg", "a": string, "points": number, "steps": 1-8 }]
- "map":      questions: [{ "q": string, "name": string, "lat": number, "lng": number, "points": number, "tileLayer": "map"|"satellite" }]
- "choice":   questions: [{ "q": string, "options": [string,...], "correct": <0-based index>, "points": number }]
- "truefalse": questions: [{ "q": string (a statement), "correct": 0|1 (0=True, 1=False), "points": number, "note": string (optional, shown on reveal) }]
- "higherlower": questions: [{ "q": string (e.g. "X is N. Is Y higher or lower?"), "correct": 0|1 (0=Higher, 1=Lower), "points": number, "note": string (optional fact) }]
- "number":   questions: [{ "q": string, "answer": number, "unit": string, "points": number }]

Rules: omit "id" fields (they are generated). Use real, publicly reachable image/video URLs, or leave url empty for the host to fill in. Keep 3-6 questions per round. Make answers unambiguous.`;
