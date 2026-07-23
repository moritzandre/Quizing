/* ====================================================================
   SPECTRUM BAR — shared read-only widget for the `spectrum` round
   --------------------------------------------------------------------
   A horizontal 0–100 spectrum between two labelled poles. Purely
   presentational (props only) so the host screen (PlayView) and the TV
   (RoundBody) render an identical bar. Before reveal it shows just the
   poles; on reveal it highlights the hidden target band and scatters each
   player's guess mark along the bar. No secrets live here — the caller
   passes `target`/`marks` only once revealed.
   ==================================================================== */

/**
 * @param {object} props
 * @param {string} props.left Left pole label.
 * @param {string} props.right Right pole label.
 * @param {number|null} [props.target] Hidden 0–100 position (pass only when revealed).
 * @param {number} [props.band] Bullseye half-width (full-points zone = target ± band).
 * @param {Array<{value:number,color:?string,label:string}>} [props.marks] Player guesses (revealed).
 * @param {boolean} [props.revealed]
 * @param {boolean} [props.compact] Tighter sizing for the host-phone mirror.
 */
export default function SpectrumBar({
  left = "",
  right = "",
  target = null,
  band = 15,
  marks = [],
  revealed = false,
  compact = false,
}) {
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const show = revealed && target != null;
  const bandLo = show ? clamp(target - band) : 0;
  const bandHi = show ? clamp(target + band) : 0;
  const barH = compact ? "h-6" : "h-9 md:h-11";
  return (
    <div className={`mx-auto w-full ${compact ? "max-w-md" : "max-w-2xl"}`}>
      {/* guess marks sit above the bar so they never cover the target line */}
      <div className={`relative ${compact ? "h-8" : "h-10"}`}>
        {show &&
          marks.map((m, i) => (
            <div
              key={i}
              className="absolute top-1 -translate-x-1/2 transition-all duration-500"
              style={{ left: `${clamp(m.value)}%` }}
              title={m.label}
            >
              <div
                className={`${compact ? "h-3 w-3" : "h-4 w-4"} rounded-full border-2 border-white shadow dark:border-stone-900`}
                style={{ background: m.color || "#6366f1" }}
              />
            </div>
          ))}
      </div>
      <div className={`relative ${barH} overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10`}>
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-violet-400 to-rose-400 opacity-80" />
        {show && (
          <>
            {/* full-points bullseye band */}
            <div
              className="absolute inset-y-0 bg-white/45 dark:bg-white/25"
              style={{ left: `${bandLo}%`, width: `${Math.max(0, bandHi - bandLo)}%` }}
            />
            {/* exact target line */}
            <div
              className="absolute inset-y-0 w-1 -translate-x-1/2 bg-stone-900 dark:bg-white"
              style={{ left: `${clamp(target)}%` }}
            />
          </>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-stone-600 dark:text-stone-300">
        <span className="min-w-0 flex-1 truncate text-left">◀ {left}</span>
        <span className="min-w-0 flex-1 truncate text-right">{right} ▶</span>
      </div>
    </div>
  );
}
