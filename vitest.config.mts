import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Server-side unit/integration tests only (API routes, lib/*) — no jsdom, no
// component rendering. Playwright (scripts/*.mjs) already covers real
// browser/click verification against a live server; this layer is for logic
// that shouldn't need a running server or an AI call to catch a regression.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
  },
});
