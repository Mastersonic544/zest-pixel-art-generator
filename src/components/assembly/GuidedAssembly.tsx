/*
  GuidedAssembly — LEGO-instructions-style step-by-step assembly guide.

  Visual language:
  - White "page" with bold black outlines, like a printed instructions booklet.
  - Huge step number top-left — the first thing your eye lands on.
  - Current color shown as a large swatch with its name and bag number.
  - The mosaic preview (passed from parent, highlighted) is the main image.
  - Mini-map thumbnail in bottom-right corner, always visible.
  - Prev / Next are large arrow buttons on the sides, like page-turn controls.
  - Progress shown as filled dots at the bottom — like booklet page indicators.
  - Print / Export PDF wires directly to window.print(); @media print styles
    generate one page per step automatically.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildAssemblyPlan, completedBefore } from "@/lib/assembly";
import type { AssemblyMode, AssemblyStep } from "@/lib/assembly";
import type { Color, Project } from "@/lib/types";
import { MosaicPreview } from "@/components/mosaic";
import type { PreviewMode } from "@/components/mosaic";
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
  const [previewMode, setPreviewMode] = useState<PreviewMode>("colored");
  const [isPrinting, setIsPrinting] = useState(false);

  const plan = useMemo(() => buildAssemblyPlan(mode, project), [mode, project]);
  const steps = plan.steps;
  const totalSteps = steps.length;

  useEffect(() => { setStepIdx(0); }, [mode]);

  const currentStep: AssemblyStep | undefined = steps[stepIdx];
  const isDone = stepIdx === totalSteps - 1 && totalSteps > 0;

  const completedIndices = useMemo(
    () => completedBefore(steps, stepIdx),
    [steps, stepIdx]
  );

  // All colors actually used in this project (sorted by id = bag number).
  const usedColors = useMemo(() => {
    const usedIds = new Set(project.grid);
    return project.paletteSnapshot.colors
      .filter((c) => usedIds.has(c.id))
      .sort((a, b) => a.id - b.id);
  }, [project]);

  // Color ids active in the current step (highlighted in decode table).
  const activeColorIds = useMemo(() => {
    if (!currentStep) return new Set<number>();
    if (currentStep.detail.kind === "color") {
      return new Set([currentStep.detail.colorId]);
    }
    const ids = new Set<number>();
    for (const idx of currentStep.activeIndices) {
      const id = project.grid[idx];
      if (id !== undefined) ids.add(id);
    }
    return ids;
  }, [currentStep, project.grid]);

  // Trigger window.print() after all step canvases have had time to render.
  useEffect(() => {
    if (!isPrinting) return;
    const t = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 350);
    return () => clearTimeout(t);
  }, [isPrinting]);

  // Keep parent in sync for the highlighted mosaic preview.
  useEffect(() => {
    if (currentStep) onHighlight(currentStep.activeIndices);
    else onHighlight(new Set());
  }, [currentStep, onHighlight]);

  const goNext = useCallback(() => setStepIdx((i) => Math.min(i + 1, totalSteps - 1)), [totalSteps]);
  const goPrev = useCallback(() => setStepIdx((i) => Math.max(i - 1, 0)), []);

  // Arrow key navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); goPrev(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // Build a project-like with highlight set for the preview inside the booklet.
  const highlightedProject = useMemo(
    () => ({ ...project, grid: project.grid }),
    [project]
  );

  if (!currentStep) return null;

  const { detail } = currentStep;
  const pct = totalSteps > 1 ? ((stepIdx + 1) / totalSteps) * 100 : 100;

  // Clamp dot count for the progress indicator.
  const DOT_MAX = 20;
  const showDots = totalSteps <= DOT_MAX;

  // Render all steps stacked for print-all export.
  if (isPrinting) {
    return (
      <div className="ga-print-all">
        {steps.map((step, idx) => (
          <PrintPage
            key={idx}
            step={step}
            stepIdx={idx}
            totalSteps={totalSteps}
            steps={steps}
            project={project}
            usedColors={usedColors}
            previewMode={previewMode}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="ga-booklet" aria-label="Assembly instructions">

      {/* ── Controls bar (screen only, hidden in print) ────────────── */}
      <div className="ga-controls no-print">
        <div className="ga-controls-left">
          {/* Mode selector */}
          <div className="segmented" role="radiogroup" aria-label="Assembly mode">
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
          {/* Preview mode for the mosaic image */}
          <div className="segmented" role="radiogroup" aria-label="Mosaic view">
            {(["colored", "bricks", "code"] as PreviewMode[]).map((m) => (
              <button
                key={m}
                className={previewMode === m ? "is-active" : ""}
                onClick={() => setPreviewMode(m)}
                role="radio"
                aria-checked={previewMode === m}
                style={{ textTransform: "capitalize" }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="ga-controls-right">
          <button
            className="btn btn-tiny"
            onClick={() => setIsPrinting(true)}
            disabled={isPrinting}
            title="Export all steps as PDF — use 'Save as PDF' in the print dialog"
          >
            {isPrinting ? "Preparing…" : "Export PDF"}
          </button>
          <button
            className="btn btn-tiny btn-ghost"
            onClick={onClose}
          >
            Exit
          </button>
        </div>
      </div>

      {/* ── Instructions page ─────────────────────────────────────── */}
      <div className="ga-page" data-step={stepIdx + 1}>

        {/* Page header strip */}
        <div className="ga-page-header">
          <div className="ga-page-step-num" aria-label={`Step ${stepIdx + 1}`}>
            {String(stepIdx + 1).padStart(2, "0")}
          </div>
          <div className="ga-page-project-name">{project.name}</div>
          <div className="ga-page-of">{stepIdx + 1} / {totalSteps}</div>
        </div>

        {/* Main content area */}
        <div className="ga-page-body">

          {/* Left: step instruction card */}
          <div className="ga-instruction-card">
            {detail.kind === "color" && (
              <ColorInstruction detail={detail} stepNum={stepIdx + 1} />
            )}
            {detail.kind === "quarter" && (
              <QuarterInstruction detail={detail} stepNum={stepIdx + 1} />
            )}
            {detail.kind === "line" && (
              <LineInstruction detail={detail} stepNum={stepIdx + 1} />
            )}

            {/* For quarter/line: show which color bags are needed this step */}
            {(detail.kind === "quarter" || detail.kind === "line") && (
              <StepColorsNeeded
                colors={usedColors.filter((c) => activeColorIds.has(c.id))}
              />
            )}

            {/* Always-visible bag legend */}
            <ColorDecodeTable colors={usedColors} activeIds={activeColorIds} />

            {/* Done state */}
            {isDone && (
              <div className="ga-done-panel">
                <span className="ga-done-checkmark" aria-hidden="true">&#10003;</span>
                <span className="ga-done-text">All done. Your mosaic is complete.</span>
              </div>
            )}
          </div>

          {/* Right: mosaic image (highlighted preview) */}
          <div className="ga-mosaic-panel">
            <MosaicPreview
              project={highlightedProject}
              mode={previewMode}
              size={340}
              {...(currentStep.activeIndices.size > 0 ? { highlightSet: currentStep.activeIndices } : {})}
            />
          </div>
        </div>

        {/* Page footer strip */}
        <div className="ga-page-footer">
          {/* Mini-map — always in bottom-left */}
          <div className="ga-footer-map">
            <span className="ga-footer-map-label">Progress</span>
            <MiniMap
              project={project}
              completedIndices={completedIndices}
              activeIndices={currentStep.activeIndices}
            />
          </div>

          {/* Progress dots / bar */}
          <div className="ga-footer-progress" aria-hidden="true">
            {showDots ? (
              <div className="ga-dots">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={`ga-dot${i < stepIdx ? " is-done" : i === stepIdx ? " is-active" : ""}`}
                  />
                ))}
              </div>
            ) : (
              <div className="ga-progress-bar">
                <div className="ga-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          {/* Piece count summary */}
          <div className="ga-footer-pieces">
            <span className="ga-footer-pieces-label">This step</span>
            <span className="ga-footer-pieces-count">
              {currentStep.activeIndices.size}
            </span>
            <span className="ga-footer-pieces-unit">
              piece{currentStep.activeIndices.size !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigation arrows (screen only) ──────────────────────── */}
      <div className="ga-nav no-print">
        <button
          className="ga-nav-arrow ga-nav-arrow-prev"
          onClick={goPrev}
          disabled={stepIdx === 0}
          aria-label="Previous step"
        >
          <span aria-hidden="true">&#8592;</span>
          <span className="ga-nav-label">Back</span>
        </button>

        <button
          className={`ga-nav-arrow ga-nav-arrow-next${isDone ? " is-done" : ""}`}
          onClick={goNext}
          disabled={isDone}
          aria-label="Next step"
        >
          <span className="ga-nav-label">{isDone ? "Done" : "Next"}</span>
          <span aria-hidden="true">&#8594;</span>
        </button>
      </div>

    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Instruction sub-components                                         */
/* ------------------------------------------------------------------ */

type ColorDetail   = Extract<AssemblyStep["detail"], { kind: "color" }>;
type QuarterDetail = Extract<AssemblyStep["detail"], { kind: "quarter" }>;
type LineDetail    = Extract<AssemblyStep["detail"], { kind: "line" }>;

function ColorInstruction({ detail, stepNum: _stepNum }: { detail: ColorDetail; stepNum: number }) {
  return (
    <div className="ga-instr-color">
      <div className="ga-instr-swatch-wrap">
        <span
          className="ga-instr-swatch"
          style={{ background: detail.colorHex }}
          aria-label={detail.colorName}
        />
        <div className="ga-piece-bubble" aria-label={`${detail.count} pieces`}>
          <span className="ga-piece-bubble-num">{detail.count}</span>
          <span className="ga-piece-bubble-unit">pcs</span>
        </div>
      </div>
      <div className="ga-instr-info">
        <span className="ga-instr-color-name">{detail.colorName}</span>
        <div className="ga-instr-tags">
          <span className="ga-bag-label">
            <span className="ga-bag-icon" aria-hidden="true">&#9670;</span>
            Bag {detail.bagNumber}
          </span>
        </div>
        <p className="ga-instr-note">
          Take all <strong>{detail.colorName}</strong> pieces from bag{" "}
          <strong>{detail.bagNumber}</strong>. On the code grid, every cell marked{" "}
          <strong>{detail.bagNumber}</strong> is a spot for this color. Place each piece
          on a highlighted cell.
        </p>
      </div>
    </div>
  );
}

function QuarterInstruction({ detail, stepNum: _stepNum }: { detail: QuarterDetail; stepNum: number }) {
  return (
    <div className="ga-instr-quarter">
      <div className="ga-instr-quad-wrap">
        <QuadDiagram active={detail.quadrant} large />
        <div className="ga-piece-bubble">
          <span className="ga-piece-bubble-num">{detail.count}</span>
          <span className="ga-piece-bubble-unit">pcs</span>
        </div>
      </div>
      <div className="ga-instr-info">
        <span className="ga-instr-color-name">{detail.label}</span>
        <p className="ga-instr-note">
          Fill the <strong>{detail.label.toLowerCase()}</strong> section of the
          baseplate. Use the bag numbers in the legend below to identify each
          color. Work from the highlighted corner outward.
        </p>
      </div>
    </div>
  );
}

function LineInstruction({ detail, stepNum: _stepNum }: { detail: LineDetail; stepNum: number }) {
  return (
    <div className="ga-instr-line">
      <div className="ga-piece-bubble ga-piece-bubble-lg">
        <span className="ga-piece-bubble-num">{detail.count}</span>
        <span className="ga-piece-bubble-unit">pcs</span>
      </div>
      <div className="ga-instr-info">
        <span className="ga-instr-color-name">Row {detail.row + 1}</span>
        <p className="ga-instr-note">
          Place pieces in <strong>row {detail.row + 1}</strong>, working left to right.
          Match each cell's number to the bag legend below to find the right color.
        </p>
      </div>
    </div>
  );
}

function StepColorsNeeded({ colors }: { colors: Color[] }) {
  if (colors.length === 0) return null;
  return (
    <div className="ga-step-colors">
      <span className="ga-step-colors-title">Colors this step</span>
      <div className="ga-step-colors-list">
        {colors.map((c) => (
          <span key={c.id} className="ga-step-color-chip">
            <span className="ga-step-color-chip-swatch" style={{ background: c.hex }} aria-hidden="true" />
            {c.name}
            <span className="ga-step-color-chip-num">#{c.id}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ColorDecodeTable({ colors, activeIds }: { colors: Color[]; activeIds: Set<number> }) {
  if (colors.length === 0) return null;
  return (
    <div className="ga-decode-table">
      <span className="ga-decode-title">Bag legend — numbers match code grid</span>
      <div className="ga-decode-rows">
        {colors.map((c) => (
          <div key={c.id} className={`ga-decode-row${activeIds.has(c.id) ? " is-active" : ""}`}>
            <span className="ga-decode-num" aria-label={`Bag ${c.id}`}>{c.id}</span>
            <span className="ga-decode-swatch" style={{ background: c.hex }} aria-hidden="true" />
            <span className="ga-decode-name">{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PrintPage — one step rendered for the print-all export             */
/* ------------------------------------------------------------------ */

type PrintPageProps = {
  step: AssemblyStep;
  stepIdx: number;
  totalSteps: number;
  steps: AssemblyStep[];
  project: Project;
  usedColors: Color[];
  previewMode: PreviewMode;
};

function PrintPage({ step, stepIdx, totalSteps, steps, project, usedColors, previewMode }: PrintPageProps) {
  const { detail } = step;
  const isLastStep = stepIdx === totalSteps - 1;
  const pct = totalSteps > 1 ? ((stepIdx + 1) / totalSteps) * 100 : 100;
  const showDots = totalSteps <= 20;

  const activeIds = useMemo(() => {
    if (detail.kind === "color") return new Set([detail.colorId]);
    const ids = new Set<number>();
    for (const idx of step.activeIndices) {
      const id = project.grid[idx];
      if (id !== undefined) ids.add(id);
    }
    return ids;
  }, [step, detail, project.grid]);

  const completedIdx = useMemo(() => completedBefore(steps, stepIdx), [steps, stepIdx]);

  return (
    <div className="ga-print-page-wrap">
      <div className="ga-page">
        <div className="ga-page-header">
          <div className="ga-page-step-num" aria-label={`Step ${stepIdx + 1}`}>
            {String(stepIdx + 1).padStart(2, "0")}
          </div>
          <div className="ga-page-project-name">{project.name}</div>
          <div className="ga-page-of">{stepIdx + 1} / {totalSteps}</div>
        </div>

        <div className="ga-page-body">
          <div className="ga-instruction-card">
            {detail.kind === "color"   && <ColorInstruction   detail={detail} stepNum={stepIdx + 1} />}
            {detail.kind === "quarter" && <QuarterInstruction detail={detail} stepNum={stepIdx + 1} />}
            {detail.kind === "line"    && <LineInstruction    detail={detail} stepNum={stepIdx + 1} />}

            {(detail.kind === "quarter" || detail.kind === "line") && (
              <StepColorsNeeded colors={usedColors.filter((c) => activeIds.has(c.id))} />
            )}

            <ColorDecodeTable colors={usedColors} activeIds={activeIds} />

            {isLastStep && (
              <div className="ga-done-panel">
                <span className="ga-done-checkmark" aria-hidden="true">&#10003;</span>
                <span className="ga-done-text">All done. Your mosaic is complete.</span>
              </div>
            )}
          </div>

          <div className="ga-mosaic-panel">
            <MosaicPreview
              project={project}
              mode={previewMode}
              size={340}
              {...(step.activeIndices.size > 0 ? { highlightSet: step.activeIndices } : {})}
            />
          </div>
        </div>

        <div className="ga-page-footer">
          <div className="ga-footer-map">
            <span className="ga-footer-map-label">Progress</span>
            <MiniMap
              project={project}
              completedIndices={completedIdx}
              activeIndices={step.activeIndices}
            />
          </div>

          <div className="ga-footer-progress" aria-hidden="true">
            {showDots ? (
              <div className="ga-dots">
                {Array.from({ length: totalSteps }).map((_, i) => (
                  <span
                    key={i}
                    className={`ga-dot${i < stepIdx ? " is-done" : i === stepIdx ? " is-active" : ""}`}
                  />
                ))}
              </div>
            ) : (
              <div className="ga-progress-bar">
                <div className="ga-progress-fill" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>

          <div className="ga-footer-pieces">
            <span className="ga-footer-pieces-label">This step</span>
            <span className="ga-footer-pieces-count">{step.activeIndices.size}</span>
            <span className="ga-footer-pieces-unit">
              piece{step.activeIndices.size !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuadDiagram({ active, large }: { active: 1 | 2 | 3 | 4; large?: boolean }) {
  return (
    <div className={`ga-quad${large ? " ga-quad-lg" : ""}`} aria-hidden="true">
      {([1, 2, 3, 4] as const).map((q) => (
        <div key={q} className={`ga-quad-cell${active === q ? " is-active" : ""}`} />
      ))}
    </div>
  );
}
