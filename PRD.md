# Zest — Product Requirements Document
**Working title:** Zest (LEGO Pixel Art Generator)
**Doc version:** 1.0
**Owner:** [you]
**Status:** Ready for build
**Target stack:** React (Vite) + TypeScript, deployed on Vercel, source on GitHub.

---

## 1. Product summary

Zest is a tool for turning an uploaded image into a buildable LEGO-plate mosaic. A creator uploads artwork, picks a canvas size, and the app quantizes the image to a fixed LEGO color palette and renders it as pixel art. The creator can inspect, hand-edit, and finalize the design. Each finished design produces a shareable build page — accessed via URL or QR code — that walks a builder through assembling the physical mosaic plate-by-plate, with numbered color bags and a baseplate the creator ships as merch.

The product is two halves joined at the QR code: a **creator app** (private, behind the dashboard) and a **builder page** (public, unlisted, read-only).

---

## 2. Goals and non-goals

**Goals (v1)**
- Reliable image → LEGO-palette pixel art with good visual fidelity at small canvas sizes.
- Three inspection modes: Colored, Bricks (stud render), Code (numbered grid).
- A correct, accurate piece-count + per-color bill of materials.
- A manual editing surface (Studio) for fixing palette over-assignment.
- A shareable, scannable build page with three guided assembly modes.
- A palette/color-code system that maps Zest color IDs to real LEGO color names + hex, and that drives the quantization.

**Non-goals (v1)**
- Payments, checkout, order fulfillment, shipping logic.
- Multi-user accounts / auth / teams. (Single-creator app; share pages are unlisted, not authenticated.)
- Native mobile apps.
- Real-time LEGO inventory / sourcing integration.
- Anything beyond 1×1 plate mosaics (no 3D, no bricks of other footprints).

---

## 3. Physical constraints (these are real, do not invent values)

LEGO baseplates ship in fixed stud counts. There is **no 50×50 baseplate.** Official sizes are 16×16, 32×32, and 48×48 studs. Use these three. Do **not** offer 50×50.

| Canvas | Studs | Pieces (1×1 plates) | Real baseplate | Approx physical size |
|---|---|---|---|---|
| Small | 16 × 16 | 256 | 16×16 baseplate | ~5 in / 12.7 cm square |
| Medium | 32 × 32 | 1,024 | 32×32 baseplate | ~10 in / 25 cm square |
| Large | 48 × 48 | 2,304 | 48×48 baseplate | ~15 in / 38 cm square |

Baseplate color offered as merch: black or white (creator picks per project).
Pieces are 1×1 round-stud plates. The "stud" in Bricks mode is the round SNOT-style nub on top of each plate.

> If you later want a true "50×50", it requires tiling multiple baseplates and a seam strategy. Out of scope for v1. Keep the data model size-agnostic (store width/height as integers) so this can expand later.

---

## 4. Color / palette system (the spine of the product)

This is the most important subsystem. Get it right first.

- A **Palette** is an ordered list of **Color** entries.
- Each Color has: `id` (stable integer, 1-indexed, used in Code mode + bags + instructions), `name` (e.g. "Bright Red"), `hex`, `legoColorId` (official LEGO color id, optional), `legoPartHint` (e.g. plate part number, optional).
- The palette is **global** (a Settings-level config), not per-project — but a project stores a snapshot of the palette it was generated against so old projects don't break when the palette changes.
- The palette **drives quantization.** Quantization maps each source pixel to the nearest palette color. Color codes in Code mode, bag numbers, and instruction steps all reference the same `id`. One numbering system, end to end.
- Ship a sensible default palette (~24–36 common LEGO solid plate colors with real names + hex). The creator can edit names/hex/legoColorId in Settings.

---

## 5. Quantization algorithm requirements

1. **Resample** the source image to the target grid (e.g. 32×32). Use area-averaging (box downscale) for the per-cell color, not nearest-neighbor, so each cell reflects the average of the region it covers.
2. **Crop / fit:** target canvas is square; source rarely is. Provide a crop step (default center-crop to square, draggable crop box, plus a "fit with letterbox" option that pads with a chosen palette color).
3. **Quantize** each cell to the nearest palette color. Use perceptual distance (CIEDE2000 or at minimum weighted RGB / Lab distance), not raw Euclidean RGB — raw RGB is what produces the "two reds where one would do" problem.
4. **Dithering toggle (off by default).** Off = flat, poster-like, fewer colors, easier to build. On = Floyd–Steinberg, photo-like, more colors/pieces. Expose as a switch in the conversion step.
5. **Palette-size guard:** after quantization, report how many distinct colors were used and the count per color. Flag colors used in very low counts (e.g. < 4 plates) since those are the prime candidates for the "merge this shade" Studio action.
6. Conversion runs client-side (canvas + typed arrays). No server round-trip needed for v1.

---

## 6. Information architecture / screens

```
/                      Dashboard (KPIs + project list + New)
/project/new           Create flow (upload → crop → size → convert → inspect → studio → finish)
/project/:id           Project detail (preview + 3 toggles + stats + Share)
/build/:shareId        Public build page (unlisted; preview + Play → guided instructions)
/settings              Palette editor, color-code config, defaults
```

### 6.1 Dashboard (`/`)
- KPI strip across the top. Defined KPIs (no filler): **Total projects**, **Total pieces across all projects**, **Most-used color**, **Projects shared**. Each KPI is a number + label + small supporting figure, not a generic card.
- Below: project list (grid or table — see design notes), each item showing a thumbnail of the colored render, name, canvas size, piece count, shared/not status.
- A clearly distinct **New project** affordance (not a tiny "+" hidden in a corner — make it a deliberate entry point).
- Clicking a project → `/project/:id`. Clicking New → `/project/new`.

### 6.2 Create flow (`/project/new`)
Single-page wizard with visible, revisitable steps (not a one-way funnel). Steps:
1. **Upload** — drag/drop or file picker. Accept PNG/JPG/WEBP.
2. **Crop & size** — square crop box over the image; size selector (16/32/48). Size is changeable here and re-derivable later without re-upload.
3. **Convert** — show the pixel-art result. Controls: dithering toggle, mode toggle (Colored / Bricks / Code), stats panel (left). This is also where "looks good?" happens — but merge "confirm" and "edit" so the user is never forced to confirm before tweaking (see UX notes §8).
4. **Studio (optional)** — manual edit surface.
5. **Finish** — name the project, pick baseplate color (black/white), save → lands on `/project/:id`.

### 6.3 The preview component (reused in 6.2, 6.4, and 6.5)
A single reusable `<MosaicPreview>` with three modes:
- **Colored** — each cell filled with its palette hex. Clean, no stud decoration.
- **Bricks** — each cell rendered as a 1×1 plate: base square + centered round stud with a subtle top-light/inner-shadow so it reads as a physical nub. Must stay crisp at 16² and not turn to mush at 48².
- **Code** — each cell shows its color `id` as a number, on a faint tinted background of that color, with a legend mapping id → name + hex swatch.

Stats panel (left of preview): total pieces, distinct colors used, **per-color breakdown** (swatch, id, name, count), estimated physical size, baseplate size + color. Low-count colors visually flagged.

### 6.4 Project detail (`/project/:id`)
- The `<MosaicPreview>` with all three toggles.
- Stats / info panel.
- **Share** button → generates an unlisted `shareId`, shows the public URL and a QR code (rendered client-side). Copy-URL and download-QR actions. Make clear the link is **unlisted** (anyone with the link can view), not password-protected.
- Re-enter Studio to edit (editing a shared project should warn that the live build page will update).

### 6.5 Public build page (`/build/:shareId`)
- Read-only. Opens in its own context ("private window" = a clean, chromeless public view; no dashboard, no editing).
- Shows the `<MosaicPreview>` (Colored / Bricks / Code toggles available to the builder too).
- **Play** button → enters guided assembly. Three instruction modes:
  - **By color** — highlight all cells of color 1, then color 2… For accuracy, pair with a persistent mini-map and a running "color N of M" counter. (By-color is satisfying but easy to lose your place — the mini-map is mandatory, not optional.)
  - **By quarter** — split the grid into 4 quadrants; fill one quadrant fully (and within it, optionally call out colors) before moving on.
  - **By line** — fill row by row (or column), one line highlighted at a time, top to bottom.
- Every guided mode shows: a **"where am I" mini-map** (completed vs. remaining), current step, next/prev, and a progress indicator.
- Bag reference: each color step names the bag number = color `id`.

### 6.6 Settings (`/settings`)
- Palette editor: list of colors, each editable (name, hex, legoColorId, legoPartHint). Add/remove/reorder. Reordering changes `id`s — warn that this affects future generations (existing projects keep their snapshot).
- Defaults: default canvas size, default baseplate color, default dithering on/off.
- Reset palette to shipped default.

---

## 7. Data model

```ts
type Color = {
  id: number;            // 1-indexed, stable within a palette snapshot
  name: string;
  hex: string;           // "#RRGGBB"
  legoColorId?: string;
  legoPartHint?: string;
};

type Palette = {
  id: string;
  name: string;
  colors: Color[];
};

type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;            // studs (16 | 32 | 48 in v1, but stored as int)
  height: number;
  baseplate: "black" | "white";
  dithered: boolean;
  paletteSnapshot: Palette; // frozen copy used to generate this project
  grid: number[];           // length width*height, each value = Color.id
  sourceThumb?: string;     // small data-url for dashboard thumbnail
  shareId?: string;         // present once shared (unlisted)
};

type DerivedStats = {        // computed, not stored
  totalPieces: number;
  distinctColors: number;
  perColor: { id: number; count: number }[];
  lowCountColorIds: number[]; // count < threshold
};
```

**Persistence v1:** browser `localStorage` (or IndexedDB if grids get large — 2,304 ints is fine for localStorage as a packed array). No backend. The build page reads the same store via the `shareId`; since there's no server, "sharing" in a no-backend v1 means the build route reads from local persistence on the same browser/device. **If true cross-device sharing is required for v1, add a minimal serverless KV (e.g. Vercel KV / Upstash) keyed by `shareId` storing the serialized project — call this out and gate it behind one env var.** Decide this early; it changes the share implementation.

---

## 8. UX rules (informed by review — enforce these)

- **No forced linear funnel.** Steps in the create flow are revisitable. Changing canvas size re-derives from the already-uploaded source; never force re-upload.
- **Don't gate editing behind "confirm."** "Looks good" = "I'm done," reached by *leaving* the edit surface, not a checkpoint before it.
- **One numbering system.** Code-mode numbers == bag numbers == instruction color references == `Color.id`. Never diverge.
- **Mini-map is mandatory** in every guided assembly mode.
- **Be honest about "private."** The share link is unlisted, not secured. Label it that way.
- **Low-count color nudge.** In stats and Studio, surface colors used only a few times as merge candidates — this is the direct fix for "two shades of red when not needed."

---

## 9. Studio (manual editor) requirements

- Zoomable, pannable grid; click a cell to repaint it with a chosen palette color (eyedropper + palette picker).
- **Merge colors** action: pick color A → color B, all A cells become B; stats update live. This is the headline Studio feature.
- **Simplify** action: auto-suggest merges for low-count / perceptually-near color pairs; creator approves each.
- Undo/redo.
- Live stats panel reflecting every edit.

---

## 10. Visual / brand direction (explicit anti-"AI-slop" rules)

The UI must not look generated. Enforce in the design system:

- **No em dashes** anywhere in UI copy. Use commas, periods, or restructure.
- **No emojis** in UI, copy, buttons, or empty states.
- **No generic rounded-corner drop-shadow "cards."** If grouping is needed, use spacing, hairline rules, baseline grids, or flat tonal blocks — not the default soft-shadow card.
- **No default AI fonts** (no Inter-as-everything, no system-ui fallback as the whole identity). Choose deliberate type: a strong display/grotesque for headings + a precise mono for the Code mode and stats numbers. (Type that nods to the grid/modular nature of LEGO without being childish.)
- Color: restrained, near-neutral chrome so the mosaic itself is the loudest thing on screen. The artwork supplies the color.
- Layout has structure and intent — strong grid, real alignment, generous negative space, confident typographic hierarchy. Think design tool / pro instrument, not consumer toy.
- Stud rendering in Bricks mode should feel tactile and precise, not a clip-art circle.

> Build the design system first (tokens: type scale, spacing scale, color, line weights) and apply it consistently. Follow the frontend-design skill.

---

## 11. Tech / deployment

- **React + Vite + TypeScript.** React Router for routes in §6.
- Client-side image processing via `<canvas>` and typed arrays. No heavy CV libs needed; nearest-color + optional Floyd–Steinberg by hand.
- QR generation: a small client lib (e.g. `qrcode`).
- State: lightweight (Zustand or React context + reducer). No Redux.
- Persistence: localStorage/IndexedDB; optional Vercel KV for cross-device share (§7).
- **GitHub** repo, **Vercel** deployment (Vite preset). Push to main → preview/prod deploy.
- Keep the converter logic in a pure, unit-testable module (`/src/lib/quantize.ts`) decoupled from React.

---

## 12. Build order (dependency-correct)

1. Repo + Vite + TS + Router + design tokens (no features).
2. Palette system + Settings + default palette.
3. Quantizer module (pure, tested) + crop/resample.
4. `<MosaicPreview>` (3 modes) + stats panel.
5. Create flow wiring (upload → crop → size → convert → finish) + persistence.
6. Dashboard (KPIs + list).
7. Project detail + Share (URL + QR).
8. Public build page + guided assembly (3 modes + mini-map).
9. Studio (repaint, merge, simplify, undo/redo).
10. Polish pass against §10, deploy to Vercel.

---

## 13. Acceptance criteria (v1 "done")

- Upload any image, crop square, pick 16/32/48, get a LEGO-palette mosaic that visibly resembles the source.
- Toggle Colored / Bricks / Code; Code numbers match the legend and stats ids.
- Stats show correct total pieces (= width×height) and a per-color breakdown that sums to the total.
- Save a project; it appears on the dashboard with correct KPIs.
- Share a project; get a working URL + scannable QR; the build page renders read-only.
- On the build page, Play → each of by-color / by-quarter / by-line guides through the full grid with a working mini-map and progress.
- Studio can merge two colors and the stats/preview update live.
- No 50×50 anywhere. No em dashes, no emojis, no generic cards in the shipped UI.
