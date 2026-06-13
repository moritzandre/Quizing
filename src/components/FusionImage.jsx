/* ====================================================================
   FUSION IMAGE — two images blended into one, "defused" step by step
   --------------------------------------------------------------------
   Step 0 is an even 50/50 blend (hard to tell who's who). Each defuse
   step swings the blend further toward A, then B, then A… so players can
   study each contributor; on reveal both are shown side by side.
   ==================================================================== */

import { useI18n } from "../i18n/I18nProvider.jsx";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Blend weight of image B (0 = all A, 1 = all B) for a defuse step. */
function mixForStep(step, steps) {
  if (step <= 0) return 0.5;
  const amp = (Math.ceil(step / 2) / Math.max(1, Math.ceil(steps / 2))) * 0.5;
  const mix = step % 2 === 1 ? 0.5 - amp : 0.5 + amp;
  return clamp(mix, 0.04, 0.96);
}

/**
 * @param {object} props
 * @param {string} props.urlA First image.
 * @param {string} props.urlB Second image.
 * @param {number} props.steps Total defuse steps.
 * @param {number} props.step Current step (0 = even blend).
 * @param {boolean} [props.revealed] Show both images side by side.
 */
export default function FusionImage({ urlA, urlB, steps, step, revealed = false }) {
  const { t } = useI18n();
  const frame =
    "overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-800";

  if (!urlA || !urlB) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-dashed border-stone-300 text-stone-400 dark:border-stone-700 dark:text-stone-500">
        {t("play.twoImages")}
      </div>
    );
  }

  if (revealed) {
    return (
      <div className="qn-pop grid grid-cols-2 gap-3">
        <img src={urlA} alt="A" className={`max-h-[50vh] w-full object-contain ${frame}`} />
        <img src={urlB} alt="B" className={`max-h-[50vh] w-full object-contain ${frame}`} />
      </div>
    );
  }

  const mix = mixForStep(step, steps);
  return (
    <div className={`relative mx-auto aspect-square max-h-[56vh] ${frame}`}>
      <img src={urlA} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <img
        src={urlB}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
        style={{ opacity: mix }}
      />
    </div>
  );
}
