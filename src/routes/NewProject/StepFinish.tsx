import type { BaseplateColor } from "@/lib/types";

type Props = {
  name: string;
  baseplate: BaseplateColor;
  onNameChange: (name: string) => void;
  onBaseplateChange: (b: BaseplateColor) => void;
};

const BASEPLATES: BaseplateColor[] = ["black", "white"];

export default function StepFinish({
  name,
  baseplate,
  onNameChange,
  onBaseplateChange,
}: Props) {
  return (
    <div className="np-step-body">
      <div className="np-finish-form">
        <div className="np-field">
          <label htmlFor="np-proj-name" className="np-field-label">
            Project name
          </label>
          <span className="np-field-help">Used on the dashboard and build page.</span>
          <input
            id="np-proj-name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Untitled project"
            autoFocus
            maxLength={80}
          />
        </div>

        <div className="np-field">
          <span className="np-field-label">Baseplate color</span>
          <span className="np-field-help">
            Ships under the mosaic. Black recedes; white pops.
          </span>
          <div
            className="segmented"
            role="radiogroup"
            aria-label="Baseplate color"
          >
            {BASEPLATES.map((b) => (
              <button
                key={b}
                className={baseplate === b ? "is-active" : ""}
                onClick={() => onBaseplateChange(b)}
                role="radio"
                aria-checked={baseplate === b}
                style={{ textTransform: "capitalize" }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
