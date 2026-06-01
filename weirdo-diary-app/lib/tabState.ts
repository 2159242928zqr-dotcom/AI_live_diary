import { create } from "zustand";
import { getAppTheme, saveAppTheme } from "./storage";

interface TabState {
  showDashboard: boolean;
  setShowDashboard: (val: boolean) => void;
}

export const useTabStore = create<TabState>((set) => ({
  showDashboard: false,
  setShowDashboard: (val) => set({ showDashboard: val }),
}));

interface ThemeState {
  theme: "stellar" | "kraft";
  setTheme: (val: "stellar" | "kraft") => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: "stellar",
  setTheme: async (val) => {
    set({ theme: val });
    await saveAppTheme(val);
  },
  loadTheme: async () => {
    const t = await getAppTheme();
    set({ theme: t as any });
  }
}));
