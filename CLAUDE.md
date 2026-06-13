# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Quiz Night** — a host-led party quiz web app (Vite + React 19 + Tailwind CSS v4). One host screen: read questions aloud, reveal answers, tap players on the scoreboard to award points. Six round formats: `classic`, `jeopardy`, `hints` (hint ladder), `video` (YouTube), `image` (picture), `map` (world-map pin). Includes a quiz builder, `.quiz.json` export/import, dark mode, an optional per-round timer, and hash-based routing.

The app originated as a single-file Claude.ai artifact (`quiz-night-app.tsx`, preserved in the first git commit) and was refactored into modules, then extended with the features above.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (relative `base: "./"`; output in `dist/`)
- `npm test` — Vitest (unit tests live next to the code, e.g. `src/lib/model.test.js`)
- `npm run lint` — ESLint (flat config, `eslint.config.js`)
- `npm run format` — Prettier (`printWidth: 120`)

Deploy: `.github/workflows/deploy.yml` publishes to GitHub Pages on push to `main` (repo Settings → Pages → Source = GitHub Actions).

## Architecture

```
index.html                   Vite entry + inline bootstrap script that sets <html class="dark"> before paint
src/main.jsx                 entry; renders <Root> from App.jsx in StrictMode
src/App.jsx                  app shell: hash routing (#/ #/play #/setup/<id> #/builder), persistence, home screen
src/index.css                @import "tailwindcss"; @custom-variant dark (class-based); keyframe animations
src/lib/storage.js           storage adapter + loadJSON/saveJSON/removeKey/loadWithLegacy, SCHEMA_VERSION, STORAGE_PREFIX
src/lib/model.js             pure logic: uid/str/num utils, ytId, moveItem, haversineKm, fileToDataUrl, factories,
                             normalizeQuiz/normalizeGame, roundHasContent/nextNonEmpty/countQuestions, exportQuiz, ROUND_TYPES
src/data/sampleQuiz.js       built-in sample quiz (read-only in the UI; "Edit" creates a copy)
src/components/ui.jsx        TYPES (round-type metadata incl. icons), FOCUS/inputCls/cardCls constants, Button, IconButton,
                             TypeBadge, ConfirmDelete, useTheme/ThemeToggle, Confetti
src/components/WorldMap.jsx  dot-grid SVG map; `pin` (answer), `guesses` (player markers), `showLines`, `onPick`
src/components/ScoreBar.jsx  fixed bottom scoreboard; +/- award toggle (allowNegative/sign/onSignChange); tappable on reveal
src/components/YouTubePlayer.jsx  chrome-free YouTube IFrame player (hides title) w/ custom controls + audioOnly cover
src/components/PlayView.jsx  game flow: intro → question/board → end; countdown timer; keyboard shortcuts; awarding; map guesses
src/components/SetupView.jsx player entry
src/components/Builder.jsx   quiz editor for all six round types; SortableList (drag-and-drop); ImageField (URL/upload); timer field
src/components/ErrorBoundary.jsx render-error fallback
```

State model: `App` owns `quizzes`, `game`, `lastPlayers` and persists them on change; `PlayView` mutates the game purely through `setGame` (which is `persistGame`). A game object holds `quiz` (deep copy), `players`, `ri`/`qi` (round/question index), `stage` (`intro|question|board|end`), `revealed`, `hintsShown`, `awarded` (per-question, reversible signed deltas), `used` (jeopardy tiles), `tile`, and `guesses` (per-player `{lat,lng}` for map rounds). Round objects carry an optional `timer` (seconds or null); video questions carry `audioOnly`. The countdown timer is UI-only (local state in `PlayView`), not persisted.

## Hard rules

- **`src/lib/` must stay framework-free.** No React, no lucide-react, no JSX. That's why round-type metadata is split: `ROUND_TYPES` (keys, for validation) lives in `lib/model.js`; `TYPES` (labels/icons/descriptions) lives in `components/ui.jsx`. Keep the two in sync — adding a round type means updating both, `makeQuestion`/`normalizeQuiz`, the `PlayView` render branch, and the `Builder` editor branch.
- **Storage compatibility is load-bearing.** Keys `quiznight.quizzes` / `quiznight.game` / `quiznight.players`, the `{ v: 1, data }` envelope (`SCHEMA_VERSION`), the legacy-key migration in `loadWithLegacy`, and the three-backend adapter (`window.storage` → `localStorage` → memory) must keep working — users have saved data in browsers, and `.quiz.json` files are shared with the Claude-artifact version of the app. New fields (`timer`, `audioOnly`, `image` rounds, `guesses`) are additive and optional; old files still load.
- **All untrusted data goes through `normalizeQuiz` / `normalizeGame`** (storage reads, file imports). Never trust raw parsed JSON.
- **Tailwind utility classes stay inline in JSX** — don't extract them into custom CSS. The only CSS in `index.css` is the Tailwind import, the `dark` custom variant, and keyframes (animations utilities can't express).
- **Dark mode is class-based.** Every surface needs paired `dark:` variants. The `.dark` class on `<html>` is set pre-paint by the inline script in `index.html` and toggled by `useTheme` (persisted to `quiznight.theme`, separate from the data adapter).

## Conventions

- `lib/` and `data/`: named exports. Components: one per file, default export (`ui.jsx` is the multi-export exception — primitives, theme, and confetti live together there).
- JSDoc on exported functions.
- Conventional commit messages (`feat:`, `fix:`, `refactor(scope):`, …).
- Prettier and ESLint are configured; run both before committing. The accepted lint warnings are `react-refresh/only-export-components` in `ui.jsx` (it exports constants/hooks alongside components by design).
