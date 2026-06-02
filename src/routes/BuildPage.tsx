/*
  BuildPage — /build/:shareId
  PRD §6.5 (public, read-only, unlisted).

  This is the chromeless builder view. It reads the project from
  shareStorage (local or KV, whichever is configured). Guided assembly
  modes are a later milestone; this file establishes the route, the data
  load, and the three preview toggles so the page is immediately functional.
*/

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { shareStorage } from "@/lib/shareStorage";
import { MosaicPreview, MosaicStats } from "@/components/mosaic";
import type { PreviewMode } from "@/components/mosaic";
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

  useEffect(() => {
    if (!shareId) {
      setLoad({ status: "not-found" });
      return;
    }
    let cancelled = false;
    shareStorage
      .read(shareId)
      .then((project) => {
        if (cancelled) return;
        if (!project) {
          setLoad({ status: "not-found" });
        } else {
          setLoad({ status: "ready", project });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setLoad({
          status: "error",
          message: e instanceof Error ? e.message : "Failed to load project.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  // ------------------------------------------------------------------ //
  // Loading                                                            //
  // ------------------------------------------------------------------ //
  if (load.status === "loading") {
    return (
      <div className="bp-shell">
        <div className="bp-container">
          <p className="bp-loading">Loading build...</p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ //
  // Not found                                                          //
  // ------------------------------------------------------------------ //
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

  // ------------------------------------------------------------------ //
  // Error                                                              //
  // ------------------------------------------------------------------ //
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

  // ------------------------------------------------------------------ //
  // Ready                                                              //
  // ------------------------------------------------------------------ //
  const { project } = load;

  return (
    <div className="bp-shell">
      <div className="bp-container">

        {/* Minimal header: project name + unlisted label */}
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

        {/* Body: stats + preview */}
        <div className="bp-body">
          <aside className="bp-stats-col">
            <MosaicStats project={project} />
          </aside>

          <div className="bp-preview-col">
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
            </div>

            <MosaicPreview project={project} mode={mode} size={480} />

            {/* Guided assembly placeholder (PRD §6.5 — later milestone) */}
            <div className="bp-play-placeholder">
              <span className="bp-play-label">Guided assembly</span>
              <span className="bp-play-sub">
                Step-by-step build instructions are coming in a later release.
              </span>
            </div>
          </div>
        </div>

        <footer className="bp-foot">
          <span className="bp-foot-note">
            This is an unlisted page. Anyone with the URL can view it.
          </span>
        </footer>

      </div>
    </div>
  );
}
