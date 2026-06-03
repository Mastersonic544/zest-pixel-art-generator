/*
  SimplifyPanel — auto-suggested merges for low-count / perceptually-near pairs.
  PRD §9: "creator approves each".
*/

import { useMemo, useState } from "react";
import { computeSuggestions } from "@/lib/simplify";
import type { MergeSuggestion } from "@/lib/simplify";
import type { Color, Palette } from "@/lib/types";

type Props = {
  grid: number[];
  palette: Palette;
  onApprove: (fromId: number, toId: number) => void;
};

const REASON_LABEL: Record<MergeSuggestion["reason"], string> = {
  "both": "Low count + near color",
  "low-count": "Low count",
  "perceptually-near": "Near color",
};

export default function SimplifyPanel({ grid, palette, onApprove }: Props) {
  const suggestions = useMemo(
    () => computeSuggestions(grid, palette),
    // Recompute when grid reference changes (parent commits a new array).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, palette]
  );

  // Track which suggestions have been dismissed.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  function key(s: MergeSuggestion) {
    return `${s.fromId}->${s.toId}`;
  }

  function dismiss(s: MergeSuggestion) {
    setDismissed((prev) => new Set([...prev, key(s)]));
  }

  const active = suggestions.filter((s) => !dismissed.has(key(s)));

  if (suggestions.length === 0) {
    return (
      <div className="sp-panel">
        <p className="sp-empty">
          No merge candidates found. The color distribution looks clean.
        </p>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="sp-panel">
        <p className="sp-empty">All suggestions reviewed.</p>
      </div>
    );
  }

  return (
    <div className="sp-panel">
      <p className="sp-desc">
        {active.length} suggestion{active.length !== 1 ? "s" : ""}.
        Approve to merge, or skip to keep both colors.
      </p>

      <ol className="sp-list">
        {active.map((s) => (
          <li key={key(s)} className="sp-item">
            <div className="sp-item-colors">
              <ColorPill color={palette.colors.find((c) => c.id === s.fromId)!} count={s.fromCount} />
              <span className="sp-item-arrow" aria-hidden="true">into</span>
              <ColorPill color={palette.colors.find((c) => c.id === s.toId)!} count={s.toCount} />
            </div>
            <div className="sp-item-meta">
              <span className="sp-reason-tag">{REASON_LABEL[s.reason]}</span>
              <span className="sp-distance">
                {s.distance.toFixed(1)} CIEDE2000
              </span>
            </div>
            <div className="sp-item-actions">
              <button
                className="btn btn-tiny btn-primary"
                onClick={() => {
                  onApprove(s.fromId, s.toId);
                  dismiss(s);
                }}
              >
                Merge
              </button>
              <button
                className="btn btn-tiny btn-ghost"
                onClick={() => dismiss(s)}
              >
                Skip
              </button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ColorPill                                                           */
/* ------------------------------------------------------------------ */

function ColorPill({ color, count }: { color: Color | undefined; count: number }) {
  if (!color) return <span className="sp-pill">?</span>;
  return (
    <span className="sp-pill">
      <span className="sp-pill-chip" style={{ background: color.hex }} aria-hidden="true" />
      <span className="sp-pill-name">{color.name}</span>
      <span className="num sp-pill-count">{count}</span>
    </span>
  );
}
