/*
  StepCrop — square crop box + canvas size selector.

  The crop box is draggable. Crop coords are in source-image pixels.
  Size selector shows 16 / 32 / 48 only (PRD §3).
*/

import { useEffect, useRef, useState, useCallback } from "react";
import type { CanvasSize } from "@/lib/types";
import type { SourceImage } from "./imageUtils";

export type CropState = {
  x: number;
  y: number;
  size: number;
};

type Props = {
  source: SourceImage;
  canvasSize: CanvasSize;
  crop: CropState;
  onCropChange: (crop: CropState) => void;
  onSizeChange: (size: CanvasSize) => void;
};

const CANVAS_SIZES: CanvasSize[] = [16, 32, 50];
const PREVIEW_MAX = 480; // max CSS px for the preview canvas

export default function StepCrop({
  source,
  canvasSize,
  crop,
  onCropChange,
  onSizeChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // We render the source into the canvas at a fitted size, then
  // overlay a draggable crop box div.
  // displayScale = canvas display size / source pixels
  const [displayScale, setDisplayScale] = useState(1);
  const [canvasDisplay, setCanvasDisplay] = useState({ w: 0, h: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origCropX: number; origCropY: number } | null>(null);

  // Compute fitted display dimensions.
  useEffect(() => {
    const srcW = source.width;
    const srcH = source.height;
    const scale = Math.min(PREVIEW_MAX / srcW, PREVIEW_MAX / srcH, 1);
    const dw = Math.round(srcW * scale);
    const dh = Math.round(srcH * scale);
    setDisplayScale(scale);
    setCanvasDisplay({ w: dw, h: dh });
  }, [source]);

  // Draw the source image into the canvas.
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

  // Crop box in display pixels.
  const displayCrop = {
    x: crop.x * displayScale,
    y: crop.y * displayScale,
    size: crop.size * displayScale,
  };

  // Clamp crop to source bounds.
  function clampCrop(x: number, y: number, size: number): CropState {
    const maxX = source.width - size;
    const maxY = source.height - size;
    return {
      x: Math.round(Math.max(0, Math.min(x, maxX))),
      y: Math.round(Math.max(0, Math.min(y, maxY))),
      size,
    };
  }

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

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const dx = (e.clientX - dragRef.current.startX) / displayScale;
      const dy = (e.clientY - dragRef.current.startY) / displayScale;
      onCropChange(
        clampCrop(
          dragRef.current.origCropX + dx,
          dragRef.current.origCropY + dy,
          crop.size
        )
      );
    }
    function onMouseUp() {
      dragRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayScale, crop.size, onCropChange]);

  // Touch support
  const touchRef = useRef<{ id: number; startX: number; startY: number; origCropX: number; origCropY: number } | null>(null);

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

  useEffect(() => {
    function onTouchMove(e: TouchEvent) {
      if (!touchRef.current) return;
      const t = Array.from(e.changedTouches).find(
        (t) => t.identifier === touchRef.current!.id
      );
      if (!t) return;
      const dx = (t.clientX - touchRef.current.startX) / displayScale;
      const dy = (t.clientY - touchRef.current.startY) / displayScale;
      onCropChange(
        clampCrop(
          touchRef.current.origCropX + dx,
          touchRef.current.origCropY + dy,
          crop.size
        )
      );
    }
    function onTouchEnd() {
      touchRef.current = null;
    }
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayScale, crop.size, onCropChange]);

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
          {/* Dimming overlay — 4 rects around the crop box */}
          {canvasDisplay.w > 0 && (
            <div className="np-crop-overlay" aria-hidden="true">
              {/* Top */}
              <div
                className="np-dim"
                style={{
                  left: 0,
                  top: 0,
                  width: canvasDisplay.w,
                  height: displayCrop.y,
                }}
              />
              {/* Bottom */}
              <div
                className="np-dim"
                style={{
                  left: 0,
                  top: displayCrop.y + displayCrop.size,
                  width: canvasDisplay.w,
                  height: canvasDisplay.h - displayCrop.y - displayCrop.size,
                }}
              />
              {/* Left */}
              <div
                className="np-dim"
                style={{
                  left: 0,
                  top: displayCrop.y,
                  width: displayCrop.x,
                  height: displayCrop.size,
                }}
              />
              {/* Right */}
              <div
                className="np-dim"
                style={{
                  left: displayCrop.x + displayCrop.size,
                  top: displayCrop.y,
                  width: canvasDisplay.w - displayCrop.x - displayCrop.size,
                  height: displayCrop.size,
                }}
              />
              {/* Crop handle */}
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
              />
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="np-crop-controls">
          <div className="np-field">
            <span className="np-field-label">Canvas size</span>
            <span className="np-field-help">Stud count per side. Real LEGO baseplates only.</span>
            <div
              className="segmented segmented-mono"
              role="radiogroup"
              aria-label="Canvas size"
            >
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
            <span className="np-field-help">Drag the box to reposition. Square crop only.</span>
            <div className="np-crop-readout">
              <span className="num">{crop.x}, {crop.y}</span>
              <span className="np-crop-readout-sep">/</span>
              <span className="num">{crop.size} x {crop.size} px</span>
            </div>
          </div>

          <div className="np-field">
            <span className="np-field-label">Source</span>
            <span className="np-field-help">Original image dimensions.</span>
            <span className="num">{source.width} x {source.height} px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
