/* ====================================================================
   ANYTHINGLE SHARED WIDGETS
   --------------------------------------------------------------------
   Pure, props-only building blocks shared by the Builder (authoring a
   character), PlayView (the host's inline add/grade panel) and the
   read-only feedback grid (RoundBody → TV + host remote). Seven of the
   ten trait controls are CLOSED (selects / capped chips / number);
   franchise, affiliation and origin are normalized free text — so an
   author or host still produces comparable values.
   ==================================================================== */

import { useState, useRef, useEffect, useId } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { ANYTHINGLE_TRAITS, normText } from "../lib/model.js";
import { Avatar, inputCls, FOCUS } from "./ui.jsx";
import { useI18n } from "../i18n/I18nProvider.jsx";

/** Cell tone by grade result (green = match, yellow = partial/close, grey = miss). */
const CELL = {
  green: "bg-emerald-500 text-white border-emerald-600 dark:border-emerald-400",
  yellow: "bg-amber-400 text-stone-900 border-amber-500",
  grey: "bg-stone-200 text-stone-500 border-stone-300 dark:bg-stone-700 dark:text-stone-400 dark:border-stone-600",
};

/** Comma-joined alias text ⇄ array. */
const aliasText = (a) => (Array.isArray(a) ? a.join(", ") : "");
const parseAliases = (s) =>
  String(s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * Edit one Anythingle character (name + aliases + the 10 traits: 7 closed-vocab
 * + 3 normalized free-text franchise/affiliation/origin).
 * @param {{value:object, onChange:(next:object)=>void, franchises?:string[], compact?:boolean}} props
 */
export function TraitForm({ value, onChange, franchises = [], compact = false }) {
  const { t } = useI18n();
  const dlId = useId(); // unique datalist id per instance (the Builder mounts many)
  const v = value || {};
  const set = (key, val) => onChange({ ...v, [key]: val });
  // Toggle a token in a capped multi-value trait. `noneToken` (powers' "None")
  // is mutually exclusive with every other token.
  const toggleMulti = (key, token, max, noneToken) => {
    let cur = Array.isArray(v[key]) ? v[key] : [];
    if (noneToken && token === noneToken) return set(key, [noneToken]);
    if (noneToken) cur = cur.filter((x) => x !== noneToken);
    if (cur.includes(token)) cur = cur.filter((x) => x !== token);
    else if (cur.length < max) cur = [...cur, token];
    set(key, noneToken && !cur.length ? [noneToken] : cur);
  };
  const singles = ANYTHINGLE_TRAITS.filter((tr) => tr.type !== "multi");
  const multis = ANYTHINGLE_TRAITS.filter((tr) => tr.type === "multi");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            {t("builder.anyName")}
          </span>
          <input className={inputCls} value={v.name || ""} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
            {t("builder.anyAliases")}
          </span>
          <input
            className={inputCls}
            value={aliasText(v.aliases)}
            onChange={(e) => set("aliases", parseAliases(e.target.value))}
          />
        </label>
      </div>

      <datalist id={dlId}>
        {franchises.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <div className={`grid grid-cols-2 gap-2 ${compact ? "" : "lg:grid-cols-4"}`}>
        {singles.map((tr) => {
          const label = t(`any.trait.${tr.key}`);
          if (tr.type === "single")
            return (
              <label key={tr.key} className="block">
                <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
                <select className={inputCls} value={v[tr.key] || ""} onChange={(e) => set(tr.key, e.target.value)}>
                  {tr.values.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            );
          if (tr.type === "text")
            return (
              <label key={tr.key} className="block">
                <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
                <input
                  className={inputCls}
                  list={tr.key === "franchise" ? dlId : undefined}
                  value={v[tr.key] || ""}
                  onChange={(e) => set(tr.key, e.target.value)}
                />
              </label>
            );
          return (
            <label key={tr.key} className="block">
              <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">{label}</span>
              <input
                type="number"
                className={inputCls}
                value={v[tr.key] ?? ""}
                onChange={(e) => set(tr.key, e.target.value === "" ? null : +e.target.value)}
              />
            </label>
          );
        })}
      </div>

      {/* multi-value traits (role, powers): capped chip pickers */}
      {multis.map((tr) => {
        const cur = Array.isArray(v[tr.key]) ? v[tr.key] : [];
        const noneToken = tr.values.includes("None") ? "None" : null;
        const used = cur.filter((x) => x !== noneToken).length;
        return (
          <div key={tr.key}>
            <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
              {t(`any.trait.${tr.key}`)} · {used}/{tr.max}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {tr.values.map((opt) => {
                const on = cur.includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => toggleMulti(tr.key, opt, tr.max, noneToken)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${FOCUS} ${
                      on
                        ? "border-pink-500 bg-pink-500 text-white"
                        : "border-stone-300 text-stone-600 hover:border-stone-400 dark:border-stone-600 dark:text-stone-300"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** A single graded cell: the guessed character's trait value, tinted by result.
 * `index` staggers the reveal so a new guess's cells flip in one-after-another. */
function Cell({ cell, big, index = 0 }) {
  const tone = CELL[cell?.result] || CELL.grey;
  return (
    <div
      style={{ animationDelay: `${index * 0.12}s` }}
      className={`qn-cell-in flex items-center justify-center gap-0.5 rounded-md border px-1 text-center font-semibold ${tone} ${
        big ? "h-14 text-sm" : "h-11 text-[11px]"
      }`}
    >
      <span className="line-clamp-2 leading-tight">{cell?.val || "—"}</span>
      {cell?.dir === "up" && <ArrowUp size={big ? 16 : 12} className="shrink-0" />}
      {cell?.dir === "down" && <ArrowDown size={big ? 16 : 12} className="shrink-0" />}
    </div>
  );
}

/**
 * Read-only Wordle-style feedback grid: rows = guesses, columns = the 10 traits.
 * @param {{guesses:Array<{name:string,by?:object,cells:Array}>, big?:boolean}} props
 */
export function GuessGrid({ guesses = [], big = false }) {
  const { t } = useI18n();
  const cols = ANYTHINGLE_TRAITS;
  const template = `minmax(6.5rem, 1.3fr) repeat(${cols.length}, minmax(4.75rem, 1fr))`;
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[58rem] space-y-1.5">
        {/* header */}
        <div className="grid gap-1 text-center" style={{ gridTemplateColumns: template }}>
          <div />
          {cols.map((c) => (
            <div
              key={c.key}
              className={`truncate font-pixel uppercase tracking-wide text-stone-400 dark:text-stone-500 ${
                big ? "text-[9px]" : "text-[8px]"
              }`}
            >
              {t(`any.trait.${c.key}`)}
            </div>
          ))}
        </div>
        {/* rows newest-first, but keyed by ORIGINAL position so adding a guess
            doesn't remount (and re-animate) the older rows — only the new top row
            mounts fresh and its cells flip in one-after-another via the stagger. */}
        {guesses
          .map((g, idx) => ({ g, idx }))
          .reverse()
          .map(({ g, idx }) => (
            <div key={idx} className="grid items-center gap-1" style={{ gridTemplateColumns: template }}>
              <div className="flex min-w-0 items-center gap-1.5">
                {g.by && <Avatar color={g.by.color} emoji={g.by.emoji} name={g.by.name} size={big ? 26 : 20} />}
                <span className={`min-w-0 truncate font-semibold ${big ? "text-sm" : "text-xs"}`}>{g.name}</span>
              </div>
              {cols.map((c, ci) => (
                <Cell key={c.key} cell={(g.cells || []).find((x) => x.key === c.key)} big={big} index={ci} />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

/** Compact colour legend for the grid (hit / partial / miss / arrow). */
export function TraitLegend() {
  const { t } = useI18n();
  const item = (tone, label) => (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block h-3 w-3 rounded-sm border ${tone}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-stone-500 dark:text-stone-400">
      {item(CELL.green, t("play.anyHit"))}
      {item(CELL.yellow, t("play.anyPartial"))}
      {item(CELL.grey, t("play.anyMiss"))}
      <span>{t("play.anyHigherLower")}</span>
    </div>
  );
}

/**
 * A name field with type-to-filter autocomplete. Suggestions appear ONLY once
 * something is typed (≥1 char) — never on an empty click — so a huge pool
 * doesn't dump every name on focus. Controlled (value/onChange); onSelect(name)
 * fires when a suggestion is clicked.
 * @param {{names:string[], value:string, onChange:(s:string)=>void, onSelect:(name:string)=>void, placeholder?:string, className?:string, autoFocus?:boolean}} props
 */
export function CharacterField({
  names = [],
  value,
  onChange,
  onSelect,
  placeholder,
  className = "",
  autoFocus = false,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const q = normText(value);
  const matches = q.length >= 1 ? names.filter((n) => normText(n).includes(q)).slice(0, 8) : [];
  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <input
        className={inputCls}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 text-left shadow-lg dark:border-stone-700 dark:bg-stone-900">
          {matches.map((n) => (
            <li key={n}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(n);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800 ${FOCUS}`}
              >
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Self-contained "pick a character from the library" field (its own text state).
 * Used by the Builder to load a known character into the target/pool.
 * @param {{names:string[], onPick:(name:string)=>void, placeholder?:string, className?:string}} props
 */
export function LibraryPicker({ names = [], onPick, placeholder, className = "" }) {
  const [text, setText] = useState("");
  return (
    <CharacterField
      names={names}
      value={text}
      onChange={setText}
      onSelect={(n) => {
        onPick(n);
        setText("");
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}
