import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // --- Legacy theme tokens (preserved for backward compatibility) ---
        background: "#0b0b0b",
        panel: "#141414",
        border: "#262626",
        accent: "#DA291C",
        muted: "#8a8a8a",

        // --- Stitch "Pit-Wall Telemetry Workstation" semantic tokens ---
        pitwall: {
          canvas: "#090C10",
          dock: "#111820",
          surface: "#18212A",
          elevated: "#1F2A36",
          hairline: "#283541",
          divider: "#1C2530",
          signal: "#E10600",
          telemetry: {
            DEFAULT: "#00C8E8",
            light: "#62E2FF",
          },
          drs: {
            DEFAULT: "#37D67A",
            light: "#46E183",
          },
          sector: "#B138DD",
          warning: "#FFB020",
          "safety-car": "#FF8C00",
          text: {
            DEFAULT: "#EAF0F5",
            muted: "#95A3AF",
          },
        },

        // Flat aliases for direct utility access (e.g. bg-pitwall-dock, border-pitwall-hairline)
        "pitwall-canvas": "#090C10",
        "pitwall-dock": "#111820",
        "pitwall-surface": "#18212A",
        "pitwall-elevated": "#1F2A36",
        "pitwall-hairline": "#283541",
        "pitwall-divider": "#1C2530",
        "pitwall-signal": "#E10600",
        "pitwall-telemetry": "#00C8E8",
        "pitwall-telemetry-light": "#62E2FF",
        "pitwall-drs": "#37D67A",
        "pitwall-drs-light": "#46E183",
        "pitwall-sector": "#B138DD",
        "pitwall-warning": "#FFB020",
        "pitwall-safety-car": "#FF8C00",
        "pitwall-text": "#EAF0F5",
        "pitwall-text-muted": "#95A3AF",
      },
      fontFamily: {
        display: ['"Barlow Condensed"', '"Arial Narrow"', "sans-serif"],
        telemetry: ['"Space Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"Space Mono"', '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      borderRadius: {
        xl: "1rem",
      },
    },
  },
  plugins: [],
};

export default config;
