/*
  Studio — /project/:id/studio
  PRD §9: zoom/pan grid, click-to-paint, eyedropper, Merge, Simplify,
  undo/redo, live stats, persist back to project.

  Layout:
    ┌─────────────────────────────────────────────────────┐
    │ Masthead: project name, back link, undo/redo, save  │
    ├───────────┬────────────────────────┬────────────────┤
    │ Tool      │                        │  Live stats    │
    │ sidebar   │  StudioCanvas          │  (MosaicStats) │
    │ (palette  │  (zoom + pan)          │                │
    │  merge    │                        │                │
    │  simplify)│                        │                │
    └───────────┴────────────────────────┴────────────────┘

  State:
    - grid: number[]  — local copy, mutated via commit()
    - history: HistoryStack — undo/redo stacks
    All save-worthy state is in `grid`; everything else is ephemeral UI.
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useProjects } from "@/store/projects";
import { MosaicStats } from "@/components/mosaic";
import { applyMerge, applyMerges } from "@/lib/simplify";
import {
  emptyHistory,
  pushUndo,
  undo as histUndo,
  redo as histRedo,
} from "@/lib/studioHistory";
import type { HistoryStack } from "@/lib/studioHistory";
import StudioCanvas from "./StudioCanvas";
import type { StudioTool } from "./StudioCanvas";
import PalettePicker from "./PalettePicker";
import MergePanel from "./MergePanel";
import SimplifyPanel from "./SimplifyPanel";
import "./Studio.css";

type SidePanel = "palette" | "merge" | "simplify";

export default function Studio() {
  const { id } = useParams<{ id: string }>();
  const getProject = useProjects((s) => s.getProject);
  const saveProject = useProjects((s) => s.saveProject);

  const project = id ? getProject(id) : undefined;

  // Local grid copy — initialised from project, not kept in sync with store.
  const [grid, setGrid] = useState<number[]>(() => project?.grid ?? []);
  const [history, setHistory] = useState<HistoryStack>(emptyHistory);
  const [tool, setTool] = useState<StudioTool>("paint");
  const [selectedColorId, setSelectedColorId] = useState<number>(
    () => project?.paletteSnapshot.colors[0]?.id ?? 1
  );
  const [sidePanel, setSidePanel] = useState<SidePanel>("palette");
  const [dirty, setDirty] = useState(false);

  // Re-sync if the project changes in the store while Studio is open
  // (e.g. navigating away and back). Only on first mount.
  useEffect(() => {
    if (project) {
      setGrid([...project.grid]);
      setHistory(emptyHistory());
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // Keep a ref to current grid so merge/simplify can read it synchronously
  // without depending on stale closure values.
  const gridRef = useRef<number[]>(project?.grid ?? []);
  useEffect(() => { gridRef.current = grid; }, [grid]);

  /* ------------------------------------------------------------------ */
  /* Commit helper — snapshot undo, set new grid, mark dirty.           */
  /* Used by merge and simplify (whole-grid operations).                */
  /* ------------------------------------------------------------------ */

  const commitGrid = useCallback((newGrid: number[]) => {
    const snapshot = [...gridRef.current];
    setHistory((h) => pushUndo(h, snapshot));
    setGrid(newGrid);
    gridRef.current = newGrid;
    setDirty(true);
  }, []);

  /* ------------------------------------------------------------------ */
  /* Paint — undo boundary on pointer-down, cells on pointer-move       */
  /* ------------------------------------------------------------------ */

  // Called once when a paint stroke begins (pointer-down).
  const handlePaintStart = useCallback(() => {
    const snapshot = [...gridRef.current];
    setHistory((h) => pushUndo(h, snapshot));
  }, []);

  const handlePaint = useCallback(
    (cellIndex: number) => {
      setGrid((g) => {
        if (g[cellIndex] === selectedColorId) return g; // no-op
        const next = [...g];
        next[cellIndex] = selectedColorId;
        gridRef.current = next;
        return next;
      });
      setDirty(true);
    },
    [selectedColorId]
  );

  /* ------------------------------------------------------------------ */
  /* Eyedropper                                                          */
  /* ------------------------------------------------------------------ */

  const handleEyedrop = useCallback((colorId: number) => {
    setSelectedColorId(colorId);
    setTool("paint");
  }, []);

  /* ------------------------------------------------------------------ */
  /* Merge                                                               */
  /* ------------------------------------------------------------------ */

  const handleMerge = useCallback(
    (fromId: number, toId: number) => {
      const newGrid = applyMerge(gridRef.current, fromId, toId);
      commitGrid(newGrid);
    },
    [commitGrid]
  );

  /* ------------------------------------------------------------------ */
  /* Simplify: approve a pair                                            */
  /* ------------------------------------------------------------------ */

  const handleSimplifyApprove = useCallback(
    (fromId: number, toId: number) => {
      handleMerge(fromId, toId);
    },
    [handleMerge]
  );

  const handleSimplifyApproveAll = useCallback(
    (merges: { fromId: number; toId: number }[]) => {
      const newGrid = applyMerges(gridRef.current, merges);
      commitGrid(newGrid);
    },
    [commitGrid]
  );

  /* ------------------------------------------------------------------ */
  /* Undo / Redo                                                         */
  /* ------------------------------------------------------------------ */

  const handleUndo = useCallback(() => {
    setHistory((h) => {
      setGrid((g) => {
        const result = histUndo(h, g);
        if (!result) return g;
        const [prev, newH] = result;
        setHistory(newH);
        setDirty(true);
        return prev;
      });
      return h; // returned value discarded; inner setHistory wins
    });
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((h) => {
      setGrid((g) => {
        const result = histRedo(h, g);
        if (!result) return g;
        const [next, newH] = result;
        setHistory(newH);
        setDirty(true);
        return next;
      });
      return h;
    });
  }, []);

  /* ------------------------------------------------------------------ */
  /* Keyboard shortcuts                                                  */
  /* ------------------------------------------------------------------ */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); handleRedo(); }
      if (e.key === "e") setTool("eyedropper");
      if (e.key === "b") setTool("paint");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  /* ------------------------------------------------------------------ */
  /* Save                                                                */
  /* ------------------------------------------------------------------ */

  const handleSave = useCallback(() => {
    if (!project) return;
    saveProject({
      ...project,
      grid,
      updatedAt: new Date().toISOString(),
    });
    setDirty(false);
  }, [project, grid, saveProject]);

  /* ------------------------------------------------------------------ */
  /* Per-color counts for the live sidebar (memoised)                   */
  /* ------------------------------------------------------------------ */

  const colorCounts = useMemo(() => {
    const m = new Map<number, number>();
    for (const id of grid) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [grid]);

  /* ------------------------------------------------------------------ */
  /* Live project-like for stats (pure object, no store mutation)       */
  /* ------------------------------------------------------------------ */

  const liveProjLike = useMemo(() => {
    if (!project) return null;
    return { ...project, grid };
  }, [project, grid]);

  /* ------------------------------------------------------------------ */
  /* Not found                                                           */
  /* ------------------------------------------------------------------ */

  if (!project || !liveProjLike) {
    return (
      <div className="page">
        <div className="container">
          <header className="masthead">
            <h1 className="masthead-title">Project not found</h1>
          </header>
          <div style={{ paddingTop: "var(--space-6)" }}>
            <Link to="/">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const canUndo = history.undoStack.length > 0;
  const canRedo = history.redoStack.length > 0;

  /* ------------------------------------------------------------------ */
  /* Render                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <div className="studio-page">

      {/* Masthead */}
      <header className="studio-header">
        <div className="studio-header-left">
          <Link to={`/project/${project.id}`} className="studio-back">
            {project.name}
          </Link>
          <h1 className="studio-title">Studio</h1>
        </div>

        <div className="studio-header-center">
          <button
            className="btn btn-tiny"
            onClick={handleUndo}
            disabled={!canUndo}
            aria-label="Undo (Ctrl+Z)"
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button
            className="btn btn-tiny"
            onClick={handleRedo}
            disabled={!canRedo}
            aria-label="Redo (Ctrl+Y)"
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>
          <span className="studio-history-depth">
            {history.undoStack.length} step{history.undoStack.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="studio-header-right">
          {dirty && <span className="studio-unsaved">Unsaved</span>}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!dirty}
          >
            Save
          </button>
          <Link
            to={`/project/${project.id}`}
            className="btn btn-ghost"
          >
            Close
          </Link>
        </div>
      </header>

      {/* Body: tool sidebar | canvas | stats */}
      <div className="studio-body">

        {/* Left sidebar: tool panels */}
        <aside className="studio-sidebar">
          {/* Panel tabs */}
          <div className="studio-panel-tabs">
            {(["palette", "merge", "simplify"] as SidePanel[]).map((p) => (
              <button
                key={p}
                className={`studio-panel-tab${sidePanel === p ? " is-active" : ""}`}
                onClick={() => setSidePanel(p)}
                style={{ textTransform: "capitalize" }}
              >
                {p === "palette" ? "Colors" : p === "merge" ? "Merge" : "Simplify"}
              </button>
            ))}
          </div>

          {/* Panel content */}
          <div className="studio-panel-body">
            {sidePanel === "palette" && (
              <PalettePicker
                colors={project.paletteSnapshot.colors}
                counts={colorCounts}
                selectedColorId={selectedColorId}
                tool={tool}
                onSelectColor={setSelectedColorId}
                onToolChange={setTool}
              />
            )}
            {sidePanel === "merge" && (
              <MergePanel
                colors={project.paletteSnapshot.colors}
                counts={colorCounts}
                onMerge={handleMerge}
              />
            )}
            {sidePanel === "simplify" && (
              <SimplifyPanel
                grid={grid}
                palette={project.paletteSnapshot}
                onApprove={handleSimplifyApprove}
                onApproveAll={handleSimplifyApproveAll}
              />
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main className="studio-canvas-area">
          <StudioCanvas
            width={project.width}
            height={project.height}
            grid={grid}
            paletteColors={project.paletteSnapshot.colors}
            selectedColorId={selectedColorId}
            tool={tool}
            onPaintStart={handlePaintStart}
            onPaint={handlePaint}
            onEyedrop={handleEyedrop}
          />
        </main>

        {/* Right sidebar: live stats */}
        <aside className="studio-stats-col">
          <MosaicStats project={liveProjLike} />
        </aside>
      </div>
    </div>
  );
}
