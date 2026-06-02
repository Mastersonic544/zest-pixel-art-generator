import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  rgbToLab,
  ciede2000,
  boxResample,
  defaultCenterCrop,
  preparePalette,
  nearestColor,
  computeStats,
  quantize,
  type ImageRGBA,
} from "./quantize";
import type { Palette } from "./types";

/* --- Test helpers -------------------------------------------------------- */

function makeImage(rgbList: Array<[number, number, number]>, width: number): ImageRGBA {
  const height = rgbList.length / width;
  if (!Number.isInteger(height)) throw new Error("rgbList length must be divisible by width");
  const data = new Uint8ClampedArray(width * height * 4);
  rgbList.forEach(([r, g, b], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  });
  return { data, width, height };
}

function solidImage(w: number, h: number, rgb: [number, number, number]): ImageRGBA {
  return makeImage(new Array(w * h).fill(rgb), w);
}

function palette(colors: Array<{ name: string; hex: string }>): Palette {
  return {
    id: "test",
    name: "test",
    colors: colors.map((c, i) => ({ id: i + 1, name: c.name, hex: c.hex })),
  };
}

/* --- hex / lab / ciede --------------------------------------------------- */

describe("hexToRgb", () => {
  it("parses uppercase, lowercase, with or without #", () => {
    expect(hexToRgb("#FF0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("ff8000")).toEqual([255, 128, 0]);
    expect(hexToRgb("#aabbcc")).toEqual([170, 187, 204]);
  });

  it("throws on invalid input", () => {
    expect(() => hexToRgb("#FFF")).toThrow();
    expect(() => hexToRgb("not-a-color")).toThrow();
  });
});

describe("rgbToLab", () => {
  it("converts pure white near L=100, a=0, b=0", () => {
    const [L, a, b] = rgbToLab(255, 255, 255);
    expect(L).toBeCloseTo(100, 1);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it("converts pure black to L=0", () => {
    const [L, a, b] = rgbToLab(0, 0, 0);
    expect(L).toBeCloseTo(0, 3);
    expect(a).toBeCloseTo(0, 3);
    expect(b).toBeCloseTo(0, 3);
  });

  it("converts pure red close to known sRGB Lab values", () => {
    const [L, a, b] = rgbToLab(255, 0, 0);
    expect(L).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.20, 1);
  });
});

describe("ciede2000", () => {
  it("distance to self is 0", () => {
    const lab = rgbToLab(123, 45, 200);
    expect(ciede2000(lab, lab)).toBeCloseTo(0, 6);
  });

  it("is symmetric", () => {
    const a = rgbToLab(10, 200, 50);
    const b = rgbToLab(180, 90, 220);
    expect(ciede2000(a, b)).toBeCloseTo(ciede2000(b, a), 6);
  });

  it("breaks an RGB tie by hue: prefers same-hue candidate over hue-shifted one", () => {
    // Source: a saturated blue.
    //   Candidate A (#326496): same blue hue, just less chromatic. RGB dist = 50.
    //   Candidate B (#6464C8): blue shifted toward red. RGB dist = 50.
    // RGB Euclidean cannot tell them apart. CIEDE2000 picks A because hue
    // matters perceptually in chromatic regions, and B introduces a hue shift.
    const source = rgbToLab(0x32, 0x64, 0xc8);
    const a = rgbToLab(0x32, 0x64, 0x96);
    const b = rgbToLab(0x64, 0x64, 0xc8);

    const euclA = Math.hypot(0, 0, 0xc8 - 0x96);
    const euclB = Math.hypot(0x64 - 0x32, 0, 0);
    expect(euclA).toBe(euclB); // RGB Euclidean tie

    expect(ciede2000(source, a)).toBeLessThan(ciede2000(source, b));
  });
});

/* --- Resampling --------------------------------------------------------- */

describe("defaultCenterCrop", () => {
  it("returns a centered square of the smaller side", () => {
    expect(defaultCenterCrop(100, 60)).toEqual({ x: 20, y: 0, w: 60, h: 60 });
    expect(defaultCenterCrop(40, 80)).toEqual({ x: 0, y: 20, w: 40, h: 40 });
    expect(defaultCenterCrop(50, 50)).toEqual({ x: 0, y: 0, w: 50, h: 50 });
  });
});

describe("boxResample", () => {
  it("identity resample returns the same pixels", () => {
    const img = makeImage(
      [
        [10, 20, 30],
        [40, 50, 60],
        [70, 80, 90],
        [100, 110, 120],
      ],
      2
    );
    const out = boxResample(img, { x: 0, y: 0, w: 2, h: 2 }, 2, 2);
    expect(Array.from(out)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  });

  it("averages a 4x4 block down to a 2x2 of block means", () => {
    // Top-left quadrant all 100, top-right all 200, bottom-left 50, bottom-right 0.
    const px = (val: number): [number, number, number] => [val, val, val];
    const img = makeImage(
      [
        // row 0
        px(100), px(100), px(200), px(200),
        // row 1
        px(100), px(100), px(200), px(200),
        // row 2
        px(50),  px(50),  px(0),   px(0),
        // row 3
        px(50),  px(50),  px(0),   px(0),
      ],
      4
    );
    const out = boxResample(img, { x: 0, y: 0, w: 4, h: 4 }, 2, 2);
    // Each target cell == its quadrant's mean.
    expect(out[0]).toBeCloseTo(100, 6);
    expect(out[3]).toBeCloseTo(200, 6);
    expect(out[6]).toBeCloseTo(50, 6);
    expect(out[9]).toBeCloseTo(0, 6);
  });

  it("uses padRgb when the rect extends past the source", () => {
    const img = solidImage(2, 2, [100, 100, 100]);
    // Rect extends one pixel above the source on every side.
    const out = boxResample(img, { x: -1, y: -1, w: 4, h: 4 }, 4, 4, [10, 10, 10]);
    // Corners are entirely outside source -> pad color.
    expect(out[0]).toBeCloseTo(10, 6); // top-left
    expect(out[(0 * 4 + 3) * 3]).toBeCloseTo(10, 6); // top-right
    // Middle cells are entirely inside source -> source color.
    expect(out[(1 * 4 + 1) * 3]).toBeCloseTo(100, 6);
    expect(out[(2 * 4 + 2) * 3]).toBeCloseTo(100, 6);
  });
});

/* --- nearestColor + preparePalette -------------------------------------- */

describe("nearestColor", () => {
  it("breaks an RGB tie perceptually: prefers same-hue blue over hue-shifted blue", () => {
    const pal = palette([
      { name: "Less Chromatic Blue", hex: "#326496" }, // same hue, lower chroma
      { name: "Reddish Blue",        hex: "#6464C8" }, // hue shifted toward red
    ]);
    const prepared = preparePalette(pal);
    const picked = nearestColor(0x32, 0x64, 0xc8, prepared);
    expect(picked.id).toBe(1); // Less Chromatic Blue
  });

  it("matches an exact palette color to itself", () => {
    const pal = palette([
      { name: "Red",   hex: "#FF0000" },
      { name: "Green", hex: "#00FF00" },
      { name: "Blue",  hex: "#0000FF" },
    ]);
    const prepared = preparePalette(pal);
    expect(nearestColor(255, 0, 0, prepared).id).toBe(1);
    expect(nearestColor(0, 255, 0, prepared).id).toBe(2);
    expect(nearestColor(0, 0, 255, prepared).id).toBe(3);
  });
});

/* --- quantize: end-to-end ---------------------------------------------- */

describe("quantize", () => {
  it("maps a solid-color image to a single palette color and totals match", () => {
    const pal = palette([
      { name: "Black", hex: "#000000" },
      { name: "Red",   hex: "#FF0000" },
      { name: "White", hex: "#FFFFFF" },
    ]);
    const img = solidImage(8, 8, [250, 5, 5]); // basically red
    const { grid, stats } = quantize({
      source: img,
      target: { width: 4, height: 4 },
      palette: pal,
      fit: { kind: "crop" },
    });
    expect(new Set(grid).size).toBe(1);
    expect(grid[0]).toBe(2); // Red
    expect(stats.totalPieces).toBe(16);
    expect(stats.distinctColors).toBe(1);
    const sum = stats.perColor.reduce((s, c) => s + c.count, 0);
    expect(sum).toBe(16);
    const red = stats.perColor.find((c) => c.id === 2);
    expect(red?.count).toBe(16);
  });

  it("produces the expected grid for a known horizontal black-to-white gradient", () => {
    // 4x4 source: cols 0/85/170/255 (replicated across 4 rows).
    const colByX = [0, 85, 170, 255];
    const px: Array<[number, number, number]> = [];
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const v = colByX[x]!;
        px.push([v, v, v]);
      }
    }
    const img = makeImage(px, 4);

    const pal = palette([
      { name: "Black", hex: "#000000" },
      { name: "Gray",  hex: "#808080" },
      { name: "White", hex: "#FFFFFF" },
    ]);

    const { grid, stats } = quantize({
      source: img,
      target: { width: 2, height: 2 },
      palette: pal,
      fit: { kind: "crop" },
    });

    // Each target cell averages 2x2 source pixels:
    //   (0,0) and (0,1): avg(0,85)   = 42.5  -> Black (id 1)
    //   (1,0) and (1,1): avg(170,255)= 212.5 -> White (id 3)
    expect(grid).toEqual([1, 3, 1, 3]);
    expect(stats.distinctColors).toBe(2);
  });

  it("counts always sum to width * height for arbitrary input", () => {
    const pal = palette([
      { name: "A", hex: "#102030" },
      { name: "B", hex: "#FF8800" },
      { name: "C", hex: "#33CCFF" },
      { name: "D", hex: "#EEEEEE" },
    ]);
    // A noisy 12x12 image.
    const px: Array<[number, number, number]> = [];
    for (let i = 0; i < 144; i++) {
      px.push([(i * 17) % 256, (i * 41) % 256, (i * 73) % 256]);
    }
    const img = makeImage(px, 12);

    for (const W of [4, 6, 8]) {
      const { grid, stats } = quantize({
        source: img,
        target: { width: W, height: W },
        palette: pal,
        fit: { kind: "crop" },
        dither: false,
      });
      expect(grid).toHaveLength(W * W);
      const sum = stats.perColor.reduce((s, c) => s + c.count, 0);
      expect(sum).toBe(W * W);
      expect(stats.totalPieces).toBe(W * W);
    }
  });

  it("perceptual quantization breaks an RGB tie by hue", () => {
    // Source: a saturated blue. Two palette candidates equidistant in RGB:
    //   id 1 same-hue lower-chroma blue; id 2 reddish-blue with hue shift.
    // CIEDE2000 picks id 1; raw RGB would tie or arbitrary-choose.
    const pal = palette([
      { name: "Less Chromatic Blue", hex: "#326496" },
      { name: "Reddish Blue",        hex: "#6464C8" },
    ]);
    const img = solidImage(4, 4, [0x32, 0x64, 0xc8]);
    const { grid } = quantize({
      source: img,
      target: { width: 2, height: 2 },
      palette: pal,
      fit: { kind: "crop" },
    });
    expect(new Set(grid).size).toBe(1);
    expect(grid[0]).toBe(1);
  });

  it("flags low-count colors below the threshold", () => {
    // 4x4 grid: 15 red pixels and 1 white pixel.
    const px: Array<[number, number, number]> = new Array(16).fill([255, 0, 0]);
    px[7] = [255, 255, 255];
    const img = makeImage(px, 4);

    const pal = palette([
      { name: "Red",   hex: "#FF0000" },
      { name: "White", hex: "#FFFFFF" },
    ]);
    const { stats } = quantize({
      source: img,
      target: { width: 4, height: 4 },
      palette: pal,
      fit: { kind: "crop" },
      lowCountThreshold: 4,
    });
    // The exact downscale puts one white pixel through. White count = 1 < 4.
    expect(stats.lowCountColorIds).toContain(2);
    expect(stats.lowCountColorIds).not.toContain(1);
  });

  it("dithering on uses more distinct colors than dithering off for a flat off-palette input", () => {
    const pal = palette([
      { name: "Black", hex: "#000000" },
      { name: "Gray",  hex: "#808080" },
      { name: "White", hex: "#FFFFFF" },
    ]);
    // A flat (180,180,180) field. Without dither every cell -> Gray.
    // With Floyd-Steinberg the error builds and pushes some cells to White.
    const img = solidImage(8, 8, [180, 180, 180]);

    const flat = quantize({
      source: img,
      target: { width: 8, height: 8 },
      palette: pal,
      fit: { kind: "crop" },
      dither: false,
    });
    const dithered = quantize({
      source: img,
      target: { width: 8, height: 8 },
      palette: pal,
      fit: { kind: "crop" },
      dither: true,
    });
    expect(flat.stats.distinctColors).toBe(1);
    expect(dithered.stats.distinctColors).toBeGreaterThan(1);
  });

  it("letterbox pads non-square source with the requested palette color", () => {
    // 4x2 source of fully saturated green; pad with id=2 (red).
    const img = solidImage(4, 2, [0, 200, 0]);
    const pal = palette([
      { name: "Green", hex: "#00C800" },
      { name: "Red",   hex: "#FF0000" },
    ]);
    const { grid } = quantize({
      source: img,
      target: { width: 4, height: 4 },
      palette: pal,
      fit: { kind: "letterbox", padColorId: 2 },
    });
    // Top row and bottom row are pad (id 2). Middle two rows are source (id 1).
    expect(grid.slice(0, 4)).toEqual([2, 2, 2, 2]);
    expect(grid.slice(4, 8)).toEqual([1, 1, 1, 1]);
    expect(grid.slice(8, 12)).toEqual([1, 1, 1, 1]);
    expect(grid.slice(12, 16)).toEqual([2, 2, 2, 2]);
  });

  it("respects an explicit crop rect", () => {
    // 8x8 image: left half red, right half blue.
    const px: Array<[number, number, number]> = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        px.push(x < 4 ? [255, 0, 0] : [0, 0, 255]);
      }
    }
    const img = makeImage(px, 8);
    const pal = palette([
      { name: "Red",  hex: "#FF0000" },
      { name: "Blue", hex: "#0000FF" },
    ]);

    // Crop only the left (red) half.
    const { grid } = quantize({
      source: img,
      target: { width: 2, height: 2 },
      palette: pal,
      fit: { kind: "crop", rect: { x: 0, y: 0, w: 4, h: 8 } },
    });
    expect(grid).toEqual([1, 1, 1, 1]);
  });

  it("throws on an empty palette or invalid dimensions", () => {
    const img = solidImage(4, 4, [0, 0, 0]);
    expect(() =>
      quantize({
        source: img,
        target: { width: 4, height: 4 },
        palette: { id: "x", name: "x", colors: [] },
        fit: { kind: "crop" },
      })
    ).toThrow();

    const pal = palette([{ name: "Black", hex: "#000000" }]);
    expect(() =>
      quantize({
        source: img,
        target: { width: 0, height: 4 },
        palette: pal,
        fit: { kind: "crop" },
      })
    ).toThrow();
  });

  it("rejects letterbox with a pad color id not in the palette", () => {
    const img = solidImage(4, 4, [255, 255, 255]);
    const pal = palette([{ name: "Black", hex: "#000000" }]);
    expect(() =>
      quantize({
        source: img,
        target: { width: 4, height: 4 },
        palette: pal,
        fit: { kind: "letterbox", padColorId: 99 },
      })
    ).toThrow();
  });
});

/* --- computeStats: independent unit check ------------------------------- */

describe("computeStats", () => {
  it("returns zero counts for unused palette colors and ignores them in distinct", () => {
    const pal = palette([
      { name: "A", hex: "#FF0000" },
      { name: "B", hex: "#00FF00" },
      { name: "C", hex: "#0000FF" },
    ]);
    const grid = [1, 1, 1, 1, 2, 2];
    const stats = computeStats(grid, pal, 4);
    expect(stats.totalPieces).toBe(6);
    expect(stats.distinctColors).toBe(2);
    expect(stats.perColor).toEqual([
      { id: 1, count: 4 },
      { id: 2, count: 2 },
      { id: 3, count: 0 },
    ]);
    // B is used 2 times (< 4 threshold) -> flagged. C is unused (0) -> NOT flagged.
    expect(stats.lowCountColorIds).toEqual([2]);
  });
});
