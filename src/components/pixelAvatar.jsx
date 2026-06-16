/* ====================================================================
   PIXEL AVATAR — render an 8-bit character sprite as crisp SVG
   --------------------------------------------------------------------
   Draws one curated pixel character (see pixelSprites.js) in <rect>
   pixels so it looks identical on every device (unlike emoji). Colours
   derive from the avatar tile colour passed in. The avatar identity is
   stored in the existing player `emoji` field (now a sprite KEY), so the
   rest of the app passes it through unchanged.
   ==================================================================== */

import { SPRITES, SPRITE_KEYS, shade, mirrorRow } from "./pixelSprites.js";

const DEFAULT_KEY = SPRITE_KEYS[0];

/**
 * Render one pixel-art character as an SVG. Colours are derived from `color`
 * (the avatar tile) so the sprite reads on top of it.
 * @param {object} props
 * @param {string} props.name A key from SPRITE_KEYS.
 * @param {string} [props.color] The tile colour the sprite sits on.
 * @param {number} [props.size]
 */
export function PixelSprite({ name, color = "#6366f1", size = 24 }) {
  const grid = SPRITES[name] || SPRITES[DEFAULT_KEY];
  const rows = grid.map(mirrorRow);
  const w = 11;
  const h = rows.length;
  const fill = { W: "#ffffff", K: "#1c1917", D: shade(color, -0.42), L: shade(color, 0.4) };
  const rects = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < w; x++) {
      const f = fill[row[x]];
      // a hair of overlap (1.02) avoids sub-pixel seams between rects
      if (f) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={f} />);
    }
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      {rects}
    </svg>
  );
}
