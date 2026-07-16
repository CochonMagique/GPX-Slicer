import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// GPX Slicer — client-only React SPA (no backend).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        // Split the heavy, disjoint vendor trees into their own cacheable
        // chunks instead of one ~880 KB bundle. (React itself stays in the
        // index chunk — listing it here just yields an empty chunk.)
        manualChunks: {
          "vendor-leaflet": ["leaflet", "react-leaflet"],
          "vendor-recharts": ["recharts"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["**/*.spec.{ts,tsx}"],
    exclude: ["node_modules", "dist"],
  },
});
