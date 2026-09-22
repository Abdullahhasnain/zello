import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-hover": "var(--color-surface-hover)",
        border: "var(--color-border)",
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
        "ink-faint": "var(--color-ink-faint)",
        accent: "var(--color-accent)",
        "accent-ink": "var(--color-accent-ink)",
        "accent-soft": "var(--color-accent-soft)",
        accent2: "var(--color-accent2)",
        "accent2-soft": "var(--color-accent2-soft)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        "danger-soft": "var(--color-danger-soft)",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      borderRadius: {
        card: "12px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 18, 27, 0.04), 0 8px 24px rgba(16, 18, 27, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
