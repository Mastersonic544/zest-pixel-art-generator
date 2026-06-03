import { useEffect, useMemo, useRef } from "react";
import { hexToRgb } from "@/lib/quantize";
import type { Color, Project } from "@/lib/types";
import "./mosaic.css";

export type PreviewMode = "colored" | "bricks" | "code";

export type MosaicProjectLike = Pick<
  Project,
  "width" | "height" | "baseplate" | "paletteSnapshot" | "grid"
>;

type Props = {
  project: MosaicProjectLike;
  mode: PreviewMode;
  /** Logical CSS pixel size of the square preview. Default 480. */
  size?: number;
  /**
   * Optional set of grid cell indices to highlight (guided assembly).
   * When provided, cells NOT in the set receive a dimming wash so the
   * active cells stand out. Pass undefined (default) for no highlight.
   */
  highlightSet?: ReadonlySet<number>;
};

/** Min cell size (in CSS px) at which the code-mode number is drawn. */
const CODE_NUMBER_MIN_CELL = 5;

export default function MosaicPreview({ project, mode, size = 480, highlightSet }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Build an id -> Color lookup once.
  const colorById = useMemo(() => {
    const m = new Map<number, Color>();
    for (const c of project.paletteSnapshot.colors) m.set(c.id, c);
    return m;
  }, [project.paletteSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    drawMosaic(ctx, project, colorById, mode, size, highlightSet);
  }, [project, mode, size, colorById, highlightSet]);

  const cellPx = size / project.width;

  return (
    <div className="mp" style={{ maxWidth: size }}>
      <div
        className="mp-frame"
        style={{ width: size, height: size, aspectRatio: "1 / 1" }}
      >
        <canvas
          ref={canvasRef}
          aria-label={`Mosaic preview, ${mode} mode, ${project.width} by ${project.height} studs`}
        />
      </div>
      <div className="mp-meta">
        <span><strong>{labelFor(mode)}</strong></span>
        <span>{project.width} x {project.height}{mode === "code" && cellPx < CODE_NUMBER_MIN_CELL ? "  numbers in legend" : ""}</span>
      </div>
    </div>
  );
}

function labelFor(mode: PreviewMode): string {
  return mode === "colored" ? "Colored" : mode === "bricks" ? "Bricks" : "Code";
}

/* ---------------------------------------------------------------------- */
/* Drawing                                                                 */
/* ---------------------------------------------------------------------- */

function drawMosaic(
  ctx: CanvasRenderingContext2D,
  project: MosaicProjectLike,
  colorById: Map<number, Color>,
  mode: PreviewMode,
  size: number,
  highlightSet?: ReadonlySet<number>
): void {
  const { width: W, height: H, grid } = project;
  const cell = size / W;
  const cellH = size / H;

  // Background: paper-2 so any inter-cell gaps from sub-pixel rounding
  // read as the chrome, not as noise.
  ctx.fillStyle = "#EBE8E0";
  ctx.fillRect(0, 0, size, size);

  // Code-mode text rendering once per grid pass.
  if (mode === "code") {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
  }

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cellIdx = y * W + x;
      const id = grid[cellIdx];
      if (id === undefined) continue;
      const color = colorById.get(id);
      if (!color) continue;
      const px = x * cell;
      const py = y * cellH;
      const isDimmed = highlightSet !== undefined && !highlightSet.has(cellIdx);
      switch (mode) {
        case "colored":
          drawColored(ctx, px, py, cell, cellH, color.hex);
          if (isDimmed) {
            ctx.fillStyle = "rgba(244, 242, 236, 0.72)";
            ctx.fillRect(px, py, cell, cellH);
          }
          break;
        case "bricks":
          drawBrick(ctx, px, py, cell, cellH, color.hex);
          if (isDimmed) {
            ctx.fillStyle = "rgba(244, 242, 236, 0.72)";
            ctx.fillRect(px, py, cell, cellH);
          }
          break;
        case "code":
          // isDimmed passed in so overlay is applied before the number is drawn.
          drawCode(ctx, px, py, cell, cellH, color.hex, id, isDimmed);
          break;
      }
    }
  }
}

function drawColored(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string
): void {
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);
}

/**
 * 1x1 plate with a centered round stud. Composition (from back to front):
 *   1. Base plate fill.
 *   2. Plate seam: a hairline darker stroke along the right + bottom of the
 *      cell, giving the impression of plate edges meeting.
 *   3. Stud disc fill (same hex as the plate).
 *   4. Stud rim: thin dark ring around the disc edge for definition.
 *   5. Inner shadow: a slightly darker arc on the bottom-right interior.
 *   6. Top-light: a slightly lighter arc on the top-left interior.
 * The rim, shadow, and highlight weights scale with the cell size so the
 * stud reads tactile at 16x16 and stays defined at 48x48.
 */
function drawBrick(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string
): void {
  const cell = Math.min(w, h);

  // 1. Base plate.
  ctx.fillStyle = hex;
  ctx.fillRect(x, y, w, h);

  // 2. Plate seam (hairline darker on right + bottom).
  const seamThickness = Math.max(0.5, cell * 0.04);
  const seamColor = mixHex(hex, "#000000", 0.18);
  ctx.fillStyle = seamColor;
  ctx.fillRect(x + w - seamThickness, y, seamThickness, h);
  ctx.fillRect(x, y + h - seamThickness, w, seamThickness);

  // Stud geometry. Diameter ~ 62% of the cell — a touch under real LEGO
  // (which is ~62.5% stud to plate footprint) for visual breathing room.
  const cx = x + w / 2;
  const cy = y + h / 2;
  const studR = cell * 0.31;

  // 3. Stud disc.
  ctx.fillStyle = hex;
  ctx.beginPath();
  ctx.arc(cx, cy, studR, 0, Math.PI * 2);
  ctx.fill();

  // Decide weights for the rim, shadow, and highlight. Scale with cell.
  const rimW = Math.max(0.5, cell * 0.05);
  const lineW = Math.max(0.5, cell * 0.07);

  // 4. Stud rim (full circle, slightly darker than plate).
  ctx.strokeStyle = mixHex(hex, "#000000", 0.22);
  ctx.lineWidth = rimW;
  ctx.beginPath();
  ctx.arc(cx, cy, studR - rimW / 2, 0, Math.PI * 2);
  ctx.stroke();

  // Inner radius for the directional arcs.
  const innerR = studR - rimW - lineW / 2;
  if (innerR > 0.4) {
    // 5. Inner shadow: bottom-right half (angles -45 deg to 135 deg).
    ctx.strokeStyle = mixHex(hex, "#000000", 0.16);
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, deg(-45), deg(135));
    ctx.stroke();

    // 6. Top-light: top-left half (angles 135 to 315 deg / -45).
    ctx.strokeStyle = mixHex(hex, "#FFFFFF", 0.28);
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR, deg(135), deg(315));
    ctx.stroke();
  }
}

function drawCode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  hex: string,
  id: number,
  isDimmed: boolean
): void {
  const cell = Math.min(w, h);

  const tint = mixHex(hex, "#F4F2EC", 0.82);
  ctx.fillStyle = tint;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = "#E6E2D6";
  ctx.fillRect(x + w - 1, y, 1, h);
  ctx.fillRect(x, y + h - 1, w, 1);

  // Dimming overlay applied BEFORE the number so the number stays on top.
  if (isDimmed) {
    ctx.fillStyle = "rgba(244, 242, 236, 0.72)";
    ctx.fillRect(x, y, w, h);
  }

  if (cell >= CODE_NUMBER_MIN_CELL) {
    const fontPx = Math.floor(cell * 0.48);
    ctx.font = `500 ${fontPx}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.fillStyle = isDimmed ? "rgba(10,10,8,0.40)" : "#0A0A08";
    ctx.fillText(String(id), x + w / 2, y + h / 2 + 0.5);
  }
}

/* ---------------------------------------------------------------------- */
/* Color math helpers                                                      */
/* ---------------------------------------------------------------------- */

/** Linear-ish RGB mix. t=0 returns a, t=1 returns b. */
function mixHex(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  const r = Math.round(ra[0] + (rb[0] - ra[0]) * t);
  const g = Math.round(ra[1] + (rb[1] - ra[1]) * t);
  const bl = Math.round(ra[2] + (rb[2] - ra[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

function deg(d: number): number {
  return (d * Math.PI) / 180;
}
