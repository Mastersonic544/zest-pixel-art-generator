/* Domain types per PRD section 7. */

export type Color = {
  /** 1-indexed within the palette snapshot. Used in Code mode, bag numbers, instructions. */
  id: number;
  name: string;
  /** "#RRGGBB" (uppercase) */
  hex: string;
  /** Official LEGO color id, e.g. "194" for Light Bluish Gray. */
  legoColorId?: string;
  /** Plate part number hint, e.g. "3024" (1x1 plate). */
  legoPartHint?: string;
};

export type Palette = {
  id: string;
  name: string;
  colors: Color[];
};

export type BaseplateColor = "black" | "white";
export type CanvasSize = 16 | 32 | 48;

export type Defaults = {
  canvasSize: CanvasSize;
  baseplate: BaseplateColor;
  dithered: boolean;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  baseplate: BaseplateColor;
  dithered: boolean;
  /** Frozen copy of the palette used to generate this project. */
  paletteSnapshot: Palette;
  /** length = width*height, each value = Color.id within paletteSnapshot. */
  grid: number[];
  sourceThumb?: string;
  shareId?: string;
};

export type DerivedStats = {
  totalPieces: number;
  distinctColors: number;
  perColor: { id: number; count: number }[];
  lowCountColorIds: number[];
};
