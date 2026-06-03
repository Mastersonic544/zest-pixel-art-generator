/*
  ImageViewModal — fullscreen zoom + pan viewer for a mosaic.
  Opens when the user clicks the preview on /project/:id.
  Supports mouse drag, touch drag, scroll-to-zoom, keyboard +/-/Escape.
*/

import { useEffect, useRef, useState, useCallback } from "react";
import MosaicPreview from "./MosaicPreview";
import type { PreviewMode, MosaicProjectLike } from "./MosaicPreview";
import "./ImageViewModal.css";

const ZOOM_LEVELS = [1, 1.5, 2, 3];
const BASE_SIZE = 600;

type Props = {
  project: MosaicProjectLike;
  initialMode?: PreviewMode;
  onClose: () => void;
};

export default function ImageViewModal({ project, initialMode = "colored", onClose }: Props) {
  const [mode, setMode] = useState<PreviewMode>(initialMode);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const scale = ZOOM_LEVELS[zoomIdx]!;
  const canPan = scale > 1;

  const zoomIn = useCallback(() => {
    setZoomIdx((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIdx((i) => {
      const next = Math.max(i - 1, 0);
      if (next === 0) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Keyboard: Escape, +, -
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "+" || e.key === "=") { zoomIn(); return; }
      if (e.key === "-") { zoomOut(); return; }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, zoomIn, zoomOut]);

  // Scroll-to-zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (e.deltaY < 0) zoomIn();
      else zoomOut();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomIn, zoomOut]);

  // Reset pan when zoom returns to 1
  useEffect(() => {
    if (scale === 1) setPan({ x: 0, y: 0 });
  }, [scale]);

  /* ── Pointer drag (mouse + touch via pointer events) ─────────── */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!canPan) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pan.x, origY: pan.y };
    setIsDragging(true);
  }, [canPan, pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPan({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  }, []);

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    setIsDragging(false);
  }, []);

  /* ── Overlay click-to-close (click outside dialog) ───────────── */

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  return (
    <div
      className="imv-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Mosaic viewer"
    >
      <div className="imv-dialog" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="imv-header">
          {/* Mode toggle */}
          <div className="imv-mode-group">
            <div className="segmented" role="radiogroup" aria-label="Preview mode">
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

          {/* Zoom controls */}
          <div className="imv-zoom-group">
            <button
              className="btn btn-tiny"
              onClick={zoomOut}
              disabled={zoomIdx === 0}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="imv-zoom-label">{Math.round(scale * 100)}%</span>
            <button
              className="btn btn-tiny"
              onClick={zoomIn}
              disabled={zoomIdx === ZOOM_LEVELS.length - 1}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>

          {/* Close */}
          <button
            className="btn btn-ghost btn-tiny imv-close"
            onClick={onClose}
            aria-label="Close viewer"
          >
            ✕
          </button>
        </div>

        {/* Viewport */}
        <div
          ref={viewportRef}
          className={`imv-viewport${isDragging ? " is-dragging" : ""}${!canPan ? " is-fit" : ""}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="imv-canvas-wrap"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            }}
          >
            <MosaicPreview project={project} mode={mode} size={BASE_SIZE} />
          </div>
        </div>

        {/* Footer hint */}
        <div className="imv-footer">
          <p className="imv-hint">
            {canPan ? "Drag to pan · Scroll to zoom · Esc to close" : "Scroll to zoom · Esc to close"}
          </p>
        </div>

      </div>
    </div>
  );
}
