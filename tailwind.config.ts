import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        surface: "#0c1324",
        "surface-dim": "#070d1f",
        "surface-container": "#191f31",
        "surface-container-high": "#23293c",
        "surface-container-highest": "#2e3447",
        "on-surface": "#dce1fb",
        "on-surface-variant": "#c6c6cd",
        primary: "#bec6e0",
        secondary: "#cebdff",
        "secondary-container": "#4f319c",
        tertiary: "#f9bd22",
        outline: "#909097",
        "outline-variant": "#45464d",
        violet: "#a78bfa",
        amber: "#fbbf24"
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Noto Serif SC", "serif"],
        sans: ["var(--font-sans)", "Inter", "sans-serif"]
      },
      boxShadow: {
        vessel: "0 24px 60px -20px rgba(0, 0, 0, 0.85)",
        glow: "0 0 34px rgba(167, 139, 250, 0.35)",
        amber: "0 0 24px rgba(251, 191, 36, 0.25)",
        insetGlow: "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 28px rgba(206,189,255,0.05)"
      },
      maxWidth: {
        vessel: "860px"
      }
    }
  },
  plugins: []
};

export default config;
