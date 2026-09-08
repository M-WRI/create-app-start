import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      include: [
        "src/api/**/*.ts",
        "src/utils/**/*.ts",
        "src/constants/**/*.ts",
        "src/hooks/**/*.{ts,tsx}",
        "src/components/**/component/*.{ts,tsx}",
        "src/pages/**/component/*.{ts,tsx}",
      ],
      // Barrels (**/index.ts) and package entry are type/re-export only — exclude from floors.
      exclude: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/index.ts", "src/index.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
