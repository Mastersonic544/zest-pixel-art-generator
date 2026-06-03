/*
  studioHistory.ts — immutable undo/redo stack for Studio grid edits.

  Each snapshot is a full grid copy (number[]). At 48x48 = 2304 entries,
  a single snapshot is ~9 KB. Capping at MAX_DEPTH keeps memory bounded.
*/

const MAX_DEPTH = 50;

export type HistoryStack = {
  undoStack: number[][];
  redoStack: number[][];
};

export function emptyHistory(): HistoryStack {
  return { undoStack: [], redoStack: [] };
}

/**
 * Push the CURRENT grid onto the undo stack before applying a change.
 * Returns a new HistoryStack (immutable update).
 */
export function pushUndo(h: HistoryStack, current: number[]): HistoryStack {
  const undoStack = [...h.undoStack, [...current]];
  if (undoStack.length > MAX_DEPTH) undoStack.shift();
  return { undoStack, redoStack: [] }; // any new edit clears redo
}

/** Undo: restore the previous grid. Returns [newGrid, newHistory] or null. */
export function undo(
  h: HistoryStack,
  current: number[]
): [number[], HistoryStack] | null {
  if (h.undoStack.length === 0) return null;
  const undoStack = [...h.undoStack];
  const prev = undoStack.pop()!;
  const redoStack = [...h.redoStack, [...current]];
  return [prev, { undoStack, redoStack }];
}

/** Redo: re-apply a previously undone change. Returns [newGrid, newHistory] or null. */
export function redo(
  h: HistoryStack,
  current: number[]
): [number[], HistoryStack] | null {
  if (h.redoStack.length === 0) return null;
  const redoStack = [...h.redoStack];
  const next = redoStack.pop()!;
  const undoStack = [...h.undoStack, [...current]];
  return [next, { undoStack, redoStack }];
}
