# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Quiz Night** — a host-led party quiz web app (Vite + React 19 + Tailwind CSS v4). One host screen: read questions aloud, reveal answers, tap players on the scoreboard to award points. Five round formats: `classic`, `jeopardy`, `hints` (hint ladder), `video` (YouTube), `map` (world-map pin). Includes a quiz builder and `.quiz.json` export/import.

The app originated as a single-file Claude.ai artifact (`quiz-night-app.tsx`, preserved in the first git commit) and was refactored into modules without behavior changes.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build
- `npm test` — Vitest (unit tests live next to the code, e.g. `src/lib/model.test.js`)
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run format` — Prettier (`printWidth: 120`)

## Architecture

```
src/main.jsx                 entry; renders <Root> from App.jsx in StrictMode
src/App.jsx                  app shell: view routing (home/setup/play/builder), persistence wiring, home screen
src/lib/storage.js           storage adapter + loadJSON/saveJSON/removeKey/loadWithLegacy, SCHEMA_VERSION, STORAGE_PREFIX
src/lib/model.js             pure logic: uid/str/num utils, ytId, factories, normalizeQuiz/normalizeGame,
                             roundHasContent/nextNonEmpty/countQuestions, exportQuiz, ROUND_TYPES
src/data/sampleQuiz.js       built-in sample quiz (read-only in the UI; "Edit" creates a copy)
src/components/ui.jsx        TYPES (round-type metadata incl. icons), FOCUS/inputCls style constants,
                             Button, IconButton, TypeBadge, ConfirmDelete
src/components/WorldMap.jsx  dot-grid SVG map; pass onPick(lat, lng) to make it clickable
src/components/ScoreBar.jsx  fixed bottom scoreboard; tappable while a question's answer is revealed
src/components/PlayView.jsx  game flow: intro → question/board → end; keyboard shortcuts; point awarding
src/components/SetupView.jsx player entry
src/components/Builder.jsx   quiz editor for all five round types
src/components/ErrorBoundary.jsx render-error fallback
```

State model: `App` owns `quizzes`, `game`, `lastPlayers` and persists them on change; `PlayView` mutates the game purely through `setGame` (which is `persistGame`). A game object holds `quiz` (deep copy), `players`, `ri`/`qi` (round/question index), `stage` (`intro|question|board|end`), `revealed`, `hintsShown`, `awarded` (per-question, reversible), `used` (jeopardy tiles), `tile`.

## Hard rules

- **`src/lib/` must stay framework-free.** No React, no lucide-react, no JSX. That's why round-type metadata is split: `ROUND_TYPES` (keys, for validation) lives in `lib/model.js`; `TYPES` (labels/icons/descriptions) lives in `components/ui.jsx`. Keep the two in sync.
- **Storage compatibility is load-bearing.** Keys `quiznight.quizzes` / `quiznight.game` / `quiznight.players`, the `{ v: 1, data }` envelope (`SCHEMA_VERSION`), the legacy-key migration in `loadWithLegacy`, and the three-backend adapter (`window.storage` → `localStorage` → memory) must keep working — users have saved data in browsers, and `.quiz.json` files are shared with the Claude-artifact version of the app.
- **All untrusted data goes through `normalizeQuiz` / `normalizeGame`** (storage reads, file imports). Never trust raw parsed JSON.
- **Tailwind utility classes stay inline in JSX** — don't extract them into custom CSS.

## Conventions

- `lib/` and `data/`: named exports. Components: one per file, default export (`ui.jsx` is the multi-export exception).
- JSDoc on exported functions.
- Conventional commit messages (`feat:`, `fix:`, `refactor(scope):`, …).
- Prettier and ESLint are configured; run both before committing. The one accepted lint warning is `react-refresh/only-export-components` in `ui.jsx`.
