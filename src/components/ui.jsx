/* ====================================================================
   UI PRIMITIVES, THEME & ROUND-TYPE METADATA
   --------------------------------------------------------------------
   Multi-export module (the project's one default-export exception):
   shared style constants, primitives, the theme toggle, and confetti.
   ==================================================================== */

import { useState, useEffect } from "react";
import {
  MessageSquare,
  LayoutGrid,
  Lightbulb,
  Video,
  Image as ImageIcon,
  Sparkles,
  Blend,
  MapPin,
  Trash2,
  Sun,
  Moon,
} from "lucide-react";
import { useI18n } from "../i18n/I18nProvider.jsx";

/**
 * Round-type metadata: icon + accent dot. Keys must match ROUND_TYPES in
 * lib/model.js. Labels and descriptions are localized via i18n keys
 * `round.<type>.label` / `round.<type>.desc`; the English `label`/`desc` here
 * are only a fallback for any non-localized consumer.
 */
export const TYPES = {
  classic: {
    label: "Classic",
    icon: MessageSquare,
    dot: "bg-stone-400",
    desc: "Read the question aloud, reveal the answer, then tap whoever got it right to award the points.",
  },
  jeopardy: {
    label: "Jeopardy",
    icon: LayoutGrid,
    dot: "bg-indigo-500",
    desc: "Players take turns picking tiles — higher value, harder question. Award the tile's points to whoever answers, or dock them on a miss.",
  },
  hints: {
    label: "Hint Ladder",
    icon: Lightbulb,
    dot: "bg-amber-500",
    desc: "The answer starts at full value. Every extra hint lowers it. Reveal when someone calls it out.",
  },
  video: {
    label: "Video",
    icon: Video,
    dot: "bg-rose-500",
    desc: "Play the clip together, then reveal the answer and award the points.",
  },
  image: {
    label: "Picture",
    icon: ImageIcon,
    dot: "bg-sky-500",
    desc: "Show the picture, let everyone study it, then reveal the answer and award the points.",
  },
  morph: {
    label: "Morph",
    icon: Sparkles,
    dot: "bg-fuchsia-500",
    desc: "The picture starts obscured and worth the most. Demorph it step by step — the longer it takes, the fewer points it's worth.",
  },
  fusion: {
    label: "Fusion",
    icon: Blend,
    dot: "bg-purple-500",
    desc: "Two images are blended into one. Guess both halves; defuse step by step to peek at each — fewer points the more you peek.",
  },
  map: {
    label: "Map",
    icon: MapPin,
    dot: "bg-emerald-500",
    desc: "Everyone drops a pin where they think it is. Reveal the real spot and the closest guess wins.",
  },
};

/** Shared focus-visible ring classes for interactive elements. */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950";

/** Shared text-input classes. */
export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 dark:focus:border-stone-500";

/** Shared card surface (border + background, both themes). */
export const cardCls = "rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900";

/** Standard button with dark / accent / outline / ghost / danger variants. */
export function Button({ variant = "dark", className = "", children, ...props }) {
  const variants = {
    dark: "bg-stone-900 text-white shadow-sm hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white",
    accent: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
    outline:
      "border border-stone-300 text-stone-900 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800",
    ghost: "text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-500",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium transition active:scale-[.98] disabled:pointer-events-none disabled:opacity-30 ${FOCUS} ${variants[variant]} ${className}`}
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
      className={`rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 active:scale-95 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-200 ${FOCUS} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Pill badge showing a round type's accent dot and localized label. */
export function TypeBadge({ type }) {
  const { t } = useI18n();
  const meta = TYPES[type];
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {t(`round.${type}.label`)}
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
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition active:scale-95 ${FOCUS} ${
        armed
          ? "bg-red-600 text-white"
          : "text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:text-stone-500 dark:hover:bg-stone-800"
      }`}
    >
      <Trash2 size={14} />
      {armed ? "Sure?" : ""}
    </button>
  );
}

/* ---- theme ---- */

const THEME_KEY = "quiznight.theme";

/**
 * Read/toggle the manual color theme. The initial class on <html> is set by a
 * bootstrap script in index.html to avoid a flash; this hook stays in sync.
 * @returns {[("dark"|"light"), () => void]} Current theme and a toggle.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  const toggle = () =>
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* private mode / disabled storage — theme just won't persist */
      }
      return next;
    });
  return [theme, toggle];
}

/** Sun/moon button that flips the app between light and dark. */
export function ThemeToggle({ className = "" }) {
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <IconButton label={dark ? "Switch to light mode" : "Switch to dark mode"} onClick={toggle} className={className}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}

/* ---- confetti ---- */

const CONFETTI_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#f43f5e", "#0ea5e9", "#a855f7"];

/**
 * One-shot confetti burst. Renders `count` pieces with deterministic-enough
 * spread; pieces fall once via CSS and fade out (no cleanup needed).
 * @param {object} props
 * @param {number} [props.count] Number of pieces.
 */
export function Confetti({ count = 90 }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: (i / count) * 100 + (((i * 53) % 17) - 8),
      delay: ((i * 37) % 100) / 100,
      duration: 2.4 + ((i * 29) % 20) / 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      rotate: (i * 47) % 360,
    })),
  );
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="qn-confetti-piece"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
