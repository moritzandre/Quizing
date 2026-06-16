/* ====================================================================
   UI PRIMITIVES, THEME & ROUND-TYPE METADATA
   --------------------------------------------------------------------
   Multi-export module (the project's one default-export exception):
   shared style constants, primitives, the theme toggle, and confetti.
   ==================================================================== */

import { useState, useEffect, useRef } from "react";
import { PixelSprite } from "./pixelAvatar.jsx";
import { SPRITE_KEYS } from "./pixelSprites.js";
import {
  MessageSquare,
  LayoutGrid,
  Lightbulb,
  Share2,
  Video,
  FastForward,
  Image as ImageIcon,
  Sparkles,
  Blend,
  MapPin,
  ListChecks,
  ToggleLeft,
  ArrowUpDown,
  Hash,
  Gavel,
  Drama,
  Trash2,
  Sun,
  Moon,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useI18n } from "../i18n/I18nProvider.jsx";
import { isMuted, setMuted, playSound } from "../lib/sound.js";

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
  connect: {
    label: "What Connects?",
    icon: Share2,
    dot: "bg-blue-500",
    desc: "Reveal clues (text, image, audio or video) one by one — players work out what they all have in common. Fewer points the more clues it takes.",
  },
  video: {
    label: "Video",
    icon: Video,
    dot: "bg-rose-500",
    desc: "Play the clip together, then reveal the answer and award the points.",
  },
  clip: {
    label: "Clip Ladder",
    icon: FastForward,
    dot: "bg-red-500",
    desc: "Play a short slice of a clip and extend it step by step — fewer points the longer it runs. Pauses when someone buzzes.",
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
  choice: {
    label: "Multiple Choice",
    icon: ListChecks,
    dot: "bg-teal-500",
    desc: "Players tap A/B/C/D on their phones. Reveal the right answer and everyone who got it scores.",
  },
  truefalse: {
    label: "True / False",
    icon: ToggleLeft,
    dot: "bg-lime-500",
    desc: "Read a statement; players tap True or False on their phones. Auto-scored — everyone right scores.",
  },
  higherlower: {
    label: "Higher / Lower",
    icon: ArrowUpDown,
    dot: "bg-cyan-500",
    desc: "Players guess whether the answer is higher or lower than the clue. Auto-scored from their phones.",
  },
  number: {
    label: "Closest Guess",
    icon: Hash,
    dot: "bg-orange-500",
    desc: "Everyone submits a number from their phone. Reveal the answer — the closest guess wins.",
  },
  whoknows: {
    label: "Who Knows More",
    icon: Gavel,
    dot: "bg-violet-500",
    desc: "Auction a category: players claim how many they know; the winner must deliver that many answers against a per-answer clock, or bust.",
  },
  anythingle: {
    label: "Anythingle",
    icon: Drama,
    dot: "bg-pink-500",
    desc: "Guess the secret fictional character. Each guess reveals how its traits compare — Wordle-style. Players take turns by standings; first to name it wins.",
  },
};

/** Per-round accent classes (full literals so Tailwind keeps them). */
const ACCENT = {
  classic: { soft: "bg-stone-100 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200", solid: "bg-stone-500" },
  jeopardy: {
    soft: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
    solid: "bg-indigo-500",
  },
  hints: { soft: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300", solid: "bg-amber-500" },
  connect: { soft: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300", solid: "bg-blue-500" },
  video: { soft: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300", solid: "bg-rose-500" },
  clip: { soft: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300", solid: "bg-red-500" },
  image: { soft: "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300", solid: "bg-sky-500" },
  morph: {
    soft: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/20 dark:text-fuchsia-300",
    solid: "bg-fuchsia-500",
  },
  fusion: { soft: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300", solid: "bg-purple-500" },
  map: {
    soft: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    solid: "bg-emerald-500",
  },
  choice: { soft: "bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300", solid: "bg-teal-500" },
  truefalse: { soft: "bg-lime-100 text-lime-700 dark:bg-lime-500/20 dark:text-lime-300", solid: "bg-lime-500" },
  higherlower: { soft: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300", solid: "bg-cyan-500" },
  number: { soft: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300", solid: "bg-orange-500" },
  whoknows: {
    soft: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
    solid: "bg-violet-500",
  },
  anythingle: { soft: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300", solid: "bg-pink-500" },
};
/** Accent class set for a round type (soft chip bg/text + solid dot). */
export const accentFor = (type) => ACCENT[type] || ACCENT.classic;

/**
 * The answer options for a binary auto-scored round (true/false, higher/lower):
 * fixed, localized UI labels. Returns null for other types. `t` is the i18n fn.
 */
export const binaryOptions = (type, t) =>
  type === "truefalse"
    ? [t("round.truefalse.opt0"), t("round.truefalse.opt1")]
    : type === "higherlower"
      ? [t("round.higherlower.opt0"), t("round.higherlower.opt1")]
      : null;

/** Display options for a choice-style round: synthesized for binary types, else the question's own. */
export const optionsFor = (type, q, t) => binaryOptions(type, t) || (Array.isArray(q?.options) ? q.options : []);

/** Player avatar palette — colors + pixel-art character sprites, cycled by index. */
export const PLAYER_COLORS = [
  "#6366f1",
  "#f43f5e",
  "#10b981",
  "#f59e0b",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
  "#eab308",
  "#ef4444",
];
// An avatar's character is a pixel-sprite KEY (see pixelAvatar.jsx). It rides
// the player `emoji` field for back-compat, so PLAYER_EMOJI/emojiAt are kept as
// aliases of the sprite list/cycler (the value is a sprite key, not an emoji).
export const PLAYER_SPRITES = SPRITE_KEYS;
export const PLAYER_EMOJI = SPRITE_KEYS;
export const colorAt = (i) => PLAYER_COLORS[((i % PLAYER_COLORS.length) + PLAYER_COLORS.length) % PLAYER_COLORS.length];
export const spriteAt = (i) => SPRITE_KEYS[((i % SPRITE_KEYS.length) + SPRITE_KEYS.length) % SPRITE_KEYS.length];
export const emojiAt = spriteAt;

/** Player avatar: a pixel-art character (sprite key in `emoji`) on a colored tile, else the name's initial. */
export function Avatar({ color, emoji, name, size = 28, className = "" }) {
  const tile = color || "#78716c";
  const base = `inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none shadow-sm ring-2 ring-white/70 dark:ring-white/15 ${className}`;
  return (
    <span aria-hidden className={base} style={{ width: size, height: size, backgroundColor: tile }}>
      {SPRITE_KEYS.includes(emoji) ? (
        <PixelSprite name={emoji} color={tile} size={Math.round(size * 0.82)} />
      ) : (
        <span className="font-semibold text-white" style={{ fontSize: Math.round(size * 0.5) }}>
          {name ? name.trim().charAt(0).toUpperCase() : "?"}
        </span>
      )}
    </span>
  );
}

/** True when the user asked for reduced motion (so animations can no-op). */
export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that smoothly counts to `value` whenever it changes (e.g. on a score
 * award). Honors prefers-reduced-motion (snaps instantly). With `pop`, it gives
 * an arcade "punch" (scale bounce) each time the value increases.
 * @param {object} props
 * @param {number} props.value Target number.
 * @param {string} [props.className]
 * @param {boolean} [props.pop] Bounce on increase.
 */
export function AnimatedNumber({ value, className = "", pop = false }) {
  const [display, setDisplay] = useState(value);
  const [popping, setPopping] = useState(false);
  const prevRef = useRef(value);
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (pop && value > prev) setPopping(true);
    if (display === value) return;
    if (prefersReducedMotion()) return setDisplay(value);
    const from = display;
    let raf;
    let start;
    const dur = 500;
    const tick = (now) => {
      if (start == null) start = now;
      const p = Math.min(1, (now - start) / dur);
      setDisplay(Math.round(from + (value - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Only re-run when the target changes; `display` is the live start point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span
      className={`${pop ? "inline-block" : ""} ${popping ? "qn-score-pop" : ""} ${className}`}
      onAnimationEnd={() => setPopping(false)}
    >
      {display}
    </span>
  );
}

/** Shared focus-visible ring classes for interactive elements. */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-50 dark:focus-visible:ring-offset-stone-950";

/** Shared text-input classes. */
export const inputCls =
  "w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 transition focus:border-stone-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 dark:focus:border-stone-500";

/** Shared card surface (border + background, both themes). */
export const cardCls = "rounded-2xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900";

/** Standard button with dark / accent / outline / ghost / danger variants.
    Subtly 8-bit: blocky corners + a hard "arcade" shadow that presses flat. */
export function Button({ variant = "dark", className = "", children, ...props }) {
  const variants = {
    dark: "bg-stone-900 text-white shadow-[0_2px_0_0_rgba(0,0,0,0.4)] hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:shadow-[0_2px_0_0_rgba(0,0,0,0.35)] dark:hover:bg-white",
    accent:
      "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_3px_0_0_#3730a3] hover:from-indigo-400 hover:to-violet-500",
    outline:
      "border border-stone-300 text-stone-900 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-100 dark:hover:bg-stone-800",
    ghost: "text-stone-500 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200",
    danger: "bg-red-600 text-white shadow-[0_3px_0_0_#7f1d1d] hover:bg-red-500",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition duration-100 motion-safe:active:translate-y-[2px] active:shadow-none disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-30 ${FOCUS} ${variants[variant]} ${className}`}
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

/** Blocky 8-bit tag showing a round type's accent pixel + localized label. */
export function TypeBadge({ type }) {
  const { t } = useI18n();
  const meta = TYPES[type];
  if (!meta) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[5px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ring-black/5 dark:ring-white/10 ${accentFor(type).soft}`}
    >
      <span className={`h-1.5 w-1.5 ${meta.dot}`} />
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

/** Speaker button that mutes/unmutes sound effects. */
export function SoundToggle({ className = "" }) {
  const { t } = useI18n();
  const [m, setM] = useState(isMuted());
  const toggle = () => {
    const next = !m;
    setMuted(next);
    setM(next);
    if (!next) playSound("reveal"); // confirm audio is back
  };
  return (
    <IconButton label={m ? t("sound.unmute") : t("sound.mute")} onClick={toggle} className={className}>
      {m ? <VolumeX size={18} /> : <Volume2 size={18} />}
    </IconButton>
  );
}

/** Sun/moon button that flips the app between light and dark. */
export function ThemeToggle({ className = "" }) {
  const { t } = useI18n();
  const [theme, toggle] = useTheme();
  const dark = theme === "dark";
  return (
    <IconButton label={dark ? t("theme.toLight") : t("theme.toDark")} onClick={toggle} className={className}>
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </IconButton>
  );
}

/* ---- confetti ---- */

const CONFETTI_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#f43f5e",
  "#0ea5e9",
  "#a855f7",
  "#ec4899",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

/**
 * One-shot confetti burst. Renders `count` pieces with deterministic-enough
 * spread; pieces fall once via CSS and fade out (no cleanup needed).
 * @param {object} props
 * @param {number} [props.count] Number of pieces.
 */
export function Confetti({ count = 120 }) {
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: (i / count) * 100 + (((i * 53) % 17) - 8),
      delay: ((i * 37) % 100) / 100,
      duration: 2.4 + ((i * 29) % 20) / 10,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0, // mix discs in with the rectangles
      scale: 0.7 + ((i * 19) % 10) / 10,
    })),
  );
  // The fall animation owns `transform` (translate + spin), so size variety is
  // baked into width/height — an inline transform here would be overridden.
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="qn-confetti-piece"
          style={{
            left: `${p.left}%`,
            width: `${Math.round(10 * p.scale)}px`,
            height: `${Math.round(14 * p.scale)}px`,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}
