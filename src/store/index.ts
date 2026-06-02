import { create } from "zustand";

type AppState = {
  ready: boolean;
  markReady: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  ready: false,
  markReady: () => set({ ready: true }),
}));
