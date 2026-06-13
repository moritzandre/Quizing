/* ====================================================================
   BUILDER (create and edit quizzes)
   ==================================================================== */

import { useState } from "react";
import { ChevronLeft, ChevronUp, ChevronDown, Plus } from "lucide-react";
import { uid, ytId, makeQuestion, makeCategory, makeRound } from "../lib/model.js";
import { TYPES, FOCUS, inputCls, Button, IconButton, TypeBadge, ConfirmDelete } from "./ui.jsx";
import WorldMap from "./WorldMap.jsx";

/** Quiz editor; works on a draft copy and hands the result to onSave. */
export default function Builder({ initial, note, onSave, onCancel }) {
  const [quiz, setQuiz] = useState(initial);
  const [picker, setPicker] = useState(false);

  const setRound = (rid, patch) =>
    setQuiz({ ...quiz, rounds: quiz.rounds.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });
  const moveRound = (idx, dir) => {
    const rounds = [...quiz.rounds];
    const j = idx + dir;
    if (j < 0 || j >= rounds.length) return;
    [rounds[idx], rounds[j]] = [rounds[j], rounds[idx]];
    setQuiz({ ...quiz, rounds });
  };
  const addRound = (type) => {
    setQuiz({ ...quiz, rounds: [...quiz.rounds, makeRound(type)] });
    setPicker(false);
  };
  const qRow = (r, item, patch) =>
    setRound(r.id, { questions: r.questions.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) });
  const qDel = (r, item) => setRound(r.id, { questions: r.questions.filter((x) => x.id !== item.id) });
  const setCat = (r, cid, patch) =>
    setRound(r.id, { categories: r.categories.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
  const setCatQ = (r, c, item, patch) =>
    setCat(r, c.id, { questions: c.questions.map((y) => (y.id === item.id ? { ...y, ...patch } : y)) });

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onCancel}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 hover:bg-stone-100 ${FOCUS}`}
        >
          <ChevronLeft size={16} /> Cancel
        </button>
        <Button
          className="px-5 py-2.5"
          onClick={() => onSave({ ...quiz, title: quiz.title.trim() || "Untitled quiz" })}
        >
          Save quiz
        </Button>
      </div>
      {note && <p className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">{note}</p>}
      <input
        className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight placeholder-stone-300 focus:outline-none"
        placeholder="Quiz title…"
        value={quiz.title}
        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
      />

      <div className="mt-8 space-y-6">
        {quiz.rounds.map((r, idx) => {
          const T = TYPES[r.type];
          return (
            <div key={r.id} className="rounded-2xl border border-stone-200 bg-white p-4 md:p-5">
              <div className="mb-4 flex items-center gap-2">
                <TypeBadge type={r.type} />
                <input
                  className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1 font-semibold placeholder-stone-300 focus:outline-none"
                  placeholder={`${T.label} round title…`}
                  value={r.title}
                  onChange={(e) => setRound(r.id, { title: e.target.value })}
                />
                <IconButton label="Move round up" onClick={() => moveRound(idx, -1)}>
                  <ChevronUp size={15} />
                </IconButton>
                <IconButton label="Move round down" onClick={() => moveRound(idx, 1)}>
                  <ChevronDown size={15} />
                </IconButton>
                <ConfirmDelete
                  label="Delete round"
                  onConfirm={() => setQuiz({ ...quiz, rounds: quiz.rounds.filter((x) => x.id !== r.id) })}
                />
              </div>

              {/* classic */}
              {r.type === "classic" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => (
                    <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                        <span>Question {i + 1}</span>
                        <ConfirmDelete label="Delete question" onConfirm={() => qDel(r, item)} />
                      </div>
                      <input
                        className={inputCls}
                        placeholder="Question"
                        value={item.q}
                        onChange={(e) => qRow(r, item, { q: e.target.value })}
                      />
                      <div className="mt-2 flex gap-2">
                        <input
                          className={inputCls}
                          placeholder="Answer"
                          value={item.a}
                          onChange={(e) => qRow(r, item, { a: e.target.value })}
                        />
                        <input
                          type="number"
                          aria-label="Points"
                          className={`${inputCls} w-20`}
                          title="Points"
                          value={item.points}
                          onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("classic")] })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                  >
                    <Plus size={15} /> Add question
                  </button>
                </div>
              )}

              {/* jeopardy */}
              {r.type === "jeopardy" && (
                <div className="space-y-4">
                  {r.categories.map((c) => (
                    <div key={c.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          className={inputCls}
                          placeholder="Category name"
                          value={c.name}
                          onChange={(e) => setCat(r, c.id, { name: e.target.value })}
                        />
                        <ConfirmDelete
                          label="Delete category"
                          onConfirm={() => setRound(r.id, { categories: r.categories.filter((x) => x.id !== c.id) })}
                        />
                      </div>
                      <div className="space-y-2">
                        {c.questions.map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              aria-label="Points"
                              className={`${inputCls} w-20`}
                              value={item.points}
                              onChange={(e) => setCatQ(r, c, item, { points: +e.target.value || 0 })}
                            />
                            <input
                              className={`${inputCls} min-w-32 flex-1`}
                              placeholder="Clue"
                              value={item.clue}
                              onChange={(e) => setCatQ(r, c, item, { clue: e.target.value })}
                            />
                            <input
                              className={`${inputCls} min-w-28 flex-1`}
                              placeholder="Answer"
                              value={item.answer}
                              onChange={(e) => setCatQ(r, c, item, { answer: e.target.value })}
                            />
                            <ConfirmDelete
                              label="Delete clue"
                              onConfirm={() =>
                                setCat(r, c.id, { questions: c.questions.filter((y) => y.id !== item.id) })
                              }
                            />
                          </div>
                        ))}
                        <button
                          onClick={() =>
                            setCat(r, c.id, {
                              questions: [
                                ...c.questions,
                                { id: uid(), clue: "", answer: "", points: (c.questions.length + 1) * 100 },
                              ],
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                        >
                          <Plus size={13} /> Add clue
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setRound(r.id, { categories: [...r.categories, makeCategory()] })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                  >
                    <Plus size={15} /> Add category
                  </button>
                </div>
              )}

              {/* hints */}
              {r.type === "hints" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => (
                    <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                        <span>Item {i + 1}</span>
                        <ConfirmDelete label="Delete item" onConfirm={() => qDel(r, item)} />
                      </div>
                      <input
                        className={inputCls}
                        placeholder="The answer (who/what is it?)"
                        value={item.answer}
                        onChange={(e) => qRow(r, item, { answer: e.target.value })}
                      />
                      <textarea
                        rows={4}
                        className={`${inputCls} mt-2`}
                        placeholder={"One hint per line — hardest first…"}
                        value={item.hints.join("\n")}
                        onChange={(e) => qRow(r, item, { hints: e.target.value.split("\n") })}
                      />
                      <p className="mt-1 text-xs text-stone-400">
                        {item.hints.filter((h) => h.trim()).length || 0} hints · starts at{" "}
                        {(item.hints.length || 1) * 10} pts, −10 per extra hint
                      </p>
                    </div>
                  ))}
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("hints")] })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                  >
                    <Plus size={15} /> Add item
                  </button>
                </div>
              )}

              {/* video */}
              {r.type === "video" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => {
                    const ok = ytId(item.url);
                    return (
                      <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                          <span>Clip {i + 1}</span>
                          <ConfirmDelete label="Delete clip" onConfirm={() => qDel(r, item)} />
                        </div>
                        <input
                          className={inputCls}
                          placeholder="YouTube link (e.g. https://youtu.be/…)"
                          value={item.url}
                          onChange={(e) => qRow(r, item, { url: e.target.value })}
                        />
                        <p
                          className={`mt-1 text-xs ${item.url ? (ok ? "text-emerald-600" : "text-red-500") : "text-stone-400"}`}
                        >
                          {item.url
                            ? ok
                              ? "✓ Video link recognised"
                              : "Couldn't read a video ID from that link"
                            : "Paste any YouTube URL"}
                        </p>
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder="Question (read after the clip)"
                          value={item.q}
                          onChange={(e) => qRow(r, item, { q: e.target.value })}
                        />
                        <div className="mt-2 flex gap-2">
                          <input
                            className={inputCls}
                            placeholder="Answer"
                            value={item.a}
                            onChange={(e) => qRow(r, item, { a: e.target.value })}
                          />
                          <input
                            type="number"
                            aria-label="Points"
                            className={`${inputCls} w-20`}
                            title="Points"
                            value={item.points}
                            onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("video")] })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                  >
                    <Plus size={15} /> Add clip
                  </button>
                </div>
              )}

              {/* map */}
              {r.type === "map" && (
                <div className="space-y-3">
                  {r.questions.map((item, i) => (
                    <div key={item.id} className="rounded-xl bg-stone-50 p-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-stone-400">
                        <span>Place {i + 1}</span>
                        <ConfirmDelete label="Delete place" onConfirm={() => qDel(r, item)} />
                      </div>
                      <input
                        className={inputCls}
                        placeholder="Question (e.g. Where is Machu Picchu?)"
                        value={item.q}
                        onChange={(e) => qRow(r, item, { q: e.target.value })}
                      />
                      <input
                        className={`${inputCls} mt-2`}
                        placeholder="Location label shown on reveal"
                        value={item.name}
                        onChange={(e) => qRow(r, item, { name: e.target.value })}
                      />
                      <div className="mt-2">
                        <WorldMap
                          pin={item.lat != null ? { lat: item.lat, lng: item.lng, label: item.name } : null}
                          onPick={(lat, lng) => qRow(r, item, { lat, lng })}
                        />
                        <p className="mt-1 text-xs text-stone-400">
                          {item.lat != null
                            ? `Pinned at ${item.lat}, ${item.lng} — click the map to move it`
                            : "Click the map to place the pin"}
                        </p>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("map")] })}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 hover:bg-stone-100 ${FOCUS}`}
                  >
                    <Plus size={15} /> Add place
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        {picker ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-stone-500">Choose a round format</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPES).map(([key, t]) => {
                const Icon = t.icon;
                return (
                  <button
                    key={key}
                    onClick={() => addRound(key)}
                    className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium hover:border-stone-400 ${FOCUS}`}
                  >
                    <Icon size={16} className="text-stone-500" /> {t.label}
                  </button>
                );
              })}
              <button
                onClick={() => setPicker(false)}
                className={`rounded-xl px-3 py-2.5 text-sm text-stone-400 hover:bg-stone-100 ${FOCUS}`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPicker(true)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-4 font-medium text-stone-500 hover:border-stone-400 hover:text-stone-700 ${FOCUS}`}
          >
            <Plus size={18} /> Add round
          </button>
        )}
      </div>
    </div>
  );
}
