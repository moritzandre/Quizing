# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Quiz Night** — a host-led party quiz web app (Vite + React 19 + Tailwind CSS v4). One host screen drives the game; players' phones can buzz in and drop map pins over a QR-code room. Seven round formats: `classic`, `jeopardy`, `hints` (hint ladder), `video` (chrome-free YouTube, optional audio-only), `image` (picture), `morph` (progressive image reveal), `map` (real Leaflet map). Includes a quiz builder, `.quiz.json` export/import, dark mode, an optional per-round timer, a persistent leaderboard, and hash-based routing.

The app began as a single-file Claude.ai artifact (`quiz-night-app.tsx`, preserved in the first git commit), was refactored into modules, then extended with the features above.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (relative `base: "./"`; output in `dist/`)
- `npm test` — Vitest (unit tests next to the code, e.g. `src/lib/model.test.js`)
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run format` — Prettier (`printWidth: 120`)

Deploy: `.github/workflows/deploy.yml` publishes to GitHub Pages on push to `main`.

## Architecture

```
index.html                   Vite entry + pre-paint dark-theme bootstrap script
src/main.jsx                 entry; renders <Root> from App.jsx in StrictMode
src/App.jsx                  shell: hash routing (#/ #/play #/setup/<id> #/builder #/leaderboard #/join/<code>),
                             persistence, home, owns the host buzzer room (useHostRoom) + leaderboard recording
src/index.css                Tailwind v4 import; class-based dark variant; keyframes; Leaflet tooltip styling
src/lib/storage.js           storage adapter + loadJSON/saveJSON/removeKey/loadWithLegacy, SCHEMA_VERSION, STORAGE_PREFIX
src/lib/model.js             pure logic: utils, ytId, moveItem, haversineKm, fileToDataUrl, factories,
                             normalizeQuiz/normalizeGame, helpers, morphValue, summarizeGame/aggregateLeaderboard,
                             exportQuiz, ROUND_TYPES, MORPH_EFFECTS
src/lib/realtime.js          MQTT-over-WebSocket room transport (public broker). Framework-free. connectRoom/roomTopics/newRoomCode
src/data/sampleQuiz.js       built-in "Friday Night Sampler"
src/data/nerdQuiz.js         built-in "Nexus Nights" (LoL/nerd; demos morph/picture/map)
src/components/ui.jsx        TYPES metadata + style constants (FOCUS/inputCls/cardCls), Button/IconButton/TypeBadge/
                             ConfirmDelete, useTheme/ThemeToggle, Confetti
src/components/useRoom.js    React hooks over realtime: useHostRoom (arbiter of first-buzz, pin collection), usePlayerRoom
src/components/LeafletMap.jsx real pan/zoom map; answer pin + colored guess markers + lines; onPick; light/dark tiles
src/components/MorphImage.jsx stepped image reveal: blur / pixelate (canvas) / tiles
src/components/YouTubePlayer.jsx chrome-free IFrame player; hides the title; audio-only cover; custom controls
src/components/ScoreBar.jsx  fixed scoreboard; +/- award toggle; tappable on reveal
src/components/PlayView.jsx  game flow: intro → question/board → end; timer; buzzer arm/lock; phone pins; keyboard
src/components/SetupView.jsx player entry; embeds BuzzerPanel; seeds players from the phone roster
src/components/Builder.jsx   quiz editor (all 7 types); SortableList drag-and-drop; ImageField; morph editor; Leaflet pin
src/components/BuzzerPanel.jsx host lobby: QR (qrcode), room code, connected roster, status
src/components/JoinView.jsx  phone page (#/join/<code>): name → buzz button / pin map
src/components/LeaderboardView.jsx persistent standings table
src/components/ErrorBoundary.jsx render-error fallback
```

State model: `App` owns `quizzes`, `game`, `lastPlayers`, `leaderboard`, and the host `room` (useHostRoom); it persists game/quizzes/players/leaderboard on change. `PlayView` mutates the game purely through `setGame`. A game holds `id`, `quiz` (deep copy), `players` (each `{id,name,score,deviceId?}` — `deviceId` links a phone), `ri`/`qi`, `stage` (`intro|question|board|end`), `revealed`, `hintsShown`, `awarded` (reversible signed deltas), `used` (jeopardy tiles), `tile`, `guesses` (per-player `{lat,lng}`). Round objects carry optional `timer` (seconds|null); video questions carry `audioOnly`; morph questions carry `effect` (`blur|pixelate|tiles`) and `steps`. The countdown timer and morph step are UI-only (local `PlayView` state), not persisted.

Realtime: player id === phone `deviceId`, so buzz/pin events map straight onto game players seeded from the room roster. The host is the single arbiter of who buzzed first (no clock sync). Topics: `quiznight/<code>/state` (host→phones, retained) and `quiznight/<code>/up` (phones→host).

## Hard rules

- **`src/lib/` stays framework-free.** No React/JSX (storage.js, model.js, realtime.js qualify — they do I/O but import no React). React hooks that wrap them live in `src/components/` (e.g. useRoom.js).
- **Round-type metadata is split and must stay in sync:** `ROUND_TYPES` (keys, validation) in `lib/model.js`; `TYPES` (label/icon/dot/desc) in `components/ui.jsx`. Adding a type means updating both, plus `makeQuestion`/`normalizeQuiz`, the `PlayView` render branch, and the `Builder` editor branch.
- **Storage compatibility is load-bearing.** Keys `quiznight.quizzes`/`quiznight.game`/`quiznight.players`, the `{ v: 1, data }` envelope, the legacy migration in `loadWithLegacy`, and the three-backend adapter must keep working. New fields (`timer`, `audioOnly`, `image`/`morph` rounds, `guesses`, `deviceId`, `leaderboard`, `theme`, `deviceId`) are additive/optional; old `.quiz.json` and saved data still load. Theme is `quiznight.theme`, leaderboard is `quiznight.leaderboard`, phone identity is `quiznight.deviceId`.
- **All untrusted data goes through `normalizeQuiz`/`normalizeGame`.** Never trust raw parsed JSON or incoming realtime messages without validating shapes.
- **Tailwind classes stay inline in JSX.** The only CSS in `index.css` is the Tailwind import, the `dark` custom variant, keyframes, and third-party (Leaflet) tooltip styling.
- **Dark mode is class-based** (`.dark` on `<html>`, set pre-paint by the inline script in `index.html`, toggled by `useTheme`). Every surface needs paired `dark:` variants.
- **The buzzer uses a free public MQTT broker** (`BROKER_URL` in realtime.js) — no backend, no account; a random room code is the only privacy boundary. Don't put anything sensitive on it.

## Conventions

- `lib/` and `data/`: named exports. Components: one per file, default export. Multi-export exceptions: `ui.jsx` (primitives + theme + confetti) and `useRoom.js` (hooks).
- JSDoc on exported functions.
- Conventional commit messages (`feat:`, `fix:`, `refactor(scope):`, …).
- Prettier + ESLint configured; run both before committing. Accepted lint warnings: `react-refresh/only-export-components` in `ui.jsx`. `useRoom.js` is exempted from that rule in `eslint.config.js`.
- New runtime deps beyond React/lucide-react: `mqtt` (buzzer), `leaflet` (map), `qrcode` (join QR). These push the bundle over Vite's 500 kB advisory — acceptable; lazy-loading them is a possible future optimization.
