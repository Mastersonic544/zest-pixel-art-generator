/*
  projects.ts — persisted project store.
  Wraps localStorage; uses Zustand for reactivity.
*/

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Project } from "@/lib/types";

type ProjectsState = {
  projects: Project[];
  saveProject: (project: Project) => void;
  getProject: (id: string) => Project | undefined;
  deleteProject: (id: string) => void;
};

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: [],

      saveProject: (project) =>
        set((s) => {
          const idx = s.projects.findIndex((p) => p.id === project.id);
          if (idx >= 0) {
            const next = [...s.projects];
            next[idx] = project;
            return { projects: next };
          }
          return { projects: [...s.projects, project] };
        }),

      getProject: (id) => get().projects.find((p) => p.id === id),

      deleteProject: (id) =>
        set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
    }),
    {
      name: "zest.projects.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
