/*
  MiniMap — persistent "where am I" overview for guided assembly.
  PRD §6.5: mandatory in every guided mode.

  Paints each grid cell as a tiny square:
    - Completed (before current step): full palette color, slightly dimmed.
    - Active (current step): full palette color, full brightness.
    - Remaining (after current step): --paper-2 tone (#EBE8E0).

  The canvas is always 96x96 CSS px (device-pixel-ratio scaled).
  A border is applied via CSS.
*/

import { useEffect, useRef } from "react";
import type { MosaicProjectLike } from "@/components/mosaic";
import { hexToRgb } from "@/lib/quantize";

type Props = {
  project: MosaicProjectLike;
  /** Indices completed before this step (earlier steps). */
  completedIndices: ReadonlySet<number>;
  /** Indices active in the current step. */
  activeIndices: ReadonlySet<number>;
};

const MAP_SIZE = 96; // CSS px

export default function MiniMap({
  project,
  completedIndices,
  activeIndices,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(MAP_SIZE * dpr);
    canvas.height = Math.round(MAP_SIZE * dpr);
    canvas.style.width = `${MAP_SIZE}px`;
    canvas.style.height = `${MAP_SIZE}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { width: W, height: H, grid, paletteSnapshot } = project;
    const colorById = new Map(paletteSnapshot.colors.map((c) => [c.id, c]));

    const cellW = MAP_SIZE / W;
    const cellH = MAP_SIZE / H;

    // Background
    ctx.fillStyle = "#EBE8E0";
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    for (let i = 0; i < W * H; i++) {
      const id = grid[i];
      if (id === undefined) continue;
      const color = colorById.get(id);
      const x = (i % W) * cellW;
      const y = Math.floor(i / W) * cellH;

      if (activeIndices.has(i)) {
        // Active: full color with a bright accent ring drawn after
        ctx.fillStyle = color?.hex ?? "#888";
        ctx.fillRect(x, y, cellW, cellH);
      } else if (completedIndices.has(i)) {
        // Completed: full color, dimmed
        const hex = color?.hex ?? "#888";
        const [r, g, b] = hexToRgb(hex);
        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
        ctx.fillRect(x, y, cellW, cellH);
      } else {
        // Remaining: paper-2
        ctx.fillStyle = "#EBE8E0";
        ctx.fillRect(x, y, cellW, cellH);
      }
    }

    // Draw a 1px accent outline around each active cell block
    // (single pass: only flag transitions for efficiency at all 3 sizes)
    ctx.strokeStyle = "#ff5a1f"; // --accent
    ctx.lineWidth = Math.max(0.5, Math.min(cellW, cellH) * 0.25);
    for (let i = 0; i < W * H; i++) {
      if (!activeIndices.has(i)) continue;
      const cx = (i % W) * cellW;
      const cy = Math.floor(i / W) * cellH;
      // Check all 4 neighbours — draw edge only where neighbour is not active
      const x0 = i % W;
      const y0 = Math.floor(i / W);
      ctx.beginPath();
      if (x0 === 0 || !activeIndices.has(i - 1))       { ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + cellH); }
      if (x0 === W - 1 || !activeIndices.has(i + 1))   { ctx.moveTo(cx + cellW, cy); ctx.lineTo(cx + cellW, cy + cellH); }
      if (y0 === 0 || !activeIndices.has(i - W))        { ctx.moveTo(cx, cy); ctx.lineTo(cx + cellW, cy); }
      if (y0 === H - 1 || !activeIndices.has(i + W))    { ctx.moveTo(cx, cy + cellH); ctx.lineTo(cx + cellW, cy + cellH); }
      ctx.stroke();
    }
  }, [project, completedIndices, activeIndices]);

  return (
    <canvas
      ref={canvasRef}
      className="mm-canvas"
      aria-label="Mini-map showing completed, current, and remaining cells"
    />
  );
}
