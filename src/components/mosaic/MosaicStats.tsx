import { useMemo } from "react";
import { computeStats } from "@/lib/quantize";
import type { Project } from "@/lib/types";
import { baseplateLabel, formatPhysicalSize } from "./physical";
import ColorLegend from "./ColorLegend";
import "./mosaic.css";

export type MosaicStatsProjectLike = Pick<
  Project,
  "width" | "height" | "baseplate" | "dithered" | "paletteSnapshot" | "grid"
>;

type Props = {
  project: MosaicStatsProjectLike;
  /** Threshold under which a color is flagged as low-count. Default 4. */
  lowCountThreshold?: number;
};

export default function MosaicStats({ project, lowCountThreshold = 4 }: Props) {
  const stats = useMemo(
    () => computeStats(project.grid, project.paletteSnapshot, lowCountThreshold),
    [project.grid, project.paletteSnapshot, lowCountThreshold]
  );

  const physical = formatPhysicalSize(project.width, project.height);
  const bp = baseplateLabel(project.width, project.height, project.baseplate);

  return (
    <div className="ms" aria-label="Mosaic statistics">
      <div className="ms-figures">
        <div>
          <div className="ms-eyebrow">Total pieces</div>
          <div className="ms-figure">{stats.totalPieces.toLocaleString()}</div>
          <div className="ms-supp">All 1 x 1 plates.</div>
        </div>
        <div>
          <div className="ms-eyebrow">Distinct colors</div>
          <div className="ms-figure">{stats.distinctColors}</div>
          <div className="ms-supp">
            {stats.lowCountColorIds.length > 0
              ? `${stats.lowCountColorIds.length} flagged as low count.`
              : "None flagged as low count."}
          </div>
        </div>
      </div>

      <div className="ms-info">
        <div>
          <div className="ms-eyebrow">Baseplate</div>
          <div className="ms-info-value ms-info-value-mono">{bp}</div>
          <div className="ms-supp">{physical}</div>
        </div>
        <div>
          <div className="ms-eyebrow">Dithering</div>
          <div className="ms-info-value">
            {project.dithered ? "On, Floyd-Steinberg" : "Off"}
          </div>
          <div className="ms-supp">
            {project.dithered
              ? "Photo-like, more colors and pieces to track."
              : "Flat, poster-like, easier to build."}
          </div>
        </div>
      </div>

      <div>
        <div className="ms-breakdown-head">
          <span className="ms-eyebrow">Per-color breakdown</span>
          <span className="ms-eyebrow" style={{ color: "var(--ink-2)" }}>
            {stats.distinctColors} of {project.paletteSnapshot.colors.length}
          </span>
        </div>
        <ColorLegend
          project={project}
          onlyUsed
          lowCountThreshold={lowCountThreshold}
          sortBy="count-desc"
        />
      </div>
    </div>
  );
}
