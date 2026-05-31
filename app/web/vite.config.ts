import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
    },
  },
});
