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
    key: "what-connects",
    type: "connect",
    round: {
      type: "connect",
      title: "What's the Connection?",
      questions: [
        {
          answer: "They're all types of knots",
          clues: ["Granny", "Windsor", "Bow", "Reef"],
        },
        {
          answer: "Famous Toms (Hanks, Cruise, Hardy, Holland)",
          clues: ["Cast Away", "Top Gun", "Mad Max: Fury Road", "Spider-Man"],
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
        {
          q: "The Great Wall of China is visible from space with the naked eye.",
          correct: 1,
          points: 10,
          note: "A myth — it isn't.",
        },
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
        {
          q: "Tokyo has ~14M people. Is London's population higher or lower?",
          correct: 1,
          points: 10,
          note: "Lower — ~9M.",
        },
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
  {
    key: "whoknows-auction",
    type: "whoknows",
    round: {
      type: "whoknows",
      title: "Who Knows More",
      timer: 20,
      questions: [
        {
          q: "Name countries that border Germany",
          answers: [
            "France",
            "Poland",
            "Austria",
            "Switzerland",
            "Czechia",
            "Netherlands",
            "Belgium",
            "Denmark",
            "Luxembourg",
          ],
          ordered: false,
        },
        {
          q: "The planets from the Sun outward",
          answers: ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"],
          ordered: true,
        },
      ],
    },
  },
  {
    key: "anythingle-characters",
    type: "anythingle",
    round: {
      type: "anythingle",
      title: "Guess the Character",
      questions: [
        {
          q: "Guess the secret fictional character.",
          points: 30,
          maxGuesses: 8,
          target: {
            name: "Luke Skywalker",
            species: "Human",
            gender: "Male",
            alignment: "Hero/Good",
            role: ["Warrior", "Mystic"],
            powers: ["Magic/Sorcery", "Telepathy/Mind", "Weapon mastery"],
            franchise: "Star Wars",
            affiliation: "Jedi Order",
            origin: "Tatooine",
            medium: "Film/TV (live-action)",
            year: 1977,
            quote: {
              en: "I've got a bad feeling about this.",
              de: "Ich habe ein ganz mieses Gefühl bei der Sache.",
            },
          },
          pool: [
            {
              name: "Harry Potter",
              species: "Human",
              gender: "Male",
              alignment: "Hero/Good",
              role: ["Student", "Mage"],
              powers: ["Magic/Sorcery"],
              franchise: "Harry Potter",
              affiliation: "Gryffindor",
              origin: "British",
              medium: "Novel/Prose",
              year: 1997,
              quote: {
                en: "I solemnly swear that I am up to no good.",
                de: "Ich schwöre feierlich, dass ich ein Tunichtgut bin.",
              },
            },
            {
              name: "Goku",
              species: "Alien",
              gender: "Male",
              alignment: "Hero/Good",
              role: ["Warrior", "Athlete"],
              powers: ["Super strength", "Energy/Beams", "Flight"],
              franchise: "Dragon Ball",
              affiliation: "Z Fighters",
              origin: "Planet Vegeta",
              medium: "Manga",
              year: 1984,
              quote: {
                en: "Now this is gonna be a great fight!",
                de: "Das wird ein richtig guter Kampf!",
              },
            },
            {
              name: "Batman",
              species: "Human",
              gender: "Male",
              alignment: "Neutral/Anti-hero",
              role: ["Detective", "Warrior"],
              powers: ["Tech/Gadgets", "Martial arts", "Peak human/Genius"],
              franchise: "DC",
              affiliation: "Justice League",
              origin: "Gotham City",
              medium: "Comic (Western)",
              year: 1939,
              quote: {
                en: "It's not who I am underneath, but what I do that defines me.",
                de: "Nicht wer ich darunter bin, sondern was ich tue, zeichnet mich aus.",
              },
            },
          ],
        },
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
      rounds: [
        roundTpl("classic-trivia"),
        roundTpl("choice-quiz"),
        roundTpl("map-geography"),
        roundTpl("number-guess"),
      ],
    },
  },
  {
    key: "pub-classic",
    title: "Pub Classic (Starter)",
    quiz: {
      title: "Pub Classic",
      rounds: [
        roundTpl("classic-trivia"),
        roundTpl("hints-ladder"),
        roundTpl("clip-ladder"),
        roundTpl("jeopardy-board"),
      ],
    },
  },
];

/** Per-round-type question/category JSON shape (AI-facing; used by the round Creator Room). */
const ROUND_SHAPES = {
  classic: 'questions: [{ "q": string, "a": string, "points": number }]',
  jeopardy: 'categories: [{ "name": string, "questions": [{ "clue": string, "answer": string, "points": number }] }]',
  hints:
    'questions: [{ "answer": string, "hints": [ string | {"type":"image"|"audio"|"video","url":string} | {"type":"map","lat":number,"lng":number,"name":string} ] }]   // earlier hints are harder',
  connect:
    'questions: [{ "answer": string (the common link), "clues": [ string | {"type":"image"|"audio"|"video","url":string} | {"type":"map","lat":number,"lng":number,"name":string} ] }]   // players guess what ALL the clues have in common',
  video:
    'questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": null, "end": null }]   // url may be YouTube, a Spotify track (open.spotify.com/track/…), or a direct .mp3/.mp4 link; start/end (seconds) optionally trim it; pauses automatically when a player buzzes',
  clip: 'questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": number, "end": number, "steps": 1-8 }]   // the clip ladder: url may be YouTube, Spotify (great for music — dodges YouTube embed blocks), or a direct .mp3/.mp4; start/end is the FULL window; the host plays the first 1/(steps+1) of it and extends step by step for fewer points (like the hint ladder)',
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
  whoknows:
    'top-level may add "timer": number (seconds per answer). questions: [{ "q": string (the category prompt), "answers": [string, ...] (ALL correct answers), "ordered": boolean (true = a ranked list, shown numbered) }]   // the host auctions the category; the winner must name as many as they claimed',
  anythingle:
    'questions: [{ "q": string, "points": number, "maxGuesses": number, "target": <CHAR>, "pool": [<CHAR>, ...] }]   // a Wordle x Guess-Who game for FICTIONAL characters. <CHAR> = { "name": string, "aliases": [string], "species": one of [Human,Humanoid,Animal,Creature/Monster,Robot/AI,Cyborg/Augmented,Alien,Deity/Spirit,Undead,Object/Other], "gender": one of [Male,Female,Non-binary/Fluid,None/Genderless], "alignment": one of [Hero/Good,Villain/Evil,Neutral/Anti-hero], "role": up to 3 of [Warrior,Royalty,Leader,Detective,Mage,Outlaw,Scientist,Student,Soldier,Adventurer,Pilot,Artist,Healer,Spy,Monster,Athlete,Worker,Politician,Mystic,Civilian], "powers": up to 3 of [None,Super strength,Super speed,Flight,Magic/Sorcery,Elemental,Electric/Lightning,Energy/Beams,Telepathy/Mind,Shapeshifting,Healing/Regeneration,Elasticity/Stretch,Stealth/Invisibility,Weapon mastery,Martial arts,Tech/Gadgets,Immortality,Summoning,Size-change,Peak human/Genius] (or ["None"]), "franchise": string (canonical name, or "Standalone"), "affiliation": string (in-story group/team e.g. "Avengers"/"Jedi Order", or "Independent"), "origin": string (the character home — a real nationality if real-world e.g. "British", else a fictional realm e.g. "Hyrule"), "medium": one of [Stage/Theatre,Novel/Prose,Comic (Western),Manga,Anime,Animation/Cartoon,Film/TV (live-action),Video game,Mythology/Folklore,Web/Other], "year": number (first appearance), "quote": { "en": string, "de": string } (an iconic in-character line shown as a hint after 4 wrong guesses — recognisable but WITHOUT naming the character or franchise; natural German, not a literal translation) }. "target" is the secret; "pool" is OPTIONAL pre-tagged likely guesses. Tag every trait ACCURATELY — a wrong value breaks the deduction.',
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
- "connect":  questions: [{ "answer": string (the common link), "clues": [ string | {"type":"image"|"audio"|"video","url":string} | {"type":"map","lat":number,"lng":number,"name":string} ] }]   // players guess what ALL the clues have in common
- "video":    questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": null, "end": null }]   // url: YouTube, Spotify track, or direct .mp3/.mp4; start/end (seconds) optionally trim the clip
- "clip":     questions: [{ "url": "https://youtu.be/ID", "q": string, "a": string, "points": number, "audioOnly": false, "start": number, "end": number, "steps": 1-8 }]   // clip ladder; url: YouTube, Spotify (best for music), or direct .mp3/.mp4; host plays the first 1/(steps+1) of [start,end] and extends for fewer points
- "image":    questions: [{ "url": "https://.../pic.jpg", "q": string, "a": string, "points": number }]
- "morph":    questions: [{ "url": "https://.../pic.jpg", "a": string, "points": number, "effect": "blur"|"pixelate"|"tiles"|"zoom"|"slices", "steps": 1-8 }]
- "fusion":   questions: [{ "urlA": "https://.../a.jpg", "urlB": "https://.../b.jpg", "a": string, "points": number, "steps": 1-8 }]
- "map":      questions: [{ "q": string, "name": string, "lat": number, "lng": number, "points": number, "tileLayer": "map"|"satellite" }]
- "choice":   questions: [{ "q": string, "options": [string,...], "correct": <0-based index>, "points": number }]
- "truefalse": questions: [{ "q": string (a statement), "correct": 0|1 (0=True, 1=False), "points": number, "note": string (optional, shown on reveal) }]
- "higherlower": questions: [{ "q": string (e.g. "X is N. Is Y higher or lower?"), "correct": 0|1 (0=Higher, 1=Lower), "points": number, "note": string (optional fact) }]
- "whoknows":  top-level may add "timer": number (seconds per answer). questions: [{ "q": string (the category prompt), "answers": [string, ...] (ALL correct answers), "ordered": boolean (true = ranked, shown numbered) }]   // an auction: the winner must name as many as they claim
- "anythingle": questions: [{ "q": string, "points": number, "maxGuesses": number, "target": <CHAR>, "pool": [<CHAR>] }]   // Wordle x Guess-Who for FICTIONAL characters. <CHAR> = { name, aliases:[string], species (Human/Alien/Robot/AI/Creature/Monster/Cyborg/Augmented/Deity/Spirit/Animal/Humanoid/Undead/Object/Other), gender (Male/Female/Non-binary/Fluid/None/Genderless), alignment (Hero/Good, Villain/Evil, Neutral/Anti-hero), role (up to 3 of: Warrior, Royalty, Leader, Detective, Mage, Outlaw, Scientist, Student, Soldier, Adventurer, Pilot, Artist, Healer, Spy, Monster, Athlete, Worker, Politician, Mystic, Civilian), powers (up to 3 of: Magic/Sorcery, Super strength, Flight, Tech/Gadgets, Martial arts, Weapon mastery, Peak human/Genius, Energy/Beams, Telepathy/Mind, Elemental, Electric/Lightning, Healing/Regeneration, Shapeshifting, Elasticity/Stretch, Immortality, Summoning, Stealth/Invisibility, Super speed, Size-change — or ["None"]), franchise (canonical, or "Standalone"), affiliation (in-story group/team or "Independent"), origin (the character home: real nationality if real-world else fictional realm like "Hyrule"), medium (Manga/Anime/Film/TV (live-action)/Novel/Prose/Comic (Western)/Animation/Cartoon/Video game/Stage/Theatre/Mythology/Folklore/Web/Other), year (first appearance), quote {en, de} (iconic in-character line shown as a hint after 4 wrong guesses — recognisable but not naming the character/franchise; natural German) }. target = the secret; pool = optional likely guesses. Tag traits ACCURATELY.
- "number":   questions: [{ "q": string, "answer": number, "unit": string, "points": number }]

Rules: omit "id" fields (they are generated). Use real, publicly reachable image/video URLs, or leave url empty for the host to fill in. Keep 3-6 questions per round. Make answers unambiguous.`;
