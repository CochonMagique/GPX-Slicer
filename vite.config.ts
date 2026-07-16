import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GPX Route Splitter — client-only React SPA (no backend).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    // Leaflet + recharts pull in some large deps; raise the warning limit.
    chunkSizeWarningLimit: 1200,
  },
});
