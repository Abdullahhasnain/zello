import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "var(--color-ink)",
        accent: "var(--color-accent)",
      },
    },
  },
  plugins: [],
};

export default config;
