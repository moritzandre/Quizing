/* ====================================================================
   BUILDER (create and edit quizzes)
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Plus, GripVertical, TimerReset, Upload, ImagePlus, Loader2 } from "lucide-react";
import {
  uid,
  ytId,
  fileToDataUrl,
  makeQuestion,
  makeCategory,
  makeRound,
  moveItem,
  MORPH_EFFECTS,
} from "../lib/model.js";
import { TYPES, FOCUS, inputCls, cardCls, Button, IconButton, TypeBadge, ConfirmDelete } from "./ui.jsx";
import LeafletMap from "./LeafletMap.jsx";

const addBtnCls = `inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 ${FOCUS}`;
const panelCls = "rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50";
const rowLabelCls = "mb-1 flex items-center justify-between text-xs text-stone-400 dark:text-stone-500";

/** Drag handle button; spread the props provided by SortableList onto it. */
function DragHandle(props) {
  return (
    <button
      type="button"
      className={`cursor-grab rounded-lg p-1.5 text-stone-300 transition hover:bg-stone-100 hover:text-stone-500 active:cursor-grabbing dark:text-stone-600 dark:hover:bg-stone-800 ${FOCUS}`}
      {...props}
    >
      <GripVertical size={15} />
    </button>
  );
}

/**
 * Render a vertically sortable list (native HTML5 drag-and-drop). Dragging is
 * gated to the handle: `children(item, index, handleProps)` must spread
 * handleProps onto a DragHandle so a drag only starts from there.
 */
function SortableList({ items, getKey, onReorder, gap = "space-y-3", itemClassName = "", children }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  // A row is only draggable while its handle is held, so inputs inside the
  // row keep normal text selection the rest of the time.
  const [armedIdx, setArmedIdx] = useState(null);
  const reset = () => {
    setDragIdx(null);
    setOverIdx(null);
    setArmedIdx(null);
  };
  // Disarm on any pointer release, even if it lands off the handle or no drag
  // ever started — otherwise a row could stay permanently draggable.
  useEffect(() => {
    if (armedIdx === null) return;
    const clear = () => setArmedIdx(null);
    window.addEventListener("mouseup", clear);
    window.addEventListener("touchend", clear);
    window.addEventListener("touchcancel", clear);
    return () => {
      window.removeEventListener("mouseup", clear);
      window.removeEventListener("touchend", clear);
      window.removeEventListener("touchcancel", clear);
    };
  }, [armedIdx]);
  return (
    <div className={gap}>
      {items.map((item, i) => (
        <div
          key={getKey(item)}
          draggable={armedIdx === i}
          onDragStart={(e) => {
            if (armedIdx !== i) return e.preventDefault();
            setDragIdx(i);
            e.dataTransfer.effectAllowed = "move";
            try {
              e.dataTransfer.setData("text/plain", String(i));
            } catch {
              /* some browsers disallow setData here; drag still works */
            }
          }}
          onDragOver={(e) => {
            if (dragIdx === null) return;
            e.preventDefault();
            if (overIdx !== i) setOverIdx(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragIdx !== null && dragIdx !== i) onReorder(dragIdx, i);
            reset();
          }}
          onDragEnd={reset}
          className={`${itemClassName} transition ${dragIdx === i ? "opacity-40" : ""} ${
            overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-2 ring-indigo-400" : ""
          }`}
        >
          {children(item, i, {
            "aria-label": "Drag to reorder",
            title: "Drag to reorder",
            onMouseDown: () => setArmedIdx(i),
            onTouchStart: () => setArmedIdx(i),
          })}
        </div>
      ))}
    </div>
  );
}

/** Picture field: paste a URL or upload an image (downscaled to a data URL). */
function ImageField({ value, onChange }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const isData = value.startsWith("data:");
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setErr("");
    try {
      onChange(await fileToDataUrl(file));
    } catch (ex) {
      setErr(ex?.message || "Couldn't load that image.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder="Image URL (https://…) or upload →"
          value={isData ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          disabled={busy}
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
        <Button
          variant="outline"
          className="shrink-0 px-3 py-2"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
          Upload
        </Button>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
      {value ? (
        <div className="relative mt-2">
          <img
            src={value}
            alt="Preview"
            className="max-h-56 w-full rounded-xl border border-stone-200 bg-white object-contain dark:border-stone-700 dark:bg-stone-900"
            onError={() => setErr("That image didn't load — check the URL.")}
          />
          <button
            onClick={() => onChange("")}
            className={`absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-stone-600 shadow-sm transition hover:text-red-600 dark:bg-stone-900/90 dark:text-stone-300 ${FOCUS}`}
          >
            Remove
          </button>
          {isData && (
            <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">Uploaded image (stored in the quiz)</p>
          )}
        </div>
      ) : (
        <div className="mt-2 flex aspect-[3/1] w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
          <ImagePlus size={20} className="mr-2" /> No picture yet
        </div>
      )}
    </div>
  );
}

/** Quiz editor; works on a draft copy and hands the result to onSave. */
export default function Builder({ initial, note, onSave, onCancel }) {
  const [quiz, setQuiz] = useState(initial);
  const [picker, setPicker] = useState(false);

  const setRound = (rid, patch) =>
    setQuiz({ ...quiz, rounds: quiz.rounds.map((r) => (r.id === rid ? { ...r, ...patch } : r)) });
  const reorderRounds = (from, to) => setQuiz({ ...quiz, rounds: moveItem(quiz.rounds, from, to) });
  const reorderQuestions = (r, from, to) => setRound(r.id, { questions: moveItem(r.questions, from, to) });
  const reorderCategories = (r, from, to) => setRound(r.id, { categories: moveItem(r.categories, from, to) });
  const setTimer = (r, raw) => {
    const v = raw.trim();
    setRound(r.id, { timer: v === "" ? null : Math.max(0, Math.round(+v)) || null });
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
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-stone-500 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
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
      {note && (
        <p className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {note}
        </p>
      )}
      <input
        className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight placeholder-stone-300 focus:outline-none dark:placeholder-stone-600"
        placeholder="Quiz title…"
        value={quiz.title}
        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
      />

      <SortableList items={quiz.rounds} getKey={(r) => r.id} onReorder={reorderRounds} gap="mt-8 space-y-6">
        {(r, idx, handleProps) => {
          const T = TYPES[r.type];
          const timed = r.timer != null;
          return (
            <div className={`${cardCls} p-4 shadow-sm md:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <DragHandle {...handleProps} />
                <TypeBadge type={r.type} />
                <input
                  className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1 font-semibold placeholder-stone-300 focus:outline-none dark:placeholder-stone-600"
                  placeholder={`${T.label} round title…`}
                  value={r.title}
                  onChange={(e) => setRound(r.id, { title: e.target.value })}
                />
                <label
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
                    timed
                      ? "border-indigo-200 text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-300"
                      : "border-stone-200 text-stone-400 dark:border-stone-700 dark:text-stone-500"
                  }`}
                  title="Seconds per question (blank = no timer)"
                >
                  <TimerReset size={13} />
                  <input
                    type="number"
                    min="0"
                    aria-label="Seconds per question"
                    className="w-9 bg-transparent text-center focus:outline-none"
                    placeholder="—"
                    value={r.timer ?? ""}
                    onChange={(e) => setTimer(r, e.target.value)}
                  />
                  s
                </label>
                <ConfirmDelete
                  label="Delete round"
                  onConfirm={() => setQuiz({ ...quiz, rounds: quiz.rounds.filter((x) => x.id !== r.id) })}
                />
              </div>

              {/* classic */}
              {r.type === "classic" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, t) => reorderQuestions(r, f, t)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> Question {i + 1}
                          </span>
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
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("classic")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add question
                  </button>
                </>
              )}

              {/* jeopardy */}
              {r.type === "jeopardy" && (
                <>
                  <SortableList
                    items={r.categories}
                    getKey={(c) => c.id}
                    onReorder={(f, t) => reorderCategories(r, f, t)}
                    gap="space-y-4"
                  >
                    {(c, _ci, hp) => (
                      <div className={panelCls}>
                        <div className="mb-2 flex items-center gap-2">
                          <DragHandle {...hp} />
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
                            className={`rounded-lg px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 ${FOCUS} inline-flex items-center gap-1`}
                          >
                            <Plus size={13} /> Add clue
                          </button>
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { categories: [...r.categories, makeCategory()] })}
                    className={`mt-4 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add category
                  </button>
                </>
              )}

              {/* hints */}
              {r.type === "hints" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, t) => reorderQuestions(r, f, t)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> Item {i + 1}
                          </span>
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
                        <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                          {item.hints.filter((h) => h.trim()).length || 0} hints · starts at{" "}
                          {(item.hints.filter((h) => h.trim()).length || 1) * 10} pts, −10 per extra hint
                        </p>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("hints")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add item
                  </button>
                </>
              )}

              {/* video */}
              {r.type === "video" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, t) => reorderQuestions(r, f, t)}
                  >
                    {(item, i, hp) => {
                      const ok = ytId(item.url);
                      return (
                        <div className={panelCls}>
                          <div className={rowLabelCls}>
                            <span className="flex items-center gap-1">
                              <DragHandle {...hp} /> Clip {i + 1}
                            </span>
                            <ConfirmDelete label="Delete clip" onConfirm={() => qDel(r, item)} />
                          </div>
                          <input
                            className={inputCls}
                            placeholder="YouTube link (e.g. https://youtu.be/…)"
                            value={item.url}
                            onChange={(e) => qRow(r, item, { url: e.target.value })}
                          />
                          <p
                            className={`mt-1 text-xs ${item.url ? (ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500") : "text-stone-400 dark:text-stone-500"}`}
                          >
                            {item.url
                              ? ok
                                ? "✓ Video link recognised"
                                : "Couldn't read a video ID from that link"
                              : "Paste any YouTube URL"}
                          </p>
                          <label className="mt-2 inline-flex cursor-pointer select-none items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded accent-indigo-600"
                              checked={!!item.audioOnly}
                              onChange={(e) => qRow(r, item, { audioOnly: e.target.checked })}
                            />
                            Audio only — hide the video, play just the sound
                          </label>
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
                    }}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("video")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add clip
                  </button>
                </>
              )}

              {/* image */}
              {r.type === "image" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, t) => reorderQuestions(r, f, t)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> Picture {i + 1}
                          </span>
                          <ConfirmDelete label="Delete picture" onConfirm={() => qDel(r, item)} />
                        </div>
                        <ImageField value={item.url} onChange={(url) => qRow(r, item, { url })} />
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder="Question (e.g. What is this?)"
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
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("image")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add picture
                  </button>
                </>
              )}

              {/* morph */}
              {r.type === "morph" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, t) => reorderQuestions(r, f, t)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> Picture {i + 1}
                          </span>
                          <ConfirmDelete label="Delete picture" onConfirm={() => qDel(r, item)} />
                        </div>
                        <ImageField value={item.url} onChange={(url) => qRow(r, item, { url })} />
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder="Answer"
                          value={item.a}
                          onChange={(e) => qRow(r, item, { a: e.target.value })}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select
                            aria-label="Reveal effect"
                            className={`${inputCls} w-32`}
                            value={item.effect}
                            onChange={(e) => qRow(r, item, { effect: e.target.value })}
                          >
                            {MORPH_EFFECTS.map((eff) => (
                              <option key={eff} value={eff}>
                                {eff === "blur" ? "De-blur" : eff === "pixelate" ? "Pixelate" : "Tiles"}
                              </option>
                            ))}
                          </select>
                          <label className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-2 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                            Steps
                            <input
                              type="number"
                              min="1"
                              max="8"
                              aria-label="Demorph steps"
                              className="w-12 bg-transparent py-2 text-center focus:outline-none"
                              value={item.steps}
                              onChange={(e) => qRow(r, item, { steps: Math.max(1, Math.min(8, +e.target.value || 4)) })}
                            />
                          </label>
                          <input
                            type="number"
                            aria-label="Points"
                            className={`${inputCls} w-24`}
                            title="Full points (when most obscured)"
                            value={item.points}
                            onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })}
                          />
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("morph")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add picture
                  </button>
                </>
              )}

              {/* map */}
              {r.type === "map" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, t) => reorderQuestions(r, f, t)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> Place {i + 1}
                          </span>
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
                          <LeafletMap
                            answer={item.lat != null ? { lat: item.lat, lng: item.lng, label: item.name } : undefined}
                            onPick={(lat, lng) => qRow(r, item, { lat, lng })}
                            className="h-72"
                          />
                          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                            {item.lat != null
                              ? `Pinned at ${item.lat}, ${item.lng} — click the map to move it`
                              : "Click the map to place the pin"}
                          </p>
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("map")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> Add place
                  </button>
                </>
              )}
            </div>
          );
        }}
      </SortableList>

      <div className="mt-6">
        {picker ? (
          <div className={`${cardCls} p-4`}>
            <p className="mb-3 text-sm font-medium text-stone-500 dark:text-stone-400">Choose a round format</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPES).map(([key, t]) => {
                const Icon = t.icon;
                return (
                  <button
                    key={key}
                    onClick={() => addRound(key)}
                    className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium transition hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:hover:border-stone-500 dark:hover:bg-stone-800 ${FOCUS}`}
                  >
                    <Icon size={16} className="text-stone-500 dark:text-stone-400" /> {t.label}
                  </button>
                );
              })}
              <button
                onClick={() => setPicker(false)}
                className={`rounded-xl px-3 py-2.5 text-sm text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPicker(true)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-4 font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200 ${FOCUS}`}
          >
            <Plus size={18} /> Add round
          </button>
        )}
      </div>
    </div>
  );
}
