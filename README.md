# Quiz Night

A host-led party quiz app. One host screen runs the show; players can buzz in, drop map pins, pick answers and guess numbers from their own phones over a QR code. Fourteen round formats, solo or in teams, English or German, light or dark — plus a TV presenter mode that mirrors a clean view to a second screen over Wi-Fi (no HDMI).

**Round formats**

| Type            | How it plays                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Classic         | Read the question, reveal the answer, tap whoever got it right.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Jeopardy        | Category board of point tiles. Award **or dock** the tile's points (the +/− toggle).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Hint Ladder     | The answer starts at full value; every extra hint lowers it. Hints can be **text, image, audio, video, or a map pin**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Video           | Plays a clip with custom controls — the **title stays hidden** (it would give the answer away). Source can be **YouTube, Spotify, or a direct audio/video file** (see _Media sources_). Optional **audio-only** mode. Auto-pauses **when a player buzzes in**.                                                                                                                                                                                                                                                                                                                                                                       |
| Clip Ladder     | A video/audio sibling of the Hint Ladder: the host plays a **short slice** of the clip and **extends it step by step** (the **Extend clip** button, the **H** key, or the host remote) — the longer it runs, the fewer points it's worth. Same sources as Video; auto-pauses on buzz.                                                                                                                                                                                                                                                                                                                                                |
| Picture         | Show an image (paste a URL or upload one), then reveal the answer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Morph           | The picture starts obscured and worth the most; **demorph** it step by step (blur, pixelate, tiles, zoom, or slices) — fewer points the longer it takes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Fusion          | Two images blended into one — guess both halves. **Defuse** to peek toward each; reveal shows them side by side.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Map             | A real pan/zoom world map. Players drop a pin (host screen or phones); reveal the true spot and the ranked guesses — **auto-scored**, closest wins.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Multiple choice | Players tap A/B/C/D on their phones; live tallies on the host screen, **auto-scored** — everyone who picked the right option gets the points.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| True / False    | Read a statement; players tap **True** or **False** on their phones. **Auto-scored** — everyone right scores. Optional fact shown on reveal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Higher / Lower  | Players guess whether the answer is **Higher** or **Lower** than the clue (e.g. "Everest is 8,849 m — is K2 higher or lower?"). **Auto-scored**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Closest number  | Players type a number on their phones; reveal ranks every guess by distance and **auto-awards the closest** one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Who Knows More  | An **auction**: a player claims how many of a category they know, then must name at least that many — the host taps each correct answer (they pop onto squares matching the claim) against a **per-answer clock**. When the clock runs out it just turns red ("time's up") — the host stays in control and can still award one more answer (which regrants the clock) or call it. Deliver them all and the winner scores the claim; **bust** and every _other_ player banks the answers given so far. The host can showcase the full, optionally **ranked**, answer list — and run the whole auction from the **host remote** phone. |

Other features:

- **Teams** — play solo (one entry per player) or split into teams. In team mode each team is one scoring entity and phones pick which team they're on when they join.
- **Phone avatars** — players choose their own emoji + colour, or **upload a photo**, on their phone; it shows up on the scoreboard, podium and TV.
- **Phone buzzers & answers** — show a QR code; players join from their phones, buzz in (first-to-buzz lockout with a sound on the host screen), drop map pins, pick multiple-choice answers, and submit number guesses. Works on your local network — see below.
- **Player score HUD (8-bit)** — each phone shows that player's own **live score and rank** in a retro arcade HUD: a pixel-font scoreboard that counts up, a `+N` coin-pop on every gain (and a level-up jingle when their rank climbs), and a between-questions leaderboard. The whole app wears a tasteful **8-bit aesthetic** (pixel display font on scores/labels, chunky arcade buzz button, chiptune blips) while keeping the colour palette and light/dark themes.
- **Reconnect on reload** — if a player's phone reloads mid-game, it silently **rejoins the same room** (no re-typing) and keeps its score; a "leave / switch player" button hands the phone to someone else. Works with or without the optional profiles below.
- **Stream to a TV** — open `#/present/<code>` on any second screen on the same Wi-Fi for a clean, enlarged, read-only mirror of the host with an animated **podium-climb** scoreboard. Map pins stay hidden until reveal. No HDMI, no backend (it rides the same room) — e.g. cast a Chrome tab to a Google TV. See _Stream to a TV_ below.
- **Host remote** — open `#/host/<code>` on a phone to drive the whole game without standing at the laptop: reveal, advance, **skip a whole round**, **give or take a player's points** (the round's value, plus fine ±1), hints, **play/pause/restart + extend a clip**, and toggle **Sound on TV**. It also **mirrors the live round** (the map, picture, and question/answer) on the phone, so you can run map rounds without looking at the PC. For **Who Knows More** it runs the entire auction from the phone — pick the winner and their claim, award the category, then tap each correct answer off the full list (which only the host's devices ever receive), bust, or showcase the answers. Its QR sits next to the TV one in the Stream-to-TV panel; keep it to yourself (it controls the game).
- **Clip sound on the TV** — by default a clip plays on the host's own screen. Flip **Sound on TV** (in the Stream-to-TV panel or the host remote) to make the cast TV the speaker instead: the host drives play/pause/restart/extend from the phone or PC and the room hears it from the TV. The TV asks for a one-time tap to enable sound (browsers block silent autoplay). A buzz auto-pauses it; extending the clip ladder replays from the start at the new length.
- **Between-rounds recap minigames** — when a round ends, a little fanfare plays and the scoreboard arrives as a random **8-bit minigame** that acts out the round's points using each player's avatar as a sprite: **Space Invaders** (blast the fleet you scored), **Rocket Race**, **Block Stacker**, **Pellet Muncher**, or **Brick Breaker**. A different one is picked each round, and the host + TV always play the same one. Scores count up to the new totals and the round's **biggest mover** gets a ★. (Reduced-motion shows a plain ranked board; scoreboard numbers also count up when you award points.)
- **Quiz builder power tools** — drag-and-drop reordering, **image crop**, **video/audio trim** (start/end), a **satellite** map layer, **place search** to drop answer pins, and an embedded **Mapillary street view** on map questions.
- **Templates, Creator Room & JSON import** — start a round or whole quiz from a template; open **Creator Room** to copy a schema prompt into any AI and paste the JSON back; or **import round(s) from JSON** (paste or upload) straight into the quiz you're editing.
- **English / German** — language toggle (top-right), remembered across sessions.
- **Per-round countdown timer** — optional, set in the builder; pause/reset while playing.
- **Persistent leaderboard** — every finished game is recorded on the device; standings aggregate wins, totals, and best scores across games.
- **Light / dark theme** — playful, colourful styling in both; toggle top-right, applied before first paint.
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

Open a game's setup screen and **Enable phone buzzers**. A QR code and 4-letter room code appear; players scan it to open the join page (`#/join/<code>`) on their phones, enter a name (and pick a team, in team mode), and they're in. Each question type drives the right phone screen: a big **Buzz** button on most rounds (first to tap locks the others out, and the host screen beeps and names them); a mini-map to drop a pin on map rounds; A/B/C/D buttons on multiple-choice rounds; a number pad on closest-number rounds.

It works with **no backend**: phones and host talk over a free public MQTT-over-WebSocket broker, with the random room code as the only privacy boundary — fine for a living-room game, not for anything sensitive. Map tiles and the buzzer both need internet.

**Using it on your home network (no deploy):** the QR encodes whatever URL the host opened, and `localhost` isn't reachable from a phone — so open the app via your machine's LAN address. `npm run dev` already binds to all interfaces and prints a **Network** URL (e.g. `http://192.168.1.23:5173/`); open _that_ on the host machine, and the QR will point phones to it. Phones must be on the same Wi-Fi. (BuzzerPanel shows a warning if you opened the app on `localhost`.) The deployed site works too.

## Stream to a TV

With phone buzzers enabled, the host's game screen has a **Stream to TV** button (the TV icon). It opens a panel with two QR codes/links:

- **TV screen** (`#/present/<code>`) — a clean, enlarged, **read-only** mirror of the current question; the answer appears only when the host reveals it, plus an animated **podium-climb** scoreboard. **Map pins are never shown on the TV** (the coordinates aren't even sent until reveal).
- **Host remote** (`#/host/<code>`) — controls (reveal, advance, award, hints, …). Keep this one to yourself; anyone who opens it can drive the game.

It reuses the same MQTT room, so there's no extra setup and no HDMI cable — just open the app via the LAN IP (not `localhost`), same as the phones.

**Getting it onto a Google TV / Fire TV:** the easiest is to open `#/present/<code>` in **Chrome on your laptop** and use **⋮ → Cast… → your TV** (Google TV / any Chromecast) — nothing to type on the TV. Alternatively, open the link directly in the TV's own browser (the Fire TV's Silk browser works). The host can also press **standings** to throw the live podium up on both screens.

## Builder power tools

- **Image crop** — on any picture field, click **Crop** to trim/zoom the image in place (output is downscaled for you).
- **Video / audio trim** — give a YouTube clip or audio/video hint a **start** and **end** (seconds) so only the chosen segment plays.
- **Clip Ladder round** — its own round type (next to Video). Set the **start/end** window (the full clip) and the number of **Extensions**; the host plays the first slice and extends it step by step for fewer points each time — the audio/video answer to the Hint Ladder. The clip also **auto-pauses when a player buzzes in**.
- **Media sources (YouTube · Spotify · direct file)** — paste any of these into a Video/Clip question and the right player is picked automatically (buzz-pause and the ladder work the same on all three):
  - **YouTube** — easiest, but many uploads (especially music) **block embedding**; those can't play in any embedded player. You'll get a clear message + an _Open on YouTube_ link.
  - **Spotify** — paste a track link (`open.spotify.com/track/…`). Always embeds — the best fix for music. It's **fully masked** so the title/cover can't spoil the answer. Caveat: without a Spotify **Premium** session in that browser it plays only the **~30-second preview** (plenty for "name that tune"); the ladder runs over the preview.
  - **Direct audio/video file** — paste a direct `.mp3`/`.m4a`/`.mp4`/`.webm` URL you host. **Full, precise control** (exact start/end slices), no embedding limits, no spoilers — the highest-quality option if you have the file.
- **Richer maps** — switch a map question between **Map** and **Satellite** (keyless Esri imagery), or **Search for a place** to drop the answer pin and fill in its name automatically (via OpenStreetMap Nominatim). Paste a **Mapillary** link/ID to embed a **street view** on the question — the TV/host shows it as the prompt and reveals the map answer afterwards. (Use the **Street view** button to find a spot on Mapillary, then copy its link.)
- **Templates** — the round picker offers per-type starters, and the home screen has **New from template** for whole-quiz starters.
- **Import round(s) from JSON** — the round picker's **Import round(s)** button takes pasted JSON or a `.quiz.json` file (a single round, an array, or a whole quiz) and appends the rounds to the quiz you're editing (validated and re-id'd).
- **Creator Room** — at the home screen, copy a whole-quiz schema prompt into ChatGPT/Claude/any AI and paste the JSON back to add a quiz; or, in the round picker, **Creator Room** gives a prompt tailored to a single round type (with its exact JSON shape + example) and inserts the round you paste back. Everything is validated and coerced.

## Deployment

A GitHub Actions workflow ([.github/workflows/deploy.yml](.github/workflows/deploy.yml)) builds and publishes to **GitHub Pages** on every push to `main`:

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Push to `main`; the site publishes at `https://<user>.github.io/<repo>/`.

The Vite `base` is relative and routing is hash-based, so the build also works under a custom domain or `npm run preview`. For Netlify/Vercel, point them at the `dist` output of `npm run build`.

> **Cross-network play:** because the join QR encodes wherever the host loaded the app and the buzzer broker is public internet, players reach the host **from any network** when everyone uses the deployed URL (the same-Wi-Fi requirement only applies to the local `npm run dev` server, whose QR points at the host's LAN IP).

## Persistent players (optional)

By default the app is fully backendless and each player types a name per game. You can **optionally** add persistent player profiles + per-player stats by pointing it at a free [Supabase](https://supabase.com) project — the frontend stays static on GitHub Pages and talks to Supabase from the browser.

1. Create a Supabase project; in the SQL editor run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (creates `profiles` + `results` with Row Level Security).
2. **Authentication → Providers → enable Anonymous sign-ins.**
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Locally: copy [`.env.example`](.env.example) to `.env`. On GitHub Pages: add them as repository **Actions secrets** (the deploy workflow injects them).

When set, each phone signs in anonymously, remembers its profile (name + avatar) across reloads, and joins with one tap. The anon key is publishable; RLS is the boundary. **Leave the vars unset and nothing changes** — the Supabase SDK is dropped from the build entirely and the app runs exactly as before.

## Project structure

```
index.html                  Vite entry + pre-paint dark-theme script
src/
  main.jsx                  React entry point
  App.jsx                   shell: hash routing, persistence, home, host buzzer room, leaderboard recording
  index.css                 Tailwind v4, class-based dark variant, keyframes, Leaflet tooltip CSS
  lib/
    storage.js              Storage adapter (Claude → localStorage → memory) + load/save helpers
    model.js                Pure logic: factories, normalize/validate, geo math, morph/leaderboard + TV-payload helpers, export
    realtime.js             MQTT room transport for the buzzer + TV (framework-free)
  i18n/
    strings.js              English/German string catalogs + translate() (framework-free)
    I18nProvider.jsx        Language context/provider, useI18n() (t), LanguageToggle
  data/
    sampleQuiz.js           "Friday Night Sampler" built-in
    nerdQuiz.js             "Nexus Nights" built-in (LoL / nerdy; demos morph, fusion, media hints, picture, map)
    templates.js            Round + quiz starter templates and the AI-authoring schema prompt
  components/
    ui.jsx                  Primitives, TYPES/accents, player palette + Avatar, style constants, theme, Confetti
    useRoom.js              React hooks over realtime: useHostRoom, usePlayerRoom, usePresenterRoom (TV + host remote)
    LeafletMap.jsx          Real pan/zoom map; answer pin + guess markers; light/dark + satellite tiles; place search; Mapillary
    MapillaryEmbed.jsx      Embedded Mapillary street view for a map question
    MorphImage.jsx          Stepped image reveal (blur / pixelate / tiles / zoom / slices)
    FusionImage.jsx         Two images cross-faded into one; defuse toward each; reveal side by side
    HintMedia.jsx           Renders one hint by type (text / image / audio / video / map); audio/video trim
    YouTubePlayer.jsx       Chrome-free YouTube player (hides the title) + audio-only mode + start/end trim
    ScoreBar.jsx            Fixed scoreboard with +/− award toggle
    PodiumClimb.jsx         Animated live standings (host overlay + TV)
    RoundRecap.jsx          Between-rounds count-up of each score from round start to round end
    RoundBody.jsx           Read-only per-round renderer for the TV presenter
    PresenterView.jsx       TV page (#/present/<code>): clean read-only mirror of the host
    HostRemoteView.jsx      Phone host controller (#/host/<code>): reveal/advance/award/hints over a ctrl channel
    PlayView.jsx            Game screen: intro → question/board → final scores; timer, buzzer, phone pins/answers, auto-scoring, TV stream
    SetupView.jsx           Player/team entry (Solo/Teams toggle) + buzzer lobby
    Builder.jsx             Quiz editor for all fourteen round types; drag-and-drop; image crop; media trim; map satellite/search; templates
    BuzzerPanel.jsx         Host buzzer lobby: QR, room code, roster
    JoinView.jsx            Phone page: avatar + team picker, buzz, pin, choice tap, number guess
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
        //   { "type": "image", "url": "…" }, { "type": "audio"|"video", "url": "…", "start": 5, "end": 20 },
        //   or { "type": "map", "lat": …, "lng": …, "name": "…" }
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
        // audioOnly: true hides the video and plays just the sound; start/end (seconds) trim the clip.
        // The clip auto-pauses when a player buzzes in.
        "questions": [
          {
            "id": "v1",
            "url": "https://youtu.be/…",
            "q": "…",
            "a": "…",
            "points": 10,
            "audioOnly": false,
            "start": null,
            "end": null,
          },
        ],
      },
      {
        "id": "r5",
        "type": "clip",
        "title": "Guess It Early",
        // Clip ladder: start/end is the FULL window; the host plays the first 1/(steps+1) of it and
        // extends it step by step, awarding fewer points each extension (like the hint ladder).
        "questions": [
          {
            "id": "c1",
            "url": "https://youtu.be/…",
            "q": "…",
            "a": "…",
            "points": 10,
            "audioOnly": false,
            "start": 0,
            "end": 30,
            "steps": 4,
          },
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
        // tileLayer: "map" (default) | "satellite"; street: optional Mapillary link/ID for a street-view prompt
        "questions": [
          {
            "id": "m1",
            "q": "…",
            "name": "Label on reveal",
            "lat": -13.16,
            "lng": -72.55,
            "points": 10,
            "tileLayer": "map",
            "street": "",
          },
        ],
      },
      {
        "id": "r9",
        "type": "choice",
        "title": "Multiple Choice",
        // correct is the 0-based index into options (2–6 options); auto-scored on reveal
        "questions": [{ "id": "ch1", "q": "…?", "options": ["A", "B", "C", "D"], "correct": 2, "points": 10 }],
      },
      {
        "id": "r10",
        "type": "number",
        "title": "Closest Guess",
        // answer is the target number; unit is an optional label; closest phone guess auto-wins
        "questions": [{ "id": "nu1", "q": "How many…?", "answer": 168, "unit": "items", "points": 15 }],
      },
      {
        "id": "r11",
        "type": "truefalse",
        "title": "True or False",
        // correct: 0 = True, 1 = False; auto-scored; note is an optional fact shown on reveal
        "questions": [{ "id": "tf1", "q": "A statement…", "correct": 1, "points": 10, "note": "Actually…" }],
      },
      {
        "id": "r12",
        "type": "higherlower",
        "title": "Higher or Lower",
        // correct: 0 = Higher, 1 = Lower; auto-scored; note is optional
        "questions": [{ "id": "hl1", "q": "X is N — is Y higher or lower?", "correct": 0, "points": 10, "note": "" }],
      },
      {
        "id": "r13",
        "type": "whoknows",
        "title": "Who Knows More",
        // timer = seconds per answer; answers = ALL correct answers; ordered = show them numbered
        "timer": 20,
        "questions": [
          {
            "id": "wk1",
            "q": "Countries bordering Germany",
            "answers": ["France", "Poland", "Austria"],
            "ordered": false,
          },
        ],
      },
    ],
  },
}
```

Imports are validated and coerced by `normalizeQuiz` in [src/lib/model.js](src/lib/model.js) — missing fields get defaults, unknown round types are dropped, and unusable files are rejected.
