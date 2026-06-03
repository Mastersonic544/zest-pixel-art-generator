/*
  StepCrop — square crop box + canvas size selector.

  The crop box is draggable (grab body) and resizable (drag corner handles).
  Crop coords are in source-image pixels.
  Size selector shows 16 / 32 / 50 only (PRD §3).
*/

import { useEffect, useRef, useState, useCallback } from "react";
import type { CanvasSize } from "@/lib/types";
import type { SourceImage } from "./imageUtils";

export type CropState = {
  x: number;
  y: number;
  size: number;
};

type Corner = "tl" | "tr" | "bl" | "br";

type Props = {
  source: SourceImage;
  canvasSize: CanvasSize;
  crop: CropState;
  onCropChange: (crop: CropState) => void;
  onSizeChange: (size: CanvasSize) => void;
};

const CANVAS_SIZES: CanvasSize[] = [16, 32, 50];
const PREVIEW_MAX = 480; // max CSS px for the preview canvas
const MIN_CROP_PX = 32; // minimum crop selection in source pixels

/* ── Pure resize helper ──────────────────────────────────────────────── */

function applyResize(
  corner: Corner,
  dx: number, // delta in source pixels
  dy: number,
  orig: CropState,
  srcW: number,
  srcH: number
): CropState {
  const maxSize = Math.min(srcW, srcH);

  let newSize: number;
  let nx: number;
  let ny: number;

  // For each corner: grow/shrink by the larger displacement axis.
  // Opposite corner stays fixed.
  if (corner === "br") {
    newSize = Math.max(orig.size + Math.max(dx, dy), MIN_CROP_PX);
    nx = orig.x;
    ny = orig.y;
  } else if (corner === "bl") {
    newSize = Math.max(orig.size + Math.max(-dx, dy), MIN_CROP_PX);
    nx = orig.x + orig.size - newSize;
    ny = orig.y;
  } else if (corner === "tr") {
    newSize = Math.max(orig.size + Math.max(dx, -dy), MIN_CROP_PX);
    nx = orig.x;
    ny = orig.y + orig.size - newSize;
  } else {
    // tl — bottom-right stays fixed
    newSize = Math.max(orig.size + Math.max(-dx, -dy), MIN_CROP_PX);
    nx = orig.x + orig.size - newSize;
    ny = orig.y + orig.size - newSize;
  }

  newSize = Math.min(newSize, maxSize);
  nx = Math.round(Math.max(0, Math.min(nx, srcW - newSize)));
  ny = Math.round(Math.max(0, Math.min(ny, srcH - newSize)));
  return { x: nx, y: ny, size: Math.round(newSize) };
}

/* ── Component ──────────────────────────────────────────────────────── */

export default function StepCrop({
  source,
  canvasSize,
  crop,
  onCropChange,
  onSizeChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [displayScale, setDisplayScale] = useState(1);
  const [canvasDisplay, setCanvasDisplay] = useState({ w: 0, h: 0 });

  // Drag-to-move state
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origCropX: number;
    origCropY: number;
  } | null>(null);

  // Corner-resize state (mouse)
  const resizeRef = useRef<{
    corner: Corner;
    startX: number;
    startY: number;
    origCrop: CropState;
  } | null>(null);

  // Corner-resize state (touch)
  const resizeTouchRef = useRef<{
    corner: Corner;
    touchId: number;
    startX: number;
    startY: number;
    origCrop: CropState;
  } | null>(null);

  // Touch drag-to-move state
  const touchRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    origCropX: number;
    origCropY: number;
  } | null>(null);

  // Compute fitted display dimensions
  useEffect(() => {
    const scale = Math.min(PREVIEW_MAX / source.width, PREVIEW_MAX / source.height, 1);
    setDisplayScale(scale);
    setCanvasDisplay({
      w: Math.round(source.width * scale),
      h: Math.round(source.height * scale),
    });
  }, [source]);

  // Draw source image into canvas
  useEffect(() => {
    if (!canvasDisplay.w || !canvasDisplay.h) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDisplay.w * dpr;
    canvas.height = canvasDisplay.h * dpr;
    canvas.style.width = `${canvasDisplay.w}px`;
    canvas.style.height = `${canvasDisplay.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(source.bitmap, 0, 0, canvasDisplay.w, canvasDisplay.h);
  }, [source, canvasDisplay]);

  // Crop box in display pixels
  const displayCrop = {
    x: crop.x * displayScale,
    y: crop.y * displayScale,
    size: crop.size * displayScale,
  };

  function clampCrop(x: number, y: number, size: number): CropState {
    return {
      x: Math.round(Math.max(0, Math.min(x, source.width - size))),
      y: Math.round(Math.max(0, Math.min(y, source.height - size))),
      size,
    };
  }

  /* ── Drag (move) ─────────────────────────────────────────────────── */

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origCropX: crop.x,
        origCropY: crop.y,
      };
    },
    [crop]
  );

  /* ── Resize (corners) — mouse ────────────────────────────────────── */

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, corner: Corner) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        corner,
        startX: e.clientX,
        startY: e.clientY,
        origCrop: { ...crop },
      };
    },
    [crop]
  );

  /* ── Global mouse move / up ──────────────────────────────────────── */

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (resizeRef.current) {
        const { corner, startX, startY, origCrop } = resizeRef.current;
        const dx = (e.clientX - startX) / displayScale;
        const dy = (e.clientY - startY) / displayScale;
        onCropChange(applyResize(corner, dx, dy, origCrop, source.width, source.height));
        return;
      }
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) / displayScale;
      const dy = (e.clientY - dragRef.current.startY) / displayScale;
      onCropChange(
        clampCrop(dragRef.current.origCropX + dx, dragRef.current.origCropY + dy, crop.size)
      );
    }
    function onMouseUp() {
      dragRef.current = null;
      resizeRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayScale, crop.size, onCropChange, source.width, source.height]);

  /* ── Touch drag (move) ───────────────────────────────────────────── */

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (!t) return;
      touchRef.current = {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        origCropX: crop.x,
        origCropY: crop.y,
      };
    },
    [crop]
  );

  /* ── Resize (corners) — touch ────────────────────────────────────── */

  const handleResizeTouchStart = useCallback(
    (e: React.TouchEvent, corner: Corner) => {
      e.preventDefault();
      e.stopPropagation();
      const t = e.changedTouches[0];
      if (!t) return;
      resizeTouchRef.current = {
        corner,
        touchId: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        origCrop: { ...crop },
      };
    },
    [crop]
  );

  /* ── Global touch move / end ─────────────────────────────────────── */

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      // Resize
      if (resizeTouchRef.current) {
        const ref = resizeTouchRef.current;
        const t = Array.from(e.changedTouches).find((x) => x.identifier === ref.touchId);
        if (!t) return;
        const dx = (t.clientX - ref.startX) / displayScale;
        const dy = (t.clientY - ref.startY) / displayScale;
        onCropChange(applyResize(ref.corner, dx, dy, ref.origCrop, source.width, source.height));
        return;
      }
      // Drag
      if (!touchRef.current) return;
      const t = Array.from(e.changedTouches).find(
        (x) => x.identifier === touchRef.current!.id
      );
      if (!t) return;
      const dx = (t.clientX - touchRef.current.startX) / displayScale;
      const dy = (t.clientY - touchRef.current.startY) / displayScale;
      onCropChange(
        clampCrop(touchRef.current.origCropX + dx, touchRef.current.origCropY + dy, crop.size)
      );
    }
    function onTouchEnd() {
      touchRef.current = null;
      resizeTouchRef.current = null;
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayScale, crop.size, onCropChange, source.width, source.height]);

  /* ── Render ──────────────────────────────────────────────────────── */

  return (
    <div className="np-step-body">
      <div className="np-crop-layout">
        {/* Image + crop overlay */}
        <div
          ref={containerRef}
          className="np-crop-stage"
          style={{
            width: canvasDisplay.w || "auto",
            height: canvasDisplay.h || "auto",
          }}
        >
          <canvas ref={canvasRef} className="np-crop-canvas" />

          {canvasDisplay.w > 0 && (
            <div className="np-crop-overlay" aria-hidden="true">
              {/* Dim rects outside the crop box */}
              <div className="np-dim" style={{ left: 0, top: 0, width: canvasDisplay.w, height: displayCrop.y }} />
              <div className="np-dim" style={{ left: 0, top: displayCrop.y + displayCrop.size, width: canvasDisplay.w, height: canvasDisplay.h - displayCrop.y - displayCrop.size }} />
              <div className="np-dim" style={{ left: 0, top: displayCrop.y, width: displayCrop.x, height: displayCrop.size }} />
              <div className="np-dim" style={{ left: displayCrop.x + displayCrop.size, top: displayCrop.y, width: canvasDisplay.w - displayCrop.x - displayCrop.size, height: displayCrop.size }} />

              {/* Crop handle — drag to reposition */}
              <div
                className="np-crop-handle"
                style={{
                  left: displayCrop.x,
                  top: displayCrop.y,
                  width: displayCrop.size,
                  height: displayCrop.size,
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
                aria-label="Drag to reposition crop"
                role="slider"
                tabIndex={0}
              >
                {/* Corner resize handles */}
                {(["tl", "tr", "bl", "br"] as Corner[]).map((corner) => (
                  <div
                    key={corner}
                    className={`np-crop-corner np-crop-corner-${corner}`}
                    onMouseDown={(e) => handleResizeMouseDown(e, corner)}
                    onTouchStart={(e) => handleResizeTouchStart(e, corner)}
                    aria-label={`Resize from ${corner} corner`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="np-crop-controls">
          <div className="np-field">
            <span className="np-field-label">Canvas size</span>
            <span className="np-field-help">Stud count per side. Real LEGO baseplates only.</span>
            <div className="segmented segmented-mono" role="radiogroup" aria-label="Canvas size">
              {CANVAS_SIZES.map((sz) => (
                <button
                  key={sz}
                  className={canvasSize === sz ? "is-active" : ""}
                  onClick={() => onSizeChange(sz)}
                  role="radio"
                  aria-checked={canvasSize === sz}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="np-field">
            <span className="np-field-label">Crop</span>
            <span className="np-field-help">Drag the box to move. Drag a corner to resize.</span>
            <div className="np-crop-readout">
              <span className="num">{crop.x}, {crop.y}</span>
              <span className="np-crop-readout-sep">/</span>
              <span className="num">{crop.size} × {crop.size} px</span>
            </div>
          </div>

          <div className="np-field">
            <span className="np-field-label">Source</span>
            <span className="np-field-help">Original image dimensions.</span>
            <span className="num">{source.width} × {source.height} px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
