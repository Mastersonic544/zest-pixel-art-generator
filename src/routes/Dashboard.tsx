/*
  Dashboard — /
  KPI strip + project list + New project entry point.
  PRD §6.1, §10.
*/

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useProjects } from "@/store/projects";
import { MosaicPreview } from "@/components/mosaic";
import type { Project } from "@/lib/types";
import "./Dashboard.css";

/* ------------------------------------------------------------------ */
/* KPI computation                                                     */
/* ------------------------------------------------------------------ */

type KpiData = {
  totalProjects: number;
  totalPieces: number;
  mostUsedColor: { name: string; hex: string } | null;
  projectsShared: number;
};

function computeKpis(projects: Project[]): KpiData {
  const totalProjects = projects.length;
  const totalPieces = projects.reduce((s, p) => s + p.width * p.height, 0);
  const projectsShared = projects.filter((p) => Boolean(p.shareId)).length;

  // Aggregate color usage across every project grid.
  // Each project's grid uses ids from its own paletteSnapshot, so we look
  // up the color name there. We key by hex to deduplicate across snapshots.
  const hexCount = new Map<string, { name: string; hex: string; total: number }>();
  for (const project of projects) {
    const idToColor = new Map(
      project.paletteSnapshot.colors.map((c) => [c.id, c])
    );
    for (const id of project.grid) {
      const color = idToColor.get(id);
      if (!color) continue;
      const existing = hexCount.get(color.hex);
      if (existing) {
        existing.total += 1;
      } else {
        hexCount.set(color.hex, { name: color.name, hex: color.hex, total: 1 });
      }
    }
  }

  let mostUsedColor: { name: string; hex: string } | null = null;
  let best = 0;
  for (const entry of hexCount.values()) {
    if (entry.total > best) {
      best = entry.total;
      mostUsedColor = { name: entry.name, hex: entry.hex };
    }
  }

  return { totalProjects, totalPieces, mostUsedColor, projectsShared };
}

/* ------------------------------------------------------------------ */
/* Thumbnail                                                           */
/* ------------------------------------------------------------------ */

function ProjectThumb({ project }: { project: Project }) {
  return (
    <div className="db-thumb-mosaic" aria-hidden="true">
      <MosaicPreview project={project} mode="colored" size={48} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const projects = useProjects((s) => s.projects);
  const isLoading = useProjects((s) => s.isLoading);
  const navigate = useNavigate();

  const kpis = useMemo(() => computeKpis(projects), [projects]);

  // Newest first.
  const sorted = useMemo(
    () => [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  );

  return (
    <div className="page">
      <div className="container">

        {/* Masthead */}
        <header className="masthead">
          <h1 className="masthead-title">Zest</h1>
          <nav className="db-nav">
            <Link to="/settings">Settings</Link>
          </nav>
        </header>

        {/* KPI strip */}
        <section className="db-kpis" aria-label="Overview">
          <div className="db-kpi">
            <span className="db-kpi-eyebrow">Total projects</span>
            <span className="db-kpi-figure">
              {String(kpis.totalProjects).padStart(2, "0")}
            </span>
            <span className="db-kpi-supp">
              {kpis.totalProjects === 1 ? "1 mosaic saved" : `${kpis.totalProjects} mosaics saved`}
            </span>
          </div>

          <div className="db-kpi">
            <span className="db-kpi-eyebrow">Total pieces</span>
            <span className="db-kpi-figure">
              {kpis.totalPieces.toLocaleString()}
            </span>
            <span className="db-kpi-supp">
              1 x 1 plates across all projects
            </span>
          </div>

          <div className="db-kpi">
            <span className="db-kpi-eyebrow">Most-used color</span>
            {kpis.mostUsedColor ? (
              <>
                <span className="db-kpi-figure db-kpi-figure-color">
                  <span
                    className="db-kpi-chip"
                    style={{ background: kpis.mostUsedColor.hex }}
                    aria-hidden="true"
                  />
                  {kpis.mostUsedColor.name}
                </span>
                <span className="db-kpi-supp db-kpi-supp-mono">
                  {kpis.mostUsedColor.hex}
                </span>
              </>
            ) : (
              <>
                <span className="db-kpi-figure db-kpi-figure-empty">None yet</span>
                <span className="db-kpi-supp">No projects generated</span>
              </>
            )}
          </div>

          <div className="db-kpi">
            <span className="db-kpi-eyebrow">Projects shared</span>
            <span className="db-kpi-figure">
              {String(kpis.projectsShared).padStart(2, "0")}
            </span>
            <span className="db-kpi-supp">
              {kpis.projectsShared === 1
                ? "1 build link active"
                : `${kpis.projectsShared} build links active`}
            </span>
          </div>
        </section>

        {/* New project — deliberate entry point, not a corner button */}
        <div className="db-new-row">
          <div className="db-new-copy">
            <span className="db-new-label">New project</span>
            <span className="db-new-sub">Upload an image, pick a size, get a LEGO mosaic.</span>
          </div>
          <button
            className="btn btn-accent db-new-btn"
            onClick={() => navigate("/project/new")}
          >
            Start
          </button>
        </div>

        {/* Project list */}
        {isLoading ? (
          <div className="db-loading" aria-live="polite" aria-label="Loading projects">
            <div className="db-loading-spinner" aria-hidden="true" />
            <span className="db-loading-text">Loading projects…</span>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          <section aria-label="Projects">
            <div className="db-list-head">
              <span>Project</span>
              <span>Size</span>
              <span>Pieces</span>
              <span>Status</span>
            </div>

            <ol className="db-list" aria-label="Project list">
              {sorted.map((project) => (
                <li key={project.id}>
                  <button
                    className="db-row"
                    onClick={() => navigate(`/project/${project.id}`)}
                    aria-label={`Open ${project.name}`}
                  >
                    {/* Thumbnail */}
                    <div className="db-thumb" aria-hidden="true">
                      <ProjectThumb project={project} />
                    </div>

                    {/* Name + date */}
                    <div className="db-row-name">
                      <span className="db-row-title">{project.name}</span>
                      <span className="db-row-date">
                        {formatDate(project.createdAt)}
                      </span>
                    </div>

                    {/* Canvas size */}
                    <span className="db-row-meta db-row-size">
                      {project.width} x {project.height}
                    </span>

                    {/* Piece count */}
                    <span className="db-row-meta db-row-pieces">
                      {(project.width * project.height).toLocaleString()}
                    </span>

                    {/* Shared status */}
                    <span className="db-row-meta">
                      {project.shareId ? (
                        <span className="db-badge db-badge-shared">Shared</span>
                      ) : (
                        <span className="db-badge db-badge-private">Private</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <footer className="db-foot">
          <div className="crosslinks">
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

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

function EmptyState() {
  const navigate = useNavigate();
  return (
    <div className="db-empty">
      <div className="db-empty-grid" aria-hidden="true">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="db-empty-cell" />
        ))}
      </div>
      <div className="db-empty-body">
        <p className="db-empty-headline">No projects yet.</p>
        <p className="db-empty-sub">
          Upload an image, crop it square, pick 16, 32, or 48 studs, and Zest
          turns it into a buildable LEGO mosaic with a full piece count and
          color guide.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/project/new")}
        >
          Create your first project
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
