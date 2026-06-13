/* ====================================================================
   APP SHELL (routing, persistence, home screen)
   --------------------------------------------------------------------
   Coarse hash routing mirrors the current view to window.location.hash
   (#/, #/play, #/setup/<id>, #/builder) so a refresh mid-game returns
   to the right place. Transient state (a builder draft) isn't in the
   URL, so refreshing on #/builder falls back home.
   ==================================================================== */

import { useState, useEffect, useRef } from "react";
import { Play, Plus, X, Pencil, Copy, Download, Upload } from "lucide-react";
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
} from "./lib/model.js";
import { SAMPLE } from "./data/sampleQuiz.js";
import { FOCUS, cardCls, Button, IconButton, TypeBadge, ConfirmDelete, ThemeToggle } from "./components/ui.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import PlayView from "./components/PlayView.jsx";
import SetupView from "./components/SetupView.jsx";
import Builder from "./components/Builder.jsx";

const APP_VERSION = "1.1.0";

const hashFor = (v) => {
  if (v.name === "play") return "#/play";
  if (v.name === "setup") return `#/setup/${v.quiz.id}`;
  if (v.name === "builder") return "#/builder";
  return "#/";
};

const parseHash = () => {
  const [seg, arg] = window.location.hash.replace(/^#\/?/, "").split("/");
  return { seg, arg };
};

function App() {
  const [view, setView] = useState({ name: "home" });
  const [quizzes, setQuizzes] = useState([]);
  const [game, setGame] = useState(null);
  const [lastPlayers, setLastPlayers] = useState(["", ""]);
  const [loaded, setLoaded] = useState(false);
  const [importError, setImportError] = useState("");
  const fileRef = useRef(null);

  /* initial load (with migration from the first artifact version's keys) */
  useEffect(() => {
    (async () => {
      const qs = await loadWithLegacy("quizzes", "quiznight-quizzes", []);
      setQuizzes((Array.isArray(qs) ? qs : []).map(normalizeQuiz).filter(Boolean));
      const g = await loadJSON("game", null);
      setGame(normalizeGame(g));
      const p = await loadWithLegacy("players", "quiznight-players", ["", ""]);
      if (Array.isArray(p) && p.length) setLastPlayers(p.map((x) => str(x)));
      setLoaded(true);
    })();
  }, []);

  const allQuizzes = [SAMPLE, ...quizzes];

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
      if (seg === "play") {
        // An ended game is kept in state for the final-scores screen but is no
        // longer "in progress" — match the home screen's resume gating.
        setView(gameRef.current && gameRef.current.stage !== "end" ? { name: "play" } : { name: "home" });
      } else if (seg === "setup") {
        const quiz = [SAMPLE, ...quizzesRef.current].find((q) => q.id === arg);
        setView(quiz ? { name: "setup", quiz } : { name: "home" });
      } else if (seg === "builder") {
        if (viewRef.current.name === "builder") return; // keep the live draft
        // A draft can't be restored from the URL; normalize the hash to home so
        // the address bar doesn't say #/builder while home is rendered.
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

  const startGame = (quiz, names) => {
    setLastPlayers(names);
    saveJSON("players", names);
    const ri = nextNonEmpty(quiz, 0);
    persistGame({
      quiz: deepClone(quiz),
      players: names.map((n) => ({ id: uid(), name: n, score: 0 })),
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
      copy.title = quiz.title + " (copy)";
      go({
        name: "builder",
        draft: copy,
        note: "The sample quiz is read-only — you're editing your own copy of it.",
      });
    } else {
      go({ name: "builder", draft: deepClone(quiz) });
    }
  };

  const duplicateQuiz = (quiz) => {
    const copy = deepClone(quiz);
    copy.id = uid();
    copy.sample = false;
    copy.title = quiz.title + " (copy)";
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
        setImportError("That file doesn't look like a Quiz Night export (.quiz.json).");
        setTimeout(() => setImportError(""), 5000);
      }
    };
    reader.readAsText(file);
  };

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 font-sans text-stone-400 dark:bg-stone-950 dark:text-stone-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased transition-colors dark:bg-stone-950 dark:text-stone-100">
      {view.name === "home" && (
        <div className="mx-auto max-w-2xl px-6 pb-16 pt-12">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-5xl font-bold tracking-tight">
                Quiz Night<span className="text-indigo-600 dark:text-indigo-400">.</span>
              </h1>
              <p className="mt-2 text-stone-500 dark:text-stone-400">
                One screen, one host, six round formats. You read, friends shout, you tap to score.
              </p>
            </div>
            <ThemeToggle className="mt-1" />
          </div>

          {game && game.stage !== "end" && (
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-indigo-200 bg-indigo-50 px-5 py-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <div>
                <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Game in progress</p>
                <p className="text-sm text-indigo-900/70 dark:text-indigo-200/70">
                  {game.quiz.title} · Round {game.ri + 1} of {game.quiz.rounds.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="accent" className="px-4 py-2" onClick={() => go({ name: "play" })}>
                  <Play size={15} /> Resume
                </Button>
                <IconButton
                  label="Discard game"
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
              Quizzes
            </h2>
            <button
              onClick={() => fileRef.current?.click()}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
            >
              <Upload size={15} /> Import
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
                      {q.rounds.length} rounds · {countQuestions(q)} questions{q.sample ? " · sample" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {q.rounds.map((r) => (
                        <TypeBadge key={r.id} type={r.type} />
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton label="Edit quiz" onClick={() => editQuiz(q)}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton label="Duplicate quiz" onClick={() => duplicateQuiz(q)}>
                      <Copy size={15} />
                    </IconButton>
                    <IconButton label="Export quiz as file" onClick={() => exportQuiz(q)}>
                      <Download size={15} />
                    </IconButton>
                    {!q.sample && (
                      <ConfirmDelete
                        label="Delete quiz"
                        onConfirm={() => persistQuizzes(quizzes.filter((x) => x.id !== q.id))}
                      />
                    )}
                  </div>
                </div>
                <Button className="mt-4 px-5 py-2.5" onClick={() => go({ name: "setup", quiz: q })}>
                  <Play size={15} /> Play
                </Button>
              </div>
            ))}
            <button
              onClick={() => go({ name: "builder", draft: { id: uid(), title: "", rounds: [] } })}
              className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-5 font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200 ${FOCUS}`}
            >
              <Plus size={18} /> New quiz
            </button>
          </div>

          <p className="mt-10 text-center text-xs text-stone-300 dark:text-stone-600">
            v{APP_VERSION} · {storage.name === "claude" && "saving to your Claude storage"}
            {storage.name === "local" && "saving to this browser"}
            {storage.name === "memory" && (
              <span className="font-medium text-amber-500">
                no persistent storage available — changes last only for this session
              </span>
            )}
          </p>
        </div>
      )}

      {view.name === "setup" && (
        <SetupView
          quiz={view.quiz}
          defaults={lastPlayers}
          onBack={() => go({ name: "home" })}
          onStart={(names) => startGame(view.quiz, names)}
        />
      )}

      {view.name === "play" && game && (
        <PlayView
          game={game}
          setGame={persistGame}
          onExit={() => {
            if (game.stage === "end") persistGame(null);
            go({ name: "home" });
          }}
        />
      )}

      {view.name === "builder" && (
        <Builder initial={view.draft} note={view.note} onSave={saveQuiz} onCancel={() => go({ name: "home" })} />
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
