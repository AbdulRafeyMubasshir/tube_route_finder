/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // Keep the CRA output folder so the existing Vercel project keeps working.
    outDir: "build",
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/main.tsx", "src/test/**", "src/**/*.test.{ts,tsx}", "src/**/*.bench.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
