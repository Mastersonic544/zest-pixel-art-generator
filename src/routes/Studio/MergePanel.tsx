/*
  MergePanel — two-step Merge colors action.
  Pick color A (replace this), pick color B (keep this), confirm.
  PRD §9: "headline Studio feature".
*/

import { useState } from "react";
import type { Color } from "@/lib/types";

type Props = {
  colors: Color[];
  counts: Map<number, number>;
  onMerge: (fromId: number, toId: number) => void;
};

export default function MergePanel({ colors, counts, onMerge }: Props) {
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);

  const used = colors.filter((c) => (counts.get(c.id) ?? 0) > 0);

  const fromColor = fromId !== null ? colors.find((c) => c.id === fromId) : null;
  const toColor = toId !== null ? colors.find((c) => c.id === toId) : null;

  function handleConfirm() {
    if (fromId !== null && toId !== null && fromId !== toId) {
      onMerge(fromId, toId);
      setFromId(null);
      setToId(null);
    }
  }

  function reset() {
    setFromId(null);
    setToId(null);
  }

  return (
    <div className="mp-panel">
      <p className="mp-desc">
        Replace all cells of one color with another. This cannot be undone
        without using undo.
      </p>

      <div className="mp-steps">
        {/* Step 1: pick source */}
        <div className="mp-step">
          <span className="mp-step-label">Replace</span>
          <ColorPickRow
            colors={used}
            counts={counts}
            selected={fromId}
            exclude={toId}
            onSelect={setFromId}
          />
          {fromColor && (
            <div className="mp-chosen">
              <span className="mp-chosen-chip" style={{ background: fromColor.hex }} />
              <span className="mp-chosen-name">{fromColor.name}</span>
              <span className="num mp-chosen-count">
                {counts.get(fromColor.id) ?? 0}
              </span>
            </div>
          )}
        </div>

        <div className="mp-arrow" aria-hidden="true">with</div>

        {/* Step 2: pick target */}
        <div className="mp-step">
          <span className="mp-step-label">Keep</span>
          <ColorPickRow
            colors={used}
            counts={counts}
            selected={toId}
            exclude={fromId}
            onSelect={setToId}
          />
          {toColor && (
            <div className="mp-chosen">
              <span className="mp-chosen-chip" style={{ background: toColor.hex }} />
              <span className="mp-chosen-name">{toColor.name}</span>
              <span className="num mp-chosen-count">
                {counts.get(toColor.id) ?? 0}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="mp-actions">
        <button
          className="btn btn-primary"
          onClick={handleConfirm}
          disabled={fromId === null || toId === null || fromId === toId}
        >
          Merge
        </button>
        <button className="btn btn-ghost" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-component: scrollable inline color swatch row                  */
/* ------------------------------------------------------------------ */

type PickRowProps = {
  colors: Color[];
  counts: Map<number, number>;
  selected: number | null;
  exclude: number | null;
  onSelect: (id: number) => void;
};

function ColorPickRow({ colors, counts, selected, exclude, onSelect }: PickRowProps) {
  return (
    <div className="mp-pick-row" role="listbox">
      {colors
        .filter((c) => c.id !== exclude)
        .map((c) => (
          <button
            key={c.id}
            className={`mp-pick-swatch${selected === c.id ? " is-selected" : ""}`}
            style={{ background: c.hex }}
            onClick={() => onSelect(c.id)}
            role="option"
            aria-selected={selected === c.id}
            aria-label={`${c.name}, ${counts.get(c.id) ?? 0} pieces`}
            title={`${c.name} (${counts.get(c.id) ?? 0})`}
          />
        ))}
    </div>
  );
}
