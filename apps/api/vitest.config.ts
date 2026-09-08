import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    coverage: {
      provider: "v8",
      // HTTP-exercised surface: app wiring, lib helpers, module layers (router/controller/service/model/middleware).
      include: ["src/app.ts", "src/lib/**/*.ts", "src/modules/**/*.ts"],
      // Narrow exclusions (not production request path / not runtime logic):
      // - main.ts, env.ts: process bootstrap / env parsing
      // - http/quality-db.ts: test-only DB harness
      // - **/types/**, **/constants/**: type-only or compile-time constant modules
      exclude: ["src/**/*.test.ts", "src/modules/**/types/**", "src/modules/**/constants/**"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 60,
        statements: 80,
      },
    },
  },
});
