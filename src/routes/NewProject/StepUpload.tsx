import { useRef, useState } from "react";
import type { SourceImage } from "./imageUtils";
import { loadImageFromFile } from "./imageUtils";

type Props = {
  onImage: (img: SourceImage) => void;
};

const ACCEPT = "image/png,image/jpeg,image/webp";

export default function StepUpload({ onImage }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      setError("Only PNG, JPG, and WEBP files are accepted.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const img = await loadImageFromFile(file);
      onImage(img);
    } catch {
      setError("Could not load the image. Try a different file.");
    } finally {
      setLoading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // reset so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <div className="np-step-body">
      <div
        className={`np-upload-zone${dragging ? " is-dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload image: click or drag a PNG, JPG, or WEBP file"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        {loading ? (
          <span className="np-upload-label">Loading...</span>
        ) : (
          <>
            <span className="np-upload-label">
              {dragging ? "Drop to upload" : "Drag an image here"}
            </span>
            <span className="np-upload-sub">
              or click to browse. PNG, JPG, WEBP.
            </span>
          </>
        )}
      </div>

      {error && (
        <p className="np-field-error" role="alert">{error}</p>
      )}
    </div>
  );
}
