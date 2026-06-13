# Quiz Night

A host-led party quiz app. One screen, one host, five round formats: you read the questions aloud, friends shout answers, and you tap players on the scoreboard to award points.

**Round formats**

| Type | How it plays |
| --- | --- |
| Classic | Read the question, reveal the answer, tap whoever got it right. |
| Jeopardy | Category board of point tiles — players pick tiles, higher value = harder question. |
| Hint Ladder | The answer starts at full value; every extra hint lowers it by 10. |
| Video | Watch a YouTube clip together, then reveal the answer. |
| Map | Everyone guesses where in the world it is; reveal the pin on a dot-grid world map. |

Comes with a built-in sample quiz, a quiz builder (including click-to-place map pins), export/import of quizzes as `.quiz.json` files, automatic game persistence (you can close the tab mid-game and resume), and host keyboard shortcuts (`R` reveal · `H` hint · `N`/`→` next · `1–9` award).

## Setup

Requires [Node.js](https://nodejs.org/) 20+.

```sh
npm install
npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run unit tests (Vitest) |
| `npm run lint` | Lint with ESLint |
| `npm run format` | Format with Prettier |

## Project structure

```
index.html              Vite entry page
src/
  main.jsx              React entry point
  App.jsx               App shell: routing between views, persistence wiring, home screen
  index.css             Tailwind v4 entry (@import "tailwindcss")
  lib/
    storage.js          Storage adapter (Claude artifact storage → localStorage → in-memory) + load/save helpers
    model.js            Pure data logic: factories, normalization/validation, quiz/game helpers, export
  data/
    sampleQuiz.js       The built-in read-only sample quiz
  components/
    ui.jsx              Shared primitives: Button, IconButton, TypeBadge, ConfirmDelete, TYPES metadata, style constants
    WorldMap.jsx        Dot-grid SVG world map (equirectangular), clickable for pin placement
    ScoreBar.jsx        Fixed bottom scoreboard, tappable when awarding
    PlayView.jsx        Game screen: round intro → questions/board → final scores
    SetupView.jsx       Player entry before a game
    Builder.jsx         Quiz editor for all five round types
    ErrorBoundary.jsx   Render-error fallback with retry
```

## Persistence

The app runs in two environments through a storage adapter, auto-detected at startup:

- **Claude artifact** — persists via `window.storage`
- **Standalone build** — persists via browser `localStorage` (falls back to in-memory if unavailable)

Data is stored under the keys `quiznight.quizzes`, `quiznight.game`, and `quiznight.players`, each wrapped in a versioned envelope `{ "v": 1, "data": … }`. Legacy keys from the first artifact version (`quiznight-quizzes`, `quiznight-players`) are read once for migration.

## `.quiz.json` export format

Quizzes exported from the home screen look like this (import accepts either this wrapper or a bare quiz object):

```jsonc
{
  "app": "quiz-night",
  "v": 1,
  "quiz": {
    "id": "abc1234",
    "title": "My Quiz",
    "sample": false,
    "rounds": [
      // one entry per round; "type" decides the question shape
      {
        "id": "r1", "type": "classic", "title": "Warm-Up",
        "questions": [{ "id": "q1", "q": "Question?", "a": "Answer", "points": 10 }]
      },
      {
        "id": "r2", "type": "jeopardy", "title": "The Board",
        "categories": [
          {
            "id": "c1", "name": "Movies",
            "questions": [{ "id": "j1", "clue": "…", "answer": "…", "points": 100 }]
          }
        ]
      },
      {
        "id": "r3", "type": "hints", "title": "Who Am I?",
        "questions": [{ "id": "h1", "answer": "…", "hints": ["hardest…", "…easiest"] }]
      },
      {
        "id": "r4", "type": "video", "title": "Watch Closely",
        "questions": [{ "id": "v1", "url": "https://youtu.be/…", "q": "…", "a": "…", "points": 10 }]
      },
      {
        "id": "r5", "type": "map", "title": "Where in the World?",
        "questions": [{ "id": "m1", "q": "…", "name": "Label on reveal", "lat": -13.16, "lng": -72.55, "points": 10 }]
      }
    ]
  }
}
```

Imports are validated and coerced by `normalizeQuiz` in [src/lib/model.js](src/lib/model.js) — missing fields get defaults, rounds with unknown types are dropped, and files that don't contain a usable quiz are rejected.
