/* ====================================================================
   PIXEL SPRITE DATA — 8-bit character grids + colour helpers
   --------------------------------------------------------------------
   Framework-free data for the avatar sprites (no JSX). Each character is
   a left-right-symmetric pixel grid, authored as its LEFT HALF (6 columns
   incl. the centre) and mirrored to a full 11-wide row at render time.
   Pixel chars: 'W' white, 'K' near-black, 'D' a dark shade of the tile
   colour, 'L' a light shade, ' ' transparent (the tile shows through).
   The renderer (PixelSprite) lives in pixelAvatar.jsx.
   ==================================================================== */

// Each sprite = array of 6-char LEFT-half rows (col 5 is the centre column).
export const SPRITES = {
  ghost: ["   WWW", "  WWWW", " WWWWW", " WKKWW", " WKKWW", " WWWWW", " WWWWW", " WWWWW", " WWWWW", " W W W"],
  invader: ["  W   ", "   W  ", "  WWWW", " WW K ", "WWWWWW", "W WWWW", "W W   ", "   WW "],
  robot: ["     W", "   WWW", "  WWWW", " WKWWW", " WWWWW", "WWWWWW", "W WWWW", "W WWWW", "  D   "],
  alien: ["  WWWW", " WWWWW", "WWWWWW", "WKKWWW", "WWWWWW", " WWWWW", "  WWWW", "  W   "],
  slime: ["   WWW", "  WWWW", " WWWWW", " WKWWW", " WWWWW", "WWWWWW", "WWWWWW", "W WW W"],
  skull: ["  WWWW", " WWWWW", "WWWWWW", "WKKWWW", "WKKWWW", "WWWWWW", " WWWWW", " WKWKW"],
  ufo: ["   WWW", "  WLLL", "WWWWWW", "DKDKDK", " WWWWW", "  D  D"],
  heart: [" WWW  ", "WWWWWW", "WWWWWW", " WWWWW", "  WWWW", "   WWW", "    WW", "     W"],
  star: ["     W", "    WW", "WWWWWW", " WWWWW", "  WWWW", "  WWWW", " WW WW"],
  mushroom: ["  WWWW", " WWWWW", "WDWWWW", "WWWWWW", "   WWW", "   WKW", "   WWW"],
};

export const SPRITE_KEYS = Object.keys(SPRITES);

/** Lighten (amt>0, toward white) or darken (amt<0, toward black) a #rrggbb colour. */
export function shade(hex, amt) {
  const h = String(hex || "").replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return hex;
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  if (amt < 0) {
    const f = 1 + amt;
    r *= f;
    g *= f;
    b *= f;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  const to = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return "#" + to(r) + to(g) + to(b);
}

/** Expand a 6-char left-half row into the full 11-char symmetric row. */
export const mirrorRow = (row) => row + [...row.slice(0, 5)].reverse().join("");
