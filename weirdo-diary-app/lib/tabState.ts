import { create } from "zustand";

interface TabState {
  showDashboard: boolean;
  setShowDashboard: (val: boolean) => void;
}

export const useTabStore = create<TabState>((set) => ({
  showDashboard: false,
  setShowDashboard: (val) => set({ showDashboard: val }),
}));
