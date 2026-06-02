/*
  SharePanel — inline share UI for /project/:id.

  Responsibilities:
  - Generate a shareId (random, stable once created).
  - Write the project to shareStorage (local or KV).
  - Render the /build/:shareId URL with copy-URL action.
  - Render a client-side QR code with download action.
  - Surface honest labelling: unlisted, not password-protected.
  - Show a device-local warning when KV is not configured.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { shareStorage, isLocalShareMode } from "@/lib/shareStorage";
import type { Project } from "@/lib/types";
import "./SharePanel.css";

type Phase = "idle" | "generating" | "ready" | "error";

type Props = {
  project: Project;
  /** Called with the updated project (shareId attached) after a successful write. */
  onShared: (updated: Project) => void;
};

function newShareId(): string {
  // 10 random base-36 chars — short enough to type, long enough to be unguessable.
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => (b % 36).toString(36))
    .join("");
}

function buildUrl(shareId: string): string {
  return `${window.location.origin}/build/${shareId}`;
}

export default function SharePanel({ project, onShared }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(
    project.shareId ?? null
  );
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const url = shareId ? buildUrl(shareId) : null;

  // If the project already has a shareId, render the QR immediately.
  useEffect(() => {
    if (project.shareId && !qrDataUrl) {
      renderQr(buildUrl(project.shareId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.shareId]);

  async function renderQr(target: string) {
    try {
      const dataUrl = await QRCode.toDataURL(target, {
        width: 256,
        margin: 2,
        color: { dark: "#0A0A08", light: "#F4F2EC" },
        errorCorrectionLevel: "M",
      });
      setQrDataUrl(dataUrl);
    } catch {
      // QR failure is non-fatal; URL copy still works.
    }
  }

  const handleGenerate = useCallback(async () => {
    setPhase("generating");
    setError(null);
    try {
      const id = project.shareId ?? newShareId();
      const updated: Project = { ...project, shareId: id };
      await shareStorage.write(id, updated);
      setShareId(id);
      onShared(updated);
      await renderQr(buildUrl(id));
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Share failed. Try again.");
      setPhase("error");
    }
  }, [project, onShared]);

  // Auto-generate if this project was already shared (re-opening panel).
  const alreadyShared = Boolean(project.shareId);
  useEffect(() => {
    if (alreadyShared && phase === "idle" && !qrDataUrl) {
      handleGenerate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — URL is visible for manual copy */
    }
  }

  function handleDownloadQr() {
    if (!qrDataUrl || !shareId) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `zest-${shareId}.png`;
    a.click();
  }

  return (
    <div className="sp">
      {/* Honesty notice — always visible */}
      <div className="sp-notice">
        <span className="sp-notice-tag">Unlisted</span>
        <span>
          Anyone with this link can view the build page. The link is not
          password-protected. There is no access list.
          {isLocalShareMode && (
            <strong className="sp-local-warn">
              {" "}This link only works in this browser. To share across devices,
              configure <code>VITE_SHARE_KV_URL</code>.
            </strong>
          )}
        </span>
      </div>

      {phase === "idle" && !alreadyShared && (
        <div className="sp-generate">
          <p className="sp-generate-copy">
            Generating a share link writes a snapshot of this project so the
            build page can read it. The snapshot updates each time you reshare.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
          >
            Generate share link
          </button>
        </div>
      )}

      {phase === "generating" && (
        <p className="sp-status">Writing share data...</p>
      )}

      {phase === "error" && (
        <div className="sp-error" role="alert">
          <span className="sp-error-tag">Error</span>
          <span>{error}</span>
          <button className="btn btn-tiny" onClick={handleGenerate}>
            Retry
          </button>
        </div>
      )}

      {(phase === "ready" || alreadyShared) && url && (
        <div className="sp-ready">
          {/* URL row */}
          <div className="sp-url-row">
            <input
              className="input input-mono sp-url-input"
              value={url}
              readOnly
              aria-label="Share URL"
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn sp-copy-btn"
              onClick={handleCopy}
              aria-label="Copy share URL"
            >
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>

          {/* QR code */}
          {qrDataUrl ? (
            <div className="sp-qr-block">
              <div className="sp-qr-frame">
                <img
                  src={qrDataUrl}
                  alt={`QR code for ${url}`}
                  width={128}
                  height={128}
                  className="sp-qr-img"
                />
              </div>
              <div className="sp-qr-actions">
                <button
                  className="btn btn-tiny"
                  onClick={handleDownloadQr}
                >
                  Download QR
                </button>
                <span className="sp-qr-hint">
                  Scan to open the build page on any device
                  {isLocalShareMode ? " (same browser only)" : ""}.
                </span>
              </div>
            </div>
          ) : (
            <p className="sp-status">Rendering QR code...</p>
          )}
        </div>
      )}
    </div>
  );
}
