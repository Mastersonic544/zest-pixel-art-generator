/* Produces a real Project from a synthetic source image, so styleguide
   demos render through the same pipeline the create flow will use. */

import { quantize, type ImageRGBA } from "@/lib/quantize";
import { DEFAULT_PALETTE } from "@/lib/defaultPalette";
import type { Project, BaseplateColor } from "@/lib/types";

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * A warm-burst-on-cool composition that exercises a wide chunk of the
 * default LEGO palette: warm core fading through orange and red to a
 * blue periphery, with gentle vertical color drift. Rendered at 4x the
 * target so the area-averaging box filter actually has work to do.
 */
function syntheticSource(targetW: number, targetH: number): ImageRGBA {
  const w = targetW * 4;
  const h = targetH * 4;
  const data = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / maxR;
      const dy = (y - cy) / maxR;
      const r = Math.hypot(dx, dy);

      // Warm burst t fades 1.0 -> 0.0 across the radius.
      const t = Math.max(0, 1 - r * 1.15);

      // Warm core (zest orange) ramps into a deep blue periphery.
      const warmR = 255;
      const warmG = 110;
      const warmB = 35;
      const coolR = 18;
      const coolG = 36;
      const coolB = 88;

      // A slow vertical bias adds yellow at the top and dark at the bottom.
      const v = y / h;
      const bias = Math.sin((v - 0.4) * Math.PI) * 30;

      const R = warmR * t + coolR * (1 - t) + bias * 0.7;
      const G = warmG * t + coolG * (1 - t) + bias * 0.4;
      const B = warmB * t + coolB * (1 - t) - bias * 0.2;

      const i = (y * w + x) * 4;
      data[i] = clamp255(R);
      data[i + 1] = clamp255(G);
      data[i + 2] = clamp255(B);
      data[i + 3] = 255;
    }
  }
  return { data, width: w, height: h };
}

export type SampleOpts = {
  width: number;
  height: number;
  baseplate?: BaseplateColor;
  dithered?: boolean;
  name?: string;
};

export function makeSampleProject(opts: SampleOpts): Project {
  const { width, height } = opts;
  const baseplate: BaseplateColor = opts.baseplate ?? "black";
  const dithered = opts.dithered ?? false;

  const source = syntheticSource(width, height);
  const palette = { ...DEFAULT_PALETTE };
  const { grid } = quantize({
    source,
    target: { width, height },
    palette,
    fit: { kind: "crop" },
    dither: dithered,
  });

  const now = "2026-06-02T00:00:00.000Z";
  return {
    id: `sample-${width}x${height}-${baseplate}-${dithered ? "d" : "f"}`,
    name: opts.name ?? `Sample ${width} x ${height}`,
    createdAt: now,
    updatedAt: now,
    width,
    height,
    baseplate,
    dithered,
    paletteSnapshot: palette,
    grid,
  };
}
