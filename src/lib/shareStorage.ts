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

/** Recursively remove undefined values so Firestore never sees them. */
function stripUndefined(val: unknown): unknown {
  if (val === null || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripUndefined);
  return Object.fromEntries(
    Object.entries(val as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, stripUndefined(v)])
  );
}

function makeFirestoreStorage(): ShareStorage {
  return {
    mode: "firestore",

    async write(shareId, project) {
      const { db } = await import("./firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");

      // sourceThumb is a base64 data URL — too large for Firestore and not
      // rendered on the build page. Destructure it out, then recursively
      // strip any remaining undefined optional fields (legoColorId, etc.)
      // before writing so Firestore never receives an unsupported undefined.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { sourceThumb: _omit, ...projectWithoutThumb } = project;
      const projectDoc = stripUndefined(projectWithoutThumb);

      await setDoc(doc(db, "shares", shareId), {
        project: projectDoc,
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
