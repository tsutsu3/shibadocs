import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths, so dist/ can be served from any prefix.
  base: "./",
  build: {
    target: "es2022",
    // The wasm modules live in public/ and are fetched at runtime.
    assetsInlineLimit: 0,
  },
  server: { port: 5273 },
});
