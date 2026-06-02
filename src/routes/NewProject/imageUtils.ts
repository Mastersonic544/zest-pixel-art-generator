/*
  imageUtils.ts — browser-side helpers for the create-flow image pipeline.

  loadImageFromFile:    File -> ImageBitmap (decoded, no canvas yet)
  imageToRGBA:          ImageBitmap -> {data, width, height} using OffscreenCanvas or a <canvas>
  drawCroppedThumb:     crop rect + source bitmap -> small data-URL for the sourceThumb
*/

export type SourceImage = {
  bitmap: ImageBitmap;
  width: number;
  height: number;
  /** Original file object-URL, revoke when done. */
  objectUrl: string;
};

/** Load a File into an ImageBitmap. The returned objectUrl must be revoked by the caller. */
export async function loadImageFromFile(file: File): Promise<SourceImage> {
  const objectUrl = URL.createObjectURL(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`));
    img.src = objectUrl;
  });
  const bitmap = await createImageBitmap(img);
  return { bitmap, width: bitmap.width, height: bitmap.height, objectUrl };
}

/** Read RGBA pixels from an ImageBitmap. */
export function bitmapToRGBA(bitmap: ImageBitmap): {
  data: Uint8ClampedArray;
  width: number;
  height: number;
} {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return { data: imageData.data, width: bitmap.width, height: bitmap.height };
}

/**
 * Draw a crop of the source bitmap into a small data-URL thumbnail.
 * cropRect is in source bitmap pixels.
 */
export function makeCroppedThumb(
  bitmap: ImageBitmap,
  cropX: number,
  cropY: number,
  cropSize: number,
  thumbSize = 128
): string {
  const canvas = document.createElement("canvas");
  canvas.width = thumbSize;
  canvas.height = thumbSize;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(
    bitmap,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    thumbSize,
    thumbSize
  );
  return canvas.toDataURL("image/jpeg", 0.7);
}
