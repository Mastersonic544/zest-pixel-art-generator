/*
  quantize.ts -- pure, framework-free image quantization for Zest.

  Pipeline:
    source RGBA -> rect (crop or letterbox to square) -> area-averaged
    box downscale to target W x H -> per-cell quantization to nearest
    palette color in perceptual color space -> optional Floyd-Steinberg
    dither in linear-ish RGB error space -> grid of palette Color.id +
    derived stats.

  Why perceptual distance, not raw RGB Euclidean:
    Raw sRGB Euclidean distance weights every channel equally and treats
    sRGB byte values as a linear space, which they aren't. The result is
    that pixels get matched to colors that share a *numeric* RGB triple
    rather than a perceptually similar color. In practice this produces
    the "two reds where one would do" problem: a pure red gets quantized
    to a dark muddy red instead of a saturated orange that is actually
    perceptually closer (chroma matters more than the L channel in the
    saturated reds). CIEDE2000 in CIE L*a*b* is the gold standard for
    perceptual color difference; we use it everywhere.
*/

import type { Color, Palette, DerivedStats } from "./types";

/* ----------------------------------------------------------------------- */
/* Input shapes                                                            */
/* ----------------------------------------------------------------------- */

export type ImageRGBA = {
  /** RGBA bytes, length = width * height * 4. */
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
};

export type Rect = { x: number; y: number; w: number; h: number };

export type FitMode =
  | { kind: "crop"; rect?: Rect }
  | { kind: "letterbox"; padColorId: number };

export type QuantizeOptions = {
  source: ImageRGBA;
  target: { width: number; height: number };
  palette: Palette;
  fit: FitMode;
  /** Default false; PRD section 5.4. */
  dither?: boolean;
  /** Counts strictly less than this are flagged; PRD section 5.5 default = 4. */
  lowCountThreshold?: number;
};

export type QuantizeResult = {
  grid: number[]; // length = target.width * target.height, values are Color.id
  stats: DerivedStats;
};

/* ----------------------------------------------------------------------- */
/* Color parsing                                                           */
/* ----------------------------------------------------------------------- */

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m || !m[1]) throw new Error(`Invalid hex: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/* ----------------------------------------------------------------------- */
/* sRGB <-> linear RGB <-> XYZ (D65) <-> CIE L*a*b*                        */
/* ----------------------------------------------------------------------- */

export function srgbToLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** sRGB primaries, D65 white point. Input r,g,b in 0..255. Output X,Y,Z in 0..~1. */
function rgbToXyz(r: number, g: number, b: number): [number, number, number] {
  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);
  const X = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375;
  const Y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750;
  const Z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041;
  return [X, Y, Z];
}

// D65 reference white, normalized so Y = 1.
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;
const DELTA = 6 / 29;
const DELTA3 = DELTA * DELTA * DELTA; // ~ 0.008856

function labF(t: number): number {
  return t > DELTA3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29;
}

export function rgbToLab(
  r: number,
  g: number,
  b: number
): [number, number, number] {
  const [X, Y, Z] = rgbToXyz(r, g, b);
  const fx = labF(X / XN);
  const fy = labF(Y / YN);
  const fz = labF(Z / ZN);
  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bb = 200 * (fy - fz);
  return [L, a, bb];
}

/* ----------------------------------------------------------------------- */
/* CIEDE2000                                                               */
/*                                                                         */
/* Reference: Sharma, Wu, Dalal (2005), "The CIEDE2000 color-difference    */
/* formula: implementation notes, supplementary test data, and             */
/* mathematical observations." Standard kL = kC = kH = 1.                  */
/* ----------------------------------------------------------------------- */

export function ciede2000(
  lab1: [number, number, number],
  lab2: [number, number, number]
): number {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = atan2deg(b1, a1p);
  const h2p = atan2deg(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    let diff = h2p - h1p;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    dhp = diff;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(deg2rad(dhp / 2));

  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else {
    const sum = h1p + h2p;
    const diff = Math.abs(h1p - h2p);
    if (diff <= 180) {
      hbarp = sum / 2;
    } else if (sum < 360) {
      hbarp = (sum + 360) / 2;
    } else {
      hbarp = (sum - 360) / 2;
    }
  }

  const T =
    1 -
    0.17 * Math.cos(deg2rad(hbarp - 30)) +
    0.24 * Math.cos(deg2rad(2 * hbarp)) +
    0.32 * Math.cos(deg2rad(3 * hbarp + 6)) -
    0.20 * Math.cos(deg2rad(4 * hbarp - 63));

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));

  const SL =
    1 +
    (0.015 * Math.pow(Lbar - 50, 2)) /
      Math.sqrt(20 + Math.pow(Lbar - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(deg2rad(2 * dTheta)) * Rc;

  const dE = Math.sqrt(
    (dLp / SL) ** 2 +
      (dCp / SC) ** 2 +
      (dHp / SH) ** 2 +
      RT * (dCp / SC) * (dHp / SH)
  );
  return dE;
}

function atan2deg(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  let deg = Math.atan2(y, x) * (180 / Math.PI);
  if (deg < 0) deg += 360;
  return deg;
}
function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

/* ----------------------------------------------------------------------- */
/* Resampling                                                              */
/* ----------------------------------------------------------------------- */

/** Default crop: a centered square of side min(w,h). */
export function defaultCenterCrop(srcW: number, srcH: number): Rect {
  const s = Math.min(srcW, srcH);
  return { x: (srcW - s) / 2, y: (srcH - s) / 2, w: s, h: s };
}

/** Letterbox rect: a centered square of side max(w,h); extends beyond source. */
function letterboxRect(srcW: number, srcH: number): Rect {
  const s = Math.max(srcW, srcH);
  return { x: -(s - srcW) / 2, y: -(s - srcH) / 2, w: s, h: s };
}

/**
 * Area-averaging box downscale of `source` over `rect` into a targetW x targetH
 * grid of RGB triples (Float64Array, length = targetW*targetH*3, channels 0..255).
 *
 * If `padRgb` is provided, samples taken from outside the source image are
 * treated as that color (letterbox semantics). Without `padRgb`, out-of-source
 * samples are simply excluded from the average for that cell.
 *
 * The math: for each target cell, compute the source rectangle it covers in
 * pixel space, then sum per-source-pixel area * pixel_color, dividing by the
 * total covered area. Fractional pixels at cell edges contribute proportional
 * area. This is mathematically equivalent to convolving the source with a box
 * filter of width = source_per_target and sampling at cell centers, but is
 * exact for arbitrary rational scale factors.
 */
export function boxResample(
  source: ImageRGBA,
  rect: Rect,
  targetW: number,
  targetH: number,
  padRgb?: [number, number, number]
): Float64Array {
  if (targetW <= 0 || targetH <= 0) {
    throw new Error("Target dimensions must be positive");
  }
  if (rect.w <= 0 || rect.h <= 0) {
    throw new Error("Source rect must have positive area");
  }

  const { data, width: sw, height: sh } = source;
  const out = new Float64Array(targetW * targetH * 3);

  const cellW = rect.w / targetW;
  const cellH = rect.h / targetH;
  const padR = padRgb ? padRgb[0] : 0;
  const padG = padRgb ? padRgb[1] : 0;
  const padB = padRgb ? padRgb[2] : 0;
  const usePad = padRgb !== undefined;

  for (let ty = 0; ty < targetH; ty++) {
    const sy0 = rect.y + ty * cellH;
    const sy1 = sy0 + cellH;
    const py0 = Math.floor(sy0);
    const py1 = Math.ceil(sy1);

    for (let tx = 0; tx < targetW; tx++) {
      const sx0 = rect.x + tx * cellW;
      const sx1 = sx0 + cellW;
      const px0 = Math.floor(sx0);
      const px1 = Math.ceil(sx1);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;

      for (let py = py0; py < py1; py++) {
        const dy = Math.max(0, Math.min(py + 1, sy1) - Math.max(py, sy0));
        if (dy <= 0) continue;
        for (let px = px0; px < px1; px++) {
          const dx = Math.max(0, Math.min(px + 1, sx1) - Math.max(px, sx0));
          if (dx <= 0) continue;
          const area = dx * dy;
          if (px >= 0 && px < sw && py >= 0 && py < sh) {
            const idx = (py * sw + px) * 4;
            rSum += (data[idx] ?? 0) * area;
            gSum += (data[idx + 1] ?? 0) * area;
            bSum += (data[idx + 2] ?? 0) * area;
            aSum += area;
          } else if (usePad) {
            rSum += padR * area;
            gSum += padG * area;
            bSum += padB * area;
            aSum += area;
          }
        }
      }

      const o = (ty * targetW + tx) * 3;
      if (aSum > 0) {
        out[o] = rSum / aSum;
        out[o + 1] = gSum / aSum;
        out[o + 2] = bSum / aSum;
      } else {
        // No coverage at all (cell entirely outside source and no pad color).
        // Fall back to black; in practice this only fires for crop with rect
        // entirely outside source, which is a caller bug.
        out[o] = 0;
        out[o + 1] = 0;
        out[o + 2] = 0;
      }
    }
  }
  return out;
}

/* ----------------------------------------------------------------------- */
/* Quantization                                                            */
/* ----------------------------------------------------------------------- */

type PreparedSwatch = {
  id: number;
  rgb: [number, number, number];
  lab: [number, number, number];
};

export function preparePalette(palette: Palette): PreparedSwatch[] {
  return palette.colors.map((c: Color) => {
    const rgb = hexToRgb(c.hex);
    const lab = rgbToLab(rgb[0], rgb[1], rgb[2]);
    return { id: c.id, rgb, lab };
  });
}

/** Pick the palette swatch with the smallest CIEDE2000 distance to (r,g,b). */
export function nearestColor(
  r: number,
  g: number,
  b: number,
  prepared: PreparedSwatch[]
): PreparedSwatch {
  if (prepared.length === 0) throw new Error("Palette is empty");
  const lab = rgbToLab(r, g, b);
  let best = prepared[0]!;
  let bestD = ciede2000(lab, best.lab);
  for (let i = 1; i < prepared.length; i++) {
    const sw = prepared[i]!;
    const d = ciede2000(lab, sw.lab);
    if (d < bestD) {
      bestD = d;
      best = sw;
    }
  }
  return best;
}

/* ----------------------------------------------------------------------- */
/* Floyd-Steinberg                                                         */
/*                                                                         */
/* Error is distributed in the post-resample RGB space (0..255 floats).    */
/* This is the conventional approach; doing it in linear-light RGB shifts  */
/* mid-tones unpleasantly for typical LEGO palettes. The dither is for     */
/* perceived "more colors used" in flat regions, and the standard sRGB     */
/* error diffusion produces the result builders intuitively expect.        */
/* ----------------------------------------------------------------------- */

function floydSteinberg(
  buf: Float64Array,
  width: number,
  height: number,
  prepared: PreparedSwatch[]
): number[] {
  const grid: number[] = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const r = clamp255(buf[i] ?? 0);
      const g = clamp255(buf[i + 1] ?? 0);
      const b = clamp255(buf[i + 2] ?? 0);

      const sw = nearestColor(r, g, b, prepared);
      grid[y * width + x] = sw.id;

      const er = r - sw.rgb[0];
      const eg = g - sw.rgb[1];
      const eb = b - sw.rgb[2];

      diffuse(buf, x + 1, y,     width, height, er, eg, eb, 7 / 16);
      diffuse(buf, x - 1, y + 1, width, height, er, eg, eb, 3 / 16);
      diffuse(buf, x,     y + 1, width, height, er, eg, eb, 5 / 16);
      diffuse(buf, x + 1, y + 1, width, height, er, eg, eb, 1 / 16);
    }
  }
  return grid;
}

function diffuse(
  buf: Float64Array,
  x: number,
  y: number,
  w: number,
  h: number,
  er: number,
  eg: number,
  eb: number,
  factor: number
): void {
  if (x < 0 || x >= w || y < 0 || y >= h) return;
  const i = (y * w + x) * 3;
  buf[i] = (buf[i] ?? 0) + er * factor;
  buf[i + 1] = (buf[i + 1] ?? 0) + eg * factor;
  buf[i + 2] = (buf[i + 2] ?? 0) + eb * factor;
}

function clamp255(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

/* ----------------------------------------------------------------------- */
/* Derived stats                                                           */
/* ----------------------------------------------------------------------- */

export function computeStats(
  grid: number[],
  palette: Palette,
  lowCountThreshold: number
): DerivedStats {
  const counts = new Map<number, number>();
  for (const c of palette.colors) counts.set(c.id, 0);
  for (const id of grid) counts.set(id, (counts.get(id) ?? 0) + 1);

  const perColor: { id: number; count: number }[] = [];
  let distinct = 0;
  const lowCountColorIds: number[] = [];
  for (const c of palette.colors) {
    const n = counts.get(c.id) ?? 0;
    perColor.push({ id: c.id, count: n });
    if (n > 0) distinct++;
    if (n > 0 && n < lowCountThreshold) lowCountColorIds.push(c.id);
  }

  return {
    totalPieces: grid.length,
    distinctColors: distinct,
    perColor,
    lowCountColorIds,
  };
}

/* ----------------------------------------------------------------------- */
/* Main entry                                                              */
/* ----------------------------------------------------------------------- */

export function quantize(opts: QuantizeOptions): QuantizeResult {
  const { source, target, palette, fit } = opts;
  const dither = opts.dither ?? false;
  const lowCountThreshold = opts.lowCountThreshold ?? 4;

  if (palette.colors.length === 0) throw new Error("Palette is empty");
  if (target.width <= 0 || target.height <= 0) {
    throw new Error("Target dimensions must be positive");
  }
  if (source.width <= 0 || source.height <= 0) {
    throw new Error("Source dimensions must be positive");
  }

  let rect: Rect;
  let padRgb: [number, number, number] | undefined;

  if (fit.kind === "crop") {
    rect = fit.rect ?? defaultCenterCrop(source.width, source.height);
  } else {
    const padColor = palette.colors.find((c) => c.id === fit.padColorId);
    if (!padColor) {
      throw new Error(`Letterbox pad color id ${fit.padColorId} not in palette`);
    }
    padRgb = hexToRgb(padColor.hex);
    rect = letterboxRect(source.width, source.height);
  }

  const buf = boxResample(source, rect, target.width, target.height, padRgb);
  const prepared = preparePalette(palette);

  let grid: number[];
  if (dither) {
    grid = floydSteinberg(buf, target.width, target.height, prepared);
  } else {
    grid = new Array(target.width * target.height);
    for (let i = 0, p = 0; i < grid.length; i++, p += 3) {
      const sw = nearestColor(
        clamp255(buf[p] ?? 0),
        clamp255(buf[p + 1] ?? 0),
        clamp255(buf[p + 2] ?? 0),
        prepared
      );
      grid[i] = sw.id;
    }
  }

  const stats = computeStats(grid, palette, lowCountThreshold);
  return { grid, stats };
}
