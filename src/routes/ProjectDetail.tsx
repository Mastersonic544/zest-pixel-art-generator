/*
  ProjectDetail — /project/:id
  PRD §6.4.

  Sections:
  - Masthead: project name, canvas / baseplate / dithering meta.
  - Two-column body: stats panel (left), preview + toolbar (right).
  - Action bar below preview: Studio button (with shared-project warning),
    Share button that expands SharePanel inline.
*/

import { useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/store/projects";
import { MosaicPreview, MosaicStats, ImageViewModal } from "@/components/mosaic";
import type { PreviewMode } from "@/components/mosaic";
import SharePanel from "@/components/SharePanel";
import type { Project } from "@/lib/types";
import "./ProjectDetail.css";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getProject = useProjects((s) => s.getProject);
  const saveProject = useProjects((s) => s.saveProject);

  const project = id ? getProject(id) : undefined;

  const [mode, setMode] = useState<PreviewMode>("colored");
  const [shareOpen, setShareOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  // Show the shared-project edit warning when Studio is clicked on a shared project.
  const [showEditWarn, setShowEditWarn] = useState(false);

  const handleShared = useCallback(
    (updated: Project) => {
      saveProject(updated);
    },
    [saveProject]
  );

  // ------------------------------------------------------------------ //
  // Not found                                                           //
  // ------------------------------------------------------------------ //
  if (!project) {
    return (
      <div className="page">
        <div className="container">
          <header className="masthead">
            <h1 className="masthead-title">Project not found</h1>
            <div className="masthead-meta">
              <span>ID</span>
              <span>{id ?? "unknown"}</span>
            </div>
          </header>
          <div className="pd-not-found">
            <p>No project with that id exists in this browser.</p>
            <Link to="/">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const isShared = Boolean(project.shareId);

  // ------------------------------------------------------------------ //
  // Main view                                                           //
  // ------------------------------------------------------------------ //
  return (
    <div className="page">
      <div className="container">

        {/* Masthead */}
        <header className="masthead">
          <div className="pd-masthead-title-group">
            <Link to="/" className="pd-back">Dashboard</Link>
            <h1 className="masthead-title">{project.name}</h1>
          </div>
          <div className="masthead-meta">
            <span>Size</span>
            <span className="num">{project.width} x {project.height}</span>
            <span>Baseplate</span>
            <span style={{ textTransform: "capitalize" }}>{project.baseplate}</span>
            <span>Dithering</span>
            <span>{project.dithered ? "On" : "Off"}</span>
            <span>Status</span>
            <span>{isShared ? "Shared" : "Private"}</span>
          </div>
        </header>

        {/* Body: stats left, preview right */}
        <div className="pd-body">

          {/* Left column: stats */}
          <aside className="pd-stats-col">
            <MosaicStats project={project} />
          </aside>

          {/* Right column: preview + toolbar + actions */}
          <div className="pd-preview-col">

            {/* Mode toggle toolbar */}
            <div className="pd-toolbar">
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

            {/* Preview — click to open fullscreen viewer */}
            <button
              className="pd-preview-btn"
              onClick={() => setViewerOpen(true)}
              aria-label="Open fullscreen viewer"
            >
              <MosaicPreview project={project} mode={mode} size={480} />
            </button>

            {/* Action bar */}
            <div className="pd-actions">
              {/* Studio */}
              {showEditWarn ? (
                <div className="pd-edit-warn">
                  <div className="notice" style={{ margin: 0 }}>
                    <span className="notice-tag">Note</span>
                    <span>
                      This project is shared. Editing it will update the live
                      build page immediately. The builder will see your changes
                      the next time they load the page.
                    </span>
                  </div>
                  <div className="pd-edit-warn-actions">
                    <button
                      className="btn btn-primary"
                      onClick={() => navigate(`/project/${project.id}/studio`)}
                    >
                      Edit anyway
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setShowEditWarn(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn"
                  onClick={() => {
                    if (isShared) {
                      setShowEditWarn(true);
                      setShareOpen(false);
                    } else {
                      navigate(`/project/${project.id}/studio`);
                    }
                  }}
                >
                  Edit in Studio
                </button>
              )}

              {/* Share */}
              <button
                className={`btn${shareOpen ? " is-active pd-share-btn-active" : ""}`}
                onClick={() => {
                  setShareOpen((o) => !o);
                  setShowEditWarn(false);
                }}
                aria-expanded={shareOpen}
              >
                {isShared ? "Share settings" : "Share"}
              </button>
            </div>

            {/* Share panel — expands inline below action bar */}
            {shareOpen && (
              <SharePanel
                project={project}
                onShared={handleShared}
              />
            )}
          </div>
        </div>

        {/* Fullscreen mosaic viewer */}
        {viewerOpen && (
          <ImageViewModal
            project={project}
            initialMode={mode}
            onClose={() => setViewerOpen(false)}
          />
        )}

        {/* Footer crosslinks */}
        <footer className="pd-foot">
          <div className="crosslinks">
            <Link to="/">Dashboard</Link>
            <Link to="/settings">Settings</Link>
          </div>
          <span className="num" style={{ color: "var(--ink-3)", fontSize: "var(--t-body-s)" }}>
            ZEST &middot; 2026
          </span>
        </footer>

      </div>
    </div>
  );
}
