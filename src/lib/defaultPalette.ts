import type { Color, Palette } from "./types";

/*
  Default Zest palette: 31 commonly-produced LEGO solid plate colors.

  Names use the official LEGO color names (with widely-known nicknames in
  parentheses where they differ from the BrickLink / community naming).
  Hex values match the LDraw LDConfig palette, which is the de-facto
  cross-source reference adopted by BrickLink, Bricklink Studio, Rebrickable,
  and LDraw-compatible renderers.

  legoPartHint is left blank: this app uses 1x1 plates (part 3024) for every
  cell, so the hint is project-level rather than per-color. Creator can
  populate it per color in Settings if desired.
*/

const palette: Color[] = [
  // --- Neutrals -----------------------------------------------------------
  { id: 1,  name: "White",                    hex: "#F4F4F4", legoColorId: "1"   },
  { id: 2,  name: "Light Bluish Gray",        hex: "#A0A5A9", legoColorId: "194" },
  { id: 3,  name: "Dark Bluish Gray",         hex: "#6C6E68", legoColorId: "199" },
  { id: 4,  name: "Black",                    hex: "#1B2A34", legoColorId: "26"  },

  // --- Reds & browns ------------------------------------------------------
  { id: 5,  name: "Bright Red",               hex: "#B40000", legoColorId: "21"  },
  { id: 6,  name: "Dark Red",                 hex: "#720E0F", legoColorId: "154" },
  { id: 7,  name: "Reddish Brown",            hex: "#5C1D0D", legoColorId: "192" },
  { id: 8,  name: "Dark Brown",               hex: "#352100", legoColorId: "308" },

  // --- Oranges & yellows --------------------------------------------------
  { id: 9,  name: "Bright Orange",            hex: "#FE8A18", legoColorId: "106" },
  { id: 10, name: "Dark Orange",              hex: "#A95500", legoColorId: "38"  },
  { id: 11, name: "Bright Light Orange",      hex: "#F8BB3D", legoColorId: "191" },
  { id: 12, name: "Bright Yellow",            hex: "#FAC80A", legoColorId: "24"  },
  { id: 13, name: "Cool Yellow",              hex: "#FFEC6C", legoColorId: "226" },

  // --- Greens -------------------------------------------------------------
  { id: 14, name: "Bright Green",             hex: "#58AB41", legoColorId: "37"  },
  { id: 15, name: "Earth Green",              hex: "#184632", legoColorId: "141" },
  { id: 16, name: "Lime",                     hex: "#BBE90B", legoColorId: "119" },
  { id: 17, name: "Sand Green",               hex: "#A0BCAC", legoColorId: "151" },
  { id: 18, name: "Olive Green",              hex: "#77774E", legoColorId: "330" },

  // --- Blues --------------------------------------------------------------
  { id: 19, name: "Bright Blue",              hex: "#1E5AA8", legoColorId: "23"  },
  { id: 20, name: "Earth Blue",               hex: "#0A3463", legoColorId: "140" },
  { id: 21, name: "Medium Blue",              hex: "#5A93DB", legoColorId: "102" },
  { id: 22, name: "Bright Light Blue",        hex: "#9FC3E9", legoColorId: "212" },
  { id: 23, name: "Sand Blue",                hex: "#6074A1", legoColorId: "135" },
  { id: 24, name: "Dark Azur",                hex: "#469BC3", legoColorId: "321" },
  { id: 25, name: "Medium Azur",              hex: "#68C3E2", legoColorId: "322" },

  // --- Tans & flesh tones -------------------------------------------------
  { id: 26, name: "Brick Yellow (Tan)",       hex: "#E4CD9E", legoColorId: "5"   },
  { id: 27, name: "Sand Yellow (Dark Tan)",   hex: "#958A73", legoColorId: "138" },
  { id: 28, name: "Medium Nougat",            hex: "#CC702A", legoColorId: "312" },
  { id: 29, name: "Nougat",                   hex: "#D09168", legoColorId: "18"  },

  // --- Purples & pinks ----------------------------------------------------
  { id: 30, name: "Bright Pink",              hex: "#FA9CB8", legoColorId: "222" },
  { id: 31, name: "Magenta",                  hex: "#901F76", legoColorId: "124" },
  { id: 32, name: "Medium Lavender",          hex: "#AC78BA", legoColorId: "324" },
];

export const DEFAULT_PALETTE: Palette = {
  id: "zest-default-v1",
  name: "Zest Default",
  colors: palette,
};

/** Reassign ids sequentially 1..N in current order. Pure. */
export function renumber(colors: Color[]): Color[] {
  return colors.map((c, i) => ({ ...c, id: i + 1 }));
}
