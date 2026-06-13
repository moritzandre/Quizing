# Quiz Night

A host-led party quiz app. One screen, one host, six round formats: you read the questions aloud, friends shout answers, and you tap players on the scoreboard to award points. Light or dark.

**Round formats**

| Type        | How it plays                                                                                                                                            |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classic     | Read the question, reveal the answer, tap whoever got it right.                                                                                         |
| Jeopardy    | Category board of point tiles — players pick tiles, higher value = harder question. Award **or dock** the tile's points (the +/− toggle).               |
| Hint Ladder | The answer starts at full value; every extra hint lowers it by 10.                                                                                      |
| Video       | Play a YouTube clip with custom controls — the **title is hidden** so it can't give the answer away. Optional **audio-only** mode plays just the sound. |
| Picture     | Show an image (paste a URL or upload one), let everyone study it, then reveal the answer.                                                               |
| Map         | Everyone drops a pin on a dot-grid world map; reveal the real spot and the ranked guesses, closest wins.                                                |

Other features:

- **Per-round countdown timer** — optional, set in the builder; pause/reset while playing.
- **Dark mode** — toggle in the top-right; remembered across sessions and applied before first paint.
- **Quiz builder** with drag-and-drop reordering of rounds and questions, click-to-place map pins, and image upload.
- **Export/import** quizzes as `.quiz.json` files (shareable with the Claude-artifact version of the app).
- **Automatic game persistence** — close the tab mid-game and resume; the URL hash (`#/play`) restores the right view on refresh.
- **Host keyboard shortcuts**: `R` reveal · `H` hint · `N`/`→` next · `+`/`−` award sign (jeopardy) · `1–9` award to player N.
- **Confetti** on the final scores.

## Setup

Requires [Node.js](https://nodejs.org/) 20+.

```sh
npm install
npm run dev
```

## Commands

| Command           | What it does                       |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the Vite dev server          |
| `npm run build`   | Production build into `dist/`      |
| `npm run preview` | Serve the production build locally |
| `npm test`        | Run unit tests (Vitest)            |
| `npm run lint`    | Lint with ESLint                   |
| `npm run format`  | Format with Prettier               |

## Project structure

```
index.html              Vite entry page (+ flash-free dark-theme bootstrap script)
src/
  main.jsx              React entry point
  App.jsx               App shell: hash routing between views, persistence wiring, home screen
  index.css             Tailwind v4 entry (@import "tailwindcss"), class-based dark variant, keyframe animations
  lib/
    storage.js          Storage adapter (Claude artifact storage → localStorage → in-memory) + load/save helpers
    model.js            Pure data logic: factories, normalization/validation, quiz/game helpers, geo math, export
  data/
    sampleQuiz.js       The built-in read-only sample quiz
  components/
    ui.jsx              Shared primitives + TYPES metadata, style constants, theme (useTheme/ThemeToggle), Confetti
    WorldMap.jsx        Dot-grid SVG world map; answer pin + per-player guess markers + distance lines
    ScoreBar.jsx        Fixed bottom scoreboard; +/− award toggle; tappable when awarding
    YouTubePlayer.jsx   Chrome-free YouTube IFrame player (hides the title) with custom controls + audio-only mode
    PlayView.jsx        Game screen: round intro → questions/board → final scores; timer; keyboard shortcuts
    SetupView.jsx       Player entry before a game
    Builder.jsx         Quiz editor for all six round types; drag-and-drop; timer + image upload
    ErrorBoundary.jsx   Render-error fallback with retry
```

## Persistence

The app runs in two environments through a storage adapter, auto-detected at startup:

- **Claude artifact** — persists via `window.storage`
- **Standalone build** — persists via browser `localStorage` (falls back to in-memory if unavailable)

Quiz/game data is stored under the keys `quiznight.quizzes`, `quiznight.game`, and `quiznight.players`, each wrapped in a versioned envelope `{ "v": 1, "data": … }`. Legacy keys from the first artifact version (`quiznight-quizzes`, `quiznight-players`) are read once for migration. The dark-theme preference is stored separately under `quiznight.theme`.

## Deployment

A GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds and publishes to **GitHub Pages** on every push to `main`. To enable it:

1. Push this repo to GitHub.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main` (or run the workflow manually); the site publishes at `https://<user>.github.io/<repo>/`.

The Vite `base` is relative (`./`) and routing is hash-based, so the build works under a project subpath, a custom domain, or `npm run preview` with no extra config. For Netlify/Vercel instead, point them at the `npm run build` output directory `dist`.

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
      // one entry per round; "type" decides the question shape.
      // "timer" (seconds, or null) is optional on every round.
      {
        "id": "r1",
        "type": "classic",
        "title": "Warm-Up",
        "timer": 20,
        "questions": [{ "id": "q1", "q": "Question?", "a": "Answer", "points": 10 }],
      },
      {
        "id": "r2",
        "type": "jeopardy",
        "title": "The Board",
        "timer": null,
        "categories": [
          {
            "id": "c1",
            "name": "Movies",
            "questions": [{ "id": "j1", "clue": "…", "answer": "…", "points": 100 }],
          },
        ],
      },
      {
        "id": "r3",
        "type": "hints",
        "title": "Who Am I?",
        "questions": [{ "id": "h1", "answer": "…", "hints": ["hardest…", "…easiest"] }],
      },
      {
        "id": "r4",
        "type": "video",
        "title": "Watch & Listen",
        // audioOnly: true hides the video and plays just the sound
        "questions": [
          { "id": "v1", "url": "https://youtu.be/…", "q": "…", "a": "…", "points": 10, "audioOnly": false },
        ],
      },
      {
        "id": "r6",
        "type": "image",
        "title": "Guess the Picture",
        // url is an image URL or an uploaded data: URL (downscaled on upload)
        "questions": [{ "id": "p1", "url": "https://…/flag.png", "q": "…", "a": "…", "points": 10 }],
      },
      {
        "id": "r5",
        "type": "map",
        "title": "Where in the World?",
        "questions": [{ "id": "m1", "q": "…", "name": "Label on reveal", "lat": -13.16, "lng": -72.55, "points": 10 }],
      },
    ],
  },
}
```

Imports are validated and coerced by `normalizeQuiz` in [src/lib/model.js](src/lib/model.js) — missing fields get defaults, rounds with unknown types are dropped, and files that don't contain a usable quiz are rejected.
