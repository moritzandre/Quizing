# Quiz Night

A host-led party quiz app. One host screen runs the show; players can buzz in and drop map pins from their own phones over a QR code. Eight round formats, English or German, light or dark.

**Round formats**

| Type        | How it plays                                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Classic     | Read the question, reveal the answer, tap whoever got it right.                                                                                          |
| Jeopardy    | Category board of point tiles. Award **or dock** the tile's points (the +/− toggle).                                                                     |
| Hint Ladder | The answer starts at full value; every extra hint lowers it. Hints can be **text, image, audio, video, or a map pin**.                                   |
| Video       | Plays a YouTube clip with custom controls — the **title stays hidden** (it would give the answer away). Optional **audio-only** mode.                    |
| Picture     | Show an image (paste a URL or upload one), then reveal the answer.                                                                                       |
| Morph       | The picture starts obscured and worth the most; **demorph** it step by step (blur, pixelate, tiles, zoom, or slices) — fewer points the longer it takes. |
| Fusion      | Two images blended into one — guess both halves. **Defuse** to peek toward each; reveal shows them side by side.                                         |
| Map         | A real pan/zoom world map. Players drop a pin (on the host screen or their phones); reveal the true spot and the ranked guesses, closest wins.           |

Other features:

- **Phone buzzers** — show a QR code; players join from their phones, buzz in (first-to-buzz lockout with a sound on the host screen), and place their own map pins. Works on your local network — see below.
- **English / German** — language toggle (top-right), remembered across sessions.
- **Per-round countdown timer** — optional, set in the builder; pause/reset while playing.
- **Persistent leaderboard** — every finished game is recorded on the device; standings aggregate wins, totals, and best scores across games.
- **Dark mode** — toggle top-right; remembered and applied before first paint.
- **Quiz builder** with drag-and-drop reordering, click-to-place map pins, and image upload.
- **Export/import** quizzes as `.quiz.json` (shareable with the Claude-artifact version of the app).
- **Auto game persistence** — close the tab mid-game and resume; `#/play` restores on refresh.
- **Host keyboard shortcuts**: `R` reveal · `H` hint/demorph · `N`/`→` next · `+`/`−` award sign (jeopardy) · `1–9` award to player N.

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

## Phone buzzers

Open a game's setup screen and **Enable phone buzzers**. A QR code and 4-letter room code appear; players scan it to open the join page (`#/join/<code>`) on their phones, enter a name, and they're in. During a question their phones show a big **Buzz** button (first to tap locks the others out, and the host screen beeps and names them); during a map round their phones show a mini-map to drop a pin.

It works with **no backend**: phones and host talk over a free public MQTT-over-WebSocket broker, with the random room code as the only privacy boundary — fine for a living-room game, not for anything sensitive. Map tiles and the buzzer both need internet.

**Using it on your home network (no deploy):** the QR encodes whatever URL the host opened, and `localhost` isn't reachable from a phone — so open the app via your machine's LAN address. `npm run dev` already binds to all interfaces and prints a **Network** URL (e.g. `http://192.168.1.23:5173/`); open _that_ on the host machine, and the QR will point phones to it. Phones must be on the same Wi-Fi. (BuzzerPanel shows a warning if you opened the app on `localhost`.) The deployed site works too.

## Deployment

A GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds and publishes to **GitHub Pages** on every push to `main`:

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main`; the site publishes at `https://<user>.github.io/<repo>/`.

The Vite `base` is relative and routing is hash-based, so the build also works under a custom domain or `npm run preview`. For Netlify/Vercel, point them at the `dist` output of `npm run build`.

## Project structure

```
index.html                  Vite entry + pre-paint dark-theme script
src/
  main.jsx                  React entry point
  App.jsx                   shell: hash routing, persistence, home, host buzzer room, leaderboard recording
  index.css                 Tailwind v4, class-based dark variant, keyframes, Leaflet tooltip CSS
  lib/
    storage.js              Storage adapter (Claude → localStorage → memory) + load/save helpers
    model.js                Pure logic: factories, normalize/validate, geo math, morph/leaderboard helpers, export
    realtime.js             MQTT room transport for the buzzer (framework-free)
  i18n/
    strings.js              English/German string catalogs + translate() (framework-free)
    I18nProvider.jsx        Language context/provider, useI18n() (t), LanguageToggle
  data/
    sampleQuiz.js           "Friday Night Sampler" built-in
    nerdQuiz.js             "Nexus Nights" built-in (LoL / nerdy; demos morph, fusion, media hints, picture, map)
  components/
    ui.jsx                  Primitives, TYPES metadata, style constants, theme (useTheme/ThemeToggle), Confetti
    useRoom.js              React hooks over realtime: useHostRoom, usePlayerRoom
    LeafletMap.jsx          Real pan/zoom map; answer pin + guess markers + lines; light/dark tiles
    MorphImage.jsx          Stepped image reveal (blur / pixelate / tiles / zoom / slices)
    FusionImage.jsx         Two images cross-faded into one; defuse toward each; reveal side by side
    HintMedia.jsx           Renders one hint by type (text / image / audio / video / map)
    YouTubePlayer.jsx       Chrome-free YouTube player (hides the title) + audio-only mode
    ScoreBar.jsx            Fixed scoreboard with +/− award toggle
    PlayView.jsx            Game screen: intro → question/board → final scores; timer, buzzer, phone pins
    SetupView.jsx           Player entry + buzzer lobby
    Builder.jsx             Quiz editor for all eight round types; drag-and-drop; image upload; typed hints
    BuzzerPanel.jsx         Host buzzer lobby: QR, room code, roster
    JoinView.jsx            Phone page: buzz + pin placement
    LeaderboardView.jsx     Persistent standings
    ErrorBoundary.jsx       Render-error fallback
```

## Persistence

The app runs in two environments through a storage adapter, auto-detected at startup: **Claude artifact** (`window.storage`) or **standalone** (`localStorage`, falling back to in-memory). Quiz/game data lives under `quiznight.quizzes` / `quiznight.game` / `quiznight.players`, each wrapped in `{ "v": 1, "data": … }`. Legacy first-artifact keys are migrated once. Separately: the theme is `quiznight.theme`, the leaderboard is `quiznight.leaderboard`, and a phone's identity is `quiznight.deviceId`.

## `.quiz.json` export format

Quizzes exported from the home screen look like this (import accepts this wrapper or a bare quiz object). Every round may carry an optional `"timer"` (seconds, or `null`).

```jsonc
{
  "app": "quiz-night",
  "v": 1,
  "quiz": {
    "id": "abc1234",
    "title": "My Quiz",
    "sample": false,
    "rounds": [
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
          { "id": "c1", "name": "Movies", "questions": [{ "id": "j1", "clue": "…", "answer": "…", "points": 100 }] },
        ],
      },
      {
        "id": "r3",
        "type": "hints",
        "title": "Who Am I?",
        // a hint is a plain string (text) OR a typed object:
        //   { "type": "image"|"audio"|"video", "url": "…" }  or  { "type": "map", "lat": …, "lng": …, "name": "…" }
        "questions": [
          {
            "id": "h1",
            "answer": "…",
            "hints": ["hardest…", { "type": "image", "url": "https://…/clue.jpg" }, "…easiest"],
          },
        ],
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
        // url is an image URL or an uploaded data: URL
        "questions": [{ "id": "p1", "url": "https://…/pic.jpg", "q": "…", "a": "…", "points": 10 }],
      },
      {
        "id": "r7",
        "type": "morph",
        "title": "Guess the Splash",
        // effect: "blur" | "pixelate" | "tiles" | "zoom" | "slices"; steps: 1–8 demorph stages
        "questions": [
          { "id": "mo1", "url": "https://…/art.jpg", "a": "…", "points": 50, "effect": "blur", "steps": 5 },
        ],
      },
      {
        "id": "r8",
        "type": "fusion",
        "title": "Who Did We Blend?",
        // two images cross-faded; the answer names both
        "questions": [
          { "id": "fu1", "urlA": "https://…/a.jpg", "urlB": "https://…/b.jpg", "a": "X + Y", "points": 40, "steps": 4 },
        ],
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

Imports are validated and coerced by `normalizeQuiz` in [src/lib/model.js](src/lib/model.js) — missing fields get defaults, unknown round types are dropped, and unusable files are rejected.
