import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Color, Defaults, Palette } from "@/lib/types";
import { DEFAULT_PALETTE, renumber } from "@/lib/defaultPalette";

const DEFAULTS: Defaults = {
  canvasSize: 32,
  baseplate: "black",
  dithered: false,
};

type SettingsState = {
  palette: Palette;
  defaults: Defaults;

  addColor: (color?: Partial<Omit<Color, "id">>) => void;
  removeColor: (id: number) => void;
  updateColor: (id: number, patch: Partial<Omit<Color, "id">>) => void;
  moveColor: (id: number, dir: -1 | 1) => void;
  resetPalette: () => void;
  renamePalette: (name: string) => void;

  setDefaults: (patch: Partial<Defaults>) => void;
};

function withRenumbered(palette: Palette, colors: Color[]): Palette {
  return { ...palette, colors: renumber(colors) };
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      palette: { ...DEFAULT_PALETTE, colors: renumber(DEFAULT_PALETTE.colors) },
      defaults: DEFAULTS,

      addColor: (color) =>
        set((s) => {
          const next: Color = {
            id: 0, // placeholder, renumber overwrites
            name: color?.name ?? "New Color",
            hex: color?.hex ?? "#CCCCCC",
            ...(color?.legoColorId !== undefined ? { legoColorId: color.legoColorId } : {}),
            ...(color?.legoPartHint !== undefined ? { legoPartHint: color.legoPartHint } : {}),
          };
          return { palette: withRenumbered(s.palette, [...s.palette.colors, next]) };
        }),

      removeColor: (id) =>
        set((s) => ({
          palette: withRenumbered(
            s.palette,
            s.palette.colors.filter((c) => c.id !== id)
          ),
        })),

      updateColor: (id, patch) =>
        set((s) => ({
          palette: {
            ...s.palette,
            colors: s.palette.colors.map((c) =>
              c.id === id ? mergeColor(c, patch) : c
            ),
          },
        })),

      moveColor: (id, dir) =>
        set((s) => {
          const idx = s.palette.colors.findIndex((c) => c.id === id);
          if (idx < 0) return s;
          const target = idx + dir;
          if (target < 0 || target >= s.palette.colors.length) return s;
          const next = [...s.palette.colors];
          const a = next[idx]!;
          const b = next[target]!;
          next[idx] = b;
          next[target] = a;
          return { palette: withRenumbered(s.palette, next) };
        }),

      resetPalette: () =>
        set(() => ({
          palette: { ...DEFAULT_PALETTE, colors: renumber(DEFAULT_PALETTE.colors) },
        })),

      renamePalette: (name) =>
        set((s) => ({ palette: { ...s.palette, name } })),

      setDefaults: (patch) =>
        set((s) => ({ defaults: { ...s.defaults, ...patch } })),
    }),
    {
      name: "zest.settings.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);

/* Helper: merge a partial Color while respecting exactOptionalPropertyTypes.
   Optional keys must be present-or-absent, not set to undefined. */
function mergeColor(base: Color, patch: Partial<Omit<Color, "id">>): Color {
  const next: Color = {
    id: base.id,
    name: patch.name ?? base.name,
    hex: patch.hex ?? base.hex,
  };
  const lci = patch.legoColorId ?? base.legoColorId;
  if (lci !== undefined && lci !== "") next.legoColorId = lci;
  const lph = patch.legoPartHint ?? base.legoPartHint;
  if (lph !== undefined && lph !== "") next.legoPartHint = lph;
  return next;
}

/** "#RRGGBB" validation, case-insensitive. */
export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex.trim());
}
