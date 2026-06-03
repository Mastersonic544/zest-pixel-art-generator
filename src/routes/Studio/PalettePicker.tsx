/*
  PalettePicker — color swatch grid + eyedropper toggle in Studio sidebar.
*/

import type { Color } from "@/lib/types";
import type { StudioTool } from "./StudioCanvas";

type Props = {
  colors: Color[];
  /** Color counts from the current grid, for low-count flagging. */
  counts: Map<number, number>;
  selectedColorId: number;
  tool: StudioTool;
  onSelectColor: (id: number) => void;
  onToolChange: (tool: StudioTool) => void;
};

const LOW_COUNT = 4;

export default function PalettePicker({
  colors,
  counts,
  selectedColorId,
  tool,
  onSelectColor,
  onToolChange,
}: Props) {
  return (
    <div className="pp">
      {/* Tool selector */}
      <div className="pp-tools">
        <div className="segmented" role="radiogroup" aria-label="Active tool">
          <button
            className={tool === "paint" ? "is-active" : ""}
            onClick={() => onToolChange("paint")}
            role="radio"
            aria-checked={tool === "paint"}
            title="Paint (click cells to repaint)"
          >
            Paint
          </button>
          <button
            className={tool === "eyedropper" ? "is-active" : ""}
            onClick={() => onToolChange("eyedropper")}
            role="radio"
            aria-checked={tool === "eyedropper"}
            title="Eyedropper (click cell to pick its color)"
          >
            Pick
          </button>
        </div>
      </div>

      {/* Selected color readout */}
      {(() => {
        const sel = colors.find((c) => c.id === selectedColorId);
        if (!sel) return null;
        return (
          <div className="pp-selected">
            <span
              className="pp-selected-chip"
              style={{ background: sel.hex }}
              aria-hidden="true"
            />
            <div className="pp-selected-text">
              <span className="pp-selected-name">{sel.name}</span>
              <span className="pp-selected-meta">
                <span className="num">#{String(sel.id).padStart(2, "0")}</span>
                <span className="pp-selected-hex">{sel.hex}</span>
              </span>
            </div>
          </div>
        );
      })()}

      {/* Swatch grid */}
      <div className="pp-grid" role="listbox" aria-label="Palette colors">
        {colors.map((c) => {
          const count = counts.get(c.id) ?? 0;
          const isLow = count > 0 && count < LOW_COUNT;
          const isSelected = c.id === selectedColorId;
          return (
            <button
              key={c.id}
              className={`pp-swatch${isSelected ? " is-selected" : ""}${isLow ? " is-low" : ""}`}
              style={{ background: c.hex }}
              onClick={() => {
                onSelectColor(c.id);
                onToolChange("paint");
              }}
              role="option"
              aria-selected={isSelected}
              aria-label={`${c.name}, id ${c.id}${isLow ? ", low count" : ""}${count === 0 ? ", unused" : ""}`}
              title={`${c.name} (#${String(c.id).padStart(2, "0")})${count > 0 ? `, ${count} piece${count !== 1 ? "s" : ""}` : " (unused)"}`}
            />
          );
        })}
      </div>
    </div>
  );
}
