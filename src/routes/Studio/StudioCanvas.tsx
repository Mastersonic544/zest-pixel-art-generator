/*
  StudioCanvas — zoomable, pannable mosaic grid with click/drag to paint.

  Zoom: Ctrl/Cmd + scroll, or pinch. Pan: space + drag, or two-finger drag.
  Paint: pointer down + move. Eyedropper: pointer click reports color id.

  Architecture:
  - A fixed-size outer <div> acts as the viewport (overflow: hidden, clip).
  - Inside sits a transform <div> that we translate + scale via CSS transform.
  - The actual content is a <canvas> sized to (width * CELL_PX) x (height * CELL_PX).
  - Hover: we track which cell the pointer is over and draw a cursor outline.
  - Painting happens on pointer events — we convert client coords to canvas
    cell coords using the inverse of the current transform.

  We do NOT use refs to store mutable paint state because we call the paint
  callback synchronously on every pointer-move event; React state would batch
  and miss events. Instead we use refs for ephemeral interaction state (drag,
  pan, zoom) and only call onPaint (which updates the parent's grid) when the
  cell changes.
*/

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { hexToRgb } from "@/lib/quantize";
import type { Color } from "@/lib/types";

/* ---------------------------------------------------------------------- */
/* Types                                                                   */
/* ---------------------------------------------------------------------- */

export type StudioTool = "paint" | "eyedropper";

type Props = {
  width: number;         // studs
  height: number;        // studs
  grid: number[];        // flat, length = width * height
  paletteColors: Color[];
  selectedColorId: number;
  tool: StudioTool;
  /** Called once when a paint stroke begins (pointer-down). Used for undo snapshot. */
  onPaintStart: () => void;
  /** Called with cell index when painted. */
  onPaint: (cellIndex: number) => void;
  /** Called when eyedropper picks a color. */
  onEyedrop: (colorId: number) => void;
};

/* ---------------------------------------------------------------------- */
/* Constants                                                               */
/* ---------------------------------------------------------------------- */

// Base cell size in logical canvas pixels before zoom is applied.
const BASE_CELL = 16;
const MIN_SCALE = 0.5;
const MAX_SCALE = 16;

/* ---------------------------------------------------------------------- */
/* Helpers                                                                 */
/* ---------------------------------------------------------------------- */

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function mixHexAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------------------------------------------------------------------- */
/* Component                                                               */
/* ---------------------------------------------------------------------- */

export default function StudioCanvas({
  width,
  height,
  grid,
  paletteColors,
  selectedColorId,
  tool,
  onPaintStart,
  onPaint,
  onEyedrop,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Transform state (scale + translation of the inner container).
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);

  // Ephemeral interaction refs (not state — no re-render needed).
  const isPainting = useRef(false);
  const lastPaintedCell = useRef<number>(-1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const spaceDown = useRef(false);
  const [hoverCell, setHoverCell] = useState<number>(-1);

  // Build color lookup once.
  const colorById = useMemo(() => {
    const m = new Map<number, Color>();
    for (const c of paletteColors) m.set(c.id, c);
    return m;
  }, [paletteColors]);

  const selectedColor = colorById.get(selectedColorId);

  // Canvas logical size.
  const canvasW = width * BASE_CELL;
  const canvasH = height * BASE_CELL;

  // Fit scale: on mount, scale so the full grid fits in the viewport.
  const outerW = outerRef.current?.clientWidth ?? 600;
  const outerH = outerRef.current?.clientHeight ?? 480;

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const { clientWidth: ow, clientHeight: oh } = el;
    const fit = Math.min(ow / canvasW, oh / canvasH, 1);
    const initScale = Math.max(MIN_SCALE, fit);
    setScale(initScale);
    setTx((ow - canvasW * initScale) / 2);
    setTy((oh - canvasH * initScale) / 2);
    // Only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw the canvas whenever grid / colors / hover change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = `${canvasW}px`;
    canvas.style.height = `${canvasH}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = "#EBE8E0";
    ctx.fillRect(0, 0, canvasW, canvasH);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const id = grid[idx];
        const color = id !== undefined ? colorById.get(id) : undefined;
        const px = x * BASE_CELL;
        const py = y * BASE_CELL;

        // Cell fill
        ctx.fillStyle = color?.hex ?? "#EBE8E0";
        ctx.fillRect(px, py, BASE_CELL, BASE_CELL);

        // Cell border (hairline)
        ctx.strokeStyle = "rgba(10,10,8,0.12)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(px + 0.25, py + 0.25, BASE_CELL - 0.5, BASE_CELL - 0.5);
      }
    }

    // Hover highlight
    if (hoverCell >= 0 && hoverCell < width * height) {
      const hx = (hoverCell % width) * BASE_CELL;
      const hy = Math.floor(hoverCell / width) * BASE_CELL;

      if (tool === "paint" && selectedColor) {
        // Paint preview: color the cell with the selected color at 60% opacity.
        ctx.fillStyle = mixHexAlpha(selectedColor.hex, 0.6);
        ctx.fillRect(hx, hy, BASE_CELL, BASE_CELL);
      }
      // Cursor outline in accent color.
      ctx.strokeStyle = "#ff5a1f";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(hx + 0.75, hy + 0.75, BASE_CELL - 1.5, BASE_CELL - 1.5);
    }
  }, [grid, colorById, hoverCell, tool, selectedColor, canvasW, canvasH, width, height]);

  /* -------------------------------------------------------------------- */
  /* Coordinate helpers                                                    */
  /* -------------------------------------------------------------------- */

  function clientToCell(clientX: number, clientY: number): number {
    const outer = outerRef.current;
    if (!outer) return -1;
    const rect = outer.getBoundingClientRect();
    // Canvas logical coords:
    const lx = (clientX - rect.left - tx) / scale;
    const ly = (clientY - rect.top - ty) / scale;
    const cx = Math.floor(lx / BASE_CELL);
    const cy = Math.floor(ly / BASE_CELL);
    if (cx < 0 || cx >= width || cy < 0 || cy >= height) return -1;
    return cy * width + cx;
  }

  /* -------------------------------------------------------------------- */
  /* Pointer events                                                        */
  /* -------------------------------------------------------------------- */

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      if (spaceDown.current) {
        // Start pan
        isPanning.current = true;
        panStart.current = { x: e.clientX, y: e.clientY, tx, ty };
        return;
      }

      const cell = clientToCell(e.clientX, e.clientY);

      if (tool === "eyedropper") {
        if (cell >= 0) {
          const id = grid[cell];
          if (id !== undefined) onEyedrop(id);
        }
        return;
      }

      // Paint
      if (cell >= 0) {
        isPainting.current = true;
        lastPaintedCell.current = cell;
        onPaintStart();
        onPaint(cell);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tx, ty, tool, grid, onPaint, onEyedrop, onPaintStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning.current) {
        const dx = e.clientX - panStart.current.x;
        const dy = e.clientY - panStart.current.y;
        setTx(panStart.current.tx + dx);
        setTy(panStart.current.ty + dy);
        return;
      }

      const cell = clientToCell(e.clientX, e.clientY);
      setHoverCell(cell);

      if (isPainting.current && cell >= 0 && cell !== lastPaintedCell.current) {
        lastPaintedCell.current = cell;
        onPaint(cell);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tx, ty, scale, tool, onPaint]
  );

  const handlePointerUp = useCallback((_e: React.PointerEvent) => {
    isPainting.current = false;
    lastPaintedCell.current = -1;
    isPanning.current = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoverCell(-1);
  }, []);

  /* -------------------------------------------------------------------- */
  /* Zoom (wheel)                                                          */
  /* -------------------------------------------------------------------- */

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const outer = outerRef.current;
      if (!outer) return;
      const rect = outer.getBoundingClientRect();

      const factor = e.ctrlKey || e.metaKey ? 1 : 0.05;
      const delta = -e.deltaY * factor * 0.01;
      const newScale = clamp(scale * Math.exp(delta * 3), MIN_SCALE, MAX_SCALE);

      // Zoom toward the cursor position.
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;
      const newTx = ox - (ox - tx) * (newScale / scale);
      const newTy = oy - (oy - ty) * (newScale / scale);

      setScale(newScale);
      setTx(newTx);
      setTy(newTy);
    },
    [scale, tx, ty]
  );

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  /* -------------------------------------------------------------------- */
  /* Space bar for pan mode                                                */
  /* -------------------------------------------------------------------- */

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        spaceDown.current = true;
      }
      // Ctrl+Z / Ctrl+Shift+Z handled by parent via bubbling; we don't
      // need to intercept here.
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceDown.current = false;
        isPanning.current = false;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  /* -------------------------------------------------------------------- */
  /* Zoom buttons                                                          */
  /* -------------------------------------------------------------------- */

  function zoomBy(factor: number) {
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const ow = outerRef.current?.clientWidth ?? outerW;
    const oh = outerRef.current?.clientHeight ?? outerH;
    const ox = ow / 2;
    const oy = oh / 2;
    setScale(newScale);
    setTx(ox - (ox - tx) * (newScale / scale));
    setTy(oy - (oy - ty) * (newScale / scale));
  }

  function resetView() {
    const el = outerRef.current;
    if (!el) return;
    const { clientWidth: ow, clientHeight: oh } = el;
    const fit = Math.min(ow / canvasW, oh / canvasH, 1);
    const s = Math.max(MIN_SCALE, fit);
    setScale(s);
    setTx((ow - canvasW * s) / 2);
    setTy((oh - canvasH * s) / 2);
  }

  const cursor =
    spaceDown.current
      ? "grab"
      : tool === "eyedropper"
      ? "crosshair"
      : "default";

  return (
    <div className="sc-wrap">
      {/* Zoom controls */}
      <div className="sc-zoom-bar">
        <button
          className="btn btn-tiny btn-ghost"
          onClick={() => zoomBy(1 / 1.4)}
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <span className="sc-zoom-label">{Math.round(scale * 100)}%</span>
        <button
          className="btn btn-tiny btn-ghost"
          onClick={() => zoomBy(1.4)}
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="btn btn-tiny btn-ghost"
          onClick={resetView}
          aria-label="Fit to view"
        >
          Fit
        </button>
      </div>

      {/* Viewport */}
      <div
        ref={outerRef}
        className="sc-viewport"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{ cursor }}
        aria-label="Studio canvas. Use scroll or +/- to zoom. Space + drag to pan. Click cells to paint."
        role="application"
      >
        <div
          className="sc-inner"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: "block",
              imageRendering: "pixelated",
            }}
          />
        </div>
      </div>
    </div>
  );
}
