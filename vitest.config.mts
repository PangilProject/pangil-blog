import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // AGENTS.md 코딩 컨벤션: path alias @/ 사용
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["{lib,scripts,app}/**/*.{test,spec}.ts"],
  },
});
