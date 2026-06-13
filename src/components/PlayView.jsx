/* ====================================================================
   PLAY VIEW (round intro → questions/board → final scores)
   ==================================================================== */

import { useEffect } from "react";
import { ChevronLeft, Trophy, RotateCcw, ArrowRight, Eye, Lightbulb, MapPin } from "lucide-react";
import { ytId, nextNonEmpty } from "../lib/model.js";
import { TYPES, FOCUS, Button } from "./ui.jsx";
import ScoreBar from "./ScoreBar.jsx";
import WorldMap from "./WorldMap.jsx";

/** Host-facing game screen; drives a game object via setGame (persisted by the app shell). */
export default function PlayView({ game, setGame, onExit }) {
  const quiz = game.quiz;
  const round = quiz.rounds[game.ri];
  const upd = (patch) => setGame({ ...game, ...patch });

  /* current question value (points at stake) */
  const value = (() => {
    if (!round) return 0;
    if (round.type === "jeopardy") {
      if (!game.tile) return 0;
      const q = round.categories[game.tile.ci]?.questions[game.tile.qi];
      return q?.points || 100;
    }
    const q = round.questions[game.qi];
    if (!q) return 0;
    if (round.type === "hints") return Math.max(1, q.hints.length - game.hintsShown + 1) * 10;
    return q.points || 10;
  })();

  const toggleAward = (pid) => {
    const a = { ...(game.awarded || {}) };
    let players;
    if (a[pid] != null) {
      players = game.players.map((p) => (p.id === pid ? { ...p, score: p.score - a[pid] } : p));
      delete a[pid];
    } else {
      a[pid] = value;
      players = game.players.map((p) => (p.id === pid ? { ...p, score: p.score + value } : p));
    }
    upd({ players, awarded: a });
  };

  const beginRound = () =>
    upd({
      stage: round.type === "jeopardy" ? "board" : "question",
      qi: 0,
      revealed: false,
      hintsShown: 1,
      awarded: {},
      tile: null,
    });

  const goNextRound = () => {
    const j = nextNonEmpty(quiz, game.ri + 1);
    if (j === -1) upd({ stage: "end" });
    else upd({ ri: j, stage: "intro", qi: 0, revealed: false, hintsShown: 1, awarded: {}, tile: null });
  };

  const nextQuestion = () => {
    if (game.qi + 1 < round.questions.length) upd({ qi: game.qi + 1, revealed: false, hintsShown: 1, awarded: {} });
    else goNextRound();
  };

  const backToBoard = () => {
    const key = `${game.ri}-${game.tile.ci}-${game.tile.qi}`;
    upd({ used: { ...game.used, [key]: true }, tile: null, stage: "board", revealed: false, awarded: {} });
  };

  const isJeop = round?.type === "jeopardy";
  const advance = isJeop ? backToBoard : nextQuestion;
  const scoreActive = game.stage === "question" && game.revealed;

  /* host keyboard shortcuts: R reveal · H hint · N/→ next · 1–9 award */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (game.stage !== "question" || !round) return;
      const k = e.key.toLowerCase();
      const q = isJeop ? round.categories[game.tile?.ci]?.questions[game.tile?.qi] : round.questions[game.qi];
      if (!q) return;
      if (k === "r" && !game.revealed) upd({ revealed: true });
      else if ((k === "n" || k === "arrowright") && game.revealed) advance();
      else if (k === "h" && !game.revealed && round.type === "hints" && game.hintsShown < q.hints.length)
        upd({ hintsShown: game.hintsShown + 1 });
      else if (game.revealed && /^[1-9]$/.test(e.key)) {
        const p = game.players[+e.key - 1];
        if (p) toggleAward(p.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const Header = (
    <div className="mb-8 flex items-center justify-between">
      <button
        onClick={onExit}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 ${FOCUS}`}
      >
        <ChevronLeft size={16} /> Exit
      </button>
      {round && game.stage !== "end" && (
        <p className="text-sm text-stone-500">
          Round {game.ri + 1} / {quiz.rounds.length} ·{" "}
          <span className="font-medium text-stone-700">{TYPES[round.type].label}</span>
        </p>
      )}
      <span className="w-14" />
    </div>
  );

  /* ---- final scores ---- */
  if (game.stage === "end") {
    const sorted = [...game.players].sort((a, b) => b.score - a.score);
    const playAgain = () =>
      setGame({
        ...game,
        players: game.players.map((p) => ({ ...p, score: 0 })),
        ri: Math.max(nextNonEmpty(quiz, 0), 0),
        qi: 0,
        stage: "intro",
        revealed: false,
        hintsShown: 1,
        awarded: {},
        used: {},
        tile: null,
      });
    return (
      <div className="mx-auto max-w-xl px-6 pb-16 pt-10 text-center">
        <Trophy className="mx-auto mb-4 text-amber-500" size={44} />
        <h2 className="text-3xl font-bold tracking-tight">Final scores</h2>
        <p className="mt-1 text-stone-500">{quiz.title}</p>
        <div className="mt-8 space-y-2">
          {sorted.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${i === 0 ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-white"}`}
            >
              <div className="flex items-center gap-3">
                <span className={`text-lg font-bold ${i === 0 ? "text-amber-600" : "text-stone-400"}`}>{i + 1}</span>
                <span className="text-lg font-medium">{p.name}</span>
                {i === 0 && <span className="text-xl">🏆</span>}
              </div>
              <span className="text-xl font-bold tabular-nums">{p.score}</span>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Button onClick={playAgain}>
            <RotateCcw size={16} /> Play again
          </Button>
          <Button variant="outline" onClick={onExit}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!round) return null;

  /* ---- round intro ---- */
  if (game.stage === "intro") {
    const T = TYPES[round.type];
    const Icon = T.icon;
    return (
      <div className="mx-auto max-w-2xl px-6 pb-32 pt-6">
        {Header}
        <div className="mt-10 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white">
            <Icon size={28} className="text-stone-700" />
          </div>
          <p className="text-sm font-medium uppercase tracking-widest text-stone-400">Round {game.ri + 1}</p>
          <h2 className="mt-2 text-4xl font-bold tracking-tight">{round.title || T.label}</h2>
          <p className="mx-auto mt-4 max-w-md text-stone-500">{T.desc}</p>
          <Button className="mt-8 px-6 py-3.5 text-base" onClick={beginRound}>
            Start round <ArrowRight size={18} />
          </Button>
        </div>
        <ScoreBar players={game.players} active={false} value={0} awarded={{}} onAward={() => {}} />
      </div>
    );
  }

  /* ---- jeopardy board ---- */
  if (game.stage === "board") {
    const boardDone = round.categories.every((c, ci) =>
      c.questions.every((_, qi) => game.used[`${game.ri}-${ci}-${qi}`]),
    );
    const maxRows = Math.max(...round.categories.map((c) => c.questions.length), 0);
    return (
      <div className="mx-auto max-w-3xl px-6 pb-32 pt-6">
        {Header}
        <h2 className="mb-6 text-center text-2xl font-bold tracking-tight">{round.title || "Pick a tile"}</h2>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${round.categories.length}, minmax(0,1fr))` }}
        >
          {round.categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-center rounded-xl bg-stone-900 px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-white md:text-sm"
            >
              {c.name || "—"}
            </div>
          ))}
          {Array.from({ length: maxRows }).map((_, qi) =>
            round.categories.map((c, ci) => {
              const q = c.questions[qi];
              if (!q) return <div key={c.id + "-" + qi} />;
              const used = game.used[`${game.ri}-${ci}-${qi}`];
              return (
                <button
                  key={c.id + "-" + qi}
                  disabled={used}
                  onClick={() => upd({ tile: { ci, qi }, stage: "question", revealed: false, awarded: {} })}
                  className={`flex h-16 items-center justify-center rounded-xl border text-xl font-bold transition md:h-20 md:text-2xl ${FOCUS} ${
                    used
                      ? "border-stone-100 bg-stone-50 text-stone-200"
                      : "border-stone-200 bg-white text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"
                  }`}
                >
                  {used ? "" : q.points}
                </button>
              );
            }),
          )}
        </div>
        {boardDone && (
          <div className="mt-8 text-center">
            <Button className="px-6 py-3.5 text-base" onClick={goNextRound}>
              Continue <ArrowRight size={18} />
            </Button>
          </div>
        )}
        <ScoreBar players={game.players} active={false} value={0} awarded={{}} onAward={() => {}} />
      </div>
    );
  }

  /* ---- question stage ---- */
  const q = isJeop ? round.categories[game.tile.ci].questions[game.tile.qi] : round.questions[game.qi];

  const RevealBtn = (
    <Button className="px-6 py-3.5 text-base" onClick={() => upd({ revealed: true })}>
      <Eye size={18} /> Reveal answer
    </Button>
  );
  const NextBtn = (
    <Button className="px-6 py-3.5 text-base" onClick={advance}>
      {isJeop ? "Back to board" : "Next"} <ArrowRight size={18} />
    </Button>
  );
  const Progress = !isJeop && (
    <p className="mb-3 text-center text-sm text-stone-400">
      Question {game.qi + 1} / {round.questions.length}
    </p>
  );
  const Shortcuts = (
    <p className="mt-8 hidden text-center text-xs text-stone-300 md:block">
      Shortcuts: R reveal{round.type === "hints" ? " · H hint" : ""} · N next · 1–9 award
    </p>
  );

  let body = null;

  if (round.type === "classic" || isJeop) {
    body = (
      <div className="text-center">
        {Progress}
        {isJeop && (
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-indigo-600">
            {round.categories[game.tile.ci].name || "Category"} · {q.points}
          </p>
        )}
        <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-snug tracking-tight md:text-5xl">
          {isJeop ? q.clue : q.q}
        </h2>
        <div className="mt-10" style={{ minHeight: 80 }}>
          {game.revealed ? (
            <p className="text-2xl font-bold text-indigo-600 md:text-4xl">{isJeop ? q.answer : q.a}</p>
          ) : (
            RevealBtn
          )}
        </div>
        {game.revealed && <div className="mt-8">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "hints") {
    const shown = q.hints.slice(0, game.hintsShown);
    body = (
      <div className="text-center">
        {Progress}
        <div className="mb-4 flex items-center justify-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Who or what is it?</h2>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700">worth {value}</span>
        </div>
        <div className="mx-auto max-w-xl space-y-2 text-left">
          {shown.map((h, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
              <span className="mt-0.5 text-xs font-bold text-stone-400">{i + 1}</span>
              <p className="text-base md:text-lg">{h || <span className="text-stone-300">…</span>}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!game.revealed && game.hintsShown < q.hints.length && (
            <Button
              variant="outline"
              className="px-5 py-3 text-base"
              onClick={() => upd({ hintsShown: game.hintsShown + 1 })}
            >
              <Lightbulb size={18} /> Next hint <span className="text-sm text-stone-400">(−10)</span>
            </Button>
          )}
          {!game.revealed && RevealBtn}
        </div>
        {game.revealed && (
          <>
            <p className="mt-8 text-2xl font-bold text-indigo-600 md:text-4xl">{q.answer}</p>
            <div className="mt-8">{NextBtn}</div>
          </>
        )}
      </div>
    );
  }

  if (round.type === "video") {
    const vid = ytId(q.url);
    body = (
      <div className="text-center">
        {Progress}
        <div className="mx-auto max-w-2xl">
          {vid ? (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-stone-200 bg-black">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${vid}`}
                title="Quiz clip"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400">
              No valid video link
            </div>
          )}
        </div>
        <h2 className="mt-6 text-2xl font-bold tracking-tight md:text-3xl">{q.q}</h2>
        <div className="mt-6" style={{ minHeight: 64 }}>
          {game.revealed ? <p className="text-2xl font-bold text-indigo-600 md:text-3xl">{q.a}</p> : RevealBtn}
        </div>
        {game.revealed && <div className="mt-6">{NextBtn}</div>}
      </div>
    );
  }

  if (round.type === "map") {
    body = (
      <div className="text-center">
        {Progress}
        <h2 className="mx-auto max-w-2xl text-2xl font-bold leading-snug tracking-tight md:text-4xl">{q.q}</h2>
        <div className="mx-auto mt-6 max-w-2xl">
          <WorldMap pin={game.revealed ? { lat: q.lat, lng: q.lng, label: q.name } : null} />
        </div>
        <div className="mt-6">
          {game.revealed ? (
            NextBtn
          ) : (
            <Button className="px-6 py-3.5 text-base" onClick={() => upd({ revealed: true })}>
              <MapPin size={18} /> Reveal location
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 pb-36 pt-6">
      {Header}
      {body}
      {Shortcuts}
      <ScoreBar
        players={game.players}
        active={scoreActive}
        value={value}
        awarded={game.awarded || {}}
        onAward={toggleAward}
      />
    </div>
  );
}
