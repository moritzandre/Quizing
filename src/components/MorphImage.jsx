/* ====================================================================
   MORPH IMAGE (continuous reveal for the "morph" round)
   --------------------------------------------------------------------
   Renders an image de-obscured by a continuous `progress` (0 = fully
   morphed, 1 = clear) so it can be animated smoothly as the host runs the
   auto-demorph. Five effects: blur, pixelate (canvas), tiles + slices
   (cover pieces that lift away), zoom. The morphed end is intentionally
   HARD (heavy blur, chunky pixels, many small tiles). `revealed` forces
   the clean image.
   ==================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nProvider.jsx";

const lerp = (a, b, t) => a + (b - a) * t;

/** Stable shuffle of [0..n) seeded by n, so pieces lift in a fixed order. */
function shuffledOrder(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  let seed = n * 9301 + 49297;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Harder than before: a finer tile/slice grid means each revealed piece gives
// away less, and the blur/pixelate/zoom start much heavier.
const COLS = 12;
const ROWS = 8;
const SLICES = 14;

/**
 * @param {object} props
 * @param {string} props.url Image URL or data URL.
 * @param {"blur"|"pixelate"|"tiles"|"zoom"|"slices"} props.effect Reveal effect.
 * @param {number} [props.progress] 0 = fully morphed → 1 = clear.
 * @param {boolean} [props.revealed] Force the clean image.
 */
export default function MorphImage({ url, effect, progress = 0, revealed = false }) {
  const { t: tr } = useI18n(); // `t` is the morph progress fraction below
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imgReady, setImgReady] = useState(false);
  const t = revealed ? 1 : Math.max(0, Math.min(1, progress));
  const clear = revealed || t >= 1;

  // Load the source once (cached) so the pixelate redraw doesn't re-decode it
  // on every progress tick.
  useEffect(() => {
    if (effect !== "pixelate" || !url) return;
    let cancelled = false;
    setImgReady(false);
    const img = new Image();
    img.onload = () => {
      if (!cancelled) {
        imgRef.current = img;
        setImgReady(true);
      }
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [effect, url]);

  // pixelate: redraw the canvas at increasing block resolution as it demorphs
  useEffect(() => {
    if (effect !== "pixelate" || clear || !imgReady) return;
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;
    const blocks = Math.max(4, Math.round(lerp(4, 170, t))); // 4 = brutally chunky
    const ar = img.height / Math.max(1, img.width);
    const tmp = document.createElement("canvas");
    tmp.width = blocks;
    tmp.height = Math.max(1, Math.round(blocks * ar));
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(img, 0, 0, tmp.width, tmp.height);
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, canvas.width, canvas.height);
  }, [effect, t, clear, imgReady]);

  const tileOrder = useMemo(() => shuffledOrder(COLS * ROWS), []);
  const sliceOrder = useMemo(() => shuffledOrder(SLICES), []);

  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
        {tr("play.noPicture")}
      </div>
    );
  }

  const frame =
    "mx-auto max-h-[58vh] w-full overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-800";

  if (clear) {
    return (
      <div className={frame}>
        <img src={url} alt="Reveal" className="qn-pop mx-auto max-h-[58vh] w-full object-contain" />
      </div>
    );
  }

  if (effect === "pixelate") {
    return (
      <div className={frame}>
        <canvas
          ref={canvasRef}
          className="mx-auto max-h-[58vh] w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
    );
  }

  if (effect === "tiles") {
    const revealedCount = Math.round(COLS * ROWS * t);
    const hidden = new Set(tileOrder.slice(revealedCount));
    return (
      <div className={`relative ${frame}`}>
        <img src={url} alt="" className="mx-auto max-h-[58vh] w-full object-contain" />
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
        >
          {Array.from({ length: COLS * ROWS }).map((_, i) => (
            <div
              key={i}
              className={`transition-opacity duration-300 ${hidden.has(i) ? "bg-stone-300 opacity-100 dark:bg-stone-700" : "opacity-0"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (effect === "zoom") {
    return (
      <div className={frame}>
        <img
          src={url}
          alt=""
          className="mx-auto max-h-[58vh] w-full object-contain transition-transform duration-300"
          style={{ transform: `scale(${lerp(5, 1, t)})` }}
        />
      </div>
    );
  }

  if (effect === "slices") {
    const revealedCount = Math.round(SLICES * t);
    const hidden = new Set(sliceOrder.slice(revealedCount));
    return (
      <div className={`relative ${frame}`}>
        <img src={url} alt="" className="mx-auto max-h-[58vh] w-full object-contain" />
        <div className="absolute inset-0 grid" style={{ gridTemplateRows: `repeat(${SLICES}, 1fr)` }}>
          {Array.from({ length: SLICES }).map((_, i) => (
            <div
              key={i}
              className={`transition-opacity duration-300 ${hidden.has(i) ? "bg-stone-300 opacity-100 dark:bg-stone-700" : "opacity-0"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  // blur (default)
  const blurPx = Math.round(lerp(48, 0, t));
  return (
    <div className={frame}>
      <img
        src={url}
        alt=""
        className="mx-auto max-h-[58vh] w-full scale-110 object-contain transition-[filter] duration-300"
        style={{ filter: `blur(${blurPx}px)` }}
      />
    </div>
  );
}
