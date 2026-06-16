/* ====================================================================
   RECAP MINIGAME — Space Invaders
   --------------------------------------------------------------------
   Each entity is a ship (its avatar) facing a fleet of invaders sized to
   the points it won this round. As the score counts up, the ship blasts
   the fleet away invader-by-invader (with a muzzle flash, an explosion at
   the frontier, and a laser blip). Rows resolve one-by-one in standings
   order over a twinkling starfield; the leader's row lands last.
   ==================================================================== */

import { useEffect } from "react";
import { Avatar } from "../ui.jsx";
import { useI18n } from "../../i18n/I18nProvider.jsx";
import { easeOutCubic, scoreAt, glyphsForDelta, rankRecap, phaseFor, useRecapSfx } from "./recapShared.js";

// Deterministic starfield (same on host + TV, no Math.random so they match).
const STARS = Array.from({ length: 22 }, (_, i) => ({
  top: (i * 53) % 100,
  left: (i * 37) % 100,
  delay: ((i * 29) % 16) / 10,
  big: i % 5 === 0,
}));

export default function SpaceInvadersRecap({ entities = [], present = false, progress = 1 }) {
  const { t } = useI18n();
  const { ranked, topMoverId } = rankRecap(entities);
  const n = ranked.length;
  const sfx = useRecapSfx(!present);

  let totalDestroyed = 0;
  const rows = ranked.map((entity, idx) => {
    const localP = phaseFor(progress, n - 1 - idx, n); // leader resolves last
    const glyphs = glyphsForDelta(entity.to - entity.from);
    const destroyed = Math.round(glyphs * easeOutCubic(localP));
    totalDestroyed += destroyed;
    return { entity, localP, glyphs, destroyed };
  });
  useEffect(() => sfx(totalDestroyed, "zap"), [totalDestroyed, sfx]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-indigo-500/40 bg-stone-950 p-4 text-stone-100 shadow-[0_0_40px_rgba(99,102,241,0.25)_inset]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {STARS.map((s, i) => (
          <span
            key={i}
            className="qn-twinkle absolute rounded-full bg-white"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: s.big ? 3 : 2,
              height: s.big ? 3 : 2,
              opacity: 0.55,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>
      <p className={`relative mb-3 text-center font-pixel text-emerald-400 ${present ? "text-base" : "text-[10px]"}`}>
        {t("recap.invaders")}
      </p>
      <div className="relative space-y-2">
        {rows.map(({ entity, localP, glyphs, destroyed }) => {
          const firing = localP > 0 && localP < 1 && glyphs > 0;
          return (
            <div
              key={entity.id}
              className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 ${
                entity.id === topMoverId ? "border-amber-400/70 bg-amber-400/10" : "border-white/10 bg-white/5"
              }`}
            >
              <div className="relative shrink-0">
                <Avatar
                  color={entity.color}
                  emoji={entity.emoji}
                  photo={entity.photo}
                  name={entity.name}
                  size={present ? 36 : 26}
                />
                {firing && (
                  <span
                    className={`qn-blink absolute -right-1.5 top-1/2 -translate-y-1/2 text-cyan-300 ${present ? "text-sm" : "text-[10px]"}`}
                  >
                    ▸
                  </span>
                )}
              </div>
              <span
                className={`min-w-0 max-w-[7rem] flex-shrink truncate font-semibold ${present ? "text-lg" : "text-xs"}`}
              >
                {entity.name}
              </span>
              <span className={`shrink-0 font-pixel text-emerald-300 ${present ? "text-xl" : "text-sm"}`}>
                {scoreAt(entity, localP)}
              </span>
              <div className="ml-auto flex items-center gap-0.5 overflow-hidden">
                {Array.from({ length: glyphs }).map((_, i) => {
                  const gone = i < destroyed;
                  const frontier = i === destroyed - 1 && localP < 1;
                  return (
                    <span key={i} className={`${present ? "text-base" : "text-[11px]"} leading-none`}>
                      {gone ? (
                        frontier ? (
                          <span className="qn-burst inline-block">💥</span>
                        ) : (
                          <span className="opacity-0">👾</span>
                        )
                      ) : (
                        <span
                          className="qn-bob inline-block text-fuchsia-400"
                          style={{ animationDelay: `${(i % 6) * 0.12}s` }}
                        >
                          👾
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
