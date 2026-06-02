/*
  StepConvert — runs quantize, shows MosaicPreview + stats.

  Re-runs whenever source / crop / canvasSize / dithered changes.
  The heavy work (quantize) is synchronous but fast at 16/32/48; no worker needed.
*/

import { useEffect, useMemo, useState } from "react";
import { MosaicPreview, MosaicStats } from "@/components/mosaic";
import type { PreviewMode } from "@/components/mosaic";
import { quantize } from "@/lib/quantize";
import type { Palette, Project } from "@/lib/types";
import type { CanvasSize } from "@/lib/types";
import type { SourceImage, CropState } from "./index";
import { bitmapToRGBA } from "./imageUtils";

type Props = {
  source: SourceImage;
  crop: CropState;
  canvasSize: CanvasSize;
  dithered: boolean;
  palette: Palette;
  onDitheredChange: (d: boolean) => void;
  /** Called with the computed grid + palette snapshot every time quantization completes. */
  onResult: (grid: number[], palette: Palette) => void;
};

export default function StepConvert({
  source,
  crop,
  canvasSize,
  dithered,
  palette,
  onDitheredChange,
  onResult,
}: Props) {
  const [mode, setMode] = useState<PreviewMode>("colored");
  const [error, setError] = useState<string | null>(null);

  // Build a minimal "project-like" for MosaicPreview/MosaicStats.
  // We recompute whenever the inputs change.
  const projectLike = useMemo<Project | null>(() => {
    try {
      const { data, width, height } = bitmapToRGBA(source.bitmap);
      const result = quantize({
        source: { data, width, height },
        target: { width: canvasSize, height: canvasSize },
        palette,
        fit: {
          kind: "crop",
          rect: { x: crop.x, y: crop.y, w: crop.size, h: crop.size },
        },
        dither: dithered,
        lowCountThreshold: 4,
      });
      setError(null);
      // Notify parent so Finish step has the final data.
      onResult(result.grid, palette);
      return {
        id: "__preview__",
        name: "",
        createdAt: "",
        updatedAt: "",
        width: canvasSize,
        height: canvasSize,
        baseplate: "black",
        dithered,
        paletteSnapshot: palette,
        grid: result.grid,
      };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Quantization failed.");
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, crop.x, crop.y, crop.size, canvasSize, dithered, palette]);

  // Keep parent in sync on first render too (effect mirrors the memo).
  useEffect(() => {
    if (projectLike) {
      onResult(projectLike.grid, projectLike.paletteSnapshot);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectLike]);

  return (
    <div className="np-step-body">
      {error && (
        <p className="np-field-error" role="alert">{error}</p>
      )}
      {projectLike && (
        <div className="np-convert-layout">
          {/* Left: stats */}
          <div className="np-convert-stats">
            <MosaicStats project={projectLike} />
          </div>

          {/* Right: preview + controls */}
          <div className="np-convert-preview">
            <div className="np-convert-toolbar">
              {/* Dithering toggle */}
              <div
                className="segmented"
                role="radiogroup"
                aria-label="Dithering"
              >
                <button
                  className={!dithered ? "is-active" : ""}
                  onClick={() => onDitheredChange(false)}
                  role="radio"
                  aria-checked={!dithered}
                >
                  Flat
                </button>
                <button
                  className={dithered ? "is-active" : ""}
                  onClick={() => onDitheredChange(true)}
                  role="radio"
                  aria-checked={dithered}
                >
                  Dithered
                </button>
              </div>

              {/* Mode toggle */}
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
            </div>

            <MosaicPreview
              project={projectLike}
              mode={mode}
              size={480}
            />
          </div>
        </div>
      )}
    </div>
  );
}
