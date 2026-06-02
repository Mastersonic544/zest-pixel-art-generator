/*
  assembly.ts — pure step-sequence computation for guided assembly.

  PRD §6.5: three modes.
    by-color  — all cells of color id 1, then 2, … Ordered by Color.id
                (ascending) so the bag number = Color.id exactly.
    by-quarter — four quadrants TL / TR / BL / BR, fill one before next.
    by-line   — one row at a time, top to bottom.

  Numbering: every step that references a color uses Color.id from the
  project's paletteSnapshot — the same id used in Code mode, stats, and
  bag labels. PRD §8: one numbering system end-to-end.

  All functions are pure (no React, no side effects).
*/

import type { Project, Color } from "./types";

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type AssemblyMode = "by-color" | "by-quarter" | "by-line";

export type AssemblyStep = {
  /** Human-readable step label. */
  label: string;
  /** 0-indexed cell positions that are active (to place) in this step. */
  activeIndices: ReadonlySet<number>;
  /**
   * Discriminated detail for the step panel.
   * byColor steps carry color metadata; others carry positional metadata.
   */
  detail:
    | { kind: "color"; colorId: number; colorName: string; colorHex: string; bagNumber: number; count: number }
    | { kind: "quarter"; quadrant: 1 | 2 | 3 | 4; label: string; count: number }
    | { kind: "line"; row: number; count: number };
};

export type AssemblyPlan = {
  mode: AssemblyMode;
  steps: AssemblyStep[];
  /** All cell indices — used by the mini-map. */
  totalIndices: number;
};

/* ------------------------------------------------------------------ */
/* By-color                                                           */
/* ------------------------------------------------------------------ */

function buildByColor(project: Project): AssemblyStep[] {
  const { width, height, grid, paletteSnapshot } = project;
  const total = width * height;

  // Build id -> Color lookup.
  const colorById = new Map<number, Color>();
  for (const c of paletteSnapshot.colors) colorById.set(c.id, c);

  // Collect cell indices per color id, maintaining id order.
  const indexMap = new Map<number, number[]>();
  for (let i = 0; i < total; i++) {
    const id = grid[i];
    if (id === undefined) continue;
    const arr = indexMap.get(id);
    if (arr) arr.push(i);
    else indexMap.set(id, [i]);
  }

  // Sort by Color.id ascending — this matches Code mode numbering.
  const usedIds = [...indexMap.keys()].sort((a, b) => a - b);

  return usedIds.map((id, stepIdx) => {
    const indices = indexMap.get(id)!;
    const color = colorById.get(id);
    const name = color?.name ?? `Color ${id}`;
    const hex = color?.hex ?? "#888888";
    const colorCount = usedIds.length;
    return {
      label: `Color ${stepIdx + 1} of ${colorCount}`,
      activeIndices: new Set(indices),
      detail: {
        kind: "color",
        colorId: id,
        colorName: name,
        colorHex: hex,
        bagNumber: id, // bag number = Color.id per PRD §6.5
        count: indices.length,
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/* By-quarter                                                         */
/* ------------------------------------------------------------------ */

type Quadrant = 1 | 2 | 3 | 4;
const QUADRANT_LABELS: Record<Quadrant, string> = {
  1: "Top left",
  2: "Top right",
  3: "Bottom left",
  4: "Bottom right",
};

function quadrantForCell(
  cellIdx: number,
  width: number,
  height: number
): Quadrant {
  const x = cellIdx % width;
  const y = Math.floor(cellIdx / width);
  const midX = width / 2;
  const midY = height / 2;
  if (x < midX && y < midY) return 1;
  if (x >= midX && y < midY) return 2;
  if (x < midX && y >= midY) return 3;
  return 4;
}

function buildByQuarter(project: Project): AssemblyStep[] {
  const { width, height, grid } = project;
  const total = width * height;

  const quadrantMap = new Map<Quadrant, number[]>([
    [1, []], [2, []], [3, []], [4, []],
  ]);
  for (let i = 0; i < total; i++) {
    if (grid[i] === undefined) continue;
    const q = quadrantForCell(i, width, height);
    quadrantMap.get(q)!.push(i);
  }

  const quads: Quadrant[] = [1, 2, 3, 4];
  return quads.map((q, stepIdx) => {
    const indices = quadrantMap.get(q)!;
    return {
      label: `Quarter ${stepIdx + 1} of 4`,
      activeIndices: new Set(indices),
      detail: {
        kind: "quarter",
        quadrant: q,
        label: QUADRANT_LABELS[q],
        count: indices.length,
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/* By-line                                                            */
/* ------------------------------------------------------------------ */

function buildByLine(project: Project): AssemblyStep[] {
  const { width, height, grid } = project;
  const steps: AssemblyStep[] = [];

  for (let row = 0; row < height; row++) {
    const indices: number[] = [];
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      if (grid[i] !== undefined) indices.push(i);
    }
    steps.push({
      label: `Row ${row + 1} of ${height}`,
      activeIndices: new Set(indices),
      detail: { kind: "line", row, count: indices.length },
    });
  }

  return steps;
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

export function buildAssemblyPlan(
  mode: AssemblyMode,
  project: Project
): AssemblyPlan {
  let steps: AssemblyStep[];
  switch (mode) {
    case "by-color":   steps = buildByColor(project);   break;
    case "by-quarter": steps = buildByQuarter(project); break;
    case "by-line":    steps = buildByLine(project);    break;
  }
  return {
    mode,
    steps,
    totalIndices: project.width * project.height,
  };
}

/**
 * Given a step index and all steps, compute the set of indices that have
 * been completed (all steps strictly before the current one).
 */
export function completedBefore(
  steps: AssemblyStep[],
  stepIndex: number
): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < stepIndex; i++) {
    for (const idx of steps[i]!.activeIndices) out.add(idx);
  }
  return out;
}
