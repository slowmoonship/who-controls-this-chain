import { defineConfig } from "vite";

// Relative base so the site works on GitHub Pages project subpaths.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    assetsInlineLimit: 4096,
  },
});
