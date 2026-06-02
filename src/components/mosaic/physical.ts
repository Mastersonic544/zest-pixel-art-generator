/* Real-world dimensions for a mosaic. */

import type { BaseplateColor } from "@/lib/types";

/**
 * One LEGO stud is 8 mm = 0.8 cm. PRD section 3 gives the rounded
 * approximations 12.7 / 25 / 38 cm for 16/32/48 studs respectively;
 * the values below use the exact stud pitch so non-standard sizes
 * are handled correctly.
 */
const CM_PER_STUD = 0.8;
const IN_PER_CM = 1 / 2.54;

export type PhysicalSize = {
  wCm: number;
  hCm: number;
  wIn: number;
  hIn: number;
};

export function physicalSize(widthStuds: number, heightStuds: number): PhysicalSize {
  const wCm = widthStuds * CM_PER_STUD;
  const hCm = heightStuds * CM_PER_STUD;
  return { wCm, hCm, wIn: wCm * IN_PER_CM, hIn: hCm * IN_PER_CM };
}

export function formatPhysicalSize(widthStuds: number, heightStuds: number): string {
  const { wCm, hCm, wIn, hIn } = physicalSize(widthStuds, heightStuds);
  if (widthStuds === heightStuds) {
    return `~${wIn.toFixed(1)} in / ${wCm.toFixed(1)} cm square`;
  }
  return `~${wIn.toFixed(1)} x ${hIn.toFixed(1)} in / ${wCm.toFixed(1)} x ${hCm.toFixed(1)} cm`;
}

export function baseplateLabel(
  widthStuds: number,
  heightStuds: number,
  color: BaseplateColor
): string {
  return `${widthStuds} x ${heightStuds}, ${color}`;
}
