/*
  SimplifyPanel — two modes:

  1. By family (default): groups all shades of the same hue family
     (all greens, all reds, etc.) and merges them into the most-used
     member. One "Merge family" button per group, plus "Merge all families"
     at the top. No per-pair approval required for obvious same-hue cases.

  2. By similarity (fine-grained): the original pair-wise CIEDE2000 approach
     with per-pair approve/skip for precise control.
*/

import { useMemo, useState } from "react";
import {
  computeSuggestions,
  computeHueFamilyMerges,
} from "@/lib/simplify";
import type { MergeSuggestion, FamilyMerge } from "@/lib/simplify";
import type { Color, Palette } from "@/lib/types";

type Mode = "family" | "similarity";

type Props = {
  grid: number[];
  palette: Palette;
  onApprove: (fromId: number, toId: number) => void;
  /** Called when multiple merges should be applied at once (family merge). */
  onApproveAll: (merges: { fromId: number; toId: number }[]) => void;
};

const REASON_LABEL: Record<MergeSuggestion["reason"], string> = {
  "both": "Low count + near color",
  "low-count": "Low count",
  "perceptually-near": "Near color",
};

export default function SimplifyPanel({ grid, palette, onApprove, onApproveAll }: Props) {
  const [mode, setMode] = useState<Mode>("family");
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const familyMerges = useMemo(
    () => computeHueFamilyMerges(grid, palette),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, palette]
  );

  const pairSuggestions = useMemo(
    () => computeSuggestions(grid, palette),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grid, palette]
  );

  function pairKey(s: MergeSuggestion) { return `${s.fromId}->${s.toId}`; }
  function familyKey(f: FamilyMerge) { return f.familyName; }

  const activePairs = pairSuggestions.filter((s) => !dismissed.has(pairKey(s)));
  const activeFamilies = familyMerges.filter((f) => !dismissed.has(familyKey(f)));

  const allFamilyMerges = activeFamilies.flatMap((f) => f.merges);

  return (
    <div className="sp-panel">
      {/* Mode tabs */}
      <div className="segmented sp-mode-tabs" role="radiogroup" aria-label="Simplify mode">
        <button
          className={mode === "family" ? "is-active" : ""}
          onClick={() => setMode("family")}
          role="radio"
          aria-checked={mode === "family"}
        >
          By family
        </button>
        <button
          className={mode === "similarity" ? "is-active" : ""}
          onClick={() => setMode("similarity")}
          role="radio"
          aria-checked={mode === "similarity"}
        >
          By similarity
        </button>
      </div>

      {/* --- By family --- */}
      {mode === "family" && (
        <>
          {activeFamilies.length === 0 ? (
            <p className="sp-empty">
              {familyMerges.length === 0
                ? "Each color family has only one member. Nothing to merge."
                : "All families reviewed."}
            </p>
          ) : (
            <>
              <p className="sp-desc">
                Groups shades of the same hue into one color. The most-used
                member of each family is kept.
              </p>

              {/* Merge all button */}
              <button
                className="btn btn-primary"
                onClick={() => {
                  onApproveAll(allFamilyMerges);
                  setDismissed(new Set(activeFamilies.map(familyKey)));
                }}
              >
                Merge all families
                <span className="sp-merge-count">
                  {allFamilyMerges.length} merge{allFamilyMerges.length !== 1 ? "s" : ""}
                </span>
              </button>

              <ol className="sp-list">
                {activeFamilies.map((f) => (
                  <li key={f.familyName} className="sp-item">
                    <div className="sp-family-header">
                      <span className="sp-family-name">{f.familyName}</span>
                      <span className="sp-family-count">
                        {f.merges.length + 1} colors,{" "}
                        {f.totalRecolored.toLocaleString()} pieces recolored
                      </span>
                    </div>

                    <div className="sp-family-colors">
                      {f.merges.map((m) => (
                        <span key={m.fromId} className="sp-family-from">
                          <span className="sp-pill-chip" style={{ background: m.fromHex }} aria-hidden="true" />
                          <span className="sp-pill-name">{m.fromName}</span>
                          <span className="sp-arrow-sm" aria-hidden="true">into</span>
                          <span className="sp-pill-chip sp-pill-chip-to" style={{ background: m.toHex }} aria-hidden="true" />
                          <span className="sp-pill-name">{m.toName}</span>
                        </span>
                      ))}
                    </div>

                    <div className="sp-item-actions">
                      <button
                        className="btn btn-tiny btn-primary"
                        onClick={() => {
                          onApproveAll(f.merges);
                          setDismissed((prev) => new Set([...prev, familyKey(f)]));
                        }}
                      >
                        Merge {f.familyName.toLowerCase()}s
                      </button>
                      <button
                        className="btn btn-tiny btn-ghost"
                        onClick={() =>
                          setDismissed((prev) => new Set([...prev, familyKey(f)]))
                        }
                      >
                        Skip
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}

      {/* --- By similarity --- */}
      {mode === "similarity" && (
        <>
          {activePairs.length === 0 ? (
            <p className="sp-empty">
              {pairSuggestions.length === 0
                ? "No merge candidates found. The color distribution looks clean."
                : "All suggestions reviewed."}
            </p>
          ) : (
            <>
              <p className="sp-desc">
                {activePairs.length} pair{activePairs.length !== 1 ? "s" : ""} flagged.
                Approve to merge, or skip to keep both.
              </p>

              <ol className="sp-list">
                {activePairs.map((s) => (
                  <li key={pairKey(s)} className="sp-item">
                    <div className="sp-item-colors">
                      <ColorPill color={palette.colors.find((c) => c.id === s.fromId)} count={s.fromCount} />
                      <span className="sp-item-arrow" aria-hidden="true">into</span>
                      <ColorPill color={palette.colors.find((c) => c.id === s.toId)} count={s.toCount} />
                    </div>
                    <div className="sp-item-meta">
                      <span className="sp-reason-tag">{REASON_LABEL[s.reason]}</span>
                      <span className="sp-distance">{s.distance.toFixed(1)} CIEDE2000</span>
                    </div>
                    <div className="sp-item-actions">
                      <button
                        className="btn btn-tiny btn-primary"
                        onClick={() => {
                          onApprove(s.fromId, s.toId);
                          setDismissed((prev) => new Set([...prev, pairKey(s)]));
                        }}
                      >
                        Merge
                      </button>
                      <button
                        className="btn btn-tiny btn-ghost"
                        onClick={() =>
                          setDismissed((prev) => new Set([...prev, pairKey(s)]))
                        }
                      >
                        Skip
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </>
      )}
    </div>
  );
}

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
