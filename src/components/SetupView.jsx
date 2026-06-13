/* ====================================================================
   SETUP VIEW (enter players, then start the game)
   ==================================================================== */

import { useState } from "react";
import { ChevronLeft, Users, X, Plus, Play } from "lucide-react";
import { FOCUS, inputCls, Button, IconButton, TypeBadge } from "./ui.jsx";

/** Player-entry screen shown before a game starts. */
export default function SetupView({ quiz, defaults, onStart, onBack }) {
  const [names, setNames] = useState(defaults.length ? defaults : ["", ""]);
  const valid = names.some((n) => n.trim());
  return (
    <div className="mx-auto max-w-md px-6 pb-16 pt-6">
      <button
        onClick={onBack}
        className={`mb-8 inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <ChevronLeft size={16} /> Back
      </button>
      <div className="mb-2 flex items-center gap-2 text-stone-400">
        <Users size={18} />
        <span className="text-sm font-medium uppercase tracking-wide">Players or teams</span>
      </div>
      <h2 className="text-3xl font-bold tracking-tight">{quiz.title}</h2>
      <div className="mt-1 flex flex-wrap gap-1.5 pt-2">
        {quiz.rounds.map((r) => (
          <TypeBadge key={r.id} type={r.type} />
        ))}
      </div>
      <div className="mt-8 space-y-2">
        {names.map((n, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={inputCls}
              placeholder={`Player ${i + 1}`}
              value={n}
              onChange={(e) => setNames(names.map((x, j) => (j === i ? e.target.value : x)))}
            />
            {names.length > 1 && (
              <IconButton
                label="Remove player"
                onClick={() => setNames(names.filter((_, j) => j !== i))}
                className="hover:text-red-600"
              >
                <X size={16} />
              </IconButton>
            )}
          </div>
        ))}
        <button
          onClick={() => setNames([...names, ""])}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
        >
          <Plus size={15} /> Add player
        </button>
      </div>
      <Button
        className="mt-8 w-full px-6 py-3.5 text-base"
        disabled={!valid}
        onClick={() => onStart(names.map((n) => n.trim()).filter(Boolean))}
      >
        <Play size={18} /> Start game
      </Button>
    </div>
  );
}
