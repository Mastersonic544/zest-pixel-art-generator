/*
  shareStorage.ts — abstraction layer for shared-project persistence.

  PRD §7: "structure the share read/write behind a single storage interface
  so a Vercel KV / Upstash backend can be dropped in behind one env var."

  Interface
  ---------
  ShareStorage.write(shareId, project)  — persist a project under a share key
  ShareStorage.read(shareId)            — retrieve a project by share key
  ShareStorage.mode                     — "local" | "kv"

  Backend selection
  -----------------
  Set VITE_SHARE_KV_URL to the base URL of a Vercel KV / Upstash REST
  endpoint to enable cross-device sharing. When the var is absent (default),
  the local implementation stores the serialised project in localStorage keyed
  by "zest.share.<shareId>". The local mode is read-only on other
  devices/browsers; the UI surfaces a clear note about this.

  KV REST contract (Vercel KV / Upstash)
  ---------------------------------------
  POST  ${VITE_SHARE_KV_URL}/set/<key>     body: JSON.stringify(project)
  GET   ${VITE_SHARE_KV_URL}/get/<key>     response: { result: <project JSON> | null }

  The VITE_SHARE_KV_REST_API_TOKEN env var carries the bearer token when set.
*/

import type { Project } from "./types";

export type StorageMode = "local" | "kv";

export type ShareStorage = {
  mode: StorageMode;
  write: (shareId: string, project: Project) => Promise<void>;
  read: (shareId: string) => Promise<Project | null>;
};

/* ------------------------------------------------------------------ */
/* Local (localStorage) implementation                                */
/* ------------------------------------------------------------------ */

function shareKey(shareId: string): string {
  return `zest.share.${shareId}`;
}

const localStorage_: ShareStorage = {
  mode: "local",

  async write(shareId, project) {
    try {
      localStorage.setItem(shareKey(shareId), JSON.stringify(project));
    } catch (e) {
      throw new Error(
        `Failed to save share data locally: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  },

  async read(shareId) {
    try {
      const raw = localStorage.getItem(shareKey(shareId));
      if (!raw) return null;
      return JSON.parse(raw) as Project;
    } catch {
      return null;
    }
  },
};

/* ------------------------------------------------------------------ */
/* KV REST implementation (Vercel KV / Upstash)                       */
/* ------------------------------------------------------------------ */

function makeKvStorage(baseUrl: string, token: string | undefined): ShareStorage {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return {
    mode: "kv",

    async write(shareId, project) {
      const url = `${baseUrl}/set/${encodeURIComponent(shareKey(shareId))}`;
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ value: JSON.stringify(project) }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`KV write failed (${res.status}): ${text}`);
      }
    },

    async read(shareId) {
      const url = `${baseUrl}/get/${encodeURIComponent(shareKey(shareId))}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 404) return null;
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`KV read failed (${res.status}): ${text}`);
      }
      const json = (await res.json()) as { result?: string | null };
      if (!json.result) return null;
      try {
        return JSON.parse(json.result) as Project;
      } catch {
        return null;
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Singleton — resolved once at module load                           */
/* ------------------------------------------------------------------ */

const KV_URL = import.meta.env.VITE_SHARE_KV_URL as string | undefined;
const KV_TOKEN = import.meta.env.VITE_SHARE_KV_REST_API_TOKEN as string | undefined;

export const shareStorage: ShareStorage =
  KV_URL && KV_URL.trim() !== ""
    ? makeKvStorage(KV_URL.trim(), KV_TOKEN)
    : localStorage_;

/** True when running without a KV backend — share links are device-local. */
export const isLocalShareMode = shareStorage.mode === "local";
