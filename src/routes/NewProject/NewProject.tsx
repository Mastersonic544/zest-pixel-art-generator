/*
  NewProject — /project/new wizard.

  Steps (PRD §6.2):
    0. Upload
    1. Crop & Size
    2. Convert (quantize + preview)
    3. Finish (name, baseplate, save)

  UX rules (PRD §8):
  - Steps are revisitable (step header buttons navigate freely once unlocked).
  - Changing canvas size re-derives from the already-uploaded source; no re-upload.
  - No "confirm" gate before editing; Convert IS the inspection surface.
*/

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/store/settings";
import { useProjects } from "@/store/projects";
import type { BaseplateColor, CanvasSize, Palette, Project } from "@/lib/types";
import type { SourceImage } from "./imageUtils";
import { makeCroppedThumb } from "./imageUtils";
import type { CropState } from "./StepCrop";
import { defaultCenterCrop } from "@/lib/quantize";
import StepUpload from "./StepUpload";
import StepCrop from "./StepCrop";
import StepConvert from "./StepConvert";
import StepFinish from "./StepFinish";
import "./NewProject.css";

type StepId = "upload" | "crop" | "convert" | "finish";

const STEPS: { id: StepId; label: string; num: string }[] = [
  { id: "upload",  label: "Upload",        num: "01" },
  { id: "crop",    label: "Crop and size",  num: "02" },
  { id: "convert", label: "Convert",        num: "03" },
  { id: "finish",  label: "Finish",         num: "04" },
];

function stepIndex(id: StepId): number {
  return STEPS.findIndex((s) => s.id === id);
}

/** Generate a simple random id. */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function NewProject() {
  const navigate = useNavigate();
  const palette = useSettings((s) => s.palette);
  const defaults = useSettings((s) => s.defaults);
  const saveProject = useProjects((s) => s.saveProject);

  // --- Wizard state ---
  const [step, setStep] = useState<StepId>("upload");
  // The furthest step the user has reached (controls which step tabs are clickable).
  const [maxReached, setMaxReached] = useState(0);

  // Step 1: source image
  const [source, setSource] = useState<SourceImage | null>(null);

  // Step 2: crop + canvas size
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, size: 0 });
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(defaults.canvasSize);

  // Step 3: dithering
  const [dithered, setDithered] = useState<boolean>(defaults.dithered);
  // Last quantization result — always current with convert step inputs
  const [grid, setGrid] = useState<number[]>([]);
  const [snapshotPalette, setSnapshotPalette] = useState<Palette>(palette);

  // Step 4: finish
  const [projectName, setProjectName] = useState("");
  const [baseplate, setBaseplate] = useState<BaseplateColor>(defaults.baseplate);

  // --- Navigation helpers ---
  function goTo(target: StepId) {
    const targetIdx = stepIndex(target);
    setStep(target);
    setMaxReached((m) => Math.max(m, targetIdx));
  }

  function advance() {
    const idx = stepIndex(step);
    if (idx < STEPS.length - 1) {
      goTo(STEPS[idx + 1]!.id);
    }
  }

  // --- Handlers ---
  const handleImage = useCallback(
    (img: SourceImage) => {
      // Revoke previous object URL.
      if (source) URL.revokeObjectURL(source.objectUrl);
      setSource(img);
      // Default center-square crop.
      const sq = defaultCenterCrop(img.width, img.height);
      setCrop({ x: sq.x, y: sq.y, size: sq.w });
      advance();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source]
  );

  const handleSizeChange = useCallback((sz: CanvasSize) => {
    setCanvasSize(sz);
    // No re-upload needed; Convert will re-quantize from the existing source.
  }, []);

  const handleResult = useCallback((g: number[], pal: Palette) => {
    setGrid(g);
    setSnapshotPalette(pal);
  }, []);



  async function handleSave() {
    if (!source || grid.length === 0) return;

    const thumb = makeCroppedThumb(source.bitmap, crop.x, crop.y, crop.size);
    const now = new Date().toISOString();
    const project: Project = {
      id: newId(),
      name: projectName.trim() || "Untitled project",
      createdAt: now,
      updatedAt: now,
      width: canvasSize,
      height: canvasSize,
      baseplate,
      dithered,
      paletteSnapshot: snapshotPalette,
      grid,
      sourceThumb: thumb,
    };

    saveProject(project);
    // Clean up object URL.
    URL.revokeObjectURL(source.objectUrl);
    navigate(`/project/${project.id}`);
  }

  // --- Render ---
  const currentIdx = stepIndex(step);

  return (
    <div className="page">
      <div className="container">
        <header className="masthead">
          <h1 className="masthead-title">
            New project <span className="masthead-title-sub">/ Create</span>
          </h1>
          <div className="masthead-meta">
            <span>Step</span>
            <span>{STEPS[currentIdx]!.num} / {String(STEPS.length).padStart(2, "0")}</span>
          </div>
        </header>

        {/* Step header nav */}
        <nav className="np-steps" aria-label="Wizard steps">
          {STEPS.map((s, idx) => {
            const reachable = idx <= maxReached;
            const active = s.id === step;
            return (
              <button
                key={s.id}
                className={`np-step-tab${active ? " is-active" : ""}${reachable && !active ? " is-done" : ""}${!reachable ? " is-locked" : ""}`}
                onClick={() => reachable && goTo(s.id)}
                disabled={!reachable}
                aria-current={active ? "step" : undefined}
                aria-disabled={!reachable}
              >
                <span className="np-step-num">{s.num}</span>
                <span className="np-step-label">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Step body */}
        <main className="np-body">
          {step === "upload" && (
            <StepUpload onImage={handleImage} />
          )}

          {step === "crop" && source && (
            <>
              <StepCrop
                source={source}
                canvasSize={canvasSize}
                crop={crop}
                onCropChange={setCrop}
                onSizeChange={handleSizeChange}
              />
              <div className="np-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setStep("upload")}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={advance}
                >
                  Convert
                </button>
              </div>
            </>
          )}

          {step === "convert" && source && (
            <>
              <StepConvert
                source={source}
                crop={crop}
                canvasSize={canvasSize}
                dithered={dithered}
                palette={palette}
                onDitheredChange={setDithered}
                onResult={handleResult}
              />
              <div className="np-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setStep("crop")}
                >
                  Back
                </button>
                <button
                  className="btn btn-primary"
                  onClick={advance}
                >
                  Continue to Finish
                </button>
              </div>
            </>
          )}

          {step === "finish" && (
            <>
              <StepFinish
                name={projectName}
                baseplate={baseplate}
                onNameChange={setProjectName}
                onBaseplateChange={setBaseplate}
              />
              <div className="np-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() => setStep("convert")}
                >
                  Back
                </button>
                <button
                  className="btn btn-accent"
                  onClick={handleSave}
                  disabled={grid.length === 0}
                >
                  Save project
                </button>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
