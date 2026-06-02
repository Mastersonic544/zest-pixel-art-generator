# Zest

A tool for turning an uploaded image into a buildable LEGO-plate mosaic. A creator uploads artwork, picks a canvas size, and the app quantizes the image to a fixed LEGO color palette and renders it as pixel art. The creator can inspect, hand-edit, and finalize the design. Each finished design produces a shareable build page, accessed via URL or QR code, that walks a builder through assembling the physical mosaic plate by plate.

The product is two halves joined at the QR code: a private creator app and a public, unlisted, read-only builder page.

## Capabilities (v1 scope)

- Image to LEGO-palette pixel art with good fidelity at small canvas sizes.
- Three inspection modes: Colored, Bricks (stud render), Code (numbered grid).
- Accurate piece count and per-color bill of materials.
- A manual editing surface (Studio) for fixing palette over-assignment.
- A shareable, scannable build page with three guided assembly modes (by color, by quarter, by line) and a mandatory mini-map.
- A palette / color-code system that maps Zest color IDs to real LEGO color names and hex values, and that drives quantization.

## Physical constraints

Canvas sizes mirror real LEGO baseplates only: **16 x 16**, **32 x 32**, **48 x 48** studs. There is no 50 x 50 baseplate, so it is not offered. All pieces are 1 x 1 round-stud plates. Baseplate ships in black or white, picked per project.

## Tech

- React 18 + Vite + TypeScript (strict).
- React Router for routes.
- Zustand for state.
- Client-side image processing via `<canvas>` and typed arrays.
- Persistence via `localStorage`. Optional Vercel KV behind one env var for cross-device share.
- Deployed on Vercel with the Vite preset.

## Getting started

```
npm install
npm run dev
```

Then visit `http://localhost:5173`. The dev root currently redirects to `/styleguide`, which renders the design system foundation (type, spacing, color, rules, buttons, a hairline-grouped sample panel).

### Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build
- `npm run typecheck` — type-check only

## Design direction

The chrome stays quiet. The mosaic is the loudest thing on screen.

- Typography pairs **Archivo** (characterful grotesque) with **JetBrains Mono** (precise, slashed zeros, tabular figures). Numbers in the chrome are always mono.
- A warm paper-white background, near-black ink, warm-gray hairlines, and a single zest accent used sparingly for primary action and focus.
- No generic rounded-corner drop-shadow cards. Grouping is done with hairlines, baseline grids, and tonal blocks.
- No emojis, no em dashes, no AI-default fonts.

The full design rules are in `PRD.md` section 10. Foundations live in `src/styles/tokens.css`.

## Project layout

```
src/
  App.tsx                 router
  main.tsx                entry
  store/                  Zustand stores
  routes/
    Styleguide.tsx        design system surface
    Styleguide.css
  styles/
    tokens.css            CSS variables: type, space, color, rules
    global.css            reset + base
```

## Deployment

Vercel auto-detects Vite. No `vercel.json` is required. Push to `main`, the preview and production deploys follow.
