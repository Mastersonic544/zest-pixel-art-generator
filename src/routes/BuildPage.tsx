/*
  BuildPage — /build/:shareId
  PRD §6.5 — chromeless, read-only, public (unlisted).
  LEGO-inspired design: yellow accent bar, bold typography, instruction-booklet feel.
*/

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { shareStorage } from "@/lib/shareStorage";
import { MosaicPreview, ColorLegend } from "@/components/mosaic";
import type { PreviewMode } from "@/components/mosaic";
import GuidedAssembly from "@/components/assembly/GuidedAssembly";
import type { Project } from "@/lib/types";
import "./BuildPage.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; project: Project }
  | { status: "not-found" }
  | { status: "error"; message: string };

export default function BuildPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const [load, setLoad] = useState<LoadState>({ status: "loading" });
  const [mode, setMode] = useState<PreviewMode>("colored");
  const [playing, setPlaying] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  useEffect(() => {
    if (!shareId) { setLoad({ status: "not-found" }); return; }
    let cancelled = false;
    shareStorage.read(shareId)
      .then((project) => {
        if (cancelled) return;
        setLoad(project ? { status: "ready", project } : { status: "not-found" });
      })
      .catch((e) => {
        if (cancelled) return;
        setLoad({ status: "error", message: e instanceof Error ? e.message : "Failed to load." });
      });
    return () => { cancelled = true; };
  }, [shareId]);

  // No-op — GuidedAssembly requires the prop but outer preview is hidden during assembly
  const handleHighlight = useCallback(() => {}, []);

  const handlePlay = useCallback(() => { setPlaying(true); }, []);

  const handleClose = useCallback(() => { setPlaying(false); }, []);

  /* ---------------------------------------------------------------- */
  /* Loading state                                                     */
  /* ---------------------------------------------------------------- */

  if (load.status === "loading") {
    return (
      <div className="bp-shell">
        <div className="bp-loading-wrap">
          <div className="bp-loading-spinner" aria-hidden="true" />
          <p className="bp-loading-text">Loading mosaic...</p>
        </div>
      </div>
    );
  }

  if (load.status === "not-found") {
    return (
      <div className="bp-shell">
        <div className="bp-missing">
          <span className="bp-missing-icon" aria-hidden="true">🧱</span>
          <p className="bp-missing-headline">Build not found</p>
          <p className="bp-missing-sub">
            This link may have expired or the project was created in a different
            browser. Ask the creator to reshare it.
          </p>
        </div>
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="bp-shell">
        <div className="bp-missing">
          <span className="bp-missing-icon" aria-hidden="true">⚠️</span>
          <p className="bp-missing-headline">Could not load build</p>
          <p className="bp-missing-sub">{load.message}</p>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Ready                                                            */
  /* ---------------------------------------------------------------- */

  const { project } = load;

  if (playing) {
    return (
      <div className="bp-shell bp-shell-assembly">
        <header className="bp-topbar">
          <div className="bp-topbar-inner">
            <span className="bp-brand">Zest</span>
            <span className="bp-topbar-label">{project.name}</span>
            <button className="btn btn-tiny bp-exit-btn" onClick={handleClose}>Exit</button>
          </div>
        </header>
        <div className="bp-assembly-wrap">
          <GuidedAssembly project={project} onHighlight={handleHighlight} onClose={handleClose} />
        </div>
      </div>
    );
  }

  return <PreviewPage project={project} mode={mode} setMode={setMode} handlePlay={handlePlay} showBreakdown={showBreakdown} setShowBreakdown={setShowBreakdown} />;
}

/* ---------------------------------------------------------------- */
/* Preview page (extracted to allow hooks at top level)            */
/* ---------------------------------------------------------------- */

function PreviewPage({
  project,
  mode,
  setMode,
  handlePlay,
  showBreakdown,
  setShowBreakdown,
}: {
  project: Project;
  mode: PreviewMode;
  setMode: (m: PreviewMode) => void;
  handlePlay: () => void;
  showBreakdown: boolean;
  setShowBreakdown: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const totalPieces = project.width * project.height;
  const distinctColors = useMemo(() => new Set(project.grid).size, [project.grid]);

  return (
    <div className="bp-shell">
      <header className="bp-topbar">
        <div className="bp-topbar-inner">
          <span className="bp-brand">Zest</span>
          <span className="bp-topbar-label">LEGO Mosaic Guide</span>
        </div>
      </header>
      <main className="bp-main">
        <div className="bp-container">
          <div className="bp-identity">
            <h1 className="bp-title">{project.name}</h1>
            <div className="bp-chips">
              <span className="bp-chip">{project.width} × {project.height}</span>
              <span className="bp-chip">{totalPieces.toLocaleString()} pieces</span>
              <span className="bp-chip">{distinctColors} colors</span>
              <span className="bp-chip" style={{ textTransform: "capitalize" }}>{project.baseplate} baseplate</span>
            </div>
          </div>
          <div className="bp-preview-hero">
            <MosaicPreview project={project} mode={mode} size={600} />
          </div>
          <div className="bp-mode-toggle">
            <div className="segmented" role="radiogroup" aria-label="Preview mode">
              {(["colored", "bricks", "code"] as PreviewMode[]).map((m) => (
                <button
                  key={m}
                  className={mode === m ? "is-active" : ""}
                  onClick={() => setMode(m)}
                  role="radio"
                  aria-checked={mode === m}
                  style={{ textTransform: "capitalize" }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div className="bp-cta-section">
            <button className="btn btn-primary bp-cta-btn" onClick={handlePlay}>
              Start Building
            </button>
            <p className="bp-cta-hint">Step-by-step guided instructions</p>
          </div>
          <div className="bp-breakdown">
            <button
              className="bp-breakdown-toggle"
              onClick={() => setShowBreakdown((s) => !s)}
              aria-expanded={showBreakdown}
            >
              <span>Piece breakdown — {distinctColors} colors</span>
              <span className={`bp-breakdown-arrow${showBreakdown ? " is-open" : ""}`} aria-hidden="true">▼</span>
            </button>
            {showBreakdown && (
              <div className="bp-breakdown-body">
                <ColorLegend project={project} onlyUsed sortBy="count-desc" />
              </div>
            )}
          </div>
        </div>
      </main>
      <footer className="bp-foot">
        <div className="bp-container">
          <span className="bp-foot-note">Unlisted · Anyone with this link can view it</span>
        </div>
      </footer>
    </div>
  );
}
