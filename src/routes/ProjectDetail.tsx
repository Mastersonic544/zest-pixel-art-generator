/*
  ProjectDetail — /project/:id (stub for now; full implementation in a later milestone).
  Shows the project's mosaic preview and basic info. No Studio or Share yet.
*/

import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/store/projects";
import { MosaicPreview, MosaicStats } from "@/components/mosaic";
import type { PreviewMode } from "@/components/mosaic";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = useProjects((s) => (id ? s.getProject(id) : undefined));
  const [mode, setMode] = useState<PreviewMode>("colored");

  if (!project) {
    return (
      <div className="page">
        <div className="container">
          <header className="masthead">
            <h1 className="masthead-title">Project not found</h1>
          </header>
          <p style={{ marginTop: "var(--space-6)", color: "var(--ink-2)" }}>
            No project with id <code>{id}</code> exists in this browser.
          </p>
          <div style={{ marginTop: "var(--space-5)" }}>
            <Link to="/">Back to dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <header className="masthead">
          <h1 className="masthead-title">
            {project.name}
            <span className="masthead-title-sub"> / Project</span>
          </h1>
          <div className="masthead-meta">
            <span>Size</span>
            <span>{project.width} x {project.height}</span>
            <span>Baseplate</span>
            <span style={{ textTransform: "capitalize" }}>{project.baseplate}</span>
            <span>Dithering</span>
            <span>{project.dithered ? "On" : "Off"}</span>
          </div>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "18rem 1fr",
            gap: "var(--space-7)",
            alignItems: "start",
            paddingTop: "var(--space-7)",
          }}
        >
          <MosaicStats project={project} />

          <div style={{ display: "grid", gap: "var(--space-5)" }}>
            <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
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
              <button
                className="btn btn-ghost btn-tiny"
                onClick={() => navigate("/project/new")}
              >
                New project
              </button>
            </div>
            <MosaicPreview project={project} mode={mode} size={480} />
          </div>
        </div>
      </div>
    </div>
  );
}
