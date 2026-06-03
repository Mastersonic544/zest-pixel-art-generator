/*
  simplify.ts — auto-suggest color merges for Studio's Simplify action.
  PRD §9: "auto-suggest merges for low-count / perceptually-near color pairs".

  Strategy:
  1. Find all used colors (count > 0) from the current grid.
  2. For each pair, compute CIEDE2000 distance between their palette hexes.
  3. Flag a pair as a candidate if:
     - Either color has count < LOW_COUNT_THRESHOLD, OR
     - Their CIEDE2000 distance < PERCEPTUAL_THRESHOLD.
  4. Sort candidates: low-count pairs first, then by ascending distance.
  5. Return a MergeSuggestion list — caller decides which to apply.

  The caller always approves each suggestion before applying (PRD §9).
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

const LOW_COUNT_THRESHOLD = 4;
const PERCEPTUAL_THRESHOLD = 8; // CIEDE2000 units; <10 is generally "close"

export function computeSuggestions(
  grid: number[],
  palette: Palette
): MergeSuggestion[] {
  // Count usage per color id.
  const counts = new Map<number, number>();
  for (const id of grid) counts.set(id, (counts.get(id) ?? 0) + 1);

  // Only consider colors actually present in this grid.
  const used = palette.colors.filter((c) => (counts.get(c.id) ?? 0) > 0);
  if (used.length < 2) return [];

  // Pre-compute Lab values.
  const labs = new Map<number, [number, number, number]>();
  for (const c of used) {
    try {
      const [r, g, b] = hexToRgb(c.hex);
      labs.set(c.id, rgbToLab(r, g, b));
    } catch {
      // Skip colors with invalid hex.
    }
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

      let reason: MergeSuggestion["reason"] =
        (isLowA || isLowB) && isNear
          ? "both"
          : isLowA || isLowB
          ? "low-count"
          : "perceptually-near";

      // Suggest merging the lower-count (or lighter/smaller-id) into the higher.
      const [fromColor, fromCount, toColor, toCount] =
        countA <= countB
          ? [a, countA, b, countB]
          : [b, countB, a, countA];

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

  // Sort: "both" first, then "low-count", then "perceptually-near"; within
  // each group, ascending distance.
  const RANK: Record<MergeSuggestion["reason"], number> = {
    both: 0,
    "low-count": 1,
    "perceptually-near": 2,
  };

  return suggestions.sort(
    (a, b) => RANK[a.reason] - RANK[b.reason] || a.distance - b.distance
  );
}

/** Apply a merge: replace all occurrences of fromId with toId in the grid. */
export function applyMerge(
  grid: number[],
  fromId: number,
  toId: number
): number[] {
  return grid.map((id) => (id === fromId ? toId : id));
}
