/* ====================================================================
   ANYTHINGLE SHARED WIDGETS
   --------------------------------------------------------------------
   Pure, props-only building blocks shared by the Builder (authoring a
   character), PlayView (the host's inline add/grade panel) and the
   read-only feedback grid (RoundBody → TV + host remote). All eight
   trait controls are CLOSED (selects / capped chips / number) so an
   author or host can only ever produce comparable, valid values.
   ==================================================================== */

import { ArrowUp, ArrowDown } from "lucide-react";
import { ANYTHINGLE_TRAITS, ANY_POWERS, ANY_MAX_POWERS } from "../lib/model.js";
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
 * Edit one Anythingle character (name + aliases + the 8 closed-vocab traits).
 * @param {{value:object, onChange:(next:object)=>void, franchises?:string[], compact?:boolean}} props
 */
export function TraitForm({ value, onChange, franchises = [], compact = false }) {
  const { t } = useI18n();
  const v = value || {};
  const set = (key, val) => onChange({ ...v, [key]: val });
  const togglePower = (p) => {
    let cur = Array.isArray(v.powers) ? v.powers : [];
    if (p === "None") return set("powers", ["None"]);
    cur = cur.filter((x) => x !== "None");
    if (cur.includes(p)) cur = cur.filter((x) => x !== p);
    else if (cur.length < ANY_MAX_POWERS) cur = [...cur, p];
    set("powers", cur.length ? cur : ["None"]);
  };

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

      <datalist id="any-franchises">
        {franchises.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <div className={`grid grid-cols-2 gap-2 ${compact ? "" : "lg:grid-cols-4"}`}>
        {ANYTHINGLE_TRAITS.map((tr) => {
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
                  list="any-franchises"
                  value={v[tr.key] || ""}
                  onChange={(e) => set(tr.key, e.target.value)}
                />
              </label>
            );
          if (tr.type === "number")
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
          return null; // powers rendered full-width below
        })}
      </div>

      {/* powers: capped multi-select chips */}
      <div>
        <span className="mb-1 block text-xs font-medium text-stone-500 dark:text-stone-400">
          {t("any.trait.powers")} · {(Array.isArray(v.powers) ? v.powers : []).filter((p) => p !== "None").length}/
          {ANY_MAX_POWERS}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ANY_POWERS.map((p) => {
            const on = (Array.isArray(v.powers) ? v.powers : []).includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePower(p)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${FOCUS} ${
                  on
                    ? "border-pink-500 bg-pink-500 text-white"
                    : "border-stone-300 text-stone-600 hover:border-stone-400 dark:border-stone-600 dark:text-stone-300"
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** A single graded cell: the guessed character's trait value, tinted by result. */
function Cell({ cell, big }) {
  const tone = CELL[cell?.result] || CELL.grey;
  return (
    <div
      className={`flex items-center justify-center gap-0.5 rounded-md border px-1 text-center font-semibold ${tone} ${
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
 * Read-only Wordle-style feedback grid: rows = guesses, columns = the 8 traits.
 * @param {{guesses:Array<{name:string,by?:object,cells:Array}>, big?:boolean}} props
 */
export function GuessGrid({ guesses = [], big = false }) {
  const { t } = useI18n();
  const cols = ANYTHINGLE_TRAITS;
  const template = `minmax(7rem, 1.4fr) repeat(${cols.length}, minmax(4.5rem, 1fr))`;
  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[44rem] space-y-1.5">
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
        {/* rows (newest first) */}
        {[...guesses].reverse().map((g, i) => (
          <div key={i} className="grid items-center gap-1" style={{ gridTemplateColumns: template }}>
            <div className="flex min-w-0 items-center gap-1.5">
              {g.by && <Avatar color={g.by.color} emoji={g.by.emoji} name={g.by.name} size={big ? 26 : 20} />}
              <span className={`min-w-0 truncate font-semibold ${big ? "text-sm" : "text-xs"}`}>{g.name}</span>
            </div>
            {cols.map((c) => (
              <Cell key={c.key} cell={(g.cells || []).find((x) => x.key === c.key)} big={big} />
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
