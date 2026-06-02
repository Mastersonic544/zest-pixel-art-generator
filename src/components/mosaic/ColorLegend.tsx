import { useMemo } from "react";
import type { Color } from "@/lib/types";
import type { MosaicProjectLike } from "./MosaicPreview";
import "./mosaic.css";

type LegendEntry = {
  color: Color;
  count: number;
  low: boolean;
};

type Props = {
  project: MosaicProjectLike;
  /** Hide colors with count = 0. Default true. */
  onlyUsed?: boolean;
  /** Mark counts strictly below this. Default 4. */
  lowCountThreshold?: number;
  /** Compact 4-col layout for use inside the preview. Default false (full table). */
  compact?: boolean;
  /** Sort by count desc (default) or by id asc. */
  sortBy?: "count-desc" | "id";
};

export default function ColorLegend({
  project,
  onlyUsed = true,
  lowCountThreshold = 4,
  compact = false,
  sortBy = "count-desc",
}: Props) {
  const entries = useMemo<LegendEntry[]>(() => {
    const counts = new Map<number, number>();
    for (const id of project.grid) counts.set(id, (counts.get(id) ?? 0) + 1);
    const out: LegendEntry[] = project.paletteSnapshot.colors.map((color) => {
      const n = counts.get(color.id) ?? 0;
      return { color, count: n, low: n > 0 && n < lowCountThreshold };
    });
    const filtered = onlyUsed ? out.filter((e) => e.count > 0) : out;
    if (sortBy === "id") return filtered.sort((a, b) => a.color.id - b.color.id);
    return filtered.sort((a, b) =>
      b.count - a.count || a.color.id - b.color.id
    );
  }, [project, onlyUsed, lowCountThreshold, sortBy]);

  return (
    <div className={`cl ${compact ? "cl-compact" : ""}`} role="table" aria-label="Color legend">
      {entries.map((e) => (
        <div className="cl-row" role="row" key={e.color.id}>
          <span className="cl-id">{String(e.color.id).padStart(2, "0")}</span>
          <span className="cl-chip" style={{ background: e.color.hex }} />
          <span className="cl-name">{e.color.name}</span>
          {!compact && <span className="cl-hex">{e.color.hex}</span>}
          <span className="cl-count">{e.count.toLocaleString()}</span>
          {!compact && (
            e.low ? (
              <span className="cl-flag">Low</span>
            ) : (
              <span className="cl-flag cl-flag-empty">Low</span>
            )
          )}
        </div>
      ))}
    </div>
  );
}
