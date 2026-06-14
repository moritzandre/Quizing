# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Quiz Night** — a host-led party quiz web app (Vite + React 19 + Tailwind CSS v4). One host screen drives the game; players' phones can buzz in, drop map pins, pick multiple-choice answers and submit number guesses over a QR-code room. Ten round formats: `classic`, `jeopardy`, `hints` (hint ladder, where each hint can be text/image/audio/video/map), `video` (chrome-free YouTube, optional audio-only), `image` (picture), `morph` (progressive image reveal: blur/pixelate/tiles/zoom/slices), `fusion` (two images blended, defuse to reveal), `map` (real Leaflet map), `choice` (multiple-choice on phones, auto-scored), `number` (closest-guess on phones, auto-scored). The `map` round is also **auto-scored** (closest pin wins). Playable solo or in **teams** (each team is one scoring entity; phones link to a team); players pick their own emoji+colour avatar — or upload a **photo** — on their phone. A **TV presenter** view (`#/present/<code>`) streams a clean, read-only mirror of the host to a second screen over the same MQTT room (no HDMI; e.g. cast a Chrome tab to a Google TV), with an animated **podium-climb** live scoreboard and map pins hidden until reveal. A separate **host remote** (`#/host/<code>`) lets the host drive the whole game (reveal, advance, award, hints, …) from a phone over a `ctrl` command channel. The builder adds **templates** (per-round + whole-quiz starters), a **Creator Room** AI-authoring helper (copy a schema prompt, paste the JSON back) — at both whole-quiz (home) and per-round-type (builder) level — **JSON round import** (paste/upload a round, array, or quiz to append rounds to the one being edited), **image crop** (cropperjs), **video/audio trim** (start/end), and richer **maps** (Esri satellite layer + OSM Nominatim place search + an embedded **Mapillary street view** on map questions). Between rounds, a **recap** animates each entity's score counting up from its start-of-round total to its end-of-round total (host + TV). Includes `.quiz.json` export/import, a playful light/dark theme, English/German UI (i18n), an optional per-round timer, a persistent leaderboard, and hash-based routing.

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
src/App.jsx                  shell: hash routing (#/ #/play #/setup/<id> #/builder #/leaderboard #/join/<code> #/present/<code> #/host/<code>),
                             persistence, home (+ New-from-template & Creator-Room modals), owns the host buzzer room (useHostRoom) + leaderboard recording
src/index.css                Tailwind v4 import; class-based dark variant; keyframes (incl. qn-hop/qn-climb-row); Leaflet tooltip styling
src/lib/storage.js           storage adapter + loadJSON/saveJSON/removeKey/loadWithLegacy, SCHEMA_VERSION, STORAGE_PREFIX
src/lib/model.js             pure logic: utils, ytId, mapillaryEmbedUrl, moveItem, haversineKm, fileToDataUrl, factories (incl. makeHint),
                             normalizeQuiz/normalizeGame, roundsFromImport, hintHasContent, morphValue, summarizeGame/aggregateLeaderboard,
                             buildPresentQ/buildLive + normalizePresent/normalizeLive (TV payloads), exportQuiz, ROUND_TYPES, MORPH_EFFECTS, HINT_TYPES
src/lib/realtime.js          MQTT-over-WebSocket room transport (public broker). Framework-free. connectRoom/roomTopics (state/up/present/live)/newRoomCode
src/i18n/strings.js          en/de string catalogs + translate(); LANGS. Framework-free.
src/i18n/I18nProvider.jsx    I18nContext + I18nProvider + useI18n() (lang/setLang/t) + LanguageToggle; persists quiznight.lang
src/data/sampleQuiz.js       built-in "Friday Night Sampler"
src/data/nerdQuiz.js         built-in "Nexus Nights" (LoL/nerd; demos morph/fusion/picture/media-hints/map/choice/number)
src/data/templates.js        ROUND_TEMPLATES (per-type starters) + QUIZ_TEMPLATES + AI_SCHEMA_HELP + roundCreatorPrompt(type) (per-type LLM prompt)
src/components/ui.jsx        TYPES metadata + ACCENT/accentFor, PLAYER_COLORS/EMOJI/colorAt/emojiAt/Avatar, style constants
                             (FOCUS/inputCls/cardCls), Button/IconButton/TypeBadge/ConfirmDelete, useTheme/ThemeToggle, Confetti
src/components/useRoom.js    React hooks over realtime: useHostRoom (first-buzz arbiter, pin/answer collection, team lobby,
                             pushPresent/pushLive TV streaming, ctrl `command` from a host remote), usePlayerRoom,
                             usePresenterRoom (TV mirror + sendCtrl for the host remote)
src/components/LeafletMap.jsx real pan/zoom map; answer pin + colored guess markers + lines; onPick; light/dark + Esri satellite tiles; optional Nominatim search + Mapillary link-out
src/components/MapillaryEmbed.jsx embeds a Mapillary street-view (the /embed endpoint; keyless) for a map question's `street`
src/components/MorphImage.jsx stepped image reveal: blur / pixelate (canvas) / tiles / zoom / slices
src/components/FusionImage.jsx two images cross-faded; "defuse" swings the blend toward each; reveal shows both
src/components/HintMedia.jsx renders one hint by type (text/image/audio/video/map); audio/video honor a start/end trim
src/components/YouTubePlayer.jsx chrome-free IFrame player; hides the title; audio-only cover; custom controls; start/end trim
src/components/ScoreBar.jsx  fixed scoreboard; +/- award toggle; tappable on reveal
src/components/PodiumClimb.jsx animated live standings (FLIP-lite rows + hop on a gain); host overlay + TV; pure props
src/components/RoundRecap.jsx between-rounds count-up: each score animates from start-of-round to end-of-round (rAF); host + TV
src/components/RoundBody.jsx read-only per-round renderer for the TV (driven by the present/live payload; no pins/controls)
src/components/PresenterView.jsx phone-less TV page (#/present/<code>): subscribes via usePresenterRoom, renders RoundBody + PodiumClimb
src/components/HostRemoteView.jsx phone host controller (#/host/<code>): present/live context + sendCtrl(reveal/advance/award/hint/…)
src/components/PlayView.jsx  game flow: intro → question/board → end; timer; buzzer arm/lock; phone pins; keyboard;
                             streams present/live to the TV; "Stream to TV" modal + standings overlay
src/components/SetupView.jsx player/team entry; Solo/Teams toggle; embeds BuzzerPanel; seeds entities from the phone roster
src/components/Builder.jsx   quiz editor (all 10 types); SortableList drag-and-drop; ImageField + CropModal (cropperjs, lazy);
                             HintsField (typed hints + TrimInputs); morph/fusion/choice/number editors; Leaflet pin + satellite/search;
                             from-template insert + RoundImportModal (paste/upload JSON rounds, re-id'd) + RoundCreatorModal (per-type AI prompt → paste)
src/components/BuzzerPanel.jsx host lobby: QR (qrcode), room code, connected roster, status
src/components/JoinView.jsx  phone page (#/join/<code>): name + emoji/colour avatar + team picker → buzz / pin map / choice tap / number guess
src/components/LeaderboardView.jsx persistent standings table
src/components/ErrorBoundary.jsx render-error fallback
```

State model: `App` owns `quizzes`, `game`, `lastPlayers`, `leaderboard`, and the host `room` (useHostRoom); it persists game/quizzes/players/leaderboard on change. `PlayView` mutates the game purely through `setGame`. A game holds `id`, `mode` (`solo|teams`), `quiz` (deep copy), `players` (each `{id,name,score,color?,emoji?,photo?,deviceIds?,members?}` — `photo` is an uploaded data-URL avatar; `deviceIds` links one or more phones; in team mode each "player" is a team and `members` lists its phone names), `ri`/`qi`, `stage` (`intro|question|board|end`), `revealed`, `hintsShown`, `awarded` (reversible signed deltas), `used` (jeopardy tiles), `tile`, `guesses` (per-entity `{lat,lng}`), `roundStartScores` (per-entity totals snapshotted at the start of the current round, for the between-rounds recap). Round objects carry optional `timer` (seconds|null); video questions carry `audioOnly` and optional `start`/`end` (trim seconds); morph questions carry `effect` (one of `MORPH_EFFECTS`) and `steps`; fusion questions carry `urlA`/`urlB`/`steps`; choice questions carry `options[]`/`correct`; number questions carry `answer`/`unit`; map questions carry optional `tileLayer` (`map|satellite`, default `map`) and `street` (a Mapillary share/embed URL or id, rendered via `mapillaryEmbedUrl`); hint-ladder hints are either plain strings (text) or typed objects (`{type:"image", url}`, `{type:"audio"|"video", url, start?, end?}`, or `{type:"map", lat, lng, name}`). Player entities carry an optional phone-chosen `color`/`emoji`. The countdown timer and the morph/fusion step are UI-only (local `PlayView` state, the morph step reused for fusion), not persisted.

Realtime: a scoring entity is a solo player or a team; `entityForDevice`/`mapByEntity` in `PlayView` re-key phone events (buzz/pins/answers, all keyed by `deviceId`) onto entities via `deviceIds`. For a team, the last phone to act wins. The host is the single arbiter of who buzzed first (no clock sync). Topics: `quiznight/<code>/state` (host→phones, retained; carries phase + `options`/`teams`), `quiznight/<code>/up` (phones→host; join/buzz/pin/answer/leave), and the TV-presenter pair `quiznight/<code>/present` (heavy, per-question display payload) + `quiznight/<code>/live` (light, frequent: reveal/step/standings/showStandings) — both retained, both built by `buildPresentQ`/`buildLive` and validated by `normalizePresent`/`normalizeLive`. The present/live payloads omit the answer and map coordinates until reveal, so the TV (`usePresenterRoom`) can never leak them and pins stay hidden until reveal. All four topics clear on host teardown. A **host remote** phone (`#/host/<code>`, `usePresenterRoom.sendCtrl`) publishes `{type:"ctrl", action, args}` back on `up`; `useHostRoom` surfaces it as `command` (id-bumped so repeats re-fire) and `PlayView`'s applier effect dispatches it to the real handlers (reveal/advance/award/hint/sign/adjust/jump/standings/resetBuzz), guarding every untrusted arg (player-id membership, round-index bounds).

## Hard rules

- **`src/lib/` stays framework-free.** No React/JSX (storage.js, model.js, realtime.js qualify — they do I/O but import no React). React hooks that wrap them live in `src/components/` (e.g. useRoom.js).
- **Round-type metadata is split and must stay in sync:** `ROUND_TYPES` (keys, validation) in `lib/model.js`; `TYPES` (icon/dot, + English fallback label/desc) in `components/ui.jsx`; the localized label/desc are i18n keys `round.<type>.label` / `round.<type>.desc` in `i18n/strings.js`. Adding a type means updating all of those, plus `makeQuestion`/`normalizeQuiz`, the `PlayView` render branch, and the `Builder` editor branch.
- **All user-facing text goes through i18n.** Use `const { t } = useI18n()` and `t("key", vars)`; add the key to both `en` and `de` in `i18n/strings.js`. `translate()` falls back to English then the key, so a missing `de` entry degrades gracefully. Quiz CONTENT (questions/answers, built-in quizzes) is not translated.
- **Storage compatibility is load-bearing.** Keys `quiznight.quizzes`/`quiznight.game`/`quiznight.players`, the `{ v: 1, data }` envelope, the legacy migration in `loadWithLegacy`, and the three-backend adapter must keep working. New fields (`timer`, `audioOnly`, video/hint `start`/`end`, map `tileLayer`/`street`, player `color`/`emoji`/`photo`, `image`/`morph`/`choice`/`number` rounds, `guesses`, `deviceIds`/`members`, game `mode`, `leaderboard`, `theme`, `deviceId`) are additive/optional; old `.quiz.json` and saved data still load (a legacy single `deviceId` on a player migrates to `deviceIds`). Theme is `quiznight.theme`, leaderboard is `quiznight.leaderboard`, phone identity is `quiznight.deviceId`. The TV present/live payloads are ephemeral (MQTT only), never persisted.
- **All untrusted data goes through `normalizeQuiz`/`normalizeGame`.** Never trust raw parsed JSON or incoming realtime messages without validating shapes.
- **Tailwind classes stay inline in JSX.** The only CSS in `index.css` is the Tailwind import, the `dark` custom variant, keyframes, and third-party (Leaflet) tooltip styling.
- **Dark mode is class-based** (`.dark` on `<html>`, set pre-paint by the inline script in `index.html`, toggled by `useTheme`). Every surface needs paired `dark:` variants.
- **The buzzer + TV presenter use a free public MQTT broker** (`BROKER_URL` in realtime.js) — no backend, no account; a random room code is the only privacy boundary. Don't put anything sensitive on it. The dev/preview server binds to `0.0.0.0` (vite.config.js) so phones/TVs on the same Wi-Fi can reach it via the host's LAN IP; the QR encodes `window.location.origin`, so the host must open the app via that IP (not `localhost`) — BuzzerPanel shows a warning when it detects localhost. The TV opens that same origin at `#/present/<code>`.
- **A few other third parties are reached, all host/builder-only and benign:** map tiles from Carto (map) and Esri World Imagery (satellite); the builder map's place search hits **OpenStreetMap Nominatim** (sends the host's typed query, submit-driven, ~1 req/s) and the Mapillary link-out opens the current map centre. All tile sources are attributed via Leaflet's `attributionControl`. No player data leaves the device through these.

## Conventions

- `lib/` and `data/`: named exports. Components: one per file, default export. Multi-export exceptions: `ui.jsx` (primitives + theme + confetti) and `useRoom.js` / `i18n/I18nProvider.jsx` (hooks + provider, exempted from the fast-refresh lint rule in `eslint.config.js`).
- JSDoc on exported functions.
- Conventional commit messages (`feat:`, `fix:`, `refactor(scope):`, …).
- Prettier + ESLint configured; run both before committing. Accepted lint warnings: `react-refresh/only-export-components` in `ui.jsx`. `useRoom.js` is exempted from that rule in `eslint.config.js`.
- New runtime deps beyond React/lucide-react: `mqtt` (buzzer/TV, dynamic-imported), `leaflet` (map), `qrcode` (join/TV QR), `cropperjs` (image crop, lazy-imported in `Builder`). Routes and the heavy libs are code-split, so the home bundle stays small; keep new heavy deps lazy.
- **`usePresenterRoom` is exempt from the fast-refresh lint rule** in `eslint.config.js` (it lives in `useRoom.js`, already exempted). Present/live payloads are built and validated only in `lib/model.js` (framework-free) so they stay unit-testable.
