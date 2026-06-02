import { Link } from "react-router-dom";
import "./Styleguide.css";

type TypeRow = { token: string; size: string; cls: string; sample: string };
type SpaceRow = { token: string; px: string; rem: string };
type Swatch = { token: string; name: string; hex: string; ink?: "light" | "dark" };
type RuleRow = { token: string; label: string; cls: string };

const typeRows: TypeRow[] = [
  { token: "--t-display-xl", size: "72 / 4.5rem", cls: "t-display-xl", sample: "Zest" },
  { token: "--t-display-l",  size: "56 / 3.5rem", cls: "t-display-l",  sample: "Stud by stud." },
  { token: "--t-display-m",  size: "40 / 2.5rem", cls: "t-display-m",  sample: "Pixel mosaic" },
  { token: "--t-h1",         size: "28 / 1.75rem", cls: "t-h1",        sample: "Project Aurora" },
  { token: "--t-h2",         size: "22 / 1.375rem", cls: "t-h2",       sample: "Per-color breakdown" },
  { token: "--t-h3",         size: "18 / 1.125rem", cls: "t-h3",       sample: "Baseplate, baseline, build" },
  { token: "--t-body-l",     size: "17 / 1.06rem", cls: "t-body-l",    sample: "Each cell maps to a single 1x1 plate." },
  { token: "--t-body",       size: "15 / 0.94rem", cls: "t-body",      sample: "Default body. Reads at length without strain." },
  { token: "--t-body-s",     size: "13 / 0.81rem", cls: "t-body-s",    sample: "Helper text, secondary labels, captions." },
  { token: "--t-caption",    size: "11 / 0.69rem", cls: "t-caption",   sample: "Micro Label Tracked" },
  { token: "--t-stat-xl",    size: "56 mono",      cls: "t-stat-xl",   sample: "2304" },
  { token: "--t-stat-l",     size: "40 mono",      cls: "t-stat-l",    sample: "1024" },
  { token: "--t-stat-m",     size: "24 mono",      cls: "t-stat-m",    sample: "256" },
];

const spaceRows: SpaceRow[] = [
  { token: "--space-1", px: "4", rem: "0.25" },
  { token: "--space-2", px: "8", rem: "0.5" },
  { token: "--space-3", px: "12", rem: "0.75" },
  { token: "--space-4", px: "16", rem: "1" },
  { token: "--space-5", px: "24", rem: "1.5" },
  { token: "--space-6", px: "32", rem: "2" },
  { token: "--space-7", px: "48", rem: "3" },
  { token: "--space-8", px: "64", rem: "4" },
  { token: "--space-9", px: "96", rem: "6" },
  { token: "--space-10", px: "128", rem: "8" },
];

const swatches: Swatch[] = [
  { token: "--paper",      name: "Paper",      hex: "#F4F2EC" },
  { token: "--paper-2",    name: "Paper / 2",  hex: "#EBE8E0" },
  { token: "--surface",    name: "Surface",    hex: "#FFFFFF" },
  { token: "--ink",        name: "Ink",        hex: "#0A0A08", ink: "light" },
  { token: "--ink-2",      name: "Ink / 2",    hex: "#3A3A36", ink: "light" },
  { token: "--ink-3",      name: "Ink / 3",    hex: "#76746D", ink: "light" },
  { token: "--ink-4",      name: "Ink / 4",    hex: "#A8A59C" },
  { token: "--hairline",   name: "Hairline",   hex: "#D8D4C8" },
  { token: "--hairline-2", name: "Hairline / 2", hex: "#E6E2D6" },
  { token: "--accent",     name: "Zest",       hex: "#FF5A1F", ink: "light" },
  { token: "--accent-faint", name: "Zest / faint", hex: "#FFE9DC" },
  { token: "--warn",       name: "Warn",       hex: "#C7762A", ink: "light" },
];

const ruleRows: RuleRow[] = [
  { token: "--w-hair (1px)",   label: "Hairline rule, default separator", cls: "rule-hair" },
  { token: "--w-thin (1.5px)", label: "Thin emphasis rule",               cls: "rule-thin" },
  { token: "--w-thick (2px)",  label: "Section bracket",                   cls: "rule-thick" },
  { token: "--w-heavy (3px)",  label: "Reserved for active states only",   cls: "rule-heavy" },
];

const sampleColors: { id: number; name: string; hex: string; count: number; low?: boolean }[] = [
  { id: 1,  name: "Black",          hex: "#1B1B1B", count: 412 },
  { id: 4,  name: "Bright Red",     hex: "#C91A09", count: 187 },
  { id: 11, name: "Cool Yellow",    hex: "#FFE383", count: 96 },
  { id: 17, name: "Medium Azur",    hex: "#71C5E8", count: 64 },
  { id: 23, name: "Dark Orange",    hex: "#A95500", count: 12 },
  { id: 28, name: "Sand Green",     hex: "#A0BCAC", count: 3, low: true },
];

export default function Styleguide() {
  return (
    <div className="sg-page">
      <div className="container">
        <header className="sg-mast">
          <h1 className="sg-mast-title">Zest <span style={{ color: "var(--ink-3)", fontWeight: 500 }}>/ Design System</span></h1>
          <div className="sg-mast-meta">
            <span>Version</span><span>0.1</span>
            <span>Date</span><span>2026.06.02</span>
            <span>Scope</span><span>Foundations</span>
          </div>
        </header>

        {/* 1.0 Typography */}
        <section className="sg-section">
          <div className="sg-section-num">
            01<strong>Typography</strong>
          </div>
          <div>
            <p className="t-body-s" style={{ maxWidth: "44ch", marginBottom: "var(--space-5)" }}>
              Two families. Archivo for sans, headings, and UI. JetBrains Mono for stats, color codes, and instrument numerals. Numbers in the chrome are always mono.
            </p>
            <div>
              {typeRows.map((r) => (
                <div className="sg-type-row" key={r.token}>
                  <span className="sg-type-token">{r.token}</span>
                  <span className="sg-type-size">{r.size}</span>
                  <span className={`sg-type-sample ${r.cls}`}>{r.sample}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2.0 Spacing */}
        <section className="sg-section">
          <div className="sg-section-num">
            02<strong>Spacing</strong>
          </div>
          <div>
            <p className="t-body-s" style={{ maxWidth: "44ch", marginBottom: "var(--space-5)" }}>
              A 4px base scale. Larger steps are intentionally sparse so layouts breathe at the page level.
            </p>
            <div>
              {spaceRows.map((s) => (
                <div className="sg-space-row" key={s.token}>
                  <span className="sg-type-token">{s.token}</span>
                  <span className="sg-type-size">{s.px}px / {s.rem}r</span>
                  <span className="sg-space-bar" style={{ width: `${s.px}px` }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3.0 Color */}
        <section className="sg-section">
          <div className="sg-section-num">
            03<strong>Color</strong>
          </div>
          <div>
            <p className="t-body-s" style={{ maxWidth: "44ch", marginBottom: "var(--space-5)" }}>
              Restrained, warm near-neutral chrome. Zest is the single accent and is used sparingly for primary action and focus only. Warn appears only on low-count color flags.
            </p>
            <div className="sg-colors">
              {swatches.map((c) => (
                <div className="sg-swatch" key={c.token}>
                  <div
                    className="sg-swatch-color"
                    style={{
                      background: `var(${c.token})`,
                      color: c.ink === "light" ? "var(--paper)" : "var(--ink)",
                    }}
                  />
                  <div className="sg-swatch-meta">
                    <span className="sg-swatch-name">{c.name}</span>
                    <span className="sg-swatch-token">{c.token}</span>
                    <span className="sg-swatch-hex">{c.hex}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4.0 Rules */}
        <section className="sg-section">
          <div className="sg-section-num">
            04<strong>Rules</strong>
          </div>
          <div>
            <p className="t-body-s" style={{ maxWidth: "44ch", marginBottom: "var(--space-5)" }}>
              Hairlines do the work that drop shadows usually do. Lines group; spacing separates.
            </p>
            <div>
              {ruleRows.map((r) => (
                <div className="sg-rule-row" key={r.token}>
                  <span className="sg-type-token">{r.token}</span>
                  <span className="sg-type-size">{r.cls === "rule-hair" ? "default" : ""}</span>
                  <span
                    className="sg-rule-sample"
                    style={{
                      borderTop:
                        r.cls === "rule-hair"
                          ? "var(--rule-hair)"
                          : r.cls === "rule-thin"
                          ? "1.5px solid var(--ink)"
                          : r.cls === "rule-thick"
                          ? "var(--rule-thick)"
                          : "3px solid var(--ink)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5.0 Buttons */}
        <section className="sg-section">
          <div className="sg-section-num">
            05<strong>Buttons</strong>
          </div>
          <div>
            <p className="t-body-s" style={{ maxWidth: "44ch", marginBottom: "var(--space-5)" }}>
              Square corners. Hairline borders. One accent variant per page maximum.
            </p>
            <div className="sg-btn-row">
              <button className="btn btn-primary">New project</button>
              <button className="btn">Secondary</button>
              <button className="btn btn-accent">Share</button>
              <button className="btn btn-ghost">Cancel</button>
              <button className="btn btn-disabled" disabled>Disabled</button>
            </div>
            <div className="sg-btn-row">
              <button className="btn btn-tiny btn-primary">Convert</button>
              <button className="btn btn-tiny">Studio</button>
              <button className="btn btn-tiny btn-ghost">Reset</button>
            </div>
          </div>
        </section>

        {/* 6.0 Sample hairline-grouped block */}
        <section className="sg-section">
          <div className="sg-section-num">
            06<strong>Sample</strong>
          </div>
          <div>
            <p className="t-body-s" style={{ maxWidth: "44ch", marginBottom: "var(--space-5)" }}>
              A stats panel rendered with the tokens. Grouping is achieved by hairlines and grid alignment. No cards, no shadows.
            </p>

            <div className="sg-panel">
              <div>
                <div className="sg-panel-eyebrow">Total pieces</div>
                <div className="sg-panel-figure">2,304</div>
                <div className="sg-panel-supp">48 by 48 studs. Approx 15 in / 38 cm square.</div>
              </div>
              <div>
                <div className="sg-panel-eyebrow">Distinct colors</div>
                <div className="sg-panel-figure">14</div>
                <div className="sg-panel-supp">2 colors flagged as low count.</div>
              </div>
            </div>

            <div style={{ height: "var(--space-7)" }} />

            <div className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Per-color breakdown</div>
            <div className="sg-rowset">
              {sampleColors.map((c) => (
                <div className="sg-row" key={c.id}>
                  <span className="sg-row-id">#{String(c.id).padStart(2, "0")}</span>
                  <span className="sg-row-chip" style={{ background: c.hex }} />
                  <span className="sg-row-name">{c.name}</span>
                  <span className="sg-row-count">{c.count}</span>
                  {c.low ? (
                    <span className="sg-row-flag">Low</span>
                  ) : (
                    <span className="sg-row-flag sg-row-flag-empty">Low</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer style={{ marginTop: "var(--space-8)", paddingTop: "var(--space-5)", borderTop: "var(--rule-ink)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="crosslinks">
              <Link to="/settings">Settings</Link>
            </div>
            <span className="num" style={{ color: "var(--ink-3)", fontSize: "var(--t-body-s)" }}>ZEST &middot; 2026</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
