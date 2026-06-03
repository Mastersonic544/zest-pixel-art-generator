const CLOUD_NAME     = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME     as string;
const UPLOAD_PRESET  = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET  as string;

/**
 * Upload a data URL (base64 image) to Cloudinary.
 * Forces WebP output and stores under the "zest" folder.
 * Returns the HTTPS URL of the uploaded asset.
 */
export async function uploadToCloudinary(dataUrl: string): Promise<string> {
  const fd = new FormData();
  fd.append("file",           dataUrl);
  fd.append("upload_preset",  UPLOAD_PRESET);
  fd.append("format",         "webp");
  fd.append("folder",         "zest");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: fd }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
  }

  const json = (await res.json()) as { secure_url: string };
  return json.secure_url;
}

/** Returns true if the string is a base64 data URL (not yet a remote URL). */
export function isDataUrl(s: string): boolean {
  return s.startsWith("data:");
}
