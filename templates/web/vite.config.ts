import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
      "@repo/ui": path.resolve(rootDir, "../../packages/ui/src"),
      "@repo/auth": path.resolve(rootDir, "../../packages/auth/src"),
      "@repo/i18n": path.resolve(rootDir, "../../packages/i18n/src"),
      "@repo/contracts": path.resolve(rootDir, "../../packages/contracts/src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    sourcemap: false,
  },
});
