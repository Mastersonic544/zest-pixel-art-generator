/*
  simplify.ts — auto-suggest color merges for Studio's Simplify action.

  Two strategies:

  1. computeSuggestions (pair-wise): flags pairs that are perceptually close
     OR have low piece counts. Used for fine-grained review with per-pair
     approve/skip.

  2. computeHueFamilyMerges (hue-family grouping): groups all used colors by
     their perceptual hue family (red, orange, yellow, green, cyan, blue,
     violet, magenta, achromatic). Within each family, merges all members
     into the single most-used color. This is the "group all shades of green
     into one green" behavior — one click, no per-pair approval needed.
*/

import { ciede2000, hexToRgb, rgbToLab } from "./quantize";
import type { Palette } from "./types";

export type MergeSuggestion = {
  /** The color to replace (the "worse" one — lower count or slightly off). */
  fromId: number;
  fromName: string;
  fromHex: string;
  fromCount: number;
  /** The color to keep. */
  toId: number;
  toName: string;
  toHex: string;
  toCount: number;
  /** CIEDE2000 distance. */
  distance: number;
  /** Why we flagged it. */
  reason: "low-count" | "perceptually-near" | "both";
};

/** A ready-to-apply batch of merges produced by hue-family grouping. */
export type FamilyMerge = {
  familyName: string;
  /** All the fromId -> toId pairs. Apply them in order. */
  merges: { fromId: number; fromName: string; fromHex: string; toId: number; toName: string; toHex: string }[];
  /** How many pieces will be recolored. */
  totalRecolored: number;
};

const LOW_COUNT_THRESHOLD = 4;
const PERCEPTUAL_THRESHOLD = 18; // raised from 8 — catches near-shades within a hue family

/* ---------------------------------------------------------------------- */
/* Pair-wise suggestions (fine-grained, per-pair approve/skip)            */
/* ---------------------------------------------------------------------- */

export function computeSuggestions(
  grid: number[],
  palette: Palette
): MergeSuggestion[] {
  const counts = new Map<number, number>();
  for (const id of grid) counts.set(id, (counts.get(id) ?? 0) + 1);

  const used = palette.colors.filter((c) => (counts.get(c.id) ?? 0) > 0);
  if (used.length < 2) return [];

  const labs = new Map<number, [number, number, number]>();
  for (const c of used) {
    try {
      const [r, g, b] = hexToRgb(c.hex);
      labs.set(c.id, rgbToLab(r, g, b));
    } catch { /* skip bad hex */ }
  }

  const suggestions: MergeSuggestion[] = [];

  for (let i = 0; i < used.length; i++) {
    for (let j = i + 1; j < used.length; j++) {
      const a = used[i]!;
      const b = used[j]!;
      const labA = labs.get(a.id);
      const labB = labs.get(b.id);
      if (!labA || !labB) continue;

      const dist = ciede2000(labA, labB);
      const countA = counts.get(a.id) ?? 0;
      const countB = counts.get(b.id) ?? 0;

      const isLowA = countA < LOW_COUNT_THRESHOLD;
      const isLowB = countB < LOW_COUNT_THRESHOLD;
      const isNear = dist < PERCEPTUAL_THRESHOLD;

      if (!isLowA && !isLowB && !isNear) continue;

      const reason: MergeSuggestion["reason"] =
        (isLowA || isLowB) && isNear ? "both"
          : isLowA || isLowB ? "low-count"
          : "perceptually-near";

      const [fromColor, fromCount, toColor, toCount] =
        countA <= countB ? [a, countA, b, countB] : [b, countB, a, countA];

      suggestions.push({
        fromId: fromColor.id,
        fromName: fromColor.name,
        fromHex: fromColor.hex,
        fromCount,
        toId: toColor.id,
        toName: toColor.name,
        toHex: toColor.hex,
        toCount,
        distance: dist,
        reason,
      });
    }
  }

  const RANK: Record<MergeSuggestion["reason"], number> = {
    both: 0, "low-count": 1, "perceptually-near": 2,
  };

  return suggestions.sort(
    (a, b) => RANK[a.reason] - RANK[b.reason] || a.distance - b.distance
  );
}

/* ---------------------------------------------------------------------- */
/* Hue-family grouping — "merge all shades of green into one green"       */
/* ---------------------------------------------------------------------- */

/*
  LCH hue angle families (degrees, 0-360).
  Achromatic = chroma < ACHROMATIC_CHROMA_THRESHOLD.
  These ranges are approximate perceptual buckets — they cover the LEGO
  default palette colors well.
*/
const ACHROMATIC_CHROMA = 12; // Lab chroma below this = grey/white/black

type HueFamily = {
  name: string;
  minH: number;
  maxH: number;
};

const HUE_FAMILIES: HueFamily[] = [
  { name: "Red",     minH: 335, maxH: 360 },
  { name: "Red",     minH:   0, maxH:  20 },
  { name: "Orange",  minH:  20, maxH:  50 },
  { name: "Yellow",  minH:  50, maxH:  80 },
  { name: "Green",   minH:  80, maxH: 165 },
  { name: "Cyan",    minH: 165, maxH: 210 },
  { name: "Blue",    minH: 210, maxH: 265 },
  { name: "Violet",  minH: 265, maxH: 305 },
  { name: "Magenta", minH: 305, maxH: 335 },
];

function labToHue(L: number, a: number, b: number): { hue: number; chroma: number } {
  const chroma = Math.hypot(a, b);
  let hue = Math.atan2(b, a) * (180 / Math.PI);
  if (hue < 0) hue += 360;
  // Suppress unused variable warning — L is used by callers for lightness info
  void L;
  return { hue, chroma };
}

function hueFamilyName(L: number, a: number, b: number): string {
  const { hue, chroma } = labToHue(L, a, b);
  if (chroma < ACHROMATIC_CHROMA) return "Neutral";
  for (const f of HUE_FAMILIES) {
    if (f.minH <= f.maxH) {
      if (hue >= f.minH && hue < f.maxH) return f.name;
    } else {
      // wraps 360->0 (red)
      if (hue >= f.minH || hue < f.maxH) return f.name;
    }
  }
  return "Other";
}

/**
 * Group all used colors by hue family and return one FamilyMerge per family
 * that contains more than one used color. Within each family the most-used
 * color is the "keep" target; all others merge into it.
 *
 * Neutrals (greys, black, white) are grouped separately and only merged if
 * they are perceptually very close (within NEUTRAL_MERGE_DIST).
 */
const NEUTRAL_MERGE_DIST = 12; // CIEDE2000 — only merge very-close neutrals

export function computeHueFamilyMerges(
  grid: number[],
  palette: Palette
): FamilyMerge[] {
  const counts = new Map<number, number>();
  for (const id of grid) counts.set(id, (counts.get(id) ?? 0) + 1);

  const used = palette.colors.filter((c) => (counts.get(c.id) ?? 0) > 0);
  if (used.length < 2) return [];

  // Pre-compute Lab for each used color.
  type ColorWithLab = { id: number; name: string; hex: string; count: number; lab: [number, number, number] };
  const withLab: ColorWithLab[] = [];
  for (const c of used) {
    try {
      const [r, g, b] = hexToRgb(c.hex);
      const lab = rgbToLab(r, g, b);
      withLab.push({ id: c.id, name: c.name, hex: c.hex, count: counts.get(c.id) ?? 0, lab });
    } catch { /* skip */ }
  }

  // Group by hue family name.
  const families = new Map<string, ColorWithLab[]>();
  for (const c of withLab) {
    const fname = hueFamilyName(c.lab[0], c.lab[1], c.lab[2]);
    const arr = families.get(fname);
    if (arr) arr.push(c);
    else families.set(fname, [c]);
  }

  const result: FamilyMerge[] = [];

  for (const [familyName, members] of families) {
    if (members.length < 2) continue;

    // For neutrals, only merge colors that are perceptually very close to
    // the most-used neutral (avoids collapsing white + dark grey together).
    const target = members.reduce((best, c) => c.count > best.count ? c : best);

    let toMerge: ColorWithLab[];
    if (familyName === "Neutral") {
      toMerge = members.filter(
        (c) => c.id !== target.id && ciede2000(c.lab, target.lab) < NEUTRAL_MERGE_DIST
      );
    } else {
      toMerge = members.filter((c) => c.id !== target.id);
    }

    if (toMerge.length === 0) continue;

    result.push({
      familyName,
      merges: toMerge.map((c) => ({
        fromId: c.id,
        fromName: c.name,
        fromHex: c.hex,
        toId: target.id,
        toName: target.name,
        toHex: target.hex,
      })),
      totalRecolored: toMerge.reduce((s, c) => s + c.count, 0),
    });
  }

  // Sort families: chromatic first (most pieces recolored), neutrals last.
  return result.sort((a, b) => {
    if (a.familyName === "Neutral") return 1;
    if (b.familyName === "Neutral") return -1;
    return b.totalRecolored - a.totalRecolored;
  });
}

/** Apply a merge: replace all occurrences of fromId with toId in the grid. */
export function applyMerge(
  grid: number[],
  fromId: number,
  toId: number
): number[] {
  return grid.map((id) => (id === fromId ? toId : id));
}

/** Apply multiple merges in sequence. */
export function applyMerges(
  grid: number[],
  merges: { fromId: number; toId: number }[]
): number[] {
  let g = grid;
  for (const m of merges) g = applyMerge(g, m.fromId, m.toId);
  return g;
}
