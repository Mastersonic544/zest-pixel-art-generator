/*
  BuildPage — /build/:shareId
  PRD §6.5 — chromeless, read-only, public (unlisted).

  Sections:
  - Minimal header: project name, unlisted tag, key meta.
  - Two-column body: stats left, preview + assembly right.
  - Play button enters guided assembly (GuidedAssembly component).
    While active, MosaicPreview receives the current step's highlight set.
  - The 3 mode toggles (Colored / Bricks / Code) are always available.
*/

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { shareStorage } from "@/lib/shareStorage";
import { MosaicPreview, MosaicStats } from "@/components/mosaic";
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
  const [highlightSet, setHighlightSet] = useState<ReadonlySet<number> | undefined>(undefined);

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

  const handleHighlight = useCallback((active: ReadonlySet<number>) => {
    setHighlightSet(active.size > 0 ? active : undefined);
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    setHighlightSet(undefined);
  }, []);

  const handleClose = useCallback(() => {
    setPlaying(false);
    setHighlightSet(undefined);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Shell states                                                      */
  /* ---------------------------------------------------------------- */

  if (load.status === "loading") {
    return (
      <div className="bp-shell">
        <div className="bp-container">
          <p className="bp-loading">Loading build...</p>
        </div>
      </div>
    );
  }

  if (load.status === "not-found") {
    return (
      <div className="bp-shell">
        <div className="bp-container">
          <div className="bp-missing">
            <p className="bp-missing-headline">Build not found.</p>
            <p className="bp-missing-sub">
              This link may have expired or the project was created in a
              different browser. Ask the creator to reshare it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (load.status === "error") {
    return (
      <div className="bp-shell">
        <div className="bp-container">
          <div className="bp-missing">
            <p className="bp-missing-headline">Could not load build.</p>
            <p className="bp-missing-sub">{load.message}</p>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Ready                                                            */
  /* ---------------------------------------------------------------- */

  const { project } = load;

  return (
    <div className="bp-shell">
      <div className="bp-container">

        {/* Header */}
        <header className="bp-header">
          <div className="bp-header-title-group">
            <span className="bp-unlisted-tag">Unlisted build page</span>
            <h1 className="bp-title">{project.name}</h1>
          </div>
          <div className="bp-header-meta">
            <span className="bp-meta-pair">
              <span className="bp-meta-label">Size</span>
              <span className="num">{project.width} x {project.height}</span>
            </span>
            <span className="bp-meta-pair">
              <span className="bp-meta-label">Pieces</span>
              <span className="num">{(project.width * project.height).toLocaleString()}</span>
            </span>
            <span className="bp-meta-pair">
              <span className="bp-meta-label">Baseplate</span>
              <span style={{ textTransform: "capitalize" }}>{project.baseplate}</span>
            </span>
          </div>
        </header>

        {/* Body */}
        <div className="bp-body">

          {/* Left: stats — hidden while guided assembly is open to give space */}
          {!playing && (
            <aside className="bp-stats-col">
              <MosaicStats project={project} />
            </aside>
          )}

          {/* Right: preview + guided assembly */}
          <div className={`bp-preview-col${playing ? " bp-preview-col-wide" : ""}`}>

            {/* Mode toggle (always available per PRD §6.5) */}
            <div className="bp-toolbar">
              <div
                className="segmented"
                role="radiogroup"
                aria-label="Preview mode"
              >
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

              {/* Play / close button */}
              {!playing ? (
                <button
                  className="btn btn-accent"
                  onClick={handlePlay}
                >
                  Play
                </button>
              ) : (
                <button
                  className="btn btn-ghost btn-tiny"
                  onClick={handleClose}
                >
                  Exit guided mode
                </button>
              )}
            </div>

            {/* Preview — receives highlight set during guided assembly */}
            <MosaicPreview
              project={project}
              mode={mode}
              size={480}
              {...(highlightSet !== undefined ? { highlightSet } : {})}
            />

            {/* Guided assembly panel */}
            {playing && (
              <GuidedAssembly
                project={project}
                onHighlight={handleHighlight}
                onClose={handleClose}
              />
            )}
          </div>
        </div>

        <footer className="bp-foot">
          <span className="bp-foot-note">
            Unlisted page. Anyone with this URL can view it.
          </span>
        </footer>

      </div>
    </div>
  );
}
