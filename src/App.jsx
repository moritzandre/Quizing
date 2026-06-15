/* ====================================================================
   APP SHELL (routing, persistence, home screen)
   --------------------------------------------------------------------
   Coarse hash routing mirrors the current view to window.location.hash
   (#/, #/play, #/setup/<id>, #/builder, #/leaderboard, #/join/<code>) so
   a refresh returns to the right place. The host buzzer room lives here
   so both setup and play can drive it; phones land directly on #/join.
   ==================================================================== */

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Play, Plus, X, Pencil, Copy, Download, Upload, Trophy, LayoutTemplate, Sparkles } from "lucide-react";
import { storage, loadJSON, saveJSON, removeKey, loadWithLegacy } from "./lib/storage.js";
import {
  uid,
  deepClone,
  str,
  normalizeQuiz,
  normalizeGame,
  nextNonEmpty,
  countQuestions,
  exportQuiz,
  summarizeGame,
} from "./lib/model.js";
import { SAMPLE } from "./data/sampleQuiz.js";
import { NERD_QUIZ } from "./data/nerdQuiz.js";
import { QUIZ_TEMPLATES, AI_SCHEMA_HELP } from "./data/templates.js";
import {
  FOCUS,
  cardCls,
  Button,
  IconButton,
  TypeBadge,
  ConfirmDelete,
  ThemeToggle,
  colorAt,
  emojiAt,
} from "./components/ui.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { useHostRoom } from "./components/useRoom.js";

// Lazy-loaded so the heavy libraries they pull in (Leaflet, the YouTube/canvas
// players, mqtt, qrcode, the builder) aren't in the initial home-screen bundle.
const PlayView = lazy(() => import("./components/PlayView.jsx"));
const SetupView = lazy(() => import("./components/SetupView.jsx"));
const Builder = lazy(() => import("./components/Builder.jsx"));
const JoinView = lazy(() => import("./components/JoinView.jsx"));
const PresenterView = lazy(() => import("./components/PresenterView.jsx"));
const HostRemoteView = lazy(() => import("./components/HostRemoteView.jsx"));
const LeaderboardView = lazy(() => import("./components/LeaderboardView.jsx"));
import { useI18n, LanguageToggle } from "./i18n/I18nProvider.jsx";

const APP_VERSION = "1.2.0";

const hashFor = (v) => {
  if (v.name === "play") return "#/play";
  if (v.name === "setup") return `#/setup/${v.quiz.id}`;
  if (v.name === "builder") return "#/builder";
  if (v.name === "leaderboard") return "#/leaderboard";
  if (v.name === "join") return `#/join/${v.code}`;
  if (v.name === "present") return `#/present/${v.code}`;
  if (v.name === "host") return `#/host/${v.code}`;
  return "#/";
};

const parseHash = () => {
  const [seg, arg] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { seg, arg };
};

const modalWrap = "fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 backdrop-blur-sm sm:items-center";
const modalCard =
  "w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-800 dark:bg-stone-900";

/** Pick a whole-quiz starter template, then open it in the builder. */
function TemplateModal({ onClose, onPick, t }) {
  return (
    <div className={modalWrap} onClick={onClose}>
      <div className={modalCard} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <LayoutTemplate size={18} /> {t("home.newFromTemplate")}
          </h3>
          <IconButton label={t("common.cancel")} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="space-y-2">
          {QUIZ_TEMPLATES.map((tpl) => (
            <button
              key={tpl.key}
              onClick={() => onPick(tpl)}
              className={`block w-full rounded-xl border border-stone-200 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-stone-700 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 ${FOCUS}`}
            >
              <div className="font-semibold">{tpl.title}</div>
              <div className="text-sm text-stone-400 dark:text-stone-500">
                {t("home.templateRounds", { n: tpl.quiz.rounds.length })}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Copy a generation prompt for an LLM, then paste the returned JSON to import it. */
function AiModal({ onClose, onImport, t }) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState(null);
  // Auto-clear the "copied!" flag, cancelling the timer if the modal closes first.
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);
  // navigator.clipboard only exists in secure contexts (https/localhost); over a
  // plain-http LAN address it's undefined, so fall back to execCommand("copy").
  const copy = async () => {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(AI_SCHEMA_HELP);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = AI_SCHEMA_HELP;
        ta.style.position = "fixed";
        ta.style.top = "-1000px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) setCopied(true);
  };
  const doImport = () => {
    const title = onImport(text.trim());
    setMsg(title ? { ok: true, text: t("ai.added", { title }) } : { ok: false, text: t("ai.invalid") });
  };
  return (
    <div className={modalWrap} onClick={onClose}>
      <div className={modalCard} onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Sparkles size={18} /> {t("ai.title")}
          </h3>
          <IconButton label={t("common.cancel")} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400">{t("ai.intro")}</p>
        <div className="relative mt-2">
          <textarea
            readOnly
            value={AI_SCHEMA_HELP}
            onFocus={(e) => e.target.select()}
            rows={6}
            className="w-full resize-none rounded-xl bg-stone-100 p-3 pr-20 font-mono text-xs leading-relaxed text-stone-600 focus:outline-none dark:bg-stone-800 dark:text-stone-300"
          />
          <button
            onClick={copy}
            className={`absolute right-2 top-2 rounded-lg bg-white px-2 py-1 text-xs font-medium text-stone-600 shadow-sm transition hover:text-indigo-600 dark:bg-stone-900 dark:text-stone-300 ${FOCUS}`}
          >
            {copied ? t("ai.copied") : t("ai.copyPrompt")}
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("ai.pastePlaceholder")}
          rows={5}
          className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
        />
        {msg && (
          <p
            className={`mt-2 text-sm ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {msg.text}
          </p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.done")}
          </Button>
          <Button onClick={doImport} disabled={!text.trim()}>
            <Sparkles size={16} /> {t("ai.import")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function App() {
  // Initialise from the hash so a phone hitting #/join/<code> renders instantly.
  const [view, setView] = useState(() => {
    const { seg, arg } = parseHash();
    if (seg === "join" && arg) return { name: "join", code: arg };
    if (seg === "present" && arg) return { name: "present", code: arg };
    if (seg === "host" && arg) return { name: "host", code: arg };
    return { name: "home" };
  });
  const [quizzes, setQuizzes] = useState([]);
  const [game, setGame] = useState(null);
  const [lastPlayers, setLastPlayers] = useState(["", ""]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [importError, setImportError] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const fileRef = useRef(null);
  const { t } = useI18n();

  const room = useHostRoom();

  /* initial load (with migration from the first artifact version's keys) */
  useEffect(() => {
    (async () => {
      const qs = await loadWithLegacy("quizzes", "quiznight-quizzes", []);
      setQuizzes((Array.isArray(qs) ? qs : []).map(normalizeQuiz).filter(Boolean));
      const g = await loadJSON("game", null);
      setGame(normalizeGame(g));
      const p = await loadWithLegacy("players", "quiznight-players", ["", ""]);
      if (Array.isArray(p) && p.length) setLastPlayers(p.map((x) => str(x)));
      const lb = await loadJSON("leaderboard", []);
      setLeaderboard(Array.isArray(lb) ? lb : []);
      setLoaded(true);
    })();
  }, []);

  const allQuizzes = [SAMPLE, NERD_QUIZ, ...quizzes];

  /* refs so the hash resolver reads the latest data without re-subscribing */
  const gameRef = useRef(game);
  const quizzesRef = useRef(quizzes);
  const viewRef = useRef(view);
  gameRef.current = game;
  quizzesRef.current = quizzes;
  viewRef.current = view;

  /* navigate: update view state and mirror it to the hash */
  const go = (v) => {
    setView(v);
    const target = hashFor(v);
    if (window.location.hash !== target) window.location.hash = target;
  };

  /* resolve the URL hash to a view (initial load + back/forward) */
  useEffect(() => {
    if (!loaded) return;
    const resolve = () => {
      const { seg, arg } = parseHash();
      if (seg === "join" && arg) {
        setView({ name: "join", code: arg });
      } else if (seg === "present" && arg) {
        setView({ name: "present", code: arg });
      } else if (seg === "host" && arg) {
        setView({ name: "host", code: arg });
      } else if (seg === "play") {
        // An ended game is kept in state for the final-scores screen but is no
        // longer "in progress" — match the home screen's resume gating.
        setView(gameRef.current && gameRef.current.stage !== "end" ? { name: "play" } : { name: "home" });
      } else if (seg === "setup") {
        const quiz = [SAMPLE, NERD_QUIZ, ...quizzesRef.current].find((q) => q.id === arg);
        setView(quiz ? { name: "setup", quiz } : { name: "home" });
      } else if (seg === "leaderboard") {
        setView({ name: "leaderboard" });
      } else if (seg === "builder") {
        if (viewRef.current.name === "builder") return; // keep the live draft
        if (window.location.hash !== "#/") window.history.replaceState(null, "", "#/");
        setView({ name: "home" });
      } else {
        setView({ name: "home" });
      }
    };
    resolve();
    window.addEventListener("hashchange", resolve);
    return () => window.removeEventListener("hashchange", resolve);
  }, [loaded]);

  const persistQuizzes = (list) => {
    setQuizzes(list);
    saveJSON("quizzes", list);
  };
  const persistGame = (g) => {
    setGame(g);
    if (g && g.stage !== "end") saveJSON("game", g);
    else removeKey("game");
  };

  /* record finished games into the persistent leaderboard, once each */
  const recordedRef = useRef(null);
  const leaderboardRef = useRef(leaderboard);
  leaderboardRef.current = leaderboard;
  useEffect(() => {
    if (!game || game.stage !== "end" || recordedRef.current === game.id) return;
    if (nextNonEmpty(game.quiz, 0) === -1) return; // content-less quiz ended at start — not a real game
    recordedRef.current = game.id;
    const rec = { id: game.id, date: new Date().toISOString(), ...summarizeGame(game) };
    const next = [...leaderboardRef.current, rec].slice(-200);
    setLeaderboard(next);
    saveJSON("leaderboard", next);
  }, [game]);

  const clearLeaderboard = () => {
    setLeaderboard([]);
    removeKey("leaderboard");
  };

  /**
   * Start a game. In solo mode `players` is a list of { name, deviceId? } and
   * each entry is one scoring entity; phone-linked players keep deviceId so
   * buzz/pin/answer events map directly. In team mode each entry is a team
   * { id, name, deviceIds[], members[] } — the team is the scoring entity and
   * every linked phone routes its events to that team.
   *
   * @param {object} quiz
   * @param {Array<object>} players solo players or team descriptors
   * @param {"solo"|"teams"} [mode="solo"]
   */
  const startGame = (quiz, players, mode = "solo") => {
    const teams = mode === "teams";
    // Only remember manually-typed solo names — phone players rejoin via the
    // room and teams are session-specific, so persisting them seeds dupes.
    const manualNames = teams ? [] : players.filter((p) => !p.deviceId).map((p) => p.name);
    setLastPlayers(manualNames);
    saveJSON("players", manualNames);
    const ri = nextNonEmpty(quiz, 0);
    persistGame({
      id: uid(),
      quiz: deepClone(quiz),
      mode: teams ? "teams" : "solo",
      players: players.map((p, i) => {
        const deviceIds = p.deviceIds || (p.deviceId ? [p.deviceId] : []);
        const base = {
          id: p.id || p.deviceId || uid(),
          name: p.name,
          score: 0,
          color: p.color || colorAt(i),
          emoji: p.emoji || emojiAt(i),
          ...(p.photo ? { photo: p.photo } : {}),
          ...(p.profileId ? { profileId: p.profileId } : {}),
        };
        if (deviceIds.length) base.deviceIds = deviceIds;
        if (p.members) base.members = p.members;
        return base;
      }),
      ri: Math.max(ri, 0),
      qi: 0,
      stage: ri === -1 ? "end" : "intro",
      revealed: false,
      hintsShown: 1,
      awarded: {},
      used: {},
      tile: null,
      guesses: {},
    });
    go({ name: "play" });
  };

  const editQuiz = (quiz) => {
    if (quiz.sample) {
      const copy = deepClone(quiz);
      copy.id = uid();
      copy.sample = false;
      copy.title = quiz.title + t("home.copySuffix");
      go({ name: "builder", draft: copy, note: t("builder.sampleNote") });
    } else {
      go({ name: "builder", draft: deepClone(quiz) });
    }
  };

  const duplicateQuiz = (quiz) => {
    const copy = deepClone(quiz);
    copy.id = uid();
    copy.sample = false;
    copy.title = quiz.title + t("home.copySuffix");
    persistQuizzes([...quizzes, copy]);
  };

  const saveQuiz = (q) => {
    const exists = quizzes.some((x) => x.id === q.id);
    persistQuizzes(exists ? quizzes.map((x) => (x.id === q.id ? q : x)) : [...quizzes, q]);
    go({ name: "home" });
  };

  const handleImportFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const quiz = normalizeQuiz(parsed?.quiz ?? parsed);
        if (!quiz || !quiz.rounds.length) throw new Error("invalid");
        quiz.id = uid();
        quiz.sample = false;
        persistQuizzes([...quizzes, quiz]);
        setImportError("");
      } catch {
        setImportError(t("home.importError"));
        setTimeout(() => setImportError(""), 5000);
      }
    };
    reader.readAsText(file);
  };

  /** Open the builder on a fresh quiz seeded from a template (fresh ids). */
  const newFromTemplate = (tpl) => {
    const draft = normalizeQuiz(tpl.quiz);
    setTplOpen(false);
    if (draft) go({ name: "builder", draft });
  };

  /** Import an AI-pasted quiz JSON (same path as a file import). Returns the title or null. */
  const importAiJson = (text) => {
    try {
      const parsed = JSON.parse(text);
      const quiz = normalizeQuiz(parsed?.quiz ?? parsed);
      if (!quiz || !quiz.rounds.length) return null;
      quiz.id = uid();
      quiz.sample = false;
      persistQuizzes([...quizzes, quiz]);
      return quiz.title || t("builder.untitledQuiz");
    } catch {
      return null;
    }
  };

  const loadingFallback = (
    <div className="qn-app-bg flex min-h-screen items-center justify-center font-sans text-stone-400 dark:text-stone-500">
      {t("home.loading")}
    </div>
  );

  // Phone join page — standalone, renders before the data-load gate.
  if (view.name === "join")
    return (
      <Suspense fallback={loadingFallback}>
        <JoinView code={view.code} />
      </Suspense>
    );

  // TV presenter page — standalone, read-only, renders before the data-load gate.
  if (view.name === "present")
    return (
      <Suspense fallback={loadingFallback}>
        <PresenterView code={view.code} />
      </Suspense>
    );

  // Host remote control page — standalone, renders before the data-load gate.
  if (view.name === "host")
    return (
      <Suspense fallback={loadingFallback}>
        <HostRemoteView code={view.code} />
      </Suspense>
    );

  if (!loaded) return loadingFallback;

  return (
    <div className="qn-app-bg min-h-screen font-sans text-stone-900 antialiased transition-colors dark:text-stone-100">
      {view.name === "home" && (
        <div className="mx-auto max-w-2xl px-6 pb-16 pt-12">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-tight">
                Quiz Night<span className="text-indigo-600 dark:text-indigo-400">.</span>
              </h1>
              <p className="mt-2 text-stone-500 dark:text-stone-400">{t("home.tagline")}</p>
            </div>
            <div className="flex items-center gap-1">
              <IconButton label={t("home.leaderboard")} onClick={() => go({ name: "leaderboard" })}>
                <Trophy size={18} />
              </IconButton>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>

          {game && game.stage !== "end" && (
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div>
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">{t("home.gameInProgress")}</p>
                <p className="text-sm text-indigo-900/70 dark:text-indigo-200/70">
                  {t("home.roundOf", { title: game.quiz.title, n: game.ri + 1, total: game.quiz.rounds.length })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="accent" className="px-4 py-2" onClick={() => go({ name: "play" })}>
                  <Play size={15} /> {t("home.resume")}
                </Button>
                <IconButton
                  label={t("home.discard")}
                  className="text-indigo-400 hover:text-red-600"
                  onClick={() => persistGame(null)}
                >
                  <X size={16} />
                </IconButton>
              </div>
            </div>
          )}

          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {t("home.quizzes")}
            </h2>
            <button
              onClick={() => fileRef.current?.click()}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
            >
              <Upload size={15} /> {t("home.import")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleImportFile}
            />
          </div>
          {importError && (
            <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
              {importError}
            </p>
          )}

          <div className="mt-3 space-y-3">
            {allQuizzes.map((q) => (
              <div key={q.id} className={`${cardCls} p-5 shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold">{q.title}</h3>
                    <p className="mt-0.5 text-sm text-stone-400 dark:text-stone-500">
                      {t("home.roundsQuestions", { rounds: q.rounds.length, questions: countQuestions(q) })}
                      {q.sample ? t("home.sampleSuffix") : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.rounds.map((r) => (
                        <TypeBadge key={r.id} type={r.type} />
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label={t("home.editQuiz")} onClick={() => editQuiz(q)}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton label={t("home.duplicateQuiz")} onClick={() => duplicateQuiz(q)}>
                      <Copy size={15} />
                    </IconButton>
                    <IconButton label={t("home.exportQuiz")} onClick={() => exportQuiz(q)}>
                      <Download size={15} />
                    </IconButton>
                    {!q.sample && (
                      <ConfirmDelete
                        label={t("home.deleteQuiz")}
                        onConfirm={() => persistQuizzes(quizzes.filter((x) => x.id !== q.id))}
                      />
                    )}
                  </div>
                </div>
                <Button className="mt-4 px-5 py-2.5" onClick={() => go({ name: "setup", quiz: q })}>
                  <Play size={15} /> {t("home.play")}
                </Button>
              </div>
            ))}
            <button
              onClick={() => go({ name: "builder", draft: { id: uid(), title: "", rounds: [] } })}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-5 font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200 ${FOCUS}`}
            >
              <Plus size={18} /> {t("home.newQuiz")}
            </button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => setTplOpen(true)}>
                <LayoutTemplate size={16} /> {t("home.newFromTemplate")}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setAiOpen(true)}>
                <Sparkles size={16} /> {t("home.createWithAi")}
              </Button>
            </div>
          </div>

          <p className="mt-10 text-center text-xs text-stone-300 dark:text-stone-600">
            v{APP_VERSION} · {storage.name === "claude" && t("home.storageClaude")}
            {storage.name === "local" && t("home.storageLocal")}
            {storage.name === "memory" && <span className="font-medium text-amber-500">{t("home.storageMemory")}</span>}
          </p>

          {tplOpen && <TemplateModal onClose={() => setTplOpen(false)} onPick={newFromTemplate} t={t} />}
          {aiOpen && <AiModal onClose={() => setAiOpen(false)} onImport={importAiJson} t={t} />}
        </div>
      )}

      {view.name !== "home" && (
        <Suspense fallback={loadingFallback}>
          {view.name === "setup" && (
            <SetupView
              quiz={view.quiz}
              defaults={lastPlayers}
              room={room}
              onBack={() => go({ name: "home" })}
              onStart={(players, mode) => startGame(view.quiz, players, mode)}
            />
          )}

          {view.name === "play" && game && (
            <PlayView
              game={game}
              setGame={persistGame}
              room={room}
              onExit={() => {
                if (game.stage === "end") persistGame(null);
                go({ name: "home" });
              }}
            />
          )}

          {view.name === "builder" && (
            <Builder initial={view.draft} note={view.note} onSave={saveQuiz} onCancel={() => go({ name: "home" })} />
          )}

          {view.name === "leaderboard" && (
            <LeaderboardView results={leaderboard} onBack={() => go({ name: "home" })} onClear={clearLeaderboard} />
          )}
        </Suspense>
      )}
    </div>
  );
}

/** App entry: the shell wrapped in the error boundary. */
export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
