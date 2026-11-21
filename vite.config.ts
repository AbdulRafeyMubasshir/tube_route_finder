/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/** Live status responses: network first, falling back to the last one seen when offline. */
const statusCache = {
  handler: "NetworkFirst" as const,
  options: {
    cacheName: "line-status",
    networkTimeoutSeconds: 4,
    expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 },
  },
};

const pwa = VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["favicon.svg", "favicon.ico", "apple-touch-icon.png"],
  manifest: {
    name: "London Underground Route Finder",
    short_name: "Tube Route",
    description: "Timetabled journeys across the Underground, DLR, Overground and Elizabeth line.",
    start_url: "/",
    display: "standalone",
    theme_color: "#1d4ed8",
    background_color: "#f5f6f8",
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    // The app, network and timetable are all precached, so planning works offline.
    globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
    navigateFallbackDenylist: [/^\/api\//],
    runtimeCaching: [
      { urlPattern: ({ url }) => url.pathname === "/api/status", ...statusCache },
      {
        urlPattern: ({ url }) =>
          url.hostname === "api.tfl.gov.uk" && url.pathname.endsWith("/Status"),
        ...statusCache,
      },
    ],
  },
});

export default defineConfig({
  plugins: [react(), ...(process.env.VITEST ? [] : [pwa])],
  build: {
    // Keep the CRA output folder so the existing Vercel project keeps working.
    outDir: "build",
    // The network (~240 kB, ~50 kB gzipped) is bundled on purpose so the first
    // route can be planned without a request; the timetable is lazy-loaded.
    chunkSizeWarningLimit: 600,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/tfl/**/*.ts", "api/**/*.ts"],
      exclude: ["src/main.tsx", "src/test/**", "**/*.test.{ts,tsx}", "scripts/tfl/types.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
