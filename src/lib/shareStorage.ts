/*
  shareStorage.ts — abstraction layer for shared-project persistence.

  Backend selection
  -----------------
  When VITE_FIREBASE_PROJECT_ID is set → writes/reads via Firestore.
    - sourceThumb base64 data URLs are uploaded to Cloudinary (WebP) first.
    - Collection: "shares", document ID = shareId.

  When the env var is absent → falls back to localStorage (device-local).
    - Share links only work in the same browser; UI surfaces a clear warning.
*/

import type { Project } from "./types";

export type StorageMode = "local" | "firestore";

export type ShareStorage = {
  mode: StorageMode;
  write: (shareId: string, project: Project) => Promise<void>;
  read: (shareId: string) => Promise<Project | null>;
};

/* ------------------------------------------------------------------ */
/* Firestore + Cloudinary implementation                              */
/* ------------------------------------------------------------------ */

function makeFirestoreStorage(): ShareStorage {
  return {
    mode: "firestore",

    async write(shareId, project) {
      const { db }               = await import("./firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { uploadToCloudinary, isDataUrl } = await import("./cloudinary");

      // Swap base64 thumb for a Cloudinary WebP URL before persisting.
      let thumb = project.sourceThumb;
      if (thumb && isDataUrl(thumb)) {
        try {
          thumb = await uploadToCloudinary(thumb);
        } catch {
          // Non-fatal: store without thumbnail rather than block sharing.
          thumb = undefined;
        }
      }

      await setDoc(doc(db, "shares", shareId), {
        project: { ...project, sourceThumb: thumb },
        createdAt: serverTimestamp(),
      });
    },

    async read(shareId) {
      const { db }        = await import("./firebase");
      const { doc, getDoc } = await import("firebase/firestore");

      const snap = await getDoc(doc(db, "shares", shareId));
      if (!snap.exists()) return null;
      return (snap.data().project as Project) ?? null;
    },
  };
}

/* ------------------------------------------------------------------ */
/* localStorage fallback                                              */
/* ------------------------------------------------------------------ */

const localStorageBackend: ShareStorage = {
  mode: "local",

  async write(shareId, project) {
    try {
      localStorage.setItem(`zest.share.${shareId}`, JSON.stringify(project));
    } catch (e) {
      throw new Error(
        `Failed to save share data locally: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  },

  async read(shareId) {
    try {
      const raw = localStorage.getItem(`zest.share.${shareId}`);
      if (!raw) return null;
      return JSON.parse(raw) as Project;
    } catch {
      return null;
    }
  },
};

/* ------------------------------------------------------------------ */
/* Singleton — resolved once at module load                           */
/* ------------------------------------------------------------------ */

const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;

export const shareStorage: ShareStorage =
  FIREBASE_PROJECT_ID && FIREBASE_PROJECT_ID.trim() !== ""
    ? makeFirestoreStorage()
    : localStorageBackend;

/** True when running without a Firestore backend — share links are device-local. */
export const isLocalShareMode = shareStorage.mode === "local";
