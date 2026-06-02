import { useState } from "react";
import { Link } from "react-router-dom";
import { useSettings, isValidHex } from "@/store/settings";
import type { CanvasSize, BaseplateColor } from "@/lib/types";
import "./Settings.css";

const CANVAS_SIZES: CanvasSize[] = [16, 32, 48];
const BASEPLATES: BaseplateColor[] = ["black", "white"];

export default function Settings() {
  const palette = useSettings((s) => s.palette);
  const defaults = useSettings((s) => s.defaults);
  const addColor = useSettings((s) => s.addColor);
  const removeColor = useSettings((s) => s.removeColor);
  const updateColor = useSettings((s) => s.updateColor);
  const moveColor = useSettings((s) => s.moveColor);
  const resetPalette = useSettings((s) => s.resetPalette);
  const renamePalette = useSettings((s) => s.renamePalette);
  const setDefaults = useSettings((s) => s.setDefaults);

  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="page">
      <div className="container">
        <header className="masthead">
          <h1 className="masthead-title">
            Settings <span className="masthead-title-sub">/ Palette and defaults</span>
          </h1>
          <div className="masthead-meta">
            <span>Colors</span>
            <span>{String(palette.colors.length).padStart(2, "0")}</span>
            <span>Persistence</span>
            <span>localStorage</span>
            <span>Scope</span>
            <span>Global</span>
          </div>
        </header>

        {/* 01 Palette */}
        <section className="section">
          <div className="section-num">
            01<strong>Palette</strong>
          </div>
          <div>
            <p className="section-note">
              The palette is global and drives quantization. Each color id is also the bag
              number and the value used in Code mode. Add, edit, reorder, or remove rows.
            </p>

            <div className="notice">
              <span className="notice-tag">Heads up</span>
              <span>
                Reordering or removing colors re-numbers ids. Existing projects keep
                their palette snapshot, so this only affects future generations.
              </span>
            </div>

            <div className="sx-toolbar">
              <div className="sx-toolbar-left">
                <input
                  className="sx-pname"
                  value={palette.name}
                  onChange={(e) => renamePalette(e.target.value)}
                  aria-label="Palette name"
                />
                <span className="sx-count">
                  {String(palette.colors.length).padStart(2, "0")} colors
                </span>
              </div>
              <div className="sx-toolbar-right">
                {confirmReset ? (
                  <>
                    <span className="sx-count" style={{ marginRight: "var(--space-2)" }}>
                      Replace palette with the shipped default?
                    </span>
                    <button
                      className="btn btn-tiny btn-danger"
                      onClick={() => {
                        resetPalette();
                        setConfirmReset(false);
                      }}
                    >
                      Yes, reset
                    </button>
                    <button
                      className="btn btn-tiny btn-ghost"
                      onClick={() => setConfirmReset(false)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-tiny"
                    onClick={() => setConfirmReset(true)}
                  >
                    Reset to default
                  </button>
                )}
              </div>
            </div>

            <div className="sx-table" role="table" aria-label="Palette editor">
              <div className="sx-head" role="row">
                <div style={{ textAlign: "right" }}>ID</div>
                <div></div>
                <div>Name</div>
                <div>Hex</div>
                <div>LEGO ID</div>
                <div>Part hint</div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              {palette.colors.map((c, i) => {
                const hexValid = isValidHex(c.hex);
                return (
                  <div className="sx-row" key={`${c.id}-${i}`} role="row">
                    <div className="sx-id">{String(c.id).padStart(2, "0")}</div>

                    <input
                      type="color"
                      className="sx-swatch"
                      value={hexValid ? c.hex : "#000000"}
                      onChange={(e) =>
                        updateColor(c.id, { hex: e.target.value.toUpperCase() })
                      }
                      aria-label={`Swatch for ${c.name}`}
                    />

                    <div className="sx-name-cell">
                      <input
                        className="input"
                        value={c.name}
                        onChange={(e) => updateColor(c.id, { name: e.target.value })}
                        aria-label="Name"
                      />
                    </div>

                    <div className="sx-hex-cell">
                      <input
                        className={`input input-mono input-uppercase${
                          hexValid ? "" : " is-invalid"
                        }`}
                        value={c.hex}
                        onChange={(e) =>
                          updateColor(c.id, { hex: e.target.value.toUpperCase() })
                        }
                        spellCheck={false}
                        aria-label="Hex"
                        aria-invalid={!hexValid}
                      />
                    </div>

                    <div className="sx-lid-cell">
                      <input
                        className="input input-mono"
                        value={c.legoColorId ?? ""}
                        onChange={(e) =>
                          updateColor(c.id, { legoColorId: e.target.value })
                        }
                        placeholder="-"
                        spellCheck={false}
                        aria-label="LEGO color id"
                      />
                    </div>

                    <div className="sx-part-cell">
                      <input
                        className="input input-mono"
                        value={c.legoPartHint ?? ""}
                        onChange={(e) =>
                          updateColor(c.id, { legoPartHint: e.target.value })
                        }
                        placeholder="-"
                        spellCheck={false}
                        aria-label="Part hint"
                      />
                    </div>

                    <button
                      className="btn btn-tiny btn-icon sx-mv-up"
                      onClick={() => moveColor(c.id, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${c.name} up`}
                      title="Move up"
                    >
                      &#8593;
                    </button>
                    <button
                      className="btn btn-tiny btn-icon sx-mv-down"
                      onClick={() => moveColor(c.id, 1)}
                      disabled={i === palette.colors.length - 1}
                      aria-label={`Move ${c.name} down`}
                      title="Move down"
                    >
                      &#8595;
                    </button>
                    <button
                      className="btn btn-tiny btn-icon sx-rm"
                      onClick={() => removeColor(c.id)}
                      aria-label={`Remove ${c.name}`}
                      title="Remove"
                      disabled={palette.colors.length <= 1}
                    >
                      &times;
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="sx-add">
              <button
                className="btn"
                onClick={() => addColor()}
              >
                + Add color
              </button>
            </div>
          </div>
        </section>

        {/* 02 Defaults */}
        <section className="section">
          <div className="section-num">
            02<strong>Defaults</strong>
          </div>
          <div>
            <p className="section-note">
              Used as the starting values whenever a new project is created. Per-project
              settings can still be changed in the create flow.
            </p>

            <div className="field">
              <div className="field-label">
                <span className="field-label-title">Canvas size</span>
                <span className="field-label-help">Stud count per side. Real baseplate.</span>
              </div>
              <div className="field-control">
                <div className="segmented segmented-mono" role="radiogroup" aria-label="Default canvas size">
                  {CANVAS_SIZES.map((sz) => (
                    <button
                      key={sz}
                      className={defaults.canvasSize === sz ? "is-active" : ""}
                      onClick={() => setDefaults({ canvasSize: sz })}
                      role="radio"
                      aria-checked={defaults.canvasSize === sz}
                    >
                      {sz} x {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                <span className="field-label-title">Baseplate color</span>
                <span className="field-label-help">Ships under the mosaic.</span>
              </div>
              <div className="field-control">
                <div className="segmented" role="radiogroup" aria-label="Default baseplate color">
                  {BASEPLATES.map((c) => (
                    <button
                      key={c}
                      className={defaults.baseplate === c ? "is-active" : ""}
                      onClick={() => setDefaults({ baseplate: c })}
                      role="radio"
                      aria-checked={defaults.baseplate === c}
                      style={{ textTransform: "capitalize" }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="field">
              <div className="field-label">
                <span className="field-label-title">Dithering</span>
                <span className="field-label-help">
                  Off: flat, fewer colors, easier to build. On: Floyd-Steinberg, photo-like.
                </span>
              </div>
              <div className="field-control">
                <div className="segmented" role="radiogroup" aria-label="Default dithering">
                  <button
                    className={!defaults.dithered ? "is-active" : ""}
                    onClick={() => setDefaults({ dithered: false })}
                    role="radio"
                    aria-checked={!defaults.dithered}
                  >
                    Off
                  </button>
                  <button
                    className={defaults.dithered ? "is-active" : ""}
                    onClick={() => setDefaults({ dithered: true })}
                    role="radio"
                    aria-checked={defaults.dithered}
                  >
                    On
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="sx-foot">
          <div className="crosslinks">
            <Link to="/styleguide">Styleguide</Link>
          </div>
          <span className="num" style={{ color: "var(--ink-3)", fontSize: "var(--t-body-s)" }}>
            ZEST &middot; 2026
          </span>
        </footer>
      </div>
    </div>
  );
}
