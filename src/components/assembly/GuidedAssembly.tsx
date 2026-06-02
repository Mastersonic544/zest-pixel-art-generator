/*
  GuidedAssembly — in-page guided assembly panel for /build/:shareId.
  PRD §6.5.

  Props:
    project        — the shared project (read-only)
    onHighlight    — called with the active cell set; parent passes to MosaicPreview
    onClose        — called when the builder exits guided mode

  Layout (always visible):
    [Mode selector: By color / By quarter / By line]
    ─────────────────────────────────────────────────
    [Mini-map]  [Step info: label + detail]  [Nav: prev / step counter / next]
    Progress bar
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAssemblyPlan, completedBefore } from "@/lib/assembly";
import type { AssemblyMode, AssemblyStep } from "@/lib/assembly";
import type { Project } from "@/lib/types";
import MiniMap from "./MiniMap";
import "./assembly.css";

type Props = {
  project: Project;
  onHighlight: (active: ReadonlySet<number>) => void;
  onClose: () => void;
};

const MODES: { id: AssemblyMode; label: string }[] = [
  { id: "by-color",   label: "By color"   },
  { id: "by-quarter", label: "By quarter" },
  { id: "by-line",    label: "By line"    },
];

export default function GuidedAssembly({ project, onHighlight, onClose }: Props) {
  const [mode, setMode] = useState<AssemblyMode>("by-color");
  const [stepIdx, setStepIdx] = useState(0);

  const plan = useMemo(() => buildAssemblyPlan(mode, project), [mode, project]);
  const steps = plan.steps;
  const totalSteps = steps.length;

  // Clamp step when mode changes.
  useEffect(() => {
    setStepIdx(0);
  }, [mode]);

  const currentStep: AssemblyStep | undefined = steps[stepIdx];

  // Completed = everything before current step.
  const completedIndices = useMemo(
    () => completedBefore(steps, stepIdx),
    [steps, stepIdx]
  );

  // Notify parent of active indices for the preview highlight.
  useEffect(() => {
    if (currentStep) onHighlight(currentStep.activeIndices);
    else onHighlight(new Set());
  }, [currentStep, onHighlight]);

  const goNext = useCallback(() => {
    setStepIdx((i) => Math.min(i + 1, totalSteps - 1));
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    setStepIdx((i) => Math.max(i - 1, 0));
  }, []);

  // Keyboard: left/right arrows.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  if (!currentStep) return null;

  const pct = totalSteps > 1 ? (stepIdx / (totalSteps - 1)) * 100 : 100;
  const { detail } = currentStep;

  return (
    <div className="ga" aria-label="Guided assembly">

      {/* Top bar: mode selector + close */}
      <div className="ga-topbar">
        <div
          className="segmented"
          role="radiogroup"
          aria-label="Assembly mode"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              className={mode === m.id ? "is-active" : ""}
              onClick={() => setMode(m.id)}
              role="radio"
              aria-checked={mode === m.id}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          className="btn btn-tiny btn-ghost"
          onClick={onClose}
          aria-label="Exit guided assembly"
        >
          Exit
        </button>
      </div>

      {/* Main row: mini-map + step detail + navigation */}
      <div className="ga-main">

        {/* Mini-map — always visible */}
        <div className="ga-minimap-wrap">
          <span className="ga-minimap-label eyebrow">Where am I</span>
          <MiniMap
            project={project}
            completedIndices={completedIndices}
            activeIndices={currentStep.activeIndices}
          />
          <div className="ga-minimap-legend">
            <span className="ga-legend-dot ga-legend-dot-active" /> Current
            <span className="ga-legend-dot ga-legend-dot-done" /> Done
            <span className="ga-legend-dot ga-legend-dot-rem" /> Remaining
          </div>
        </div>

        {/* Step detail */}
        <div className="ga-detail">
          <span className="ga-step-label">{currentStep.label}</span>

          {detail.kind === "color" && (
            <div className="ga-color-detail">
              <span
                className="ga-color-chip"
                style={{ background: detail.colorHex }}
                aria-hidden="true"
              />
              <div className="ga-color-text">
                <span className="ga-color-name">{detail.colorName}</span>
                <span className="ga-color-meta">
                  <span className="ga-bag-badge">Bag {detail.bagNumber}</span>
                  <span className="ga-piece-count">{detail.count.toLocaleString()} piece{detail.count !== 1 ? "s" : ""}</span>
                </span>
              </div>
            </div>
          )}

          {detail.kind === "quarter" && (
            <div className="ga-quarter-detail">
              <span className="ga-quarter-name">{detail.label}</span>
              <span className="ga-piece-count">{detail.count.toLocaleString()} piece{detail.count !== 1 ? "s" : ""}</span>
              <QuadrantDiagram active={detail.quadrant} />
            </div>
          )}

          {detail.kind === "line" && (
            <div className="ga-line-detail">
              <span className="ga-line-name">Row {detail.row + 1}</span>
              <span className="ga-piece-count">{detail.count.toLocaleString()} piece{detail.count !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="ga-nav">
          <button
            className="btn ga-nav-btn"
            onClick={goPrev}
            disabled={stepIdx === 0}
            aria-label="Previous step"
          >
            Prev
          </button>
          <div className="ga-step-counter" aria-live="polite">
            <span className="ga-step-num">{stepIdx + 1}</span>
            <span className="ga-step-sep">/</span>
            <span className="ga-step-total">{totalSteps}</span>
          </div>
          <button
            className="btn btn-primary ga-nav-btn"
            onClick={goNext}
            disabled={stepIdx === totalSteps - 1}
            aria-label="Next step"
          >
            Next
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="ga-progress" aria-label={`Progress: step ${stepIdx + 1} of ${totalSteps}`}>
        <div
          className="ga-progress-fill"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* QuadrantDiagram — 2x2 grid showing which quadrant is active        */
/* ------------------------------------------------------------------ */

function QuadrantDiagram({ active }: { active: 1 | 2 | 3 | 4 }) {
  return (
    <div className="ga-quad-diagram" aria-hidden="true">
      {([1, 2, 3, 4] as const).map((q) => (
        <div
          key={q}
          className={`ga-quad-cell ${active === q ? "is-active" : ""}`}
        />
      ))}
    </div>
  );
}
