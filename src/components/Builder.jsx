/* ====================================================================
   BUILDER (create and edit quizzes)
   ==================================================================== */

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  Plus,
  GripVertical,
  TimerReset,
  Upload,
  ImagePlus,
  Loader2,
  Crop as CropIcon,
  Sparkles,
} from "lucide-react";
import {
  uid,
  ytId,
  fileToDataUrl,
  makeQuestion,
  makeCategory,
  makeRound,
  moveItem,
  makeHint,
  hintHasContent,
  normalizeQuiz,
  MORPH_EFFECTS,
  HINT_TYPES,
} from "../lib/model.js";
import { TYPES, FOCUS, inputCls, cardCls, Button, IconButton, TypeBadge, ConfirmDelete } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { ROUND_TEMPLATES } from "../data/templates.js";
import LeafletMap from "./LeafletMap.jsx";
import MapillaryEmbed from "./MapillaryEmbed.jsx";

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
  const { t } = useI18n();
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
            "aria-label": t("builder.dragToReorder"),
            title: t("builder.dragToReorder"),
            onMouseDown: () => setArmedIdx(i),
            onTouchStart: () => setArmedIdx(i),
          })}
        </div>
      ))}
    </div>
  );
}

/** Crop an image in a modal (cropperjs is lazy-loaded so it stays out of the home bundle). */
function CropModal({ src, onApply, onClose, t }) {
  const imgRef = useRef(null);
  const cropperRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [loading, setLoading] = useState(true);

  // Key only on the image source so an unrelated parent re-render can't tear
  // down and re-init the live cropper (which would reset the user's selection).
  useEffect(() => {
    let alive = true;
    let cropper = null;
    (async () => {
      try {
        const [{ default: Cropper }] = await Promise.all([import("cropperjs"), import("cropperjs/dist/cropper.css")]);
        if (!alive || !imgRef.current) return;
        cropper = new Cropper(imgRef.current, {
          viewMode: 1,
          autoCropArea: 1,
          background: false,
          ready: () => alive && setLoading(false),
        });
        cropperRef.current = cropper;
      } catch {
        if (alive) onCloseRef.current();
      }
    })();
    return () => {
      alive = false;
      cropper?.destroy?.();
      cropperRef.current = null;
    };
  }, [src]);

  const apply = () => {
    const c = cropperRef.current;
    if (!c) return;
    const canvas = c.getCroppedCanvas({ maxWidth: 1400, maxHeight: 1400, imageSmoothingQuality: "high" });
    if (canvas) onApply(canvas.toDataURL("image/jpeg", 0.82));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-4 shadow-xl dark:border-stone-800 dark:bg-stone-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <CropIcon size={18} /> {t("builder.cropImage")}
          </h3>
          <IconButton label={t("common.cancel")} onClick={onClose}>
            <ChevronLeft size={16} />
          </IconButton>
        </div>
        <div className="relative max-h-[60vh] overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
          <img ref={imgRef} src={src} alt="" className="block max-w-full" style={{ maxHeight: "60vh" }} />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-stone-400">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={apply} disabled={loading}>
            <CropIcon size={16} /> {t("builder.applyCrop")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Picture field: paste a URL or upload an image (downscaled to a data URL). */
function ImageField({ value, onChange }) {
  const { t } = useI18n();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [cropping, setCropping] = useState(false);
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
      setErr(ex?.message || t("builder.couldntProcess"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <div className="flex gap-2">
        <input
          className={inputCls}
          placeholder={t("builder.imageUrl")}
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
          {t("builder.upload")}
        </Button>
      </div>
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
      {value ? (
        <div className="relative mt-2">
          <img
            src={value}
            alt="Preview"
            className="max-h-56 w-full rounded-xl border border-stone-200 bg-white object-contain dark:border-stone-700 dark:bg-stone-900"
            onError={() => setErr(t("builder.imageLoadErr"))}
          />
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              onClick={() => setCropping(true)}
              className={`inline-flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-stone-600 shadow-sm transition hover:text-indigo-600 dark:bg-stone-900/90 dark:text-stone-300 ${FOCUS}`}
            >
              <CropIcon size={12} /> {t("builder.crop")}
            </button>
            <button
              onClick={() => onChange("")}
              className={`rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-stone-600 shadow-sm transition hover:text-red-600 dark:bg-stone-900/90 dark:text-stone-300 ${FOCUS}`}
            >
              {t("builder.remove")}
            </button>
          </div>
          {isData && <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{t("builder.uploadedImage")}</p>}
        </div>
      ) : (
        <div className="mt-2 flex aspect-[3/1] w-full items-center justify-center rounded-xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
          <ImagePlus size={20} className="mr-2" /> {t("builder.noPictureYet")}
        </div>
      )}
      {cropping && (
        <CropModal
          src={value}
          onApply={(url) => {
            onChange(url);
            setCropping(false);
          }}
          onClose={() => setCropping(false)}
          t={t}
        />
      )}
    </div>
  );
}

const HINT_TYPE_KEY = {
  text: "builder.hintTypeText",
  image: "builder.hintTypeImage",
  audio: "builder.hintTypeAudio",
  video: "builder.hintTypeVideo",
  map: "builder.hintTypeMap",
};
const hintTypeOf = (h) => (typeof h === "string" ? "text" : HINT_TYPES.includes(h?.type) ? h.type : "text");

/** Start/end (seconds) trim inputs for audio/video; null = no bound. */
function TrimInputs({ start, end, onChange, t }) {
  const toSec = (v) => (v === "" ? null : Math.max(0, +v || 0));
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-stone-400 dark:text-stone-500">{t("builder.trim")}</span>
      <input
        type="number"
        min="0"
        placeholder={t("builder.startSec")}
        className={`${inputCls} w-24 py-1`}
        value={start ?? ""}
        onChange={(e) => onChange({ start: toSec(e.target.value) })}
      />
      <input
        type="number"
        min="0"
        placeholder={t("builder.endSec")}
        className={`${inputCls} w-24 py-1`}
        value={end ?? ""}
        onChange={(e) => onChange({ end: toSec(e.target.value) })}
      />
    </div>
  );
}

function HintsField({ hints, onChange, t }) {
  const set = (i, val) => onChange(hints.map((h, j) => (j === i ? val : h)));
  const del = (i) => onChange(hints.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= hints.length) return;
    const copy = [...hints];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const count = hints.filter(hintHasContent).length;
  return (
    <div className="space-y-2">
      {hints.map((h, i) => {
        const type = hintTypeOf(h);
        return (
          <div key={i} className="rounded-lg border border-stone-200 p-2 dark:border-stone-700">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-xs font-bold text-stone-400 dark:text-stone-500">{i + 1}</span>
              <select
                value={type}
                onChange={(e) => set(i, makeHint(e.target.value))}
                aria-label={t("builder.hintType")}
                className={`${inputCls} w-28 py-1`}
              >
                {HINT_TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(HINT_TYPE_KEY[ty])}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex items-center">
                <IconButton label={t("builder.moveUp")} onClick={() => move(i, -1)}>
                  <ChevronUp size={14} />
                </IconButton>
                <IconButton label={t("builder.moveDown")} onClick={() => move(i, 1)}>
                  <ChevronDown size={14} />
                </IconButton>
                <ConfirmDelete label={t("builder.deleteHint")} onConfirm={() => del(i)} />
              </div>
            </div>
            {type === "text" && (
              <input
                className={inputCls}
                placeholder={t("builder.hintText")}
                value={typeof h === "string" ? h : ""}
                onChange={(e) => set(i, e.target.value)}
              />
            )}
            {type === "image" && <ImageField value={h.url || ""} onChange={(url) => set(i, { type: "image", url })} />}
            {type === "audio" && (
              <>
                <input
                  className={inputCls}
                  placeholder={t("builder.audioUrl")}
                  value={h.url || ""}
                  onChange={(e) => set(i, { ...h, type: "audio", url: e.target.value })}
                />
                <TrimInputs start={h.start} end={h.end} onChange={(p) => set(i, { ...h, type: "audio", ...p })} t={t} />
              </>
            )}
            {type === "video" && (
              <>
                <input
                  className={inputCls}
                  placeholder={t("builder.videoUrl")}
                  value={h.url || ""}
                  onChange={(e) => set(i, { ...h, type: "video", url: e.target.value })}
                />
                <TrimInputs start={h.start} end={h.end} onChange={(p) => set(i, { ...h, type: "video", ...p })} t={t} />
              </>
            )}
            {type === "map" && (
              <div>
                <input
                  className={`${inputCls} mb-2`}
                  placeholder={t("builder.locationLabel")}
                  value={h.name || ""}
                  onChange={(e) =>
                    set(i, { type: "map", lat: h.lat ?? null, lng: h.lng ?? null, name: e.target.value })
                  }
                />
                <LeafletMap
                  answer={h.lat != null ? { lat: h.lat, lng: h.lng, label: h.name } : undefined}
                  onPick={(lat, lng) => set(i, { type: "map", lat, lng, name: h.name || "" })}
                  className="h-56"
                />
              </div>
            )}
          </div>
        );
      })}
      <button
        onClick={() => onChange([...hints, makeHint("text")])}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 ${FOCUS}`}
      >
        <Plus size={13} /> {t("builder.addHint")}
      </button>
      <p className="text-xs text-stone-400 dark:text-stone-500">
        {t("builder.hintsSummary", { count, pts: (count || 1) * 10 })}
      </p>
    </div>
  );
}

/** Quiz editor; works on a draft copy and hands the result to onSave. */
export default function Builder({ initial, note, onSave, onCancel }) {
  const { t } = useI18n();
  const [quiz, setQuiz] = useState(initial);
  const [picker, setPicker] = useState(false);

  // Functional updaters so back-to-back writes in one event compose (e.g. the
  // map search sets {lat,lng} and {name} in the same tick) instead of clobbering.
  const setRound = (rid, patch) =>
    setQuiz((prev) => ({ ...prev, rounds: prev.rounds.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }));
  const reorderRounds = (from, to) => setQuiz((prev) => ({ ...prev, rounds: moveItem(prev.rounds, from, to) }));
  const reorderQuestions = (r, from, to) => setRound(r.id, { questions: moveItem(r.questions, from, to) });
  const reorderCategories = (r, from, to) => setRound(r.id, { categories: moveItem(r.categories, from, to) });
  const setTimer = (r, raw) => {
    const v = raw.trim();
    setRound(r.id, { timer: v === "" ? null : Math.max(0, Math.round(+v)) || null });
  };
  const addRound = (type) => {
    setQuiz((prev) => ({ ...prev, rounds: [...prev.rounds, makeRound(type)] }));
    setPicker(false);
  };
  // Insert a starter round from a template (normalized so it gets fresh ids).
  const addTemplateRound = (tpl) => {
    const round = normalizeQuiz({ rounds: [tpl.round] })?.rounds?.[0];
    if (round) setQuiz((prev) => ({ ...prev, rounds: [...prev.rounds, round] }));
    setPicker(false);
  };
  const qRow = (r, item, patch) =>
    setQuiz((prev) => ({
      ...prev,
      rounds: prev.rounds.map((rd) =>
        rd.id !== r.id
          ? rd
          : { ...rd, questions: rd.questions.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) },
      ),
    }));
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
          <ChevronLeft size={16} /> {t("common.cancel")}
        </button>
        <Button
          className="px-5 py-2.5"
          onClick={() => onSave({ ...quiz, title: quiz.title.trim() || t("builder.untitledQuiz") })}
        >
          {t("builder.saveQuiz")}
        </Button>
      </div>
      {note && (
        <p className="mb-4 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
          {note}
        </p>
      )}
      <input
        className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight placeholder-stone-300 focus:outline-none dark:placeholder-stone-600"
        placeholder={t("builder.quizTitle")}
        value={quiz.title}
        onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
      />

      <SortableList items={quiz.rounds} getKey={(r) => r.id} onReorder={reorderRounds} gap="mt-8 space-y-6">
        {(r, idx, handleProps) => {
          const timed = r.timer != null;
          return (
            <div className={`${cardCls} p-4 shadow-sm md:p-5`}>
              <div className="mb-4 flex items-center gap-2">
                <DragHandle {...handleProps} />
                <TypeBadge type={r.type} />
                <input
                  className="min-w-0 flex-1 rounded-lg border-0 bg-transparent px-2 py-1 font-semibold placeholder-stone-300 focus:outline-none dark:placeholder-stone-600"
                  placeholder={t("builder.roundTitle", { label: t(`round.${r.type}.label`) })}
                  value={r.title}
                  onChange={(e) => setRound(r.id, { title: e.target.value })}
                />
                <label
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition ${
                    timed
                      ? "border-indigo-200 text-indigo-600 dark:border-indigo-500/40 dark:text-indigo-300"
                      : "border-stone-200 text-stone-400 dark:border-stone-700 dark:text-stone-500"
                  }`}
                  title={t("builder.secondsTitle")}
                >
                  <TimerReset size={13} />
                  <input
                    type="number"
                    min="0"
                    aria-label={t("builder.secondsTitle")}
                    className="w-9 bg-transparent text-center focus:outline-none"
                    placeholder="—"
                    value={r.timer ?? ""}
                    onChange={(e) => setTimer(r, e.target.value)}
                  />
                  s
                </label>
                <ConfirmDelete
                  label={t("builder.deleteRound")}
                  onConfirm={() => setQuiz({ ...quiz, rounds: quiz.rounds.filter((x) => x.id !== r.id) })}
                />
              </div>

              {/* classic */}
              {r.type === "classic" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.questionN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deleteQuestion")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <input
                          className={inputCls}
                          placeholder={t("builder.question")}
                          value={item.q}
                          onChange={(e) => qRow(r, item, { q: e.target.value })}
                        />
                        <div className="mt-2 flex gap-2">
                          <input
                            className={inputCls}
                            placeholder={t("builder.answer")}
                            value={item.a}
                            onChange={(e) => qRow(r, item, { a: e.target.value })}
                          />
                          <input
                            type="number"
                            aria-label={t("builder.points")}
                            className={`${inputCls} w-20`}
                            title={t("builder.points")}
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
                    <Plus size={15} /> {t("builder.addQuestion")}
                  </button>
                </>
              )}

              {/* jeopardy */}
              {r.type === "jeopardy" && (
                <>
                  <SortableList
                    items={r.categories}
                    getKey={(c) => c.id}
                    onReorder={(f, to) => reorderCategories(r, f, to)}
                    gap="space-y-4"
                  >
                    {(c, _ci, hp) => (
                      <div className={panelCls}>
                        <div className="mb-2 flex items-center gap-2">
                          <DragHandle {...hp} />
                          <input
                            className={inputCls}
                            placeholder={t("builder.categoryName")}
                            value={c.name}
                            onChange={(e) => setCat(r, c.id, { name: e.target.value })}
                          />
                          <ConfirmDelete
                            label={t("builder.deleteCategory")}
                            onConfirm={() => setRound(r.id, { categories: r.categories.filter((x) => x.id !== c.id) })}
                          />
                        </div>
                        <div className="space-y-2">
                          {c.questions.map((item) => (
                            <div key={item.id} className="flex flex-wrap items-center gap-2">
                              <input
                                type="number"
                                aria-label={t("builder.points")}
                                className={`${inputCls} w-20`}
                                value={item.points}
                                onChange={(e) => setCatQ(r, c, item, { points: +e.target.value || 0 })}
                              />
                              <input
                                className={`${inputCls} min-w-32 flex-1`}
                                placeholder={t("builder.clue")}
                                value={item.clue}
                                onChange={(e) => setCatQ(r, c, item, { clue: e.target.value })}
                              />
                              <input
                                className={`${inputCls} min-w-28 flex-1`}
                                placeholder={t("builder.answer")}
                                value={item.answer}
                                onChange={(e) => setCatQ(r, c, item, { answer: e.target.value })}
                              />
                              <ConfirmDelete
                                label={t("builder.deleteClue")}
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
                            <Plus size={13} /> {t("builder.addClue")}
                          </button>
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { categories: [...r.categories, makeCategory()] })}
                    className={`mt-4 ${addBtnCls}`}
                  >
                    <Plus size={15} /> {t("builder.addCategory")}
                  </button>
                </>
              )}

              {/* hints */}
              {r.type === "hints" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.itemN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deleteItem")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <input
                          className={`${inputCls} mb-2`}
                          placeholder={t("builder.theAnswer")}
                          value={item.answer}
                          onChange={(e) => qRow(r, item, { answer: e.target.value })}
                        />
                        <HintsField hints={item.hints} onChange={(h) => qRow(r, item, { hints: h })} t={t} />
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("hints")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> {t("builder.addItem", {})}
                  </button>
                </>
              )}

              {/* video */}
              {r.type === "video" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => {
                      const ok = ytId(item.url);
                      return (
                        <div className={panelCls}>
                          <div className={rowLabelCls}>
                            <span className="flex items-center gap-1">
                              <DragHandle {...hp} /> {t("builder.clipN", { n: i + 1 })}
                            </span>
                            <ConfirmDelete label={t("builder.deleteClip")} onConfirm={() => qDel(r, item)} />
                          </div>
                          <input
                            className={inputCls}
                            placeholder={t("builder.ytLink")}
                            value={item.url}
                            onChange={(e) => qRow(r, item, { url: e.target.value })}
                          />
                          <p
                            className={`mt-1 text-xs ${item.url ? (ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500") : "text-stone-400 dark:text-stone-500"}`}
                          >
                            {item.url ? (ok ? t("builder.ytOk") : t("builder.ytBad")) : t("builder.ytPaste")}
                          </p>
                          <label className="mt-2 inline-flex cursor-pointer select-none items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded accent-indigo-600"
                              checked={!!item.audioOnly}
                              onChange={(e) => qRow(r, item, { audioOnly: e.target.checked })}
                            />
                            {t("builder.audioOnly")}
                          </label>
                          <TrimInputs start={item.start} end={item.end} onChange={(p) => qRow(r, item, p)} t={t} />
                          <input
                            className={`${inputCls} mt-2`}
                            placeholder={t("builder.afterClip")}
                            value={item.q}
                            onChange={(e) => qRow(r, item, { q: e.target.value })}
                          />
                          <div className="mt-2 flex gap-2">
                            <input
                              className={inputCls}
                              placeholder={t("builder.answer")}
                              value={item.a}
                              onChange={(e) => qRow(r, item, { a: e.target.value })}
                            />
                            <input
                              type="number"
                              aria-label={t("builder.points")}
                              className={`${inputCls} w-20`}
                              title={t("builder.points")}
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
                    <Plus size={15} /> {t("builder.addClip")}
                  </button>
                </>
              )}

              {/* image */}
              {r.type === "image" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.pictureN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deletePicture")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <ImageField value={item.url} onChange={(url) => qRow(r, item, { url })} />
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder={t("builder.imageQ")}
                          value={item.q}
                          onChange={(e) => qRow(r, item, { q: e.target.value })}
                        />
                        <div className="mt-2 flex gap-2">
                          <input
                            className={inputCls}
                            placeholder={t("builder.answer")}
                            value={item.a}
                            onChange={(e) => qRow(r, item, { a: e.target.value })}
                          />
                          <input
                            type="number"
                            aria-label={t("builder.points")}
                            className={`${inputCls} w-20`}
                            title={t("builder.points")}
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
                    <Plus size={15} /> {t("builder.addPicture")}
                  </button>
                </>
              )}

              {/* morph */}
              {r.type === "morph" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.pictureN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deletePicture")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <ImageField value={item.url} onChange={(url) => qRow(r, item, { url })} />
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder={t("builder.answer")}
                          value={item.a}
                          onChange={(e) => qRow(r, item, { a: e.target.value })}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <select
                            aria-label={t("builder.effect")}
                            className={`${inputCls} w-32`}
                            value={item.effect}
                            onChange={(e) => qRow(r, item, { effect: e.target.value })}
                          >
                            {MORPH_EFFECTS.map((eff) => (
                              <option key={eff} value={eff}>
                                {t(`builder.effect${eff.charAt(0).toUpperCase()}${eff.slice(1)}`)}
                              </option>
                            ))}
                          </select>
                          <label className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-2 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                            {t("builder.steps")}
                            <input
                              type="number"
                              min="1"
                              max="8"
                              aria-label={t("builder.morphSteps")}
                              className="w-12 bg-transparent py-2 text-center focus:outline-none"
                              value={item.steps}
                              onChange={(e) => qRow(r, item, { steps: Math.max(1, Math.min(8, +e.target.value || 4)) })}
                            />
                          </label>
                          <input
                            type="number"
                            aria-label={t("builder.points")}
                            className={`${inputCls} w-24`}
                            title={t("builder.fullPoints")}
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
                    <Plus size={15} /> {t("builder.addPicture")}
                  </button>
                </>
              )}

              {/* fusion */}
              {r.type === "fusion" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.pictureN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deletePicture")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-medium text-stone-400 dark:text-stone-500">
                              {t("builder.imageA")}
                            </p>
                            <ImageField value={item.urlA} onChange={(url) => qRow(r, item, { urlA: url })} />
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-medium text-stone-400 dark:text-stone-500">
                              {t("builder.imageB")}
                            </p>
                            <ImageField value={item.urlB} onChange={(url) => qRow(r, item, { urlB: url })} />
                          </div>
                        </div>
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder={t("builder.fusionAnswer")}
                          value={item.a}
                          onChange={(e) => qRow(r, item, { a: e.target.value })}
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <label className="inline-flex items-center gap-1 rounded-xl border border-stone-200 px-2 text-xs text-stone-500 dark:border-stone-700 dark:text-stone-400">
                            {t("builder.steps")}
                            <input
                              type="number"
                              min="1"
                              max="8"
                              aria-label={t("builder.steps")}
                              className="w-12 bg-transparent py-2 text-center focus:outline-none"
                              value={item.steps}
                              onChange={(e) => qRow(r, item, { steps: Math.max(1, Math.min(8, +e.target.value || 4)) })}
                            />
                          </label>
                          <input
                            type="number"
                            aria-label={t("builder.points")}
                            className={`${inputCls} w-24`}
                            title={t("builder.fullPoints")}
                            value={item.points}
                            onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })}
                          />
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("fusion")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> {t("builder.addPicture")}
                  </button>
                </>
              )}

              {/* choice (multiple choice) */}
              {r.type === "choice" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.questionN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deleteQuestion")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <input
                          className={inputCls}
                          placeholder={t("builder.question")}
                          value={item.q}
                          onChange={(e) => qRow(r, item, { q: e.target.value })}
                        />
                        <div className="mt-2 space-y-1.5">
                          {item.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${item.id}`}
                                checked={item.correct === oi}
                                onChange={() => qRow(r, item, { correct: oi })}
                                title={t("builder.markCorrect")}
                                className="h-4 w-4 shrink-0 accent-emerald-600"
                              />
                              <input
                                className={`${inputCls} flex-1`}
                                placeholder={t("builder.optionN", { n: oi + 1 })}
                                value={opt}
                                onChange={(e) =>
                                  qRow(r, item, {
                                    options: item.options.map((o, j) => (j === oi ? e.target.value : o)),
                                  })
                                }
                              />
                              {item.options.length > 2 && (
                                <ConfirmDelete
                                  label={t("builder.deleteOption")}
                                  onConfirm={() => {
                                    const options = item.options.filter((_, j) => j !== oi);
                                    qRow(r, item, { options, correct: Math.min(item.correct, options.length - 1) });
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {item.options.length < 6 ? (
                            <button
                              onClick={() => qRow(r, item, { options: [...item.options, ""] })}
                              className={`rounded-lg px-2 py-1 text-xs font-medium text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 ${FOCUS} inline-flex items-center gap-1`}
                            >
                              <Plus size={13} /> {t("builder.addOption")}
                            </button>
                          ) : (
                            <span />
                          )}
                          <input
                            type="number"
                            aria-label={t("builder.points")}
                            className={`${inputCls} w-20`}
                            title={t("builder.points")}
                            value={item.points}
                            onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })}
                          />
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("choice")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> {t("builder.addQuestion")}
                  </button>
                </>
              )}

              {/* number (closest guess) */}
              {r.type === "number" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.questionN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deleteQuestion")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <input
                          className={inputCls}
                          placeholder={t("builder.question")}
                          value={item.q}
                          onChange={(e) => qRow(r, item, { q: e.target.value })}
                        />
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            className={`${inputCls} flex-1`}
                            placeholder={t("builder.numberAnswer")}
                            value={item.answer ?? ""}
                            onChange={(e) => qRow(r, item, { answer: e.target.value === "" ? null : +e.target.value })}
                          />
                          <input
                            className={`${inputCls} w-28`}
                            placeholder={t("builder.unit")}
                            value={item.unit}
                            onChange={(e) => qRow(r, item, { unit: e.target.value })}
                          />
                          <input
                            type="number"
                            aria-label={t("builder.points")}
                            className={`${inputCls} w-20`}
                            title={t("builder.points")}
                            value={item.points}
                            onChange={(e) => qRow(r, item, { points: +e.target.value || 0 })}
                          />
                        </div>
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("number")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> {t("builder.addQuestion")}
                  </button>
                </>
              )}

              {/* map */}
              {r.type === "map" && (
                <>
                  <SortableList
                    items={r.questions}
                    getKey={(x) => x.id}
                    onReorder={(f, to) => reorderQuestions(r, f, to)}
                  >
                    {(item, i, hp) => (
                      <div className={panelCls}>
                        <div className={rowLabelCls}>
                          <span className="flex items-center gap-1">
                            <DragHandle {...hp} /> {t("builder.placeN", { n: i + 1 })}
                          </span>
                          <ConfirmDelete label={t("builder.deletePlace")} onConfirm={() => qDel(r, item)} />
                        </div>
                        <input
                          className={inputCls}
                          placeholder={t("builder.mapQ")}
                          value={item.q}
                          onChange={(e) => qRow(r, item, { q: e.target.value })}
                        />
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder={t("builder.locationLabel")}
                          value={item.name}
                          onChange={(e) => qRow(r, item, { name: e.target.value })}
                        />
                        <div className="mt-2 inline-flex rounded-xl border border-stone-200 p-0.5 dark:border-stone-700">
                          {[
                            { k: "map", label: t("builder.layerMap") },
                            { k: "satellite", label: t("builder.layerSatellite") },
                          ].map(({ k, label }) => (
                            <button
                              key={k}
                              onClick={() => qRow(r, item, { tileLayer: k })}
                              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${FOCUS} ${
                                (item.tileLayer || "map") === k
                                  ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                                  : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2">
                          <LeafletMap
                            answer={item.lat != null ? { lat: item.lat, lng: item.lng, label: item.name } : undefined}
                            onPick={(lat, lng) => qRow(r, item, { lat, lng })}
                            onSearchName={(name) => name && qRow(r, item, { name })}
                            tileLayer={item.tileLayer}
                            search
                            mapillary
                            className="h-80"
                          />
                          <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                            {item.lat != null
                              ? t("builder.pinnedAt", { lat: item.lat, lng: item.lng })
                              : t("builder.clickToPin")}
                          </p>
                        </div>
                        <input
                          className={`${inputCls} mt-2`}
                          placeholder={t("builder.streetUrl")}
                          value={item.street || ""}
                          onChange={(e) => qRow(r, item, { street: e.target.value })}
                        />
                        <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{t("builder.streetHint")}</p>
                        {item.street && (
                          <MapillaryEmbed street={item.street} className="mt-2 h-56" empty={t("builder.streetBad")} />
                        )}
                      </div>
                    )}
                  </SortableList>
                  <button
                    onClick={() => setRound(r.id, { questions: [...r.questions, makeQuestion("map")] })}
                    className={`mt-3 ${addBtnCls}`}
                  >
                    <Plus size={15} /> {t("builder.addPlace")}
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
            <p className="mb-3 text-sm font-medium text-stone-500 dark:text-stone-400">{t("builder.chooseFormat")}</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPES).map(([key, meta]) => {
                const Icon = meta.icon;
                return (
                  <button
                    key={key}
                    onClick={() => addRound(key)}
                    className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-medium transition hover:border-stone-400 hover:bg-stone-50 dark:border-stone-700 dark:hover:border-stone-500 dark:hover:bg-stone-800 ${FOCUS}`}
                  >
                    <Icon size={16} className="text-stone-500 dark:text-stone-400" /> {t(`round.${key}.label`)}
                  </button>
                );
              })}
              <button
                onClick={() => setPicker(false)}
                className={`rounded-xl px-3 py-2.5 text-sm text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
              >
                {t("common.cancel")}
              </button>
            </div>

            <p className="mb-2 mt-5 text-sm font-medium text-stone-500 dark:text-stone-400">
              {t("builder.fromTemplate")}
            </p>
            <div className="flex flex-wrap gap-2">
              {ROUND_TEMPLATES.map((tpl) => {
                const Icon = TYPES[tpl.type]?.icon || Sparkles;
                return (
                  <button
                    key={tpl.key}
                    onClick={() => addTemplateRound(tpl)}
                    className={`inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-sm font-medium transition hover:border-indigo-400 hover:bg-indigo-50 dark:border-stone-700 dark:bg-stone-800/50 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 ${FOCUS}`}
                  >
                    <Icon size={16} className="text-indigo-500" />
                    <span className="truncate">{tpl.round.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setPicker(true)}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 px-4 py-4 font-medium text-stone-500 transition hover:border-stone-400 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-200 ${FOCUS}`}
          >
            <Plus size={18} /> {t("builder.addRound")}
          </button>
        )}
      </div>
    </div>
  );
}
