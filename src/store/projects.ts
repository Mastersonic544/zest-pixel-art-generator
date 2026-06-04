/*
  projects.ts — centralized project store.

  When VITE_FIREBASE_PROJECT_ID is set (production):
    - All projects live in Firestore collection "projects".
    - An onSnapshot subscription keeps every open tab / device in sync.
    - saveProject / deleteProject write to Firestore optimistically.

  When Firebase is not configured (local dev without .env.local):
    - Falls back to localStorage so development still works offline.
*/

import { create } from "zustand";
import type { Project } from "@/lib/types";

const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined;
const useFirestore = Boolean(FIREBASE_PROJECT_ID?.trim());

type ProjectsState = {
  projects: Project[];
  /** True while the initial Firestore snapshot is in flight. */
  isLoading: boolean;
  saveProject: (project: Project) => void;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => void;
};

// localStorage helpers for the offline fallback
const LS_KEY = "zest.projects.v1";

function lsLoad(): Project[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { state?: { projects?: Project[] } };
    return parsed?.state?.projects ?? [];
  } catch {
    return [];
  }
}

function lsSave(projects: Project[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ state: { projects }, version: 1 }));
  } catch {
    // storage quota — ignore
  }
}

export const useProjects = create<ProjectsState>()((set, get) => {
  if (useFirestore) {
    // Start the real-time Firestore subscription. Dynamic import so the
    // Firebase SDK is only loaded when actually needed.
    import("@/lib/projectsStorage").then(({ subscribeToProjects }) => {
      subscribeToProjects((projects) => set({ projects, isLoading: false }));
    });
  } else {
    // Synchronously hydrate from localStorage
    const projects = lsLoad();
    setTimeout(() => set({ projects, isLoading: false }), 0);
  }

  return {
    projects: [],
    isLoading: true,

    saveProject: (project) => {
      // Optimistic local update — UI reflects the change immediately
      set((s) => {
        const idx = s.projects.findIndex((p) => p.id === project.id);
        const next = [...s.projects];
        if (idx >= 0) next[idx] = project;
        else next.unshift(project);
        if (!useFirestore) lsSave(next);
        return { projects: next };
      });

      if (useFirestore) {
        import("@/lib/projectsStorage")
          .then(({ upsertProject }) => upsertProject(project))
          .catch((e) => console.error("[projects] saveProject failed:", e));
      }
    },

    getProject: (id) => get().projects.find((p) => p.id === id),

    deleteProject: (id) => {
      set((s) => {
        const projects = s.projects.filter((p) => p.id !== id);
        if (!useFirestore) lsSave(projects);
        return { projects };
      });

      if (useFirestore) {
        import("@/lib/projectsStorage")
          .then(({ removeProject }) => removeProject(id))
          .catch((e) => console.error("[projects] deleteProject failed:", e));
      }
    },
  };
});
