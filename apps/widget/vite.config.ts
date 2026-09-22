import { defineConfig } from "vite";

/**
 * Two distinct build outputs, not one flag-gated bundle — a Phase-1 tenant's
 * shipped JS must contain zero voice/checkout-automation code. See the SRS
 * "Phased delivery & IP protection" section.
 *
 *   pnpm build:text   -> dist/zello-widget.text.js   (Phase 1: text search only)
 *   pnpm build:voice   -> dist/zello-widget.voice.js  (Phase 2+: voice + autonomous checkout)
 *
 * Actual entry points and bundle logic land in a later module — this file
 * only fixes the build target split so the folder structure is correct.
 */
export default defineConfig(({ mode }) => ({
  build: {
    lib: {
      entry:
        mode === "voice"
          ? "src/entry.voice.ts"
          : "src/entry.text.ts",
      name: "ZelloWidget",
      fileName: () => (mode === "voice" ? "zello-widget.voice.js" : "zello-widget.text.js"),
      formats: ["iife"],
    },
    outDir: "dist",
    emptyOutDir: false,
  },
}));
