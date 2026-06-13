/* ====================================================================
   UI PRIMITIVES & ROUND-TYPE METADATA
   ==================================================================== */

import { useState, useEffect } from "react";
import { MessageSquare, LayoutGrid, Lightbulb, Video, MapPin, Trash2 } from "lucide-react";

/** Round-type metadata: label, icon, accent dot, and host instructions. Keys must match ROUND_TYPES in lib/model.js. */
export const TYPES = {
  classic:  { label: "Classic",     icon: MessageSquare, dot: "bg-stone-400",   desc: "Read the question aloud, reveal the answer, then tap whoever got it right to award the points." },
  jeopardy: { label: "Jeopardy",    icon: LayoutGrid,    dot: "bg-indigo-500",  desc: "Players take turns picking tiles — higher value, harder question. Award the tile's points to whoever answers." },
  hints:    { label: "Hint Ladder", icon: Lightbulb,     dot: "bg-amber-500",   desc: "The answer starts at full value. Every extra hint lowers it. Reveal when someone calls it out." },
  video:    { label: "Video",       icon: Video,         dot: "bg-rose-500",    desc: "Watch the clip together, then reveal the answer and award the points." },
  map:      { label: "Map",         icon: MapPin,        dot: "bg-emerald-500", desc: "Everyone guesses where in the world it is. Reveal the pin and award the closest guess." },
};

/** Shared focus-visible ring classes for interactive elements. */
export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2";

/** Shared text-input classes. */
export const inputCls = `w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none`;

/** Standard button with dark / accent / outline / ghost variants. */
export function Button({ variant = "dark", className = "", children, ...props }) {
  const variants = {
    dark: "bg-stone-900 text-white hover:bg-stone-700",
    accent: "bg-indigo-600 text-white hover:bg-indigo-500",
    outline: "border border-stone-300 text-stone-900 hover:bg-stone-100",
    ghost: "text-stone-500 hover:bg-stone-100 hover:text-stone-700",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-30 ${FOCUS} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Small icon-only button with an accessible label. */
export function IconButton({ label, className = "", children, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 ${FOCUS} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Pill badge showing a round type's accent dot and label. */
export function TypeBadge({ type }) {
  const t = TYPES[type];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600">
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {t.label}
    </span>
  );
}

/** Two-tap delete button: first tap arms it ("Sure?"), second confirms. */
export function ConfirmDelete({ onConfirm, label = "Delete" }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      aria-label={armed ? `Confirm: ${label}` : label}
      title={label}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${FOCUS} ${
        armed ? "bg-red-600 text-white" : "text-stone-400 hover:bg-stone-100 hover:text-red-600"
      }`}
    >
      <Trash2 size={14} />
      {armed ? "Sure?" : ""}
    </button>
  );
}
